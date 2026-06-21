'use client';

// ============================================================================
// EgBE Memory & Revision Engine — Scenarios Page (XState-powered)
//
// Uses @xstate/react useMachine to drive the scenarioMachine defined in
// src/lib/scenario-machine.ts. All state management (node traversal, score,
// penalty, timeout, history) is handled by the XState statechart.
//
// Style: impeccable.style — brutalist, high-density, zero AI slop
// ============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMachine } from '@xstate/react';
import { initDb } from '@/lib/db';
import {
  scenarioMachine,
  getNodePresentation,
  getNextStateForNode,
  getFeedback,
  computeNetScore,
  computeGrade,
} from '@/lib/scenario-machine';
import { useLanguageStore } from '@/stores/language-store';
import type {
  Scenario,
  ScenarioNode,
  ScenarioTransition,
  UUID,
} from '@/types/schema';

// ---------------------------------------------------------------------------
// Scenarios Page
// ---------------------------------------------------------------------------

export default function ScenariosPage() {
  const { language, toggleLanguage, t } = useLanguageStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // XState machine
  const [state, send] = useMachine(scenarioMachine);
  const ctx = state.context;

  // Local UI state (not managed by XState — scenario list + all data cache)
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [allNodes, setAllNodes] = useState<Map<UUID, ScenarioNode>>(new Map());
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load scenario list on mount
  useEffect(() => {
    (async () => {
      const db = await initDb();
      const all = await db.scenarios.toArray();
      setScenarios(all);
      setHasLoaded(true);
    })();
  }, []);

  // Timer effect — fires TICK every second when machine is in active states
  useEffect(() => {
    const activeStates = new Set([
      'presenting',
      'awaiting_decision',
      'showing_feedback',
    ]);
    if (activeStates.has(state.value as string)) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        send({ type: 'TICK', elapsedSeconds: Math.floor((now - timerStartRef.current) / 1000) });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.value, send]);

  // Track timer start
  const timerStartRef = useRef<number>(0);

  // Start scenario
  const startScenario = useCallback(
    async (sc: Scenario) => {
      const db = await initDb();
      const nodes = await db.getScenarioNodes(sc.id);
      const nodeMap = new Map<UUID, ScenarioNode>();
      for (const n of nodes) nodeMap.set(n.id, n);
      setAllNodes(nodeMap);

      const entry = nodes.find((n) => n.is_entry_point);
      if (!entry) return;

      timerStartRef.current = Date.now();
      send({ type: 'START', scenario: sc, entryNode: entry });
    },
    [send],
  );

  // When machine enters awaiting_decision, load transitions
  const [transitions, setTransitions] = useState<ScenarioTransition[]>([]);
  useEffect(() => {
    if (state.value === 'awaiting_decision' && ctx.currentNodeId) {
      (async () => {
        const db = await initDb();
        const trans = await db.getScenarioTransitions(ctx.currentNodeId);
        setTransitions(trans);
      })();
    }
  }, [state.value, ctx.currentNodeId]);

  // Handle decision
  const handleDecision = useCallback(
    (transition: ScenarioTransition) => {
      // First show feedback, then navigate
      send({
        type: 'MAKE_DECISION',
        transition,
        targetNodeId: transition.to_node_id,
      });
    },
    [send],
  );

  // Dismiss feedback and advance to next node
  const handleDismissFeedback = useCallback(
    (nextNodeId: UUID) => {
      send({ type: 'DISMISS_FEEDBACK', nextNodeId });
    },
    [send],
  );

  // Restart scenario
  const handleRestart = useCallback(() => {
    send({ type: 'RESTART' });
    setTransitions([]);
    setAllNodes(new Map());
  }, [send]);

  // Get current node from allNodes map
  const currentNode = ctx.currentNodeId
    ? allNodes.get(ctx.currentNodeId)
    : undefined;

  const currentScenario = ctx.scenario?.id ? ctx.scenario : null;

  // Compute results (for terminal states)
  const totalDecisions = ctx.history.length;
  const netScore = computeNetScore(ctx.score, ctx.penaltySeconds);
  const gradeInfo = totalDecisions > 0
    ? computeGrade(
        netScore,
        totalDecisions,
        ctx.elapsedSeconds,
        ctx.timeLimitSeconds,
      )
    : null;

  const S = {
    page: {
      maxWidth: '800px',
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
      fontSize: '2rem',
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
    cardGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '1rem',
    },
    scenarioCard: {
      backgroundColor: '#FFFFFF',
      border: '1px solid rgba(26,19,9,0.09)',
      borderRadius: '1rem',
      padding: '1.5rem',
      textAlign: 'left' as const,
      cursor: 'pointer',
      transition: 'box-shadow 0.2s, transform 0.2s',
      display: 'flex',
      flexDirection: 'column' as const,
    },
    cardTitle: {
      fontFamily: 'var(--font-fraunces), serif',
      fontSize: '1.125rem',
      fontWeight: 600,
      color: '#1A1309',
      marginBottom: '0.5rem',
    },
    cardDesc: {
      fontSize: '0.875rem',
      color: '#6A5C4E',
      lineHeight: 1.5,
      marginBottom: '1.25rem',
      flex: 1,
    },
    tagRow: {
      display: 'flex',
      gap: '0.5rem',
      fontSize: '0.75rem',
      fontWeight: 600,
    },
    tagDomain: {
      backgroundColor: 'rgba(196,90,27,0.08)',
      color: '#C45A1B',
      padding: '0.2rem 0.6rem',
      borderRadius: '9999px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      fontSize: '0.65rem',
    },
    tagDiff: {
      backgroundColor: 'rgba(13,148,136,0.08)',
      color: '#0d9488',
      padding: '0.2rem 0.6rem',
      borderRadius: '9999px',
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: '4rem 2rem',
      backgroundColor: '#FFFFFF',
      borderRadius: '1rem',
      border: '1px dashed rgba(26,19,9,0.15)',
    }
  };

  // ---- Render: Idle (scenario list) ----
  if (state.matches('idle') || !currentScenario) {
    return (
      <div style={S.page}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <h1 style={S.h1}>Scenarios</h1>
            <p style={S.subtitle}>
              {t('nav.scenarios')} — Clinical & Engineering Troubleshooting
            </p>
          </div>
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

        {/* Empty state */}
        {hasLoaded && scenarios.length === 0 && (
          <div style={S.emptyState}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1A1309', marginBottom: '0.5rem' }}>No scenarios found</div>
            <p style={{ fontSize: '0.875rem', color: '#6A5C4E' }}>
              Visit the{' '}
              <a href="/" style={{ color: '#C45A1B', textDecoration: 'underline' }}>
                home page
              </a>{' '}
              to seed data.
            </p>
          </div>
        )}

        {/* Scenario grid */}
        <div style={S.cardGrid}>
          {scenarios.map((sc) => (
            <button
              key={sc.id}
              onClick={() => startScenario(sc)}
              style={S.scenarioCard}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 30px rgba(26,19,9,0.06)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <h3 style={S.cardTitle}>
                {language === 'th' && sc.title_th ? sc.title_th : sc.title_en}
              </h3>
              {sc.description_en && (
                <p style={S.cardDesc}>
                  {language === 'th' && sc.description_th
                    ? sc.description_th
                    : sc.description_en}
                </p>
              )}
              <div style={S.tagRow}>
                {sc.domain && (
                  <span style={S.tagDomain}>
                    {sc.domain}
                  </span>
                )}
                {sc.difficulty && (
                  <span style={S.tagDiff}>
                    Lvl {sc.difficulty}
                  </span>
                )}
                {sc.time_limit_seconds && (
                  <span style={{ color: '#8A7F72', padding: '0.2rem 0', fontSize: '0.75rem' }}>
                    {Math.floor(sc.time_limit_seconds / 60)}m limit
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- Render: Active Scenario ----
  const elapsed = Math.floor(ctx.elapsedSeconds);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const isTerminal =
    state.matches('success') ||
    state.matches('failure') ||
    state.matches('timed_out') ||
    state.matches('completed');

  const isSuccess = state.matches('success');
  const isTimedOut = state.matches('timed_out');

  const activePageStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '4rem 1.5rem',
    fontFamily: 'var(--font-inter), sans-serif',
    color: '#1A1309',
    minHeight: '100vh',
  };

  const nodeCardStyle = {
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(26,19,9,0.09)',
    borderRadius: '1.5rem',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(26,19,9,0.04)',
    marginBottom: '2rem',
  };

  return (
    <div style={activePageStyle}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <button
          onClick={handleRestart}
          style={{
            background: 'none',
            border: 'none',
            color: '#8A7F72',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '0.5rem 0',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#1A1309')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#8A7F72')}
        >
          ← All Scenarios
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
          <span style={{ color: '#0d9488', backgroundColor: 'rgba(13,148,136,0.1)', padding: '0.25rem 0.75rem', borderRadius: '9999px' }}>
            Score: {ctx.score}
          </span>
          <span style={{ color: '#6A5C4E', fontVariantNumeric: 'tabular-nums' }}>
            {timeDisplay}
            {ctx.timeLimitSeconds && (
              <span style={{ opacity: 0.6, marginLeft: '0.25rem' }}>
                / {Math.floor(ctx.timeLimitSeconds / 60)}:{(ctx.timeLimitSeconds % 60).toString().padStart(2, '0')}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Scenario title */}
      <h2 style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '2rem', fontWeight: 600, color: '#1A1309', marginBottom: '0.5rem', lineHeight: 1.2 }}>
        {language === 'th' && currentScenario.title_th ? currentScenario.title_th : currentScenario.title_en}
      </h2>
      {currentScenario.description_en && (
        <p style={{ fontSize: '1rem', color: '#6A5C4E', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          {language === 'th' && currentScenario.description_th ? currentScenario.description_th : currentScenario.description_en}
        </p>
      )}

      {/* Breadcrumb / decision history */}
      {ctx.history.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '2rem', fontSize: '0.75rem', color: '#8A7F72' }}>
          <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Path: </span>
          {ctx.history.map((t) => (
            <span key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ color: t.is_correct ? '#0d9488' : '#e11d48', fontWeight: 500, backgroundColor: t.is_correct ? 'rgba(13,148,136,0.08)' : 'rgba(225,29,72,0.08)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                {language === 'th' && t.label_th ? t.label_th : t.label_en}
              </span>
              <span>→</span>
            </span>
          ))}
        </div>
      )}

      {/* Current node content */}
      {currentNode && !isTerminal && (
        <div style={nodeCardStyle}>
          {/* Node type badge */}
          <div style={{ borderBottom: '1px solid rgba(26,19,9,0.08)', padding: '0.75rem 1.5rem', display: 'flex', gap: '0.5rem', backgroundColor: '#FDFBF7' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7F72' }}>
              {currentNode.node_type.replace(/_/g, ' ')}
            </span>
            {currentNode.is_entry_point && (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C45A1B', backgroundColor: 'rgba(196,90,27,0.1)', padding: '0 0.4rem', borderRadius: '4px' }}>
                Start
              </span>
            )}
          </div>

          {/* Content */}
          <div style={{ padding: '2rem 1.5rem' }}>
            <p style={{ fontSize: '1.125rem', color: '#1A1309', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {language === 'th' && currentNode.content_th ? currentNode.content_th : currentNode.content_en}
            </p>

            {/* Feedback overlay (showing_feedback state) */}
            {state.matches('showing_feedback') && (
              <div style={{ marginTop: '2rem', padding: '1.5rem', borderRadius: '1rem', backgroundColor: '#FDFBF7', border: '1px solid rgba(26,19,9,0.1)' }}>
                {(() => {
                  const lastTransition = ctx.history[ctx.history.length - 1];
                  if (!lastTransition) return null;
                  const fb = getFeedback(lastTransition, language === 'th' ? 'th' : 'en');
                  return (
                    <>
                      <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: fb.isCorrect ? '#0d9488' : '#e11d48' }}>
                        {fb.isCorrect ? '✓ Correct Decision' : '✗ Needs Adjustment'}
                      </div>
                      <p style={{ fontSize: '0.95rem', color: '#6A5C4E', lineHeight: 1.6 }}>{fb.message}</p>
                      <button
                        onClick={() => handleDismissFeedback(lastTransition.to_node_id)}
                        style={{ marginTop: '1.5rem', padding: '0.75rem 2rem', borderRadius: '9999px', backgroundColor: fb.isCorrect ? '#0d9488' : '#e11d48', color: '#FFF', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                      >
                        Continue →
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Terminal states */}
      {isTerminal && (
        <div style={{ ...nodeCardStyle, padding: '3rem 2rem', textAlign: 'center', backgroundColor: isSuccess ? '#f0fdf4' : isTimedOut ? '#fffbeb' : '#fff1f2', borderColor: isSuccess ? '#bbf7d0' : isTimedOut ? '#fef3c7' : '#fecdd3' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            {isSuccess ? '🎉' : isTimedOut ? '⏱' : '🛑'}
          </div>
          <h3 style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '1.75rem', fontWeight: 600, color: '#1A1309', marginBottom: '0.5rem' }}>
            {isSuccess ? 'Scenario Completed' : isTimedOut ? 'Time Limit Exceeded' : 'Incorrect Path'}
          </h3>

          {gradeInfo && (
            <div style={{ margin: '2rem auto', maxWidth: '300px', textAlign: 'left', backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#8A7F72', fontWeight: 600 }}>Grade:</span>
                <span style={{ fontWeight: 800, color: gradeInfo.grade === 'A' ? '#0d9488' : gradeInfo.grade === 'B' ? '#65a30d' : gradeInfo.grade === 'C' ? '#d97706' : '#e11d48' }}>{gradeInfo.grade}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#8A7F72', fontWeight: 600 }}>Accuracy:</span>
                <span style={{ color: '#1A1309', fontWeight: 600 }}>{gradeInfo.percentage}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#8A7F72', fontWeight: 600 }}>Score:</span>
                <span style={{ color: '#1A1309', fontWeight: 600 }}>{netScore} / {totalDecisions}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: '#8A7F72', fontWeight: 600 }}>Time Used:</span>
                <span style={{ color: '#1A1309', fontWeight: 600 }}>{timeDisplay}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            {!isSuccess && (
              <button
                onClick={() => startScenario(currentScenario)}
                style={{ padding: '0.875rem 2rem', borderRadius: '9999px', backgroundColor: '#1A1309', color: '#FFF', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Retry Scenario
              </button>
            )}
            <button
              onClick={handleRestart}
              style={{ padding: '0.875rem 2rem', borderRadius: '9999px', backgroundColor: 'transparent', border: '1px solid rgba(26,19,9,0.2)', color: '#1A1309', fontWeight: 600, cursor: 'pointer' }}
            >
              All Scenarios
            </button>
          </div>
        </div>
      )}

      {/* Decision choices (awaiting_decision state) */}
      {state.matches('awaiting_decision') && transitions.length > 0 && (
        <div>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#8A7F72', marginBottom: '1rem' }}>
            Choose your next action
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {transitions.sort((a, b) => a.sort_order - b.sort_order).map((t) => {
              const target = allNodes.get(t.to_node_id);
              return (
                <button
                  key={t.id}
                  onClick={() => handleDecision(t)}
                  style={{
                    textAlign: 'left',
                    padding: '1.25rem 1.5rem',
                    borderRadius: '1rem',
                    border: '1px solid rgba(26,19,9,0.15)',
                    backgroundColor: '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#0d9488';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 20px rgba(13,148,136,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.15)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1A1309' }}>
                    {language === 'th' && t.label_th ? t.label_th : t.label_en || target?.content_en?.slice(0, 80) || `Choice ${t.sort_order}`}
                  </div>
                  {target && (
                    <div style={{ fontSize: '0.875rem', color: '#6A5C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {target.content_en}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}