// ============================================================================
// EgBE Memory & Revision Engine — Syllabus Store (Zustand)
//
// Manages the curriculum tree (Year → Semester → Course → Module),
// selected module state, and flashcard/equation deck queries.
// All data sourced from Dexie.js (IndexedDB).
// ============================================================================

import { create } from 'zustand';
import { getDb, initDb } from '@/lib/db';
import { KnowledgeGraph } from '@/lib/knowledge-graph';
import type {
  ConceptEdge,
  ConceptNode,
  Course,
  EquationBank,
  Flashcard,
  Module,
  OcclusionSet,
  Scenario,
  Semester,
  UUID,
  Year,
} from '@/types/schema';

export interface SyllabusStore {
  // Data
  years: (Year & {
    semesters: (Semester & {
      courses: (Course & { modules: Module[] })[];
    })[];
  })[];
  isLoading: boolean;
  error: string | null;

  // Selection state
  selectedYearId: UUID | null;
  selectedSemesterId: UUID | null;
  selectedCourseId: UUID | null;
  selectedModuleId: UUID | null;

  // Current module's content
  flashcards: Flashcard[];
  equations: EquationBank[];
  occlusionSets: OcclusionSet[];
  scenarios: Scenario[];

  // Knowledge graph (built from conceptNodes + conceptEdges in module)
  graph: KnowledgeGraph | null;

  // Actions
  loadCurriculum: () => Promise<void>;
  selectYear: (yearId: UUID) => void;
  selectSemester: (semesterId: UUID) => void;
  selectCourse: (courseId: UUID) => void;
  selectModule: (moduleId: UUID) => Promise<void>;
  refreshModuleContent: () => Promise<void>;

  // Utility
  getSelectedYear: () => (Year & { semesters: (Semester & { courses: (Course & { modules: Module[] })[] })[] }) | undefined;
  getSelectedSemester: () => (Semester & { courses: (Course & { modules: Module[] })[] }) | undefined;
  getSelectedCourse: () => (Course & { modules: Module[] }) | undefined;
  getSelectedModule: () => Module | undefined;
}

export const useSyllabusStore = create<SyllabusStore>()((set, get) => ({
  // Data
  years: [],
  isLoading: false,
  error: null,

  // Selection state
  selectedYearId: null,
  selectedSemesterId: null,
  selectedCourseId: null,
  selectedModuleId: null,

  // Current module content
  flashcards: [],
  equations: [],
  occlusionSets: [],
  scenarios: [],

  // Knowledge graph
  graph: null,

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  loadCurriculum: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await initDb();
      const tree = await db.getCurriculumTree();
      set({ years: tree, isLoading: false });
    } catch (err) {
      set({
        error: (err as Error).message,
        isLoading: false,
      });
    }
  },

  selectYear: (yearId: UUID) => {
    set({
      selectedYearId: yearId,
      selectedSemesterId: null,
      selectedCourseId: null,
      selectedModuleId: null,
      flashcards: [],
      equations: [],
      occlusionSets: [],
      scenarios: [],
      graph: null,
    });
  },

  selectSemester: (semesterId: UUID) => {
    const { years, selectedYearId } = get();
    const year = years.find((y) => y.id === selectedYearId);
    const semester = year?.semesters.find((s) => s.id === semesterId);

    set({
      selectedSemesterId: semester ? semesterId : null,
      selectedCourseId: null,
      selectedModuleId: null,
      flashcards: [],
      equations: [],
      occlusionSets: [],
      scenarios: [],
      graph: null,
    });
  },

  selectCourse: (courseId: UUID) => {
    const { years, selectedYearId, selectedSemesterId } = get();
    const year = years.find((y) => y.id === selectedYearId);
    const semester = year?.semesters.find((s) => s.id === selectedSemesterId);
    const course = semester?.courses.find((c) => c.id === courseId);

    set({
      selectedCourseId: course ? courseId : null,
      selectedModuleId: null,
      flashcards: [],
      equations: [],
      occlusionSets: [],
      scenarios: [],
      graph: null,
    });
  },

  selectModule: async (moduleId: UUID) => {
    const { years, selectedYearId, selectedSemesterId, selectedCourseId } = get();
    const year = years.find((y) => y.id === selectedYearId);
    const semester = year?.semesters.find((s) => s.id === selectedSemesterId);
    const course = semester?.courses.find((c) => c.id === selectedCourseId);
    const module = course?.modules.find((m) => m.id === moduleId);

    if (!module) {
      set({
        selectedModuleId: null,
        flashcards: [],
        equations: [],
        occlusionSets: [],
        scenarios: [],
        graph: null,
      });
      return;
    }

    set({ selectedModuleId: moduleId, isLoading: true, error: null });

    try {
      const db = getDb();
      const flashcardsPromise = db.getFlashcardsByModule(moduleId);
      const equationsPromise = db.getEquationsByModule(moduleId);
      const occlusionSetsPromise = db.occlusionSets.where('module_id').equals(moduleId).toArray();
      const scenariosPromise = db.getScenariosByModule(moduleId);
      const conceptNodesPromise = db.getConceptNodesByModule(moduleId);

      const [flashcards, equations, occlusionSets, scenarios, conceptNodes] = await Promise.all([
        flashcardsPromise,
        equationsPromise,
        occlusionSetsPromise,
        scenariosPromise,
        conceptNodesPromise,
      ]);

      const conceptNodesArray = conceptNodes as ConceptNode[];
      const nodeIds = new Set(conceptNodesArray.map((n) => n.id));

      const allEdges = await db.conceptEdges.toArray();
      const conceptEdges = allEdges.filter(
        (e) => nodeIds.has(e.source_id) || nodeIds.has(e.target_id),
      );

      const graph = new KnowledgeGraph(conceptNodesArray, conceptEdges);

      set({
        flashcards: flashcards as Flashcard[],
        equations: equations as EquationBank[],
        occlusionSets: occlusionSets as OcclusionSet[],
        scenarios: scenarios as Scenario[],
        graph,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: (err as Error).message,
        isLoading: false,
      });
    }
  },

  refreshModuleContent: async () => {
    const { selectedModuleId } = get();
    if (selectedModuleId) {
      await get().selectModule(selectedModuleId);
    }
  },

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  getSelectedYear: () => {
    const { years, selectedYearId } = get();
    return years.find((y) => y.id === selectedYearId);
  },

  getSelectedSemester: () => {
    const { years, selectedYearId, selectedSemesterId } = get();
    const year = years.find((y) => y.id === selectedYearId);
    return year?.semesters.find((s) => s.id === selectedSemesterId);
  },

  getSelectedCourse: () => {
    const { years, selectedYearId, selectedSemesterId, selectedCourseId } = get();
    const year = years.find((y) => y.id === selectedYearId);
    const semester = year?.semesters.find((s) => s.id === selectedSemesterId);
    return semester?.courses.find((c) => c.id === selectedCourseId);
  },

  getSelectedModule: () => {
    const { years, selectedYearId, selectedSemesterId, selectedCourseId, selectedModuleId } =
      get();
    const year = years.find((y) => y.id === selectedYearId);
    const semester = year?.semesters.find((s) => s.id === selectedSemesterId);
    const course = semester?.courses.find((c) => c.id === selectedCourseId);
    return course?.modules.find((m) => m.id === selectedModuleId);
  },
}));