-- Curriculum hierarchy: Year → Semester → Course → Module
CREATE TABLE years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_number SMALLINT NOT NULL UNIQUE CHECK (year_number BETWEEN 1 AND 4),
  title_en TEXT NOT NULL,
  title_th TEXT NOT NULL,
  description_en TEXT,
  description_th TEXT,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id UUID NOT NULL REFERENCES years(id),
  semester_number SMALLINT NOT NULL CHECK (semester_number BETWEEN 1 AND 3),
  title_en TEXT NOT NULL,
  title_th TEXT NOT NULL,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (year_id, semester_number)
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id),
  course_code TEXT,
  title_en TEXT NOT NULL,
  title_th TEXT NOT NULL,
  description_en TEXT,
  description_th TEXT,
  credit_hours SMALLINT,
  color_hex CHAR(7),
  icon_name TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id),
  title_en TEXT NOT NULL,
  title_th TEXT NOT NULL,
  description_en TEXT,
  description_th TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_modules_course ON modules(course_id);
CREATE INDEX idx_courses_semester ON courses(semester_id);
CREATE INDEX idx_semesters_year ON semesters(year_id);

CREATE TYPE card_type AS ENUM ('basic', 'cloze', 'equation', 'image_occlusion', 'multi_choice', 'signal_interactive');

CREATE TABLE occlusion_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id),
  title_en TEXT NOT NULL,
  title_th TEXT,
  image_url TEXT NOT NULL,
  image_width INT NOT NULL,
  image_height INT NOT NULL,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id),
  card_type card_type NOT NULL DEFAULT 'basic',
  front_en TEXT NOT NULL,
  front_th TEXT,
  back_en TEXT NOT NULL,
  back_th TEXT,
  front_latex TEXT,
  back_latex TEXT,
  front_markdown TEXT,
  back_markdown TEXT,
  occlusion_set_id UUID REFERENCES occlusion_sets(id),
  tags TEXT[],
  difficulty_tier SMALLINT CHECK (difficulty_tier BETWEEN 1 AND 5),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE equation_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id),
  name_en TEXT NOT NULL,
  name_th TEXT,
  latex_source TEXT NOT NULL,
  description_en TEXT,
  description_th TEXT,
  variables JSONB,
  tags TEXT[],
  sort_order SMALLINT NOT NULL DEFAULT 0,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE occlusion_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occlusion_set_id UUID NOT NULL REFERENCES occlusion_sets(id),
  label_en TEXT,
  label_th TEXT,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  reveal_order SMALLINT NOT NULL DEFAULT 0,
  shape TEXT NOT NULL DEFAULT 'rect' CHECK (shape IN ('rect', 'ellipse', 'polygon')),
  polygon_points REAL[],
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_flashcards_module ON flashcards(module_id);
CREATE INDEX idx_flashcards_tags ON flashcards USING GIN(tags);
CREATE INDEX idx_equations_module ON equation_bank(module_id);
CREATE INDEX idx_occlusion_regions_set ON occlusion_regions(occlusion_set_id);

CREATE TABLE concept_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en TEXT NOT NULL,
  title_th TEXT,
  description_en TEXT,
  description_th TEXT,
  module_id UUID REFERENCES modules(id),
  flashcard_ids UUID[],
  node_type TEXT NOT NULL DEFAULT 'concept' CHECK (node_type IN ('concept', 'skill', 'principle', 'system')),
  domain TEXT,
  importance SMALLINT CHECK (importance BETWEEN 1 AND 5),
  graph_x REAL,
  graph_y REAL,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE concept_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES concept_nodes(id),
  target_id UUID NOT NULL REFERENCES concept_nodes(id),
  relationship TEXT NOT NULL CHECK (relationship IN (
    'prerequisite', 'applies_to', 'extends', 'contradicts',
    'analogous_to', 'component_of', 'clinical_application'
  )),
  strength REAL NOT NULL DEFAULT 1.0 CHECK (strength BETWEEN 0 AND 1),
  description_en TEXT,
  description_th TEXT,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (source_id, target_id, relationship)
);

CREATE INDEX idx_edges_source ON concept_edges(source_id);
CREATE INDEX idx_edges_target ON concept_edges(target_id);
CREATE INDEX idx_concept_nodes_module ON concept_nodes(module_id);

CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES modules(id),
  title_en TEXT NOT NULL,
  title_th TEXT,
  description_en TEXT,
  description_th TEXT,
  domain TEXT NOT NULL DEFAULT 'clinical',
  difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  time_limit_seconds INT,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE scenario_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id),
  node_type TEXT NOT NULL CHECK (node_type IN ('prompt', 'decision', 'outcome_success', 'outcome_failure', 'info')),
  content_en TEXT NOT NULL,
  content_th TEXT,
  is_entry_point BOOLEAN NOT NULL DEFAULT false,
  time_penalty_seconds INT DEFAULT 0,
  score_award INT DEFAULT 0,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE scenario_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id UUID NOT NULL REFERENCES scenario_nodes(id),
  to_node_id UUID NOT NULL REFERENCES scenario_nodes(id),
  label_en TEXT NOT NULL,
  label_th TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  _sync_version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
