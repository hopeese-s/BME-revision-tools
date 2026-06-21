// ============================================================================
// EgBE Memory & Revision Engine — Study Session Store (Zustand)
//
// Manages the active study session state: card queue, scheduling,
// FSRS-5 integration, review logging, and streak tracking.
//
// Flow:
//  1. loadSession(moduleId) → fetch due + new cards
//  2. Interleave flashcards, equations, occlusion, and scenarios
//  3. Present one card at a time
//  4. On rating → FSRS-5 schedules next review → log → next card
//  5. Session ends when queue is empty or user taps "Complete"
// ============================================================================

import { create } from 'zustand';
import { getDb } from '@/lib/db';
import {
  createEmptyCard,
  gradeCard,
  type FSRSCard,
  type FSRSRating,
} from '@/lib/fsrs';
import type {
  CardReview,
  Flashcard,
  EquationBank,
  OcclusionSet,
  Scenario,
  ReviewLog,
  StudySession,
  SrsState,
  UUID,
} from '@/types/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardSource = 'flashcard' | 'equation' | 'occlusion' | 'scenario';

export interface QueuedCard {
  source: CardSource;
  data: Flashcard | EquationBank | OcclusionSet | Scenario;
  fsrsCard: FSRSCard;
  review: CardReview | null; // Existing review, if due
}

export type SessionStatus = 'idle' | 'active' | 'paused' | 'complete';

export interface StudySessionStore {
  // Session state
  status: SessionStatus;
  currentSessionId: UUID | null;
  moduleId: UUID | null;
  moduleTitle: string;
  isLoading: boolean;

  // Card queue
  queue: QueuedCard[];
  currentIndex: number;
  totalCards: number;
  remainingCards: number;

  // Current card
  currentCard: QueuedCard | null;
  isFlipped: boolean;

  // Cram Mode
  isCramMode: boolean;

  // Session stats
  sessionStartTime: number | null;
  cardsReviewed: number;
  streak: number; // consecutive correct
  longStreak: number; // all-time streak from DB
  averageRating: number;

  // Actions
  loadSession: (moduleId: UUID, moduleTitle: string, cramMode?: boolean) => Promise<void>;
  flipCard: () => void;
  rateCard: (rating: FSRSRating) => Promise<void>;
  nextCard: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => Promise<void>;
  resetSession: () => void;

  // Computed
  getProgress: () => { completed: number; total: number; percentage: number };
  getNextCard: () => QueuedCard | null;
}

// ---------------------------------------------------------------------------
// Helper: Shuffle array (Fisher-Yates)
// ---------------------------------------------------------------------------

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Helper: generate a UUID v4 (crypto.randomUUID not available in all envs)
// ---------------------------------------------------------------------------

function generateUUID(): UUID {
  return crypto.randomUUID() as UUID;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStudySessionStore = create<StudySessionStore>()((set, get) => ({
  // Initial state
  status: 'idle',
  currentSessionId: null,
  moduleId: null,
  moduleTitle: '',
  isLoading: false,

  queue: [],
  currentIndex: 0,
  totalCards: 0,
  remainingCards: 0,

  currentCard: null,
  isFlipped: false,

  isCramMode: false,

  sessionStartTime: null,
  cardsReviewed: 0,
  streak: 0,
  longStreak: 0,
  averageRating: 0,

  // -----------------------------------------------------------------------
  // loadSession — build card queue from module content
  // -----------------------------------------------------------------------
  loadSession: async (moduleId: UUID, moduleTitle: string, cramMode = false) => {
    set({ status: 'active', moduleId, moduleTitle, isLoading: true, isCramMode: cramMode });

    const db = getDb();
    const now = new Date();

    // Fetch due cards (reviews scheduled for today or earlier)
    const dueFlashcards = await db.getDueFlashcards(moduleId, 50);
    const dueEquations = await db.getDueEquations(moduleId, 30);
    const dueOcclusion = await db.getDueOcclusion(moduleId, 20);
    const dueScenarios = await db.getDueScenarios(moduleId, 5);

    // Fetch new/unseen cards
    const newFlashcards = await db.getNewFlashcards(moduleId, 20);
    const newEquations = await db.getNewEquations(moduleId, 10);
    const newOcclusion = await db.getNewOcclusion(moduleId, 5);
    const newScenarios = await db.getNewScenarios(moduleId, 2);

    // Collect all card IDs to fetch existing reviews
    const allCardIds: UUID[] = [
      ...dueFlashcards.map((f) => f.id),
      ...dueEquations.map((e) => e.id),
      ...dueOcclusion.map((o) => o.id),
      ...dueScenarios.map((s) => s.id),
    ];

    // Fetch user's card reviews for these cards (assume userId = 'local-user' for local mode)
    const allReviews: CardReview[] =
      allCardIds.length > 0
        ? await db.cardReviews
            .where('flashcard_id')
            .anyOf(allCardIds)
            .toArray()
        : [];

    const reviewById = new Map<UUID, CardReview>();
    for (const r of allReviews) {
      reviewById.set(r.flashcard_id, r);
    }

    // Build queue: interleave due + new
    const queue: QueuedCard[] = [];

    const addCards = <T extends { id: UUID }>(
      source: CardSource,
      items: T[],
    ) => {
      for (const item of items) {
        const review = reviewById.get(item.id) ?? null;
        queue.push({
          source,
          data: item as unknown as QueuedCard['data'],
          fsrsCard: review
            ? {
                due: review.next_review ? new Date(review.next_review) : now,
                stability: review.stability,
                difficulty: review.difficulty,
                elapsed_days: review.elapsed_days,
                scheduled_days: review.scheduled_days,
                reps: review.reps,
                lapses: review.lapses,
                state: review.state as FSRSCard['state'],
                last_review: review.last_review
                  ? new Date(review.last_review)
                  : undefined,
              }
            : createEmptyCard(now),
          review,
        });
      }
    };

    // Add due cards first, then new
    addCards('flashcard', dueFlashcards);
    addCards('equation', dueEquations);
    addCards('occlusion', dueOcclusion);
    addCards('scenario', dueScenarios);
    addCards('flashcard', newFlashcards);
    addCards('equation', newEquations);
    addCards('occlusion', newOcclusion);
    addCards('scenario', newScenarios);

    // Shuffle the combined queue
    const shuffled = shuffle(queue);

    // Create a new StudySession record
    const sessionId = generateUUID();
    const session: StudySession = {
      id: sessionId,
      user_id: 'local-user' as UUID,
      course_id: null,
      module_id: moduleId,
      cards_reviewed: 0,
      cards_new: 0,
      cards_relearning: 0,
      total_duration_ms: 0,
      started_at: now.toISOString(),
      ended_at: null,
      _sync_version: 1,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      deleted_at: null,
    };
    await db.studySessions.put(session);

    // Load all-time streak
    const longStreak = await db.getLongStreak();

    set({
      status: 'active',
      currentSessionId: sessionId,
      queue: shuffled,
      currentIndex: 0,
      totalCards: shuffled.length,
      remainingCards: shuffled.length,
      currentCard: shuffled.length > 0 ? shuffled[0] : null,
      isFlipped: false,
      sessionStartTime: Date.now(),
      cardsReviewed: 0,
      streak: 0,
      longStreak,
      averageRating: 0,
      isLoading: false,
    });
  },

  // -----------------------------------------------------------------------
  // flipCard — reveal card content (question → answer)
  // -----------------------------------------------------------------------
  flipCard: () => {
    set({ isFlipped: true });
  },

  // -----------------------------------------------------------------------
  // rateCard — grade current card with FSRS-5 and schedule next review
  // -----------------------------------------------------------------------
  rateCard: async (rating: FSRSRating) => {
    const { currentCard, currentSessionId, streak, isCramMode } = get();
    if (!currentCard) return;

    const db = getDb();
    const now = new Date();
    const schemaRating = rating as 1 | 2 | 3 | 4;

    // CRAM MODE: Skip FSRS — do not update stability/difficulty
    if (!isCramMode) {
      // Grade the card with FSRS-5
      const updatedCard = gradeCard(currentCard.fsrsCard, rating, now);

      // Create or update CardReview
      const reviewId = generateUUID();
      const review: CardReview = {
        id: reviewId,
        user_id: 'local-user' as UUID,
        flashcard_id: currentCard.data.id,
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
        elapsed_days: updatedCard.elapsed_days,
        scheduled_days: updatedCard.scheduled_days,
        reps: updatedCard.reps,
        lapses: updatedCard.lapses,
        state: updatedCard.state as SrsState,
        last_review: now.toISOString(),
        next_review: updatedCard.due.toISOString(),
        ease_factor: 2.5,
        interval_days: updatedCard.scheduled_days,
        _sync_version: 1,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        deleted_at: null,
      };
      await db.cardReviews.put(review);

      // Log the review
      const logId = generateUUID();
      const reviewLog: ReviewLog = {
        id: logId,
        user_id: 'local-user' as UUID,
        flashcard_id: currentCard.data.id,
        rating: schemaRating,
        state_before: currentCard.fsrsCard.state as SrsState,
        state_after: updatedCard.state as SrsState,
        elapsed_days: updatedCard.elapsed_days,
        scheduled_days: updatedCard.scheduled_days,
        review_duration_ms: null,
        reviewed_at: now.toISOString(),
        _sync_version: 1,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        deleted_at: null,
      };
      await db.reviewLogs.put(reviewLog);
    }

    // Update streak
    const newStreak = rating >= 3 ? streak + 1 : 0;

    const { cardsReviewed, averageRating } = get();
    const newReviewed = cardsReviewed + 1;
    const newAvgRating = Math.round(
      ((averageRating * cardsReviewed) + rating) / newReviewed * 100
    ) / 100;

    set({
      cardsReviewed: newReviewed,
      streak: newStreak,
      averageRating: newAvgRating,
    });
  },

  // -----------------------------------------------------------------------
  // nextCard — advance to next card in queue
  // -----------------------------------------------------------------------
  nextCard: () => {
    const { queue, currentIndex } = get();
    const newIndex = currentIndex + 1;

    if (newIndex >= queue.length) {
      // Queue exhausted — auto-complete
      set({
        currentIndex: queue.length,
        remainingCards: 0,
        currentCard: null,
        isFlipped: false,
        status: 'complete',
      });
      return;
    }

    const nextCard = queue[newIndex];

    set({
      currentIndex: newIndex,
      remainingCards: queue.length - newIndex,
      currentCard: nextCard,
      isFlipped: false,
    });
  },

  // -----------------------------------------------------------------------
  // pauseSession
  // -----------------------------------------------------------------------
  pauseSession: () => {
    set({ status: 'paused' });
  },

  // -----------------------------------------------------------------------
  // resumeSession
  // -----------------------------------------------------------------------
  resumeSession: () => {
    set({ status: 'active' });
  },

  // -----------------------------------------------------------------------
  // completeSession — finalize and persist session stats
  // -----------------------------------------------------------------------
  completeSession: async () => {
    const { currentSessionId, cardsReviewed, totalCards, averageRating, streak, longStreak, sessionStartTime } = get();
    if (!currentSessionId) return;

    const db = getDb();
    const now = new Date();

    // Update session record
    const session = await db.studySessions.get(currentSessionId);
    if (session) {
      session.ended_at = now.toISOString();
      session.cards_reviewed = cardsReviewed;
      session.total_duration_ms = sessionStartTime ? (Date.now() - sessionStartTime) : 0;
      await db.studySessions.put(session);
    }

    // Update long streak if current streak exceeds it
    if (streak > longStreak) {
      await db.setSyncMeta('long_streak', streak.toString());
    }

    set({
      status: 'complete',
      remainingCards: 0,
      currentCard: null,
      isFlipped: false,
      longStreak: Math.max(longStreak, streak),
    });
  },

  // -----------------------------------------------------------------------
  // resetSession
  // -----------------------------------------------------------------------
  resetSession: () => {
    set({
      status: 'idle',
      currentSessionId: null,
      moduleId: null,
      moduleTitle: '',
      isCramMode: false,
      queue: [],
      currentIndex: 0,
      totalCards: 0,
      remainingCards: 0,
      currentCard: null,
      isFlipped: false,
      sessionStartTime: null,
      cardsReviewed: 0,
      streak: 0,
      averageRating: 0,
    });
  },

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------
  getProgress: () => {
    const { cardsReviewed, totalCards } = get();
    const percentage = totalCards > 0 ? Math.round((cardsReviewed / totalCards) * 100) : 0;
    return { completed: cardsReviewed, total: totalCards, percentage };
  },

  getNextCard: () => {
    const { queue, currentIndex } = get();
    const nextIndex = currentIndex + 1;
    return nextIndex < queue.length ? queue[nextIndex] : null;
  },
}));