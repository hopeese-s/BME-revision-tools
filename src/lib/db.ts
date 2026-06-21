// ============================================================================
// EgBE Memory & Revision Engine — Dexie.js Local Database Schema
//
// IndexedDB wrapper providing offline-first persistence for all entities.
// Supports live queries, compound indexes, and the sync protocol.
// ============================================================================

import Dexie, { type Table } from 'dexie';
import type {
  CardReview,
  ConceptEdge,
  ConceptNode,
  Course,
  EquationBank,
  Flashcard,
  MediaAsset,
  Module,
  MutationEntry,
  OcclusionRegion,
  OcclusionSet,
  ReviewLog,
  Scenario,
  ScenarioNode,
  ScenarioTransition,
  Semester,
  StudySession,
  User,
  UUID,
  Year,
} from '@/types/schema';

// ---------------------------------------------------------------------------
// Database Class
// ---------------------------------------------------------------------------

export class EgBeDatabase extends Dexie {
  // Curriculum tables
  years!: Table<Year, UUID>;
  semesters!: Table<Semester, UUID>;
  courses!: Table<Course, UUID>;
  modules!: Table<Module, UUID>;

  // Content tables
  flashcards!: Table<Flashcard, UUID>;
  equationBanks!: Table<EquationBank, UUID>;
  occlusionSets!: Table<OcclusionSet, UUID>;
  occlusionRegions!: Table<OcclusionRegion, UUID>;

  // Knowledge graph tables
  conceptNodes!: Table<ConceptNode, UUID>;
  conceptEdges!: Table<ConceptEdge, UUID>;

  // User progress tables
  cardReviews!: Table<CardReview, UUID>;
  reviewLogs!: Table<ReviewLog, UUID>;
  studySessions!: Table<StudySession, UUID>;

  // Troubleshooting scenario tables
  scenarios!: Table<Scenario, UUID>;
  scenarioNodes!: Table<ScenarioNode, UUID>;
  scenarioTransitions!: Table<ScenarioTransition, UUID>;

  // Media
  mediaAssets!: Table<MediaAsset, UUID>;

  // Sync engine tables
  mutationQueue!: Table<MutationEntry, UUID>;
  syncMeta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super('EgBeMemoryEngine');

    this.version(2).stores({
      // Curriculum — indexed by hierarchy for fast tree queries
      years: 'id, year_number',
      semesters: 'id, year_id, [year_id+semester_number]',
      courses: 'id, semester_id, course_code, sort_order',
      modules: 'id, course_id, sort_order',

      // Content — indexed by module and tags
      flashcards: 'id, module_id, card_type, *tags, difficulty_tier, sort_order',
      equationBanks: 'id, module_id, *tags, sort_order',
      occlusionSets: 'id, module_id',
      occlusionRegions: 'id, occlusion_set_id, reveal_order',

      // Knowledge graph
      conceptNodes: 'id, module_id, node_type, domain',
      conceptEdges: 'id, source_id, target_id, relationship, [source_id+target_id+relationship]',

      // User progress
      cardReviews: 'id, user_id, flashcard_id, next_review, state, [user_id+flashcard_id], [user_id+next_review]',
      reviewLogs: 'id, user_id, flashcard_id, reviewed_at, [user_id+reviewed_at]',
      studySessions: 'id, user_id, course_id, module_id, started_at, [user_id+started_at]',

      // Troubleshooting
      scenarios: 'id, domain, module_id, difficulty',
      scenarioNodes: 'id, scenario_id, node_type, is_entry_point',
      scenarioTransitions: 'id, from_node_id, sort_order',

      // Media
      mediaAssets: 'id, module_id, *tags, mime_type',

      // Sync
      mutationQueue: 'id, table, timestamp, operation',
      syncMeta: 'key',
    });
  }

  // -----------------------------------------------------------------------
  // Curriculum Tree Query (recursive client-side join)
  // -----------------------------------------------------------------------

  /**
   * Build the complete curriculum tree: Year → Semester → Course → Module.
   * Uses IndexedDB queries with in-memory assembly.
   */
  async getCurriculumTree(): Promise<
    (Year & {
      semesters: (Semester & {
        courses: (Course & { modules: Module[] })[];
      })[];
    })[]
  > {
    const years = await this.years.orderBy('year_number').toArray();
    const semesters = await this.semesters.toArray();
    const courses = await this.courses.orderBy('sort_order').toArray();
    const modules = await this.modules.orderBy('sort_order').toArray();

    return years.map((year) => ({
      ...year,
      semesters: semesters
        .filter((s) => s.year_id === year.id)
        .sort((a, b) => a.semester_number - b.semester_number)
        .map((semester) => ({
          ...semester,
          courses: courses
            .filter((c) => c.semester_id === semester.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((course) => ({
              ...course,
              modules: modules
                .filter((m) => m.course_id === course.id)
                .sort((a, b) => a.sort_order - b.sort_order),
            })),
        })),
    }));
  }

  // -----------------------------------------------------------------------
  // Flashcard Queries
  // -----------------------------------------------------------------------

  async getFlashcardsByModule(moduleId: UUID): Promise<Flashcard[]> {
    return this.flashcards
      .where('module_id')
      .equals(moduleId)
      .sortBy('sort_order');
  }

  async getFlashcardsByTags(tags: string[]): Promise<Flashcard[]> {
    // Dexie supports multi-tag filtering via AnyOf on multiEntry index
    return this.flashcards
      .where('tags')
      .anyOf(tags)
      .distinct()
      .toArray();
  }

  async getFlashcardsByCardType(cardType: string): Promise<Flashcard[]> {
    return this.flashcards.where('card_type').equals(cardType).toArray();
  }

  // -----------------------------------------------------------------------
  // Card Review Queries (SRS)
  // -----------------------------------------------------------------------

  async getCardReviewsByUser(userId: UUID): Promise<CardReview[]> {
    return this.cardReviews.where('user_id').equals(userId).toArray();
  }

  async getDueCardReviews(userId: UUID, beforeDate: Date): Promise<CardReview[]> {
    // New cards (state = 0, no next_review) are always due
    const newCards = await this.cardReviews
      .where('[user_id+flashcard_id]')
      .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
      .filter((cr) => cr.state === 0 || cr.next_review === null)
      .toArray();

    // Cards with next_review <= beforeDate
    const dueCards = await this.cardReviews
      .where('next_review')
      .between(Dexie.minKey, beforeDate.toISOString(), true, true)
      .filter((cr) => cr.user_id === userId && cr.state !== 0)
      .toArray();

    return [...newCards, ...dueCards];
  }

  async getCardReviewForFlashcard(userId: UUID, flashcardId: UUID): Promise<CardReview | undefined> {
    return this.cardReviews
      .where('[user_id+flashcard_id]')
      .equals([userId, flashcardId])
      .first();
  }

  // -----------------------------------------------------------------------
  // Review Logs
  // -----------------------------------------------------------------------

  async getRecentReviewLogs(userId: UUID, limit: number = 100): Promise<ReviewLog[]> {
    return this.reviewLogs
      .where('[user_id+reviewed_at]')
      .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
      .reverse()
      .limit(limit)
      .toArray();
  }

  async getReviewLogsForFlashcard(userId: UUID, flashcardId: UUID): Promise<ReviewLog[]> {
    return this.reviewLogs
      .where('flashcard_id')
      .equals(flashcardId)
      .filter((rl) => rl.user_id === userId)
      .sortBy('reviewed_at');
  }

  // -----------------------------------------------------------------------
  // Study Sessions
  // -----------------------------------------------------------------------

  async getRecentStudySessions(userId: UUID, limit: number = 10): Promise<StudySession[]> {
    return this.studySessions
      .where('[user_id+started_at]')
      .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
      .reverse()
      .limit(limit)
      .toArray();
  }

  // -----------------------------------------------------------------------
  // Knowledge Graph Queries
  // -----------------------------------------------------------------------

  async getConceptNode(nodeId: UUID): Promise<ConceptNode | undefined> {
    return this.conceptNodes.get(nodeId);
  }

  async getConceptNodesByModule(moduleId: UUID): Promise<ConceptNode[]> {
    return this.conceptNodes.where('module_id').equals(moduleId).toArray();
  }

  async getConceptNodesByDomain(domain: string): Promise<ConceptNode[]> {
    return this.conceptNodes.where('domain').equals(domain).toArray();
  }

  async getAllConceptNodes(): Promise<ConceptNode[]> {
    return this.conceptNodes.toArray();
  }

  async getConceptEdgesForSource(sourceId: UUID): Promise<ConceptEdge[]> {
    return this.conceptEdges.where('source_id').equals(sourceId).toArray();
  }

  async getConceptEdgesForTarget(targetId: UUID): Promise<ConceptEdge[]> {
    return this.conceptEdges.where('target_id').equals(targetId).toArray();
  }

  async getAllConceptEdges(): Promise<ConceptEdge[]> {
    return this.conceptEdges.toArray();
  }

  // -----------------------------------------------------------------------
  // Equation Bank Queries
  // -----------------------------------------------------------------------

  async getEquationsByModule(moduleId: UUID): Promise<EquationBank[]> {
    return this.equationBanks.where('module_id').equals(moduleId).sortBy('sort_order');
  }

  async getEquationsByTags(tags: string[]): Promise<EquationBank[]> {
    return this.equationBanks.where('tags').anyOf(tags).distinct().toArray();
  }

  // -----------------------------------------------------------------------
  // Image Occlusion Queries
  // -----------------------------------------------------------------------

  async getOcclusionSet(setId: UUID): Promise<OcclusionSet | undefined> {
    return this.occlusionSets.get(setId);
  }

  async getOcclusionRegionsForSet(setId: UUID): Promise<OcclusionRegion[]> {
    return this.occlusionRegions
      .where('occlusion_set_id')
      .equals(setId)
      .sortBy('reveal_order');
  }

  // -----------------------------------------------------------------------
  // Scenario Queries
  // -----------------------------------------------------------------------

  async getScenariosByModule(moduleId: UUID): Promise<Scenario[]> {
    return this.scenarios.where('module_id').equals(moduleId).toArray();
  }

  async getScenarioNodes(scenarioId: UUID): Promise<ScenarioNode[]> {
    return this.scenarioNodes.where('scenario_id').equals(scenarioId).toArray();
  }

  async getEntryPointNode(scenarioId: UUID): Promise<ScenarioNode | undefined> {
    return this.scenarioNodes
      .where('[scenario_id+is_entry_point]')
      .equals([scenarioId, 1]) // Dexie boolean edge case — cast to number
      .first();
  }

  async getScenarioTransitions(fromNodeId: UUID): Promise<ScenarioTransition[]> {
    return this.scenarioTransitions
      .where('from_node_id')
      .equals(fromNodeId)
      .sortBy('sort_order');
  }

  // -----------------------------------------------------------------------
  // Mutation Queue (for offline sync)
  // -----------------------------------------------------------------------

  async enqueueMutation(mutation: MutationEntry): Promise<void> {
    await this.mutationQueue.put(mutation);
  }

  async getPendingMutations(): Promise<MutationEntry[]> {
    return this.mutationQueue.orderBy('timestamp').toArray();
  }

  async clearMutation(mutationId: UUID): Promise<void> {
    await this.mutationQueue.delete(mutationId);
  }

  async getMutationQueueSize(): Promise<number> {
    return this.mutationQueue.count();
  }

  // -----------------------------------------------------------------------
  // Sync Metadata (key-value store)
  // -----------------------------------------------------------------------

  async getSyncMeta(key: string): Promise<string | undefined> {
    const entry = await this.syncMeta.get(key);
    return entry?.value;
  }

  async setSyncMeta(key: string, value: string): Promise<void> {
    await this.syncMeta.put({ key, value });
  }

  // -----------------------------------------------------------------------
  // Bulk Operations (for initial sync / seeding)
  // -----------------------------------------------------------------------

  async bulkUpsertYears(items: Year[]): Promise<void> {
    await this.years.bulkPut(items);
  }

  async bulkUpsertSemesters(items: Semester[]): Promise<void> {
    await this.semesters.bulkPut(items);
  }

  async bulkUpsertCourses(items: Course[]): Promise<void> {
    await this.courses.bulkPut(items);
  }

  async bulkUpsertModules(items: Module[]): Promise<void> {
    await this.modules.bulkPut(items);
  }

  async bulkUpsertFlashcards(items: Flashcard[]): Promise<void> {
    await this.flashcards.bulkPut(items);
  }

  async bulkUpsertEquationBanks(items: EquationBank[]): Promise<void> {
    await this.equationBanks.bulkPut(items);
  }

  async bulkUpsertOcclusionSets(items: OcclusionSet[]): Promise<void> {
    await this.occlusionSets.bulkPut(items);
  }

  async bulkUpsertOcclusionRegions(items: OcclusionRegion[]): Promise<void> {
    await this.occlusionRegions.bulkPut(items);
  }

  async bulkUpsertConceptNodes(items: ConceptNode[]): Promise<void> {
    await this.conceptNodes.bulkPut(items);
  }

  async bulkUpsertConceptEdges(items: ConceptEdge[]): Promise<void> {
    await this.conceptEdges.bulkPut(items);
  }

  async bulkUpsertScenarios(items: Scenario[]): Promise<void> {
    await this.scenarios.bulkPut(items);
  }

  async bulkUpsertScenarioNodes(items: ScenarioNode[]): Promise<void> {
    await this.scenarioNodes.bulkPut(items);
  }

  async bulkUpsertScenarioTransitions(items: ScenarioTransition[]): Promise<void> {
    await this.scenarioTransitions.bulkPut(items);
  }

  async bulkUpsertCardReviews(items: CardReview[]): Promise<void> {
    await this.cardReviews.bulkPut(items);
  }

  // -----------------------------------------------------------------------
  // Due/New Card Queries (for Study Session Store)
  // -----------------------------------------------------------------------

  async getDueFlashcards(moduleId: UUID, limit: number = 50): Promise<Flashcard[]> {
    const allModuleCards = await this.flashcards.where('module_id').equals(moduleId).toArray();
    const cardIds = allModuleCards.map((f) => f.id);
    if (cardIds.length === 0) return [];

    const dueReviews = await this.cardReviews
      .where('flashcard_id')
      .anyOf(cardIds)
      .filter(
        (cr: CardReview) =>
          cr.state === 0 ||
          cr.next_review === null ||
          cr.next_review <= new Date().toISOString(),
      )
      .toArray();

    const dueIds = new Set(dueReviews.map((r: CardReview) => r.flashcard_id));
    return allModuleCards.filter((f: Flashcard) => dueIds.has(f.id)).slice(0, limit);
  }

  async getDueEquations(moduleId: UUID, limit: number = 30): Promise<EquationBank[]> {
    const allModuleEqs = await this.equationBanks.where('module_id').equals(moduleId).toArray();
    const eqIds = allModuleEqs.map((e: EquationBank) => e.id);
    if (eqIds.length === 0) return [];

    const dueReviews = await this.cardReviews
      .where('flashcard_id')
      .anyOf(eqIds)
      .filter(
        (cr: CardReview) =>
          cr.state === 0 ||
          cr.next_review === null ||
          cr.next_review <= new Date().toISOString(),
      )
      .toArray();

    const dueIds = new Set(dueReviews.map((r: CardReview) => r.flashcard_id));
    return allModuleEqs.filter((e: EquationBank) => dueIds.has(e.id)).slice(0, limit);
  }

  async getDueOcclusion(moduleId: UUID, limit: number = 20): Promise<OcclusionSet[]> {
    const allSets = await this.occlusionSets.where('module_id').equals(moduleId).toArray();
    const setIds = allSets.map((s: OcclusionSet) => s.id);
    if (setIds.length === 0) return [];

    const dueReviews = await this.cardReviews
      .where('flashcard_id')
      .anyOf(setIds)
      .filter(
        (cr: CardReview) =>
          cr.state === 0 ||
          cr.next_review === null ||
          cr.next_review <= new Date().toISOString(),
      )
      .toArray();

    const dueIds = new Set(dueReviews.map((r: CardReview) => r.flashcard_id));
    return allSets.filter((s: OcclusionSet) => dueIds.has(s.id)).slice(0, limit);
  }

  async getDueScenarios(moduleId: UUID, limit: number = 5): Promise<Scenario[]> {
    const allScenarios = await this.scenarios.where('module_id').equals(moduleId).toArray();
    const scenarioIds = allScenarios.map((s: Scenario) => s.id);
    if (scenarioIds.length === 0) return [];

    const dueReviews = await this.cardReviews
      .where('flashcard_id')
      .anyOf(scenarioIds)
      .filter(
        (cr: CardReview) =>
          cr.state === 0 ||
          cr.next_review === null ||
          cr.next_review <= new Date().toISOString(),
      )
      .toArray();

    const dueIds = new Set(dueReviews.map((r: CardReview) => r.flashcard_id));
    return allScenarios.filter((s: Scenario) => dueIds.has(s.id)).slice(0, limit);
  }

  async getNewFlashcards(moduleId: UUID, limit: number = 20): Promise<Flashcard[]> {
    const allModuleCards = await this.flashcards.where('module_id').equals(moduleId).toArray();
    const cardIds = allModuleCards.map((f: Flashcard) => f.id);
    if (cardIds.length === 0) return [];

    const existingReviews = await this.cardReviews
      .where('flashcard_id')
      .anyOf(cardIds)
      .toArray();

    const reviewedIds = new Set(existingReviews.map((r: CardReview) => r.flashcard_id));
    return allModuleCards.filter((f: Flashcard) => !reviewedIds.has(f.id)).slice(0, limit);
  }

  async getNewEquations(moduleId: UUID, limit: number = 10): Promise<EquationBank[]> {
    const allEqs = await this.equationBanks.where('module_id').equals(moduleId).toArray();
    const eqIds = allEqs.map((e: EquationBank) => e.id);
    if (eqIds.length === 0) return [];

    const existingReviews = await this.cardReviews
      .where('flashcard_id')
      .anyOf(eqIds)
      .toArray();

    const reviewedIds = new Set(existingReviews.map((r: CardReview) => r.flashcard_id));
    return allEqs.filter((e: EquationBank) => !reviewedIds.has(e.id)).slice(0, limit);
  }

  async getNewOcclusion(moduleId: UUID, limit: number = 5): Promise<OcclusionSet[]> {
    const allSets = await this.occlusionSets.where('module_id').equals(moduleId).toArray();
    const setIds = allSets.map((s: OcclusionSet) => s.id);
    if (setIds.length === 0) return [];

    const existingReviews = await this.cardReviews
      .where('flashcard_id')
      .anyOf(setIds)
      .toArray();

    const reviewedIds = new Set(existingReviews.map((r: CardReview) => r.flashcard_id));
    return allSets.filter((s: OcclusionSet) => !reviewedIds.has(s.id)).slice(0, limit);
  }

  async getNewScenarios(moduleId: UUID, limit: number = 2): Promise<Scenario[]> {
    const allScs = await this.scenarios.where('module_id').equals(moduleId).toArray();
    const scIds = allScs.map((s: Scenario) => s.id);
    if (scIds.length === 0) return [];

    const existingReviews = await this.cardReviews
      .where('flashcard_id')
      .anyOf(scIds)
      .toArray();

    const reviewedIds = new Set(existingReviews.map((r: CardReview) => r.flashcard_id));
    return allScs.filter((s: Scenario) => !reviewedIds.has(s.id)).slice(0, limit);
  }

  // -----------------------------------------------------------------------
  // Review Logs — add
  // -----------------------------------------------------------------------

  async addReviewLog(log: ReviewLog): Promise<void> {
    await this.reviewLogs.put(log);
  }

  // -----------------------------------------------------------------------
  // Long Streak
  // -----------------------------------------------------------------------

  async getLongStreak(): Promise<number> {
    const val = await this.getSyncMeta('long_streak');
    return val ? parseInt(val, 10) : 0;
  }

  // -----------------------------------------------------------------------
  // Utility — clear all data (for testing / reset)
  // -----------------------------------------------------------------------

  async clearAll(): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.years, this.semesters, this.courses, this.modules,
        this.flashcards, this.equationBanks, this.occlusionSets, this.occlusionRegions,
        this.conceptNodes, this.conceptEdges,
        this.cardReviews, this.reviewLogs, this.studySessions,
        this.scenarios, this.scenarioNodes, this.scenarioTransitions,
        this.mutationQueue, this.syncMeta,
      ],
      async () => {
        await Promise.all([
          this.years.clear(), this.semesters.clear(), this.courses.clear(), this.modules.clear(),
          this.flashcards.clear(), this.equationBanks.clear(), this.occlusionSets.clear(),
          this.occlusionRegions.clear(),
          this.conceptNodes.clear(), this.conceptEdges.clear(),
          this.cardReviews.clear(), this.reviewLogs.clear(), this.studySessions.clear(),
          this.scenarios.clear(), this.scenarioNodes.clear(), this.scenarioTransitions.clear(),
          this.mutationQueue.clear(), this.syncMeta.clear(),
        ]);
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton Database Instance
// ---------------------------------------------------------------------------

let dbInstance: EgBeDatabase | null = null;

export function getDb(): EgBeDatabase {
  if (!dbInstance) {
    dbInstance = new EgBeDatabase();
  }
  return dbInstance;
}

export async function initDb(): Promise<EgBeDatabase> {
  const db = getDb();
  await db.open();
  return db;
}