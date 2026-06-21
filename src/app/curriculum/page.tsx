'use client';

// ============================================================================
// EgBE Memory & Revision Engine — Curriculum Page
//
// Uses useSyllabusStore for all state management (Year → Semester → Course → Module).
// Displays the curriculum tree and selected module content.
//
// Style: impeccable.style — brutalist, high-density, zero AI slop
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSyllabusStore } from '@/stores/syllabus-store';
import { useLanguageStore } from '@/stores/language-store';
import type { UUID } from '@/types/schema';

// ---------------------------------------------------------------------------
// Curriculum Page
// ---------------------------------------------------------------------------

export default function CurriculumPage() {
  const router = useRouter();

  // Syllabus store — single source of truth for tree + selection
  const {
    years,
    isLoading,
    error,
    selectedYearId,
    selectedSemesterId,
    selectedCourseId,
    selectedModuleId,
    flashcards,
    equations,
    occlusionSets,
    scenarios,
    loadCurriculum,
    selectYear,
    selectSemester,
    selectCourse,
    selectModule,
  } = useSyllabusStore();

  const { language, toggleLanguage, t } = useLanguageStore();

  // Load curriculum on mount
  useEffect(() => {
    if (years.length === 0 && !isLoading && !error) {
      loadCurriculum();
    }
  }, [years.length, isLoading, error, loadCurriculum]);

  // Handlers — toggle selection logic
  const handleYearClick = useCallback(
    (yearId: UUID) => {
      if (selectedYearId === yearId) {
        selectYear(null as unknown as UUID); // deselect
      } else {
        selectYear(yearId);
      }
    },
    [selectedYearId, selectYear],
  );

  const handleSemesterClick = useCallback(
    (semesterId: UUID) => {
      if (selectedSemesterId === semesterId) {
        selectSemester(null as unknown as UUID);
      } else {
        selectSemester(semesterId);
      }
    },
    [selectedSemesterId, selectSemester],
  );

  const handleCourseClick = useCallback(
    (courseId: UUID) => {
      if (selectedCourseId === courseId) {
        selectCourse(null as unknown as UUID);
      } else {
        selectCourse(courseId);
      }
    },
    [selectedCourseId, selectCourse],
  );

  const handleModuleClick = useCallback(
    async (moduleId: UUID) => {
      if (selectedModuleId === moduleId) {
        selectModule(null as unknown as UUID);
      } else {
        await selectModule(moduleId);
      }
    },
    [selectedModuleId, selectModule],
  );

  const handleStudyModule = (moduleId: UUID) => {
    router.push(`/study?moduleId=${moduleId}`);
  };

  const S = {
    page: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '4rem 1.5rem',
      fontFamily: 'var(--font-inter), sans-serif',
      color: '#1A1309',
      minHeight: '100vh',
    } as React.CSSProperties,
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(26,19,9,0.08)',
      paddingBottom: '1.5rem',
      marginBottom: '2.5rem',
    },
    h1: {
      fontFamily: 'var(--font-fraunces), serif',
      fontSize: '2.25rem',
      fontWeight: 600,
      color: '#1A1309',
      letterSpacing: '-0.02em',
      marginBottom: '0.25rem',
    },
    subtitle: {
      fontSize: '0.875rem',
      color: '#8A7F72',
      fontWeight: 500,
    },
    langBtn: {
      padding: '0.375rem 0.875rem',
      borderRadius: '9999px',
      border: '1px solid rgba(26,19,9,0.15)',
      backgroundColor: '#FDFBF7',
      color: '#1A1309',
      fontSize: '0.75rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.15s',
    },
    layout: {
      display: 'flex',
      gap: '2.5rem',
      alignItems: 'flex-start',
    },
    treeContainer: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '0.5rem',
    },
    panelContainer: {
      width: '400px',
      flexShrink: 0,
      position: 'sticky' as const,
      top: '2rem',
    },
    panelBox: {
      backgroundColor: '#FFFFFF',
      border: '1px solid rgba(26,19,9,0.09)',
      borderRadius: '1rem',
      overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(26,19,9,0.04)',
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: '4rem 2rem',
      backgroundColor: '#FFFFFF',
      borderRadius: '1rem',
      border: '1px dashed rgba(26,19,9,0.15)',
      marginBottom: '2rem',
    },
    cardItem: {
      backgroundColor: '#FFFFFF',
      border: '1px solid rgba(26,19,9,0.09)',
      borderRadius: '0.75rem',
      overflow: 'hidden',
    },
    btnYear: {
      width: '100%',
      textAlign: 'left' as const,
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      border: 'none',
      borderLeft: '3px solid transparent',
      transition: 'background-color 0.15s, border-color 0.15s',
    },
    btnSem: {
      width: '100%',
      textAlign: 'left' as const,
      padding: '0.75rem 1.25rem 0.75rem 2.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      border: 'none',
      borderLeft: '2px solid transparent',
      fontSize: '0.95rem',
      transition: 'background-color 0.15s, border-color 0.15s',
    },
    btnCourse: {
      width: '100%',
      textAlign: 'left' as const,
      padding: '0.6rem 1.25rem 0.6rem 3.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      border: 'none',
      borderLeft: '2px solid transparent',
      fontSize: '0.875rem',
      transition: 'background-color 0.15s, border-color 0.15s',
    },
    btnMod: {
      flex: 1,
      textAlign: 'left' as const,
      padding: '0.5rem 1.25rem 0.5rem 4.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      border: 'none',
      borderLeft: '2px solid transparent',
      fontSize: '0.875rem',
      transition: 'background-color 0.15s, border-color 0.15s',
    },
  };

  // Loading state
  if (isLoading && years.length === 0) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8A7F72', fontSize: '0.875rem', fontWeight: 500, opacity: 0.7 }}>
          Loading curriculum…
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', padding: '1.5rem', borderRadius: '1rem', maxWidth: '400px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e11d48', marginBottom: '0.5rem' }}>Error</div>
          <div style={{ fontSize: '0.875rem', color: '#be123c', marginBottom: '1rem' }}>{error}</div>
          <button
            onClick={() => loadCurriculum()}
            style={{ padding: '0.5rem 1rem', borderRadius: '9999px', backgroundColor: '#e11d48', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Curriculum</h1>
          <p style={S.subtitle}>
            {t('nav.curriculum')} — Year {'>'} Semester {'>'} Course {'>'} Module
          </p>
        </div>
        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          style={S.langBtn}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#f3f0e8';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.25)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#FDFBF7';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.15)';
          }}
        >
          {language === 'en' ? 'EN → TH' : 'TH → EN'}
        </button>
      </div>

      {/* Empty State */}
      {years.length === 0 && (
        <div style={S.emptyState}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1A1309', marginBottom: '0.5rem' }}>No curriculum data</div>
          <p style={{ fontSize: '0.875rem', color: '#6A5C4E' }}>
            Visit the{' '}
            <a href="/" style={{ color: '#C45A1B', textDecoration: 'underline' }}>
              home page
            </a>{' '}
            to seed data.
          </p>
        </div>
      )}

      {/* Two-Column Layout */}
      <div style={S.layout}>
        {/* Left: Curriculum Tree */}
        <div style={S.treeContainer}>
          {years.map((year) => {
            const isYearSelected = selectedYearId === year.id;
            return (
              <div key={year.id} style={S.cardItem}>
                {/* Year Row */}
                <button
                  onClick={() => handleYearClick(year.id)}
                  style={{
                    ...S.btnYear,
                    backgroundColor: isYearSelected ? 'rgba(13,148,136,0.05)' : 'transparent',
                    borderColor: isYearSelected ? '#0d9488' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!isYearSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#faf9f6'; }}
                  onMouseLeave={(e) => { if (!isYearSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ color: '#8A7F72', width: '16px', textAlign: 'center', fontSize: '0.75rem' }}>
                    {isYearSelected ? '▾' : '▸'}
                  </span>
                  <span style={{ fontWeight: 600, color: isYearSelected ? '#0d9488' : '#1A1309', fontSize: '1.05rem' }}>
                    {language === 'th' && year.title_th ? year.title_th : year.title_en}
                  </span>
                  {language !== 'th' && year.title_th && (
                    <span style={{ color: '#8A7F72', fontSize: '0.85rem' }}>({year.title_th})</span>
                  )}
                  {language === 'th' && year.title_en && (
                    <span style={{ color: '#8A7F72', fontSize: '0.85rem' }}>({year.title_en})</span>
                  )}
                </button>

                {/* Semesters */}
                {isYearSelected && (
                  <div style={{ borderTop: '1px solid rgba(26,19,9,0.06)', paddingBottom: '0.5rem' }}>
                    {year.semesters.map((sem) => {
                      const isSemSelected = selectedSemesterId === sem.id;
                      return (
                        <div key={sem.id}>
                          <button
                            onClick={() => handleSemesterClick(sem.id)}
                            style={{
                              ...S.btnSem,
                              backgroundColor: isSemSelected ? 'rgba(13,148,136,0.03)' : 'transparent',
                              borderColor: isSemSelected ? 'rgba(13,148,136,0.4)' : 'transparent',
                            }}
                            onMouseEnter={(e) => { if (!isSemSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#faf9f6'; }}
                            onMouseLeave={(e) => { if (!isSemSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          >
                            <span style={{ color: '#8A7F72', width: '16px', textAlign: 'center', fontSize: '0.75rem' }}>
                              {isSemSelected ? '▾' : '▸'}
                            </span>
                            <span style={{ color: isSemSelected ? '#0d9488' : '#3c3224', fontWeight: isSemSelected ? 600 : 500 }}>
                              {language === 'th' && sem.title_th ? sem.title_th : sem.title_en}
                            </span>
                          </button>

                          {/* Courses */}
                          {isSemSelected && (
                            <div style={{ paddingBottom: '0.25rem' }}>
                              {sem.courses.map((course) => {
                                const isCourseSelected = selectedCourseId === course.id;
                                return (
                                  <div key={course.id}>
                                    <button
                                      onClick={() => handleCourseClick(course.id)}
                                      style={{
                                        ...S.btnCourse,
                                        backgroundColor: isCourseSelected ? 'rgba(26,19,9,0.02)' : 'transparent',
                                        borderColor: isCourseSelected ? 'rgba(26,19,9,0.2)' : 'transparent',
                                      }}
                                      onMouseEnter={(e) => { if (!isCourseSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#faf9f6'; }}
                                      onMouseLeave={(e) => { if (!isCourseSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                                    >
                                      <span style={{ color: '#8A7F72', width: '16px', textAlign: 'center', fontSize: '0.75rem' }}>
                                        {isCourseSelected ? '▾' : '▸'}
                                      </span>
                                      <span style={{ color: '#8A7F72', fontFamily: 'monospace', fontSize: '0.75rem', width: '4rem', flexShrink: 0 }}>
                                        {course.course_code}
                                      </span>
                                      <span style={{ color: isCourseSelected ? '#1A1309' : '#6A5C4E', fontWeight: isCourseSelected ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {language === 'th' && course.title_th ? course.title_th : course.title_en}
                                      </span>
                                    </button>

                                    {/* Modules */}
                                    {isCourseSelected && (
                                      <div style={{ paddingBottom: '0.25rem' }}>
                                        {course.modules.map((mod) => {
                                          const isModuleSelected = selectedModuleId === mod.id;
                                          return (
                                            <div key={mod.id} style={{ display: 'flex', alignItems: 'center' }}>
                                              <button
                                                onClick={() => handleModuleClick(mod.id)}
                                                style={{
                                                  ...S.btnMod,
                                                  backgroundColor: isModuleSelected ? 'rgba(196,90,27,0.05)' : 'transparent',
                                                  borderColor: isModuleSelected ? '#C45A1B' : 'transparent',
                                                  color: isModuleSelected ? '#C45A1B' : '#6A5C4E',
                                                  fontWeight: isModuleSelected ? 600 : 400,
                                                }}
                                                onMouseEnter={(e) => { if (!isModuleSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#faf9f6'; }}
                                                onMouseLeave={(e) => { if (!isModuleSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                                              >
                                                {language === 'th' && mod.title_th ? mod.title_th : mod.title_en}
                                              </button>
                                              {/* Quick Study Button */}
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleStudyModule(mod.id);
                                                }}
                                                style={{
                                                  flexShrink: 0,
                                                  fontSize: '0.65rem',
                                                  fontWeight: 700,
                                                  letterSpacing: '0.05em',
                                                  textTransform: 'uppercase',
                                                  color: '#8A7F72',
                                                  border: '1px solid rgba(26,19,9,0.15)',
                                                  backgroundColor: '#FFFFFF',
                                                  padding: '0.2rem 0.5rem',
                                                  borderRadius: '4px',
                                                  marginRight: '1rem',
                                                  cursor: 'pointer',
                                                  transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={(e) => {
                                                  (e.currentTarget as HTMLElement).style.borderColor = '#0d9488';
                                                  (e.currentTarget as HTMLElement).style.color = '#0d9488';
                                                }}
                                                onMouseLeave={(e) => {
                                                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.15)';
                                                  (e.currentTarget as HTMLElement).style.color = '#8A7F72';
                                                }}
                                                title="Study this module"
                                              >
                                                Study
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Content Panel */}
        <div style={S.panelContainer}>
          {/* Module Info */}
          {selectedModuleId ? (
            <div style={S.panelBox}>
              {/* Module Header */}
              <div style={{ borderBottom: '1px solid rgba(26,19,9,0.08)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FDFBF7' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7F72' }}>
                    Module
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1A1309', marginTop: '0.15rem' }}>
                    {language === 'th'
                      ? (() => {
                          for (const year of years) {
                            for (const sem of year.semesters) {
                              for (const course of sem.courses) {
                                const mod = course.modules.find((m) => m.id === selectedModuleId);
                                if (mod) return mod.title_th || mod.title_en;
                              }
                            }
                          }
                          return '';
                        })()
                      : (() => {
                          for (const year of years) {
                            for (const sem of year.semesters) {
                              for (const course of sem.courses) {
                                const mod = course.modules.find((m) => m.id === selectedModuleId);
                                if (mod) return mod.title_en;
                              }
                            }
                          }
                          return '';
                        })()}
                  </div>
                </div>
                <button
                  onClick={() => handleStudyModule(selectedModuleId)}
                  style={{
                    border: '1px solid #0d9488',
                    backgroundColor: 'rgba(13,148,136,0.1)',
                    color: '#0d9488',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.4rem 0.8rem',
                    borderRadius: '9999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#0d9488';
                    (e.currentTarget as HTMLElement).style.color = '#FFF';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(13,148,136,0.1)';
                    (e.currentTarget as HTMLElement).style.color = '#0d9488';
                  }}
                >
                  Study Now
                </button>
              </div>

              {/* Content Tabs */}
              <ContentTabs
                flashcards={flashcards}
                equations={equations}
                occlusionSets={occlusionSets}
                scenarios={scenarios}
                language={language}
                onSelectModule={handleModuleClick}
              />
            </div>
          ) : (
            /* Empty selection hint */
            <div style={S.emptyState}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7F72', marginBottom: '0.5rem' }}>
                Content Panel
              </div>
              <p style={{ fontSize: '0.875rem', color: '#6A5C4E', lineHeight: 1.5 }}>
                Select a module from the tree to view its flashcards, equations, occlusion sets, and clinical scenarios.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content Tabs — displays flashcards, equations, occlusions, scenarios
// ---------------------------------------------------------------------------

type TabKey = 'flashcards' | 'equations' | 'occlusions' | 'scenarios';

const TAB_LABELS_EN: Record<TabKey, string> = {
  flashcards: 'Flashcards',
  equations: 'Equations',
  occlusions: 'Occlusions',
  scenarios: 'Scenarios',
};

const TAB_LABELS_TH: Record<TabKey, string> = {
  flashcards: 'แฟลชการ์ด',
  equations: 'สมการ',
  occlusions: 'การบดบังภาพ',
  scenarios: 'สถานการณ์',
};

function ContentTabs({
  flashcards,
  equations,
  occlusionSets,
  scenarios,
  language,
  onSelectModule,
}: {
  flashcards: unknown[];
  equations: unknown[];
  occlusionSets: unknown[];
  scenarios: unknown[];
  language: 'en' | 'th';
  onSelectModule: (id: UUID) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('flashcards');
  const tabs = TAB_LABELS_EN;
  const tabsTH = TAB_LABELS_TH;

  const tabData: { key: TabKey; items: unknown[] }[] = [
    { key: 'flashcards', items: flashcards },
    { key: 'equations', items: equations },
    { key: 'occlusions', items: occlusionSets },
    { key: 'scenarios', items: scenarios },
  ];

  const activeItems = tabData.find((t) => t.key === activeTab)?.items ?? [];

  return (
    <div>
      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(26,19,9,0.08)', backgroundColor: '#FDFBF7' }}>
        {tabData.map(({ key }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                fontSize: '0.75rem',
                padding: '0.75rem 0',
                fontWeight: 700,
                border: 'none',
                borderRight: '1px solid rgba(26,19,9,0.08)',
                borderBottom: isActive ? '2px solid #0d9488' : '2px solid transparent',
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#0d9488' : '#8A7F72',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = '#1A1309';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = '#8A7F72';
              }}
            >
              {language === 'th' ? tabsTH[key] : tabs[key]}
              <span style={{ marginLeft: '0.25rem', color: isActive ? 'rgba(13,148,136,0.7)' : 'rgba(138,127,114,0.7)' }}>
                ({tabData.find((t) => t.key === key)?.items.length ?? 0})
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div style={{ maxHeight: '60vh', overflowY: 'auto', backgroundColor: '#FFFFFF' }}>
        {activeItems.length === 0 ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: '#8A7F72' }}>
              No {language === 'th' ? tabsTH[activeTab] : tabs[activeTab].toLowerCase()} in this module.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activeItems.map((item: any, idx: number) => (
              <div key={item.id ?? idx} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(26,19,9,0.06)' }}>
                {/* Flashcard */}
                {'front_en' in item && (
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#1A1309', fontWeight: 600, marginBottom: '0.25rem' }}>
                      {language === 'th' && item.front_th
                        ? item.front_th
                        : item.front_en}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#0d9488' }}>
                      {language === 'th' && item.back_th
                        ? item.back_th
                        : item.back_en}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      {item.tags?.map((tag: string) => (
                        <span
                          key={tag}
                          style={{ fontSize: '0.65rem', border: '1px solid rgba(26,19,9,0.15)', color: '#6A5C4E', padding: '0.15rem 0.4rem', borderRadius: '4px' }}
                        >
                          {tag}
                        </span>
                      ))}
                      {item.difficulty_tier && (
                        <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(13,148,136,0.1)', color: '#0d9488', padding: '0.15rem 0.4rem', borderRadius: '4px', marginLeft: 'auto', fontWeight: 600 }}>
                          Lvl {item.difficulty_tier}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Equation */}
                {item.equation_type && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#8A7F72', letterSpacing: '0.05em', fontWeight: 600 }}>
                        {item.equation_type}
                      </span>
                      <span style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: '#0d9488', fontWeight: 600 }}>
                        {item.latex}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#6A5C4E' }}>
                      {language === 'th' && item.description_th
                        ? item.description_th
                        : item.description_en}
                    </div>
                  </div>
                )}

                {/* Occlusion Set */}
                {item.mask_type && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#8A7F72', letterSpacing: '0.05em', fontWeight: 600 }}>
                        {item.mask_type}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#1A1309', fontWeight: 600 }}>{item.label}</span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#6A5C4E' }}>
                      {item.mask_count ?? item.masks?.length ?? 0} mask(s)
                    </div>
                  </div>
                )}

                {/* Scenario */}
                {'presentation_en' in item && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#8A7F72', letterSpacing: '0.05em', fontWeight: 600 }}>
                        {item.scenario_type ?? 'clinical'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#1A1309', fontWeight: 600, backgroundColor: 'rgba(26,19,9,0.05)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                        {item.level}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#1A1309', fontWeight: 500, marginBottom: '0.25rem' }}>
                      {language === 'th' && item.presentation_th
                        ? item.presentation_th
                        : item.presentation_en}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#8A7F72' }}>
                      Choices: {item.mcq_choices?.length ?? 0}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}