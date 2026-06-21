// ============================================================================
// EgBE Memory & Revision Engine — TypeScript Schema Definitions
// All interfaces mirror the PostgreSQL schema defined in the architecture blueprint.
// ============================================================================

// ---------------------------------------------------------------------------
// UUID Brand Type (for nominal typing safety)
// ---------------------------------------------------------------------------
declare const UUID_BRAND: unique symbol;
export type UUID = string & { [UUID_BRAND]: never };

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type CardType = 'basic' | 'cloze' | 'equation' | 'image_occlusion' | 'multi_choice' | 'signal_interactive';

export type SrsState = 0 | 1 | 2 | 3;
// 0 = New, 1 = Learning, 2 = Review, 3 = Relearning

export type ReviewRating = 1 | 2 | 3 | 4;
// 1 = Again, 2 = Hard, 3 = Good, 4 = Easy

export type PreferredLanguage = 'en' | 'th' | 'bilingual';

export type ConceptNodeType = 'concept' | 'skill' | 'principle' | 'system';

export type ConceptRelationship =
  | 'prerequisite'
  | 'applies_to'
  | 'extends'
  | 'contradicts'
  | 'analogous_to'
  | 'component_of'
  | 'clinical_application';

export type OcclusionShape = 'rect' | 'ellipse' | 'polygon';

export type ScenarioNodeType = 'prompt' | 'decision' | 'outcome_success' | 'outcome_failure' | 'info';

// ---------------------------------------------------------------------------
// Base Fields (inherited by all syncable entities)
// ---------------------------------------------------------------------------
export interface BaseEntity {
  id: UUID;
  _sync_version: number;
  created_at: string; // ISO 8601
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Curriculum Hierarchy: Year → Semester → Course → Module
// ---------------------------------------------------------------------------

export interface Year extends BaseEntity {
  year_number: 1 | 2 | 3 | 4;
  title_en: string;
  title_th: string;
  description_en: string | null;
  description_th: string | null;
}

export interface Semester extends BaseEntity {
  year_id: UUID;
  semester_number: 1 | 2 | 3;
  title_en: string;
  title_th: string;
}

export interface Course extends BaseEntity {
  semester_id: UUID;
  course_code: string | null; // e.g., 'EGBE201'
  title_en: string;
  title_th: string;
  description_en: string | null;
  description_th: string | null;
  credit_hours: number | null;
  color_hex: string | null; // '#RRGGBB' UI accent
  icon_name: string | null;
  sort_order: number;
}

export interface Module extends BaseEntity {
  course_id: UUID;
  title_en: string;
  title_th: string;
  description_en: string | null;
  description_th: string | null;
  sort_order: number;
}

// ---------------------------------------------------------------------------
// Flashcard & Content Types
// ---------------------------------------------------------------------------

export interface Flashcard extends BaseEntity {
  module_id: UUID;
  card_type: CardType;
  // Bilingual content
  front_en: string;
  front_th: string | null;
  back_en: string;
  back_th: string | null;
  // Rich content
  front_latex: string | null;
  back_latex: string | null;
  front_markdown: string | null;
  back_markdown: string | null;
  // Image occlusion reference
  occlusion_set_id: UUID | null;
  // Metadata
  tags: string[];
  difficulty_tier: 1 | 2 | 3 | 4 | 5 | null;
  sort_order: number;
  // BME Enhancements
  requires_calculation?: boolean;
  signal_data?: unknown;
}

export interface EquationVariable {
  symbol: string;
  name_en: string;
  name_th: string | null;
  unit: string | null;
}

export interface EquationBank extends BaseEntity {
  module_id: UUID;
  name_en: string;
  name_th: string | null;
  latex_source: string;
  description_en: string | null;
  description_th: string | null;
  variables: EquationVariable[];
  tags: string[];
  sort_order: number;
}

// ---------------------------------------------------------------------------
// Image Occlusion Types & Media
// ---------------------------------------------------------------------------

export interface MediaAsset extends BaseEntity {
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  data_url: string; // Base64 data for local caching, later can be Supabase URL
  tags: string[];
  module_id: UUID | null;
  uploaded_at: string;
}

export interface OcclusionSet extends BaseEntity {
  module_id: UUID;
  title_en: string;
  title_th: string | null;
  image_url: string;
  image_width: number;
  image_height: number;
}

export interface OcclusionRegion extends BaseEntity {
  occlusion_set_id: UUID;
  label_en: string | null;
  label_th: string | null;
  // Normalized coordinates (0–1)
  x: number;
  y: number;
  width: number;
  height: number;
  reveal_order: number;
  shape: OcclusionShape;
  polygon_points: number[] | null; // [x1,y1,x2,y2,...] for 'polygon' shape
}

// Composite type for rendering
export interface OcclusionCard {
  set: OcclusionSet;
  regions: OcclusionRegion[];
}

// ---------------------------------------------------------------------------
// Knowledge Graph Types
// ---------------------------------------------------------------------------

export interface ConceptNode extends BaseEntity {
  title_en: string;
  title_th: string | null;
  description_en: string | null;
  description_th: string | null;
  module_id: UUID | null;
  flashcard_ids: UUID[];
  node_type: ConceptNodeType;
  domain: string | null; // e.g., 'physics', 'anatomy', 'instrumentation'
  importance: 1 | 2 | 3 | 4 | 5 | null;
  graph_x: number | null;
  graph_y: number | null;
}

export interface ConceptEdge extends BaseEntity {
  source_id: UUID;
  target_id: UUID;
  relationship: ConceptRelationship;
  strength: number; // 0–1
  description_en: string | null;
  description_th: string | null;
}

// Composite for graph queries
export interface GraphPath {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  totalStrength: number;
}

// ---------------------------------------------------------------------------
// User & SRS Progress Types
// ---------------------------------------------------------------------------

export interface User {
  id: UUID;
  display_name: string | null;
  preferred_language: PreferredLanguage;
  year_level: 1 | 2 | 3 | 4 | null;
  daily_review_target: number; // default 50
  fsrs_parameters: number[]; // 19-element array (w0–w18)
  timezone: string; // default 'Asia/Bangkok'
  created_at: string;
  updated_at: string;
}

export interface CardReview extends BaseEntity {
  user_id: UUID;
  flashcard_id: UUID;
  // FSRS-5 state
  stability: number;
  difficulty: number; // [0, 10]
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: SrsState;
  last_review: string | null;
  next_review: string | null;
  // Legacy SM-2 fields
  ease_factor: number; // default 2.5
  interval_days: number;
}

export interface ReviewLog extends BaseEntity {
  user_id: UUID;
  flashcard_id: UUID;
  rating: ReviewRating;
  state_before: SrsState;
  state_after: SrsState;
  elapsed_days: number | null;
  scheduled_days: number | null;
  review_duration_ms: number | null;
  reviewed_at: string;
}

export interface StudySession extends BaseEntity {
  user_id: UUID;
  course_id: UUID | null;
  module_id: UUID | null;
  cards_reviewed: number;
  cards_new: number;
  cards_relearning: number;
  total_duration_ms: number;
  started_at: string;
  ended_at: string | null;
}

// ---------------------------------------------------------------------------
// FSRS Parameter Set (w0–w18 = 19 parameters)
// ---------------------------------------------------------------------------
export const FSRS_DEFAULT_PARAMETERS: number[] = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94,
  2.18, 0.05, 0.34, 1.26, 0.29, 2.61, 0.0, 0.0,
];

// ---------------------------------------------------------------------------
// Troubleshooting Scenario Types
// ---------------------------------------------------------------------------

export interface Scenario extends BaseEntity {
  title_en: string;
  title_th: string | null;
  description_en: string | null;
  description_th: string | null;
  domain: string; // 'clinical', 'instrumentation', 'circuit_debug'
  difficulty: 1 | 2 | 3 | 4 | 5 | null;
  time_limit_seconds: number | null;
  module_id: UUID | null;
}

export interface ScenarioNode extends BaseEntity {
  scenario_id: UUID;
  node_type: ScenarioNodeType;
  content_en: string;
  content_th: string | null;
  image_url: string | null;
  is_entry_point: boolean;
}

export interface ScenarioTransition extends BaseEntity {
  from_node_id: UUID;
  to_node_id: UUID;
  label_en: string;
  label_th: string | null;
  is_correct: boolean;
  penalty_seconds: number; // default 0
  feedback_en: string | null;
  feedback_th: string | null;
  sort_order: number;
}

// ---------------------------------------------------------------------------
// State Machine Context for Scenario Runner (used by XState)
// ---------------------------------------------------------------------------
export interface ScenarioMachineContext {
  scenario: Scenario;
  currentNodeId: UUID;
  visitedNodeIds: UUID[];
  score: number;
  penaltySeconds: number;
  elapsedSeconds: number;
  timeLimitSeconds: number | null;
  isTimedOut: boolean;
  history: ScenarioTransition[];
}

// ---------------------------------------------------------------------------
// Sync Engine Types
// ---------------------------------------------------------------------------

export type SyncOperation = 'create' | 'update' | 'delete';

export interface MutationEntry {
  id: UUID;
  table: string;
  operation: SyncOperation;
  record: Record<string, unknown>;
  timestamp: number;
  _sync_version: number;
}

export interface ConflictResolution {
  strategy: 'last_write_wins' | 'client_wins' | 'server_wins';
  resolvedRecord: Record<string, unknown>;
  vectorClock: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Composite Curriculum Tree (derived type for Zustand store)
// ---------------------------------------------------------------------------

export interface CurriculumTree {
  years: (Year & {
    semesters: (Semester & {
      courses: (Course & {
        modules: Module[];
      })[];
    })[];
  })[];
}