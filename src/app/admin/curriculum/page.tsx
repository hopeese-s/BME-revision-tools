'use client';

import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  BookOpen,
  GraduationCap,
  Library,
  Layers,
  Plus,
  Save,
  Sparkles,
  ChevronDown,
  Trash2,
  FileText,
} from 'lucide-react';
import { initDb } from '@/lib/db';
import type { UUID, Year, Semester, Course, Module } from '@/types/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CurriculumTree extends Year {
  semesters: (Semester & { courses: (Course & { modules: Module[] })[] })[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminCurriculumPage() {
  const [tree, setTree] = useState<CurriculumTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'curriculum' | 'compile'>('curriculum');

  // Form state
  const [showYearForm, setShowYearForm] = useState(false);
  const [showSemesterForm, setShowSemesterForm] = useState<UUID | null>(null);
  const [showCourseForm, setShowCourseForm] = useState<UUID | null>(null);
  const [showModuleForm, setShowModuleForm] = useState<UUID | null>(null);

  // Form fields (bilingual)
  const [newYearNum, setNewYearNum] = useState('');
  const [newSemNum, setNewSemNum] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitleEn, setNewCourseTitleEn] = useState('');
  const [newCourseTitleTh, setNewCourseTitleTh] = useState('');
  const [newModTitleEn, setNewModTitleEn] = useState('');
  const [newModTitleTh, setNewModTitleTh] = useState('');
  const [newModDescEn, setNewModDescEn] = useState('');
  const [newModDescTh, setNewModDescTh] = useState('');

  // Compilation state
  const [compiledTerms, setCompiledTerms] = useState<{ termName: string; modules: Module[]; cards: { en: string; th: string | null }[] }[]>([]);
  const [compiling, setCompiling] = useState(false);

  // -----------------------------------------------------------------------
  // Load data
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const db = await initDb();
      const data = await db.getCurriculumTree();
      setTree(data as CurriculumTree[]);
      setIsLoading(false);
    }
    load();
  }, []);

  // -----------------------------------------------------------------------
  // Handlers — Add
  // -----------------------------------------------------------------------
  async function addYear() {
    const n = parseInt(newYearNum, 10);
    if (!n || isNaN(n) || n < 1 || n > 4) return;
    const db = await initDb();
    const id = uuidv4() as UUID;
    await db.years.put({
      id,
      year_number: n as 1 | 2 | 3 | 4,
      title_en: `Year ${n}`,
      title_th: `ชั้นปีที่ ${n}`,
      description_en: null,
      description_th: null,
      _sync_version: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    setNewYearNum('');
    setShowYearForm(false);
    const data = await db.getCurriculumTree();
    setTree(data as CurriculumTree[]);
  }

  async function addSemester(yearId: UUID) {
    const n = parseInt(newSemNum, 10);
    if (!n || isNaN(n) || n < 1 || n > 3) return;
    const db = await initDb();
    const id = uuidv4() as UUID;
    await db.semesters.put({
      id,
      year_id: yearId,
      semester_number: n as 1 | 2 | 3,
      title_en: `Semester ${n}`,
      title_th: `ภาคการศึกษาที่ ${n}`,
      _sync_version: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    setNewSemNum('');
    setShowSemesterForm(null);
    const data = await db.getCurriculumTree();
    setTree(data as CurriculumTree[]);
  }

  async function addCourse(semesterId: UUID) {
    if (!newCourseCode || !newCourseTitleEn) return;
    const db = await initDb();
    const id = uuidv4() as UUID;
    const existing = await db.courses.toArray();
    const maxOrder = existing.filter(c => c.semester_id === semesterId).length;
    await db.courses.put({
      id,
      semester_id: semesterId,
      course_code: newCourseCode || null,
      title_en: newCourseTitleEn,
      title_th: newCourseTitleTh,
      description_en: null,
      description_th: null,
      credit_hours: null,
      color_hex: null,
      icon_name: null,
      sort_order: maxOrder + 1,
      _sync_version: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    setNewCourseCode('');
    setNewCourseTitleEn('');
    setNewCourseTitleTh('');
    setShowCourseForm(null);
    const data = await db.getCurriculumTree();
    setTree(data as CurriculumTree[]);
  }

  async function addModule(courseId: UUID) {
    if (!newModTitleEn) return;
    const db = await initDb();
    const id = uuidv4() as UUID;
    const existing = await db.modules.toArray();
    const maxOrder = existing.filter(m => m.course_id === courseId).length;
    await db.modules.put({
      id,
      course_id: courseId,
      title_en: newModTitleEn,
      title_th: newModTitleTh || '',
      description_en: newModDescEn || null,
      description_th: newModDescTh || null,
      sort_order: maxOrder + 1,
      _sync_version: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    setNewModTitleEn('');
    setNewModTitleTh('');
    setNewModDescEn('');
    setNewModDescTh('');
    setShowModuleForm(null);
    const data = await db.getCurriculumTree();
    setTree(data as CurriculumTree[]);
  }

  // -----------------------------------------------------------------------
  // Handlers — Delete
  // -----------------------------------------------------------------------
  async function deleteModule(moduleId: UUID) {
    if (!confirm('Delete this module? This will also delete all flashcards, equations, etc. in this module.')) return;
    const db = await initDb();
    await db.modules.delete(moduleId);
    await db.flashcards.where('module_id').equals(moduleId).delete();
    await db.equationBanks.where('module_id').equals(moduleId).delete();
    await db.occlusionSets.where('module_id').equals(moduleId).delete();
    await db.scenarios.where('module_id').equals(moduleId).delete();
    await db.conceptNodes.where('module_id').equals(moduleId).delete();
    const data = await db.getCurriculumTree();
    setTree(data as CurriculumTree[]);
  }

  // -----------------------------------------------------------------------
  // Compile & Summarize by Terms/Chapters
  // -----------------------------------------------------------------------
  async function handleCompile() {
    setCompiling(true);
    const db = await initDb();
    const allModules = await db.modules.toArray();
    const allFlashcards = await db.flashcards.toArray();
    const terms = new Map<string, { modules: Module[]; cards: { en: string; th: string | null }[] }>();

    for (const mod of allModules) {
      const modCards = allFlashcards.filter(c => c.module_id === mod.id);
      const termName = `Module: ${mod.title_en}`;
      if (!terms.has(termName)) {
        terms.set(termName, { modules: [], cards: [] });
      }
      const entry = terms.get(termName)!;
      entry.modules.push(mod);
      entry.cards.push(
        ...modCards.map(c => ({
          en: `${c.front_en}\n\n${c.back_en}`,
          th: c.front_th && c.back_th ? `${c.front_th}\n\n${c.back_th}` : null,
        })),
      );
    }

    const compiled = Array.from(terms.entries()).map(([termName, data]) => ({
      termName,
      modules: data.modules,
      cards: data.cards,
    }));

    setCompiledTerms(compiled);
    setCompiling(false);
  }

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------
  const stats = useMemo(() => {
    let years = 0, semesters = 0, courses = 0, modules = 0;
    for (const y of tree) {
      years++;
      for (const s of y.semesters) {
        semesters++;
        for (const c of s.courses) {
          courses++;
          modules += c.modules.length;
        }
      }
    }
    return { years, semesters, courses, modules };
  }, [tree]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="p-8" style={{ backgroundColor: 'var(--cream)', minHeight: '100vh' }}>
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12" style={{ backgroundColor: 'var(--cream-dark)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" style={{ backgroundColor: 'var(--cream)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold tracking-tight mb-2"
          style={{ fontFamily: "'Fraunces', Georgia, serif", color: 'var(--ink)' }}
        >
          Curriculum & Summaries
        </h1>
        <p
          className="text-sm"
          style={{ fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--ink-muted)' }}
        >
          Manage the curriculum tree and compile long-form summaries for revision.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', borderBottom: '2px solid rgba(26, 19, 9, 0.08)' }}>
        {(['curriculum', 'compile'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'all 0.15s',
              fontFamily: "'Inter', system-ui, sans-serif",
              color: activeTab === tab ? 'var(--ink)' : 'var(--ink-faint)',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--amber)' : '2px solid transparent',
              marginBottom: '-2px',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {tab === 'curriculum' ? 'Curriculum Tree' : 'Compile Summaries'}
          </button>
        ))}
      </div>

      {/* ── CURRICULUM TREE TAB ── */}
      {activeTab === 'curriculum' && (
        <div>
          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { icon: BookOpen, label: 'Years', value: stats.years },
              { icon: GraduationCap, label: 'Semesters', value: stats.semesters },
              { icon: Library, label: 'Courses', value: stats.courses },
              { icon: Layers, label: 'Modules', value: stats.modules },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                style={{ padding: '1rem', backgroundColor: '#FDFBF7', border: '1px solid rgba(26, 19, 9, 0.08)' }}
              >
                <Icon size={16} strokeWidth={2} style={{ color: 'var(--ink-faint)', marginBottom: 4 }} />
                <div className="text-2xl font-bold" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>{value}</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--ink-faint)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Tree */}
          <div className="space-y-8">
            {tree.map(year => (
              <div key={year.id}>
                {/* Year header */}
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', marginBottom: '0.75rem', backgroundColor: 'var(--ink)', color: 'var(--cream)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <BookOpen size={18} strokeWidth={2} />
                    <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                      Year {year.year_number}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowSemesterForm(year.id)}
                    className="imp-btn"
                  >
                    <Plus size={12} strokeWidth={2.5} /> Add Semester
                  </button>
                </div>

                {/* Semester form inline */}
                {showSemesterForm === year.id && (
                  <div
                    className="p-4 mb-3 flex items-end gap-3"
                    style={{ backgroundColor: 'var(--cream-dark)', border: '1px solid rgba(26, 19, 9, 0.1)' }}
                  >
                    <div className="flex-1">
                      <label className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--ink-faint)' }}>
                        Semester Number
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={3}
                        value={newSemNum}
                        onChange={e => setNewSemNum(e.target.value)}
                        className="w-full p-2 text-sm"
                        style={{
                          fontFamily: "'Inter', system-ui, sans-serif",
                          border: '1px solid rgba(26, 19, 9, 0.15)',
                          backgroundColor: '#FDFBF7',
                          outline: 'none',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                      />
                    </div>
                    <button
                      onClick={() => addSemester(year.id)}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-all duration-150"
                      style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        backgroundColor: 'var(--amber)',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#A84A14'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--amber)'; }}
                    >
                      <Save size={14} strokeWidth={2} /> Add
                    </button>
                    <button
                      onClick={() => setShowSemesterForm(null)}
                      className="px-4 py-2 text-sm uppercase tracking-wider"
                      style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(26, 19, 9, 0.15)',
                        color: 'var(--ink-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Semesters */}
                {year.semesters.map(semester => (
                  <div key={semester.id} className="ml-4 mb-4 pl-4" style={{ borderLeft: '2px solid rgba(26, 19, 9, 0.06)' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', marginBottom: '0.5rem', backgroundColor: 'var(--cream-dark)', border: '1px solid rgba(26, 19, 9, 0.06)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <GraduationCap size={16} strokeWidth={2} style={{ color: 'var(--amber)' }} />
                        <span className="text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                          Semester {semester.semester_number}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowCourseForm(semester.id)}
                        className="imp-btn"
                      >
                        <Plus size={10} strokeWidth={2.5} /> Add Course
                      </button>
                    </div>

                    {/* Course form inline */}
                    {showCourseForm === semester.id && (
                      <div
                        className="p-4 mb-2 space-y-3"
                        style={{ backgroundColor: '#FDFBF7', border: '1px solid rgba(26, 19, 9, 0.1)' }}
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--ink-faint)' }}>Course Code</label>
                            <input value={newCourseCode} onChange={e => setNewCourseCode(e.target.value)} className="imp-input" />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--ink-faint)' }}>Title (EN)</label>
                            <input value={newCourseTitleEn} onChange={e => setNewCourseTitleEn(e.target.value)} className="imp-input" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--ink-faint)' }}>Title (TH)</label>
                          <input value={newCourseTitleTh} onChange={e => setNewCourseTitleTh(e.target.value)} className="imp-input" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => addCourse(semester.id)} className="imp-btn imp-btn-accent">
                            <Save size={14} /> Add Course
                          </button>
                          <button onClick={() => setShowCourseForm(null)} className="imp-btn">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Courses */}
                    {semester.courses.map(course => (
                      <div key={course.id} className="ml-4 mb-3 pl-4" style={{ borderLeft: '1px solid rgba(26, 19, 9, 0.04)' }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem', marginBottom: '0.5rem', backgroundColor: '#FDFBF7', border: '1px solid rgba(26, 19, 9, 0.06)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Library size={14} strokeWidth={2} style={{ color: '#0d9488' }} />
                            <span className="text-xs font-semibold" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                              <span style={{ color: 'var(--ink-faint)', fontFamily: 'monospace' }}>{course.course_code}</span>
                              {' — '}
                              {course.title_en}
                              {course.title_th && <span style={{ color: 'var(--ink-faint)', marginLeft: 4 }}>({course.title_th})</span>}
                            </span>
                          </div>
                          <button
                            onClick={() => setShowModuleForm(course.id)}
                            className="imp-btn"
                          >
                            <Plus size={10} strokeWidth={2.5} /> Add Module
                          </button>
                        </div>

                        {/* Module form */}
                        {showModuleForm === course.id && (
                          <div
                            className="p-4 mb-2 space-y-3"
                            style={{ backgroundColor: '#FDFBF7', border: '1px solid rgba(26, 19, 9, 0.1)' }}
                          >
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--ink-faint)' }}>Title (EN)</label>
                                <input value={newModTitleEn} onChange={e => setNewModTitleEn(e.target.value)} className="imp-input" />
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--ink-faint)' }}>Title (TH)</label>
                                <input value={newModTitleTh} onChange={e => setNewModTitleTh(e.target.value)} className="imp-input" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--ink-faint)' }}>Description (EN)</label>
                                <textarea rows={2} value={newModDescEn} onChange={e => setNewModDescEn(e.target.value)} className="imp-input" />
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--ink-faint)' }}>Description (TH)</label>
                                <textarea rows={2} value={newModDescTh} onChange={e => setNewModDescTh(e.target.value)} className="imp-input" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => addModule(course.id)} className="imp-btn imp-btn-accent">
                                <Save size={14} /> Add Module
                              </button>
                              <button onClick={() => setShowModuleForm(null)} className="imp-btn">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Modules */}
                        {course.modules.map(mod => (
                          <div
                            key={mod.id}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem', marginBottom: '0.5rem', borderLeft: '2px solid rgba(196, 90, 27, 0.3)', backgroundColor: '#fff' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                              <Layers size={12} strokeWidth={2} style={{ color: 'var(--ink-faint)' }} />
                              <span className="text-xs" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                                {mod.title_en}
                                {mod.title_th && (
                                  <span style={{ color: 'var(--ink-faint)', fontSize: '0.625rem', marginLeft: 6 }}>
                                    {mod.title_th}
                                  </span>
                                )}
                              </span>
                            </div>
                            <button
                              onClick={() => deleteModule(mod.id)}
                              className="p-1.5 transition-all duration-150"
                              style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-faint)'; }}
                            >
                              <Trash2 size={14} strokeWidth={2} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Add Year button at bottom */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(26, 19, 9, 0.08)' }}>
            {!showYearForm ? (
              <button
                onClick={() => setShowYearForm(true)}
                className="imp-btn"
                style={{ width: '100%', borderStyle: 'dashed' }}
              >
                <Plus size={16} strokeWidth={2.5} /> Add New Year
              </button>
            ) : (
              <div className="flex items-end gap-3 p-4" style={{ backgroundColor: 'var(--cream-dark)', border: '1px solid rgba(26, 19, 9, 0.1)' }}>
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--ink-faint)' }}>Year Number</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={newYearNum}
                    onChange={e => setNewYearNum(e.target.value)}
                    className="w-full p-2 text-sm"
                    style={{
                      fontFamily: "'Inter', system-ui, sans-serif",
                      border: '1px solid rgba(26, 19, 9, 0.15)',
                      backgroundColor: '#FDFBF7',
                      outline: 'none',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                  />
                </div>
                <button onClick={addYear} className="imp-btn imp-btn-accent"><Save size={14} /> Add Year</button>
                <button onClick={() => { setShowYearForm(false); setNewYearNum(''); }} className="imp-btn">Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COMPILE TAB ── */}
      {activeTab === 'compile' && (
        <div>
          <div
            className="p-6 mb-6"
            style={{ backgroundColor: 'var(--cream-dark)', border: '1px solid rgba(26, 19, 9, 0.1)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Sparkles size={20} strokeWidth={2} style={{ color: 'var(--amber)' }} />
              <h2
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "'Fraunces', Georgia, serif", color: 'var(--ink)' }}
              >
                Compile & Summarize
              </h2>
            </div>
            <p
              className="text-sm mb-4"
              style={{ fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--ink-muted)' }}
            >
              Group all modules and their flashcards into long-form summaries for revision. Each term/chapter
              becomes a compiled document with front+back pairs rendered as readable prose.
            </p>
            <button
              onClick={handleCompile}
              disabled={compiling}
              className="imp-btn imp-btn-accent imp-btn-lg"
            >
              <FileText size={16} /> {compiling ? 'Compiling...' : 'Compile All Modules'}
            </button>
          </div>

          {compiledTerms.length > 0 && (
            <div className="space-y-6">
              {compiledTerms.map((term, i) => (
                <div
                  key={i}
                  className="p-6"
                  style={{ backgroundColor: '#FDFBF7', border: '1px solid rgba(26, 19, 9, 0.08)' }}
                >
                  <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(26, 19, 9, 0.06)' }}>
                    <Layers size={16} strokeWidth={2} style={{ color: 'var(--amber)' }} />
                    <h3
                      className="text-base font-bold tracking-tight"
                      style={{ fontFamily: "'Fraunces', Georgia, serif", color: 'var(--ink)' }}
                    >
                      {term.termName}
                    </h3>
                    <span
                      className="text-[10px] px-2 py-0.5 font-semibold uppercase tracking-wider"
                      style={{ backgroundColor: 'rgba(196, 90, 27, 0.08)', color: 'var(--amber)' }}
                    >
                      {term.cards.length} cards
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {term.cards.map((card, j) => (
                      <div
                        key={j}
                        className="p-3"
                        style={{ backgroundColor: 'var(--cream-dark)', borderLeft: '3px solid #0d9488' }}
                      >
                        <div
                          className="text-sm whitespace-pre-wrap leading-relaxed"
                          style={{ fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--ink)' }}
                        >
                          {card.en}
                        </div>
                        {card.th && (
                          <div
                            className="text-sm whitespace-pre-wrap leading-relaxed mt-2 pt-2"
                            style={{
                              fontFamily: "'Inter', system-ui, sans-serif",
                              color: 'var(--ink-muted)',
                              borderTop: '1px dashed rgba(26, 19, 9, 0.1)',
                            }}
                          >
                            {card.th}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!compiling && compiledTerms.length === 0 && (
            <div
              className="p-12 text-center"
              style={{
                backgroundColor: '#FDFBF7',
                border: '1px solid rgba(26, 19, 9, 0.06)',
                color: 'var(--ink-faint)',
              }}
            >
              <FileText size={40} strokeWidth={1} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p className="text-sm" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                Click "Compile All Modules" to generate long-form summaries for revision.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}