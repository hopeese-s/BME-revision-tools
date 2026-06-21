'use client';

import { useEffect, useState } from 'react';
import { initDb, getDb } from '@/lib/db';
import { BookOpen, Brain, Activity, Network, Database, Globe, Layers, Zap, Loader2, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  const [isSeeded, setIsSeeded] = useState<boolean | null>(null);
  const [counts, setCounts] = useState({ flashcards: 0, concepts: 0, scenarios: 0 });

  useEffect(() => {
    loadAndSeed();
  }, []);

  async function loadAndSeed() {
    let db;
    try {
      db = await initDb();
      // Check if data already seeded
      const cardCount = await db.flashcards.count();
      if (cardCount > 0) {
        setIsSeeded(true);
        await refreshCounts(db);
        return;
      }
    } catch (err) {
      console.error('Database init failed:', err);
      // Give a slight delay and try to force reload to bypass Dexie lock
      if ((err as Error).name === 'VersionChangeError' || (err as Error).name === 'DatabaseClosedError') {
        window.location.reload();
      }
      setIsSeeded(false); // Fallback to show UI at least
      return;
    }

    // Load seed modules dynamically
    try {
      const { seedFlashcards, seedConcepts, seedEdges, seedScenarios, seedScenarioNodes, seedScenarioTransitions } =
        await import('@/data/seed');

      // Seed curriculum modules (simplified: since this is local-only for prototype, create placeholder modules)
      const moduleIds = [
        { id: 'mod-anatomy' as string, title: 'Anatomy', course: 'mod-course-1' },
        { id: 'mod-physiology' as string, title: 'Physiology', course: 'mod-course-1' },
        { id: 'mod-biochemistry' as string, title: 'Biochemistry', course: 'mod-course-1' },
        { id: 'mod-biomaterials' as string, title: 'Biomaterials', course: 'mod-course-2' },
        { id: 'mod-biomechanics' as string, title: 'Biomechanics', course: 'mod-course-2' },
        { id: 'mod-instrumentation' as string, title: 'Medical Instrumentation', course: 'mod-course-2' },
        { id: 'mod-signals' as string, title: 'Signals & Systems', course: 'mod-course-3' },
        { id: 'mod-imaging' as string, title: 'Medical Imaging', course: 'mod-course-3' },
        { id: 'mod-clinical' as string, title: 'Clinical Engineering', course: 'mod-course-4' },
      ];

      const now = new Date().toISOString();

      // Insert placeholder years/semesters/courses/modules
      for (let y = 1; y <= 4; y++) {
        await db.years.put({
          id: `year-${y}` as never,
          year_number: y as 1 | 2 | 3 | 4,
          title_en: `Year ${y}`,
          title_th: `ปี ${y}`,
          description_en: null,
          description_th: null,
          _sync_version: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        } as never);

        for (let s = 1; s <= (y === 4 ? 1 : 2); s++) {
          const semId = `sem-${y}-${s}`;
          await db.semesters.put({
            id: semId as never,
            year_id: `year-${y}` as never,
            semester_number: s as 1 | 2 | 3,
            title_en: `Semester ${s}`,
            title_th: `ภาคเรียนที่ ${s}`,
            _sync_version: 0,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          } as never);

          // Courses
          const courseIds = y <= 2
            ? [1, 2].map(c => `course-${y}-${s}-${c}`)
            : y === 3
              ? [1, 2, 3].map(c => `course-${y}-${s}-${c}`)
              : [1].map(c => `course-${y}-${s}-${c}`);

          for (const [i, cid] of courseIds.entries()) {
            await db.courses.put({
              id: cid as never,
              semester_id: semId as never,
              course_code: `EGBE${y}0${i + 1}`,
              title_en: `BME Course ${y}.${s}.${i + 1}`,
              title_th: `วิชา BME ${y}.${s}.${i + 1}`,
              description_en: null,
              description_th: null,
              credit_hours: 3,
              color_hex: null,
              icon_name: null,
              sort_order: i,
              _sync_version: 0,
              created_at: now,
              updated_at: now,
              deleted_at: null,
            } as never);
          }
        }
      }

      // Seed modules
      for (const mod of moduleIds) {
        await db.modules.put({
          id: mod.id as never,
          course_id: mod.course as never,
          title_en: mod.title,
          title_th: null,
          description_en: null,
          description_th: null,
          sort_order: 0,
          _sync_version: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        } as never);
      }

      // Seed flashcards
      for (const card of seedFlashcards) {
        await db.flashcards.put({
          ...card,
          front_latex: null,
          back_latex: null,
          front_markdown: null,
          back_markdown: null,
          occlusion_set_id: null,
          _sync_version: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        } as never);
      }

      // Seed concept nodes
      for (const node of seedConcepts) {
        await db.conceptNodes.put({
          ...node,
          graph_x: null,
          graph_y: null,
          importance: null,
          _sync_version: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        } as never);
      }

      // Seed concept edges
      for (const edge of seedEdges) {
        await db.conceptEdges.put({
          ...edge,
          _sync_version: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        } as never);
      }

      // Seed scenarios
      for (const sc of seedScenarios) {
        await db.scenarios.put({
          ...sc,
          time_limit_seconds: null,
          difficulty: null,
          _sync_version: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        } as never);
      }

      // Seed scenario nodes
      for (const sn of seedScenarioNodes) {
        await db.scenarioNodes.put({
          ...sn,
          image_url: null,
          _sync_version: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        } as never);
      }

      // Seed scenario transitions
      for (const st of seedScenarioTransitions) {
        await db.scenarioTransitions.put({
          ...st,
          _sync_version: 0,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        } as never);
      }

      setIsSeeded(true);
      await refreshCounts(db);
    } catch (err) {
      console.error('Seed failed:', err);
      setIsSeeded(false);
    }
  }

  async function refreshCounts(db: ReturnType<typeof getDb>) {
    const dbInst = await db;
    const [flashcards, concepts, scenarios] = await Promise.all([
      dbInst.flashcards.count(),
      dbInst.conceptNodes.count(),
      dbInst.scenarios.count(),
    ]);
    setCounts({ flashcards, concepts, scenarios });
  }

  const S = {
    page: {
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '6rem 1.5rem 4rem',
    } as React.CSSProperties,
    hero: {
      textAlign: 'center' as const,
      marginBottom: '5rem',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
    },
    eyebrow: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.4rem 1rem',
      borderRadius: '9999px',
      border: '1px solid rgba(196, 90, 27, 0.25)',
      backgroundColor: 'rgba(196, 90, 27, 0.06)',
      marginBottom: '2rem',
    },
    eyebrowDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: '#C45A1B',
      flexShrink: 0,
    },
    eyebrowText: {
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: '#8B3A0A',
    },
    h1: {
      fontFamily: 'var(--font-fraunces), Georgia, "Times New Roman", serif',
      fontSize: 'clamp(2.8rem, 7vw, 5rem)',
      fontWeight: 500,
      color: '#1A1309',
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
      marginBottom: '1.5rem',
      maxWidth: '780px',
    },
    h1italic: {
      fontStyle: 'italic',
      color: '#C45A1B',
      fontWeight: 400,
    },
    subtitle: {
      fontSize: '1.125rem',
      color: '#6A5C4E',
      maxWidth: '560px',
      lineHeight: 1.65,
      fontWeight: 400,
      marginBottom: '2.5rem',
    },
    btnRow: {
      display: 'flex',
      gap: '0.875rem',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap' as const,
    },
    btnPrimary: {
      padding: '0.875rem 2rem',
      borderRadius: '9999px',
      backgroundColor: '#1A1309',
      color: '#FDFBF7',
      fontWeight: 600,
      fontSize: '0.95rem',
      border: 'none',
      cursor: 'pointer',
      textDecoration: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      transition: 'background-color 0.15s, transform 0.15s',
    },
    btnSecondary: {
      padding: '0.875rem 2rem',
      borderRadius: '9999px',
      backgroundColor: 'transparent',
      color: '#1A1309',
      fontWeight: 600,
      fontSize: '0.95rem',
      border: '1.5px solid rgba(26, 19, 9, 0.25)',
      cursor: 'pointer',
      textDecoration: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      transition: 'border-color 0.15s',
    },
    grid3: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1.25rem',
      marginBottom: '1.25rem',
    },
    card: {
      backgroundColor: '#FFFFFF',
      border: '1px solid rgba(26, 19, 9, 0.09)',
      borderRadius: '1.75rem',
      padding: '2rem',
      textDecoration: 'none',
      color: 'inherit',
      display: 'flex',
      flexDirection: 'column' as const,
      transition: 'box-shadow 0.25s, transform 0.25s',
      cursor: 'pointer',
    },
    iconBox: (bg: string, color: string) => ({
      width: '48px',
      height: '48px',
      borderRadius: '0.875rem',
      backgroundColor: bg,
      color: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '1.5rem',
      flexShrink: 0,
    }),
    cardTitle: {
      fontFamily: 'var(--font-fraunces), Georgia, serif',
      fontSize: '1.375rem',
      fontWeight: 500,
      color: '#1A1309',
      marginBottom: '0.625rem',
      letterSpacing: '-0.01em',
    },
    cardDesc: {
      fontSize: '0.875rem',
      color: '#6A5C4E',
      lineHeight: 1.65,
      flex: 1,
      marginBottom: '1.5rem',
    },
    cardMeta: (color: string) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '0.375rem',
      fontSize: '0.8125rem',
      fontWeight: 600,
      color: color,
    }),
    darkCard: {
      backgroundColor: '#1A1309',
      borderRadius: '1.75rem',
      padding: '3.5rem',
      position: 'relative' as const,
      overflow: 'hidden' as const,
    },
    darkCardBg: {
      position: 'absolute' as const,
      top: '-2rem',
      right: '-2rem',
      opacity: 0.07,
      pointerEvents: 'none' as const,
    },
    darkCardContent: {
      position: 'relative' as const,
      zIndex: 1,
    },
    liveBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.3rem 0.75rem',
      borderRadius: '9999px',
      border: '1px solid rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.07)',
      marginBottom: '1.5rem',
    },
    liveDot: {
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      backgroundColor: '#4ade80',
    },
    liveTxt: {
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.55)',
    },
    darkTitle: {
      fontFamily: 'var(--font-fraunces), Georgia, serif',
      fontSize: '2.25rem',
      fontWeight: 500,
      color: '#FDFBF7',
      marginBottom: '1rem',
      letterSpacing: '-0.02em',
    },
    darkDesc: {
      fontSize: '1rem',
      color: 'rgba(253,251,247,0.55)',
      maxWidth: '480px',
      lineHeight: 1.7,
      marginBottom: '2rem',
    },
    ctaWhite: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.875rem 2rem',
      borderRadius: '9999px',
      backgroundColor: '#FDFBF7',
      color: '#1A1309',
      fontWeight: 600,
      fontSize: '0.95rem',
      textDecoration: 'none',
      transition: 'background-color 0.15s',
    },
  };

  return (
    <div style={S.page}>
      {/* ── Hero ── */}
      <div style={S.hero}>
        {/* Eyebrow Pill */}
        <div style={S.eyebrow}>
          <span style={S.eyebrowDot} />
          <span style={S.eyebrowText}>Mahidol BME Curriculum</span>
        </div>

        {/* Headline */}
        <h1 style={S.h1}>
          Master biomedical engineering with{' '}
          <span style={S.h1italic}>intelligent workflows</span>
        </h1>

        {/* Subtitle */}
        <p style={S.subtitle}>
          The all-in-one platform that helps BME students conquer their curriculum in record time. Powered by FSRS-5, designed for clinical excellence.
        </p>

        {/* CTA Buttons */}
        <div style={S.btnRow}>
          <a href="/study" style={S.btnPrimary}>
            Start studying →
          </a>
          <a href="/curriculum" style={S.btnSecondary}>
            Explore modules
          </a>
        </div>
      </div>

      {/* ── Loading ── */}
      {isSeeded === null && (
        <div style={{ textAlign: 'center', padding: '5rem 0' }}>
          <Loader2
            style={{
              width: '2rem',
              height: '2rem',
              color: '#C45A1B',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <p style={{ color: '#8A7F72', fontWeight: 500 }}>Preparing intelligent workflows…</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Error ── */}
      {isSeeded === false && (
        <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: '#FFF0F0', borderRadius: '1.5rem', border: '1px solid #FFC9C9' }}>
          <p style={{ color: '#dc2626', fontWeight: 500 }}>Failed to load seed data. Check console.</p>
        </div>
      )}

      {/* ── Content ── */}
      {isSeeded === true && (
        <div>
          {/* 3-Column Cards */}
          <div style={S.grid3}>
            {/* Curriculum */}
            <a
              href="/curriculum"
              style={S.card}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(26,19,9,0.1)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={S.iconBox('rgba(196,90,27,0.08)', '#C45A1B')}>
                <BookOpen size={22} />
              </div>
              <div style={S.cardTitle}>Curriculum</div>
              <div style={S.cardDesc}>Browse Year 1–4 modules, manage study materials, and track academic progression.</div>
              <div style={S.cardMeta('#C45A1B')}>
                <Layers size={14} />
                {counts.flashcards} active flashcards
              </div>
            </a>

            {/* Study */}
            <a
              href="/study"
              style={S.card}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(26,19,9,0.1)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={S.iconBox('rgba(225,29,72,0.06)', '#be123c')}>
                <Activity size={22} />
              </div>
              <div style={S.cardTitle}>Study Session</div>
              <div style={S.cardDesc}>Retain knowledge forever using the state-of-the-art FSRS-5 spaced repetition algorithm.</div>
              <div style={S.cardMeta('#be123c')}>
                <Zap size={14} />
                Begin intelligent review
              </div>
            </a>

            {/* Scenarios */}
            <a
              href="/scenarios"
              style={S.card}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(26,19,9,0.1)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={S.iconBox('rgba(13,148,136,0.08)', '#0d9488')}>
                <Globe size={22} />
              </div>
              <div style={S.cardTitle}>Scenarios</div>
              <div style={S.cardDesc}>Troubleshoot real-world biomedical equipment issues in hospital environments.</div>
              <div style={S.cardMeta('#0d9488')}>
                <Database size={14} />
                {counts.scenarios} clinical scenarios
              </div>
            </a>
          </div>

          {/* Knowledge Graph Dark Card */}
          <div style={S.darkCard}>
            <div style={S.darkCardBg}>
              <Network size={340} color="#FDFBF7" />
            </div>
            <div style={S.darkCardContent}>
              <div style={S.liveBadge}>
                <span style={S.liveDot} />
                <span style={S.liveTxt}>Live View</span>
              </div>
              <div style={S.darkTitle}>Knowledge Graph</div>
              <p style={S.darkDesc}>
                Visualizing{' '}
                <span style={{ color: '#FDFBF7', fontWeight: 600 }}>{counts.concepts} concept nodes</span>{' '}
                connected by prerequisite, application, and extension edges.
              </p>
              <a
                href="/graph"
                style={S.ctaWhite}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#EDE8E0')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#FDFBF7')}
              >
                Explore connections
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
