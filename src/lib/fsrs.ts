// ============================================================================
// EgBE Memory & Revision Engine — FSRS-5 Algorithm Implementation
// Free Spaced Repetition Scheduler v5
//
// Reference: https://github.com/open-spaced-repetition/fsrs4anki
//
// The FSRS-5 algorithm computes memory stability and difficulty from review
// history, then schedules the next review date using a forgetting curve model.
// w0–w18 are 19 trainable parameters that personalize the algorithm per user.
// ============================================================================

import type { CardReview, ReviewLog, ReviewRating, SrsState, UUID, User } from '@/types/schema';
import { FSRS_DEFAULT_PARAMETERS } from '@/types/schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECONDS_PER_DAY = 86400;
const DECAY = -0.5;
const FACTOR = 19 / 81;

/**
 * Default FSRS parameters (w0–w18).
 * These are the starting point before personal optimization.
 * Values sourced from the open-spaced-repetition/fsrs-rs reference implementation.
 */
export const DEFAULT_W: number[] = [...FSRS_DEFAULT_PARAMETERS];

// ---------------------------------------------------------------------------
// FSRSCard type (alias for store/UI use)
// ---------------------------------------------------------------------------

export interface FSRSCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3; // New, Learning, Review, Relearning
  last_review?: Date;
}

export type FSRSRating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

/**
 * Create an empty/initial FSRS card for a new item.
 */
export function createEmptyCard(now: Date = new Date()): FSRSCard {
  return {
    due: now,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 0, // New
  };
}

/**
 * Grade a card using FSRS-5 and return the updated card.
 * Thin wrapper around processReview for convenience.
 */
export function gradeCard(card: FSRSCard, rating: FSRSRating, now: Date = new Date()): FSRSCard {
  // Map FSRSCard to the shape processReview expects
  const input = {
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as SrsState,
    last_review: card.last_review?.toISOString() ?? null,
  };
  const out = processReview(input, rating, now);
  return {
    due: new Date(out.nextReview),
    stability: out.stability,
    difficulty: out.difficulty,
    elapsed_days: out.elapsedDays,
    scheduled_days: out.scheduledDays,
    reps: out.reps,
    lapses: out.lapses,
    state: out.state,
    last_review: now,
  };
}

// ---------------------------------------------------------------------------
// Core FSRS-5 Functions
// ---------------------------------------------------------------------------

/**
 * Compute retrievability (probability of recall) at a given elapsed time.
 * Implements the exponential forgetting curve.
 *
 * @param elapsedDays - Days since last review
 * @param stability  - Current memory stability (days)
 * @returns Retrievability R ∈ [0, 1]
 */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + FACTOR * (elapsedDays / stability), DECAY);
}

/**
 * Compute initial stability after the first review.
 *
 * @param rating - User's rating (1=Again, 2=Hard, 3=Good, 4=Easy)
 * @param w     - FSRS parameter array
 * @returns Initial stability in days
 */
export function initStability(rating: ReviewRating, w: number[] = DEFAULT_W): number {
  return Math.max(w[rating - 1], 0.1);
}

/**
 * Compute initial difficulty after the first rating.
 *
 * @param rating - User's rating
 * @param w     - FSRS parameter array
 * @returns Difficulty D ∈ [1, 10]
 */
export function initDifficulty(rating: ReviewRating, w: number[] = DEFAULT_W): number {
  const raw = w[4] - (rating - 3) * w[5];
  return clampDifficulty(raw);
}

/**
 * Compute next difficulty based on prior difficulty and rating.
 *
 * @param difficulty - Previous difficulty D
 * @param rating     - User's rating
 * @param w          - FSRS parameter array
 * @returns New difficulty D ∈ [1, 10]
 */
export function nextDifficulty(
  difficulty: number,
  rating: ReviewRating,
  w: number[] = DEFAULT_W,
): number {
  const deltaD = -w[6] * (rating - 3);
  const raw = difficulty + deltaD * (10 - difficulty) * 0.1;
  // D = w[4] - w[5] * (rating - 3) applied as mean reversion via w[7]
  const meanReversion = w[7] * initDifficulty(3, w) + (1 - w[7]) * raw;
  return clampDifficulty(meanReversion);
}

/**
 * Compute next stability after a successful review (rating 2, 3, or 4).
 *
 * @param difficulty        - Item difficulty D
 * @param stability         - Previous stability S
 * @param retrievability    - Current retrievability R
 * @param rating            - User's rating
 * @param w                 - FSRS parameter array
 * @returns New stability in days
 */
export function nextStability(
  difficulty: number,
  stability: number,
  retrievability: number,
  rating: ReviewRating,
  w: number[] = DEFAULT_W,
): number {
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  return (
    stability *
    (1 + easyBonus * w[8] * Math.pow(11 - difficulty, w[9]) * Math.pow(stability, -w[10]) *
      (Math.exp((1 - retrievability) * w[11]) - 1) * hardPenalty)
  );
}

/**
 * Compute stability after a lapse (rating = Again).
 *
 * @param difficulty     - Item difficulty D
 * @param stability      - Previous stability S
 * @param retrievability - Current retrievability R
 * @param w              - FSRS parameter array
 * @returns New stability after lapse
 */
export function stabilityAfterLapse(
  difficulty: number,
  stability: number,
  retrievability: number,
  w: number[] = DEFAULT_W,
): number {
  return (
    w[12] *
    Math.pow(11 - difficulty, w[13]) *
    Math.pow(stability, w[14]) *
    Math.exp((1 - retrievability) * w[15])
  );
}

// ---------------------------------------------------------------------------
// Main FSRS Scheduler: compute next review state from a rating
// ---------------------------------------------------------------------------

export interface FsrsOutput {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: SrsState;
  /** ISO 8601 timestamp for the next review */
  nextReview: string;
}

/**
 * Process a single review and return the updated card state.
 *
 * @param card      - Current card review state
 * @param rating    - User rating for this review (1–4)
 * @param now       - Current date (defaults to new Date())
 * @param w         - User-specific FSRS parameters
 * @returns Updated FSRS state and next review date
 */
export function processReview(
  card: Pick<
    CardReview,
    'stability' | 'difficulty' | 'elapsed_days' | 'scheduled_days' | 'reps' | 'lapses' | 'state' | 'last_review'
  >,
  rating: ReviewRating,
  now: Date = new Date(),
  w: number[] = DEFAULT_W,
): FsrsOutput {
  // Compute actual elapsed days since last review
  const lastReviewDate = card.last_review ? new Date(card.last_review) : now;
  const elapsedDays = Math.max(
    (now.getTime() - lastReviewDate.getTime()) / (SECONDS_PER_DAY * 1000),
    0,
  );

  const currentR = retrievability(elapsedDays, card.stability);
  let newState: SrsState;
  let newStability: number;
  let newDifficulty: number;
  let newLapses = card.lapses;
  let newReps = card.reps;
  let scheduledDays: number;

  if (rating === 1) {
    // Again — lapse
    newState = 1; // Learning
    newLapses += 1;
    newDifficulty = nextDifficulty(card.difficulty, rating, w);
    newStability = stabilityAfterLapse(card.difficulty, card.stability, currentR, w);
    scheduledDays = newStability;
  } else {
    // Hard, Good, or Easy — success
    newDifficulty = nextDifficulty(card.difficulty, rating, w);
    newReps += 1;

    if (card.state === 0 || card.state === 1) {
      // New or Learning → first successful review
      newStability = initStability(rating, w);
      newState = 2; // Review
    } else {
      // Review or Relearning
      newStability = nextStability(card.difficulty, card.stability, currentR, rating, w);
      newState = 2; // Review
    }

    scheduledDays = newStability * (rating === 2 ? w[15] : 1);
  }

  // Clamp stability to reasonable bounds
  newStability = Math.max(newStability, 0.01);

  // Compute next review date
  const nextReviewDate = new Date(now.getTime() + scheduledDays * SECONDS_PER_DAY * 1000);

  return {
    stability: newStability,
    difficulty: newDifficulty,
    elapsedDays,
    scheduledDays,
    reps: newReps,
    lapses: newLapses,
    state: newState,
    nextReview: nextReviewDate.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Due Card Selection: get cards ready for review
// ---------------------------------------------------------------------------

/**
 * Determine which cards are due for review now.
 *
 * @param cards       - All card review states for the user
 * @param now         - Current date
 * @param maxCards    - Maximum number of cards to return
 * @param w           - FSRS parameters
 * @returns Sorted array of due cards (most overdue first), with retrievability
 */
export function getDueCards(
  cards: (Pick<CardReview, 'flashcard_id' | 'stability' | 'difficulty' | 'state' | 'next_review' | 'last_review'>)[],
  now: Date = new Date(),
  maxCards: number = 50,
): Array<{
  flashcard_id: UUID;
  retrievability: number;
  overdueDays: number;
}> {
  const dueCards: Array<{
    flashcard_id: UUID;
    retrievability: number;
    overdueDays: number;
  }> = [];

  for (const card of cards) {
    // New cards are always due
    if (card.state === 0) {
      dueCards.push({
        flashcard_id: card.flashcard_id,
        retrievability: 0,
        overdueDays: Infinity,
      });
      continue;
    }

    // Cards with no next_review are due
    if (!card.next_review) {
      dueCards.push({
        flashcard_id: card.flashcard_id,
        retrievability: 0,
        overdueDays: Infinity,
      });
      continue;
    }

    const nextReview = new Date(card.next_review);
    const overdueDays = (now.getTime() - nextReview.getTime()) / (SECONDS_PER_DAY * 1000);

    // Card is due if overdueDays >= 0
    if (overdueDays >= 0) {
      const r = retrievability(overdueDays, card.stability);
      dueCards.push({
        flashcard_id: card.flashcard_id,
        retrievability: r,
        overdueDays,
      });
    }
  }

  // Sort by retrievability ascending (most forgotten first), then by overdue
  dueCards.sort((a, b) => {
    if (a.overdueDays === Infinity && b.overdueDays === Infinity) return 0;
    if (a.overdueDays === Infinity) return -1;
    if (b.overdueDays === Infinity) return 1;
    return a.retrievability - b.retrievability;
  });

  return dueCards.slice(0, maxCards);
}

// ---------------------------------------------------------------------------
// Create default CardReview for a new flashcard
// ---------------------------------------------------------------------------

export function createNewCardReview(
  userId: UUID,
  flashcardId: UUID,
  now: Date = new Date(),
): Omit<CardReview, 'id' | '_sync_version' | 'created_at' | 'updated_at' | 'deleted_at'> {
  return {
    user_id: userId,
    flashcard_id: flashcardId,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 0 as SrsState, // New
    last_review: null,
    next_review: null,
    ease_factor: 2.5,
    interval_days: 0,
  };
}

// ---------------------------------------------------------------------------
// Utility: Clamp difficulty to [1, 10]
// ---------------------------------------------------------------------------

function clampDifficulty(d: number): number {
  return Math.max(1, Math.min(10, d));
}

// ---------------------------------------------------------------------------
// Legacy SM-2 Algorithm (for comparison / migration)
// ---------------------------------------------------------------------------

export interface Sm2Output {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string;
}

/**
 * SM-2 algorithm implementation for backward compatibility.
 *
 * @param quality    - Rating 0–5 (0=complete blackout, 5=perfect response)
 * @param repetitions - Current rep count
 * @param easeFactor - Current ease factor (default 2.5, min 1.3)
 * @param interval   - Current interval in days
 * @param now        - Current date
 * @returns Updated SM-2 state
 */
export function sm2(
  quality: number,
  repetitions: number,
  easeFactor: number,
  interval: number,
  now: Date = new Date(),
): Sm2Output {
  let newReps: number;
  let newEase: number;
  let newInterval: number;

  if (quality < 3) {
    // Failed — reset
    newReps = 0;
    newInterval = 1;
    newEase = easeFactor;
  } else {
    newEase = Math.max(
      1.3,
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );

    newReps = repetitions + 1;

    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEase);
    }

    // Apply quality modifier
    if (quality === 3) {
      newInterval = Math.round(newInterval * 1.0);
    } else if (quality === 4) {
      newInterval = Math.round(newInterval * 1.2);
    } else if (quality === 5) {
      newInterval = Math.round(newInterval * 1.3);
    }
  }

  const nextReview = new Date(now.getTime() + newInterval * SECONDS_PER_DAY * 1000);

  return {
    easeFactor: newEase,
    interval: newInterval,
    repetitions: newReps,
    nextReview: nextReview.toISOString(),
  };
}