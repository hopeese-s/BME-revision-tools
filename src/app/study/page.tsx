'use client';

// ============================================================================
// EgBE Memory & Revision Engine — Study Page
//
// BME Enhancements (per Principal Architect directive):
//  1. Cram Mode Toggle — bypasses FSRS, no stability/difficulty update
//  2. Derivation Scratchpad — HTML5 canvas with perfect-freehand smoothing
//  3. Signal Interactive Cards — dynamic waveform via ECharts
//  4. KaTeX Markdown rendering for LaTeX math in card content
//  5. EN/TH Language Toggle
//
// Style: impeccable.style — brutalist, high-density, zero AI slop
// ============================================================================

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { getStroke } from 'perfect-freehand';
import { useStudySessionStore } from '@/stores/study-session-store';
import { useSyllabusStore } from '@/stores/syllabus-store';
import { useLanguageStore, type Language } from '@/stores/language-store';
import type { Flashcard, UUID, Module } from '@/types/schema';
import type { FSRSRating } from '@/lib/fsrs';
import 'katex/dist/katex.min.css';

// ---------------------------------------------------------------------------
// KaTeX Markdown Renderer — renders LaTeX math in flashcard content
// ---------------------------------------------------------------------------

function MarkdownContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {text}
    </ReactMarkdown>
  );
}

// ---------------------------------------------------------------------------
// Canvas Drawing Hook with perfect-freehand smoothing
// ---------------------------------------------------------------------------

interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
}

function useDrawingCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const isDrawing = useRef(false);
  const pointsRef = useRef<StrokePoint[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvasRectRef.current = rect;
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = '#2dd4bf'; // teal-400 (impeccable accent)
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
  }, [canvasRef]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent): StrokePoint => {
    const canvas = canvasRef.current!;
    const rect = canvasRectRef.current ?? canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const pressure = 'touches' in e ? ((e as React.TouchEvent).touches[0] as any).force as number ?? 0.5 : 0.5;
    return { x: clientX - rect.left, y: clientY - rect.top, pressure };
  }, [canvasRef]);

  const renderStroke = useCallback((points: StrokePoint[]) => {
    const ctx = ctxRef.current;
    if (!ctx || points.length < 2) return;

    // Use perfect-freehand to get smoothed stroke outline
    const outlinePoints = getStroke(points, {
      size: 3,
      thinning: 0.5,
      smoothing: 0.8,
      streamline: 0.5,
      simulatePressure: true,
    });

    if (outlinePoints.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
    for (let i = 1; i < outlinePoints.length; i++) {
      ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
    }
    ctx.closePath();
    ctx.fillStyle = '#2dd4bf';
    ctx.fill();
  }, []);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    pointsRef.current = [getPos(e)];
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const pos = getPos(e);
    pointsRef.current.push(pos);
    // Render in realtime with perfect-freehand smoothing
    renderStroke(pointsRef.current);
  }, [getPos, renderStroke]);

  const stopDraw = useCallback(() => {
    isDrawing.current = false;
    // Final render of completed stroke
    if (pointsRef.current.length > 1) {
      renderStroke(pointsRef.current);
    }
    pointsRef.current = [];
  }, [renderStroke]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
    // Re-initialize canvas state after clear
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [canvasRef]);

  return { initCanvas, startDraw, draw, stopDraw, clearCanvas };
}

// ---------------------------------------------------------------------------
// Signal Data Parser → ECharts option
// ---------------------------------------------------------------------------

function buildSignalChartOption(signalData: unknown) {
  // Accept { series: { name: string, data: number[] }[] } or { data: number[] }
  let series: { name?: string; data: number[] }[] = [];

  if (!signalData) {
    return null;
  }

  if (typeof signalData === 'object' && signalData !== null) {
    const sd = signalData as Record<string, unknown>;
    if (Array.isArray(sd.series)) {
      series = sd.series as { name?: string; data: number[] }[];
    } else if (Array.isArray(sd.data)) {
      series = [{ name: 'Signal', data: sd.data as number[] }];
    }
  }

  if (series.length === 0) return null;

  const xAxisData = series[0]?.data.map((_, i) => i) ?? [];

  return {
    backgroundColor: 'transparent',
    grid: { top: 8, right: 8, bottom: 24, left: 36 },
    xAxis: {
      type: 'category' as const,
      data: xAxisData,
      axisLine: { lineStyle: { color: '#3f3f46' } },
      axisLabel: { color: '#71717a', fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { lineStyle: { color: '#3f3f46' } },
      axisLabel: { color: '#71717a', fontSize: 10 },
      splitLine: { lineStyle: { color: '#27272a' } },
    },
    series: series.map((s) => ({
      name: s.name,
      type: 'line' as const,
      data: s.data,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#14b8a6', width: 2 },
      areaStyle: {
        color: {
          type: 'linear' as const,
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(20,184,166,0.2)' },
            { offset: 1, color: 'rgba(20,184,166,0.0)' },
          ],
        },
      },
    })),
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#18181b',
      borderColor: '#3f3f46',
      textStyle: { color: '#d4d4d8', fontSize: 12 },
    },
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicInOut' as const,
  };
}

// ---------------------------------------------------------------------------
// Study Page Component
// ---------------------------------------------------------------------------

export default function StudyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleIdParam = searchParams.get('moduleId');

  const {
    status,
    moduleTitle,
    isLoading,
    queue,
    currentIndex,
    totalCards,
    remainingCards,
    currentCard,
    isFlipped,
    isCramMode,
    cardsReviewed,
    streak,
    longStreak,
    averageRating,
    loadSession,
    flipCard,
    rateCard,
    nextCard,
    completeSession,
    resetSession,
    getProgress,
  } = useStudySessionStore();

  const { years, isLoading: syllabusLoading, loadCurriculum } = useSyllabusStore();
  const { language, toggleLanguage, t } = useLanguageStore();

  // Load curriculum if it hasn't been loaded yet
  useEffect(() => {
    if (years.length === 0 && !syllabusLoading) {
      loadCurriculum();
    }
  }, [years.length, syllabusLoading, loadCurriculum]);

  // Extract flat module list from curriculum tree
  const allModules = useMemo(() => {
    const result: Module[] = [];
    for (const year of years) {
      for (const sem of year.semesters) {
        for (const course of sem.courses) {
          for (const mod of course.modules) {
            result.push(mod);
          }
        }
      }
    }
    return result;
  }, [years]);

  const [cramModePref, setCramModePref] = useState(false);
  const [showCramToggle, setShowCramToggle] = useState(true);

  // Canvas ref for derivation scratchpad
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useDrawingCanvas(canvasRef);

  // Init canvas on mount and when isFlipped changes
  useEffect(() => {
    if (!isFlipped) {
      drawing.initCanvas();
    }
  }, [isFlipped, drawing]);

  // Determine if current card requires calculation scratchpad
  const needsScratchpad = useMemo(() => {
    if (!currentCard || currentCard.source !== 'flashcard') return false;
    const card = currentCard.data as Flashcard;
    return card.requires_calculation === true;
  }, [currentCard]);

  // Determine if current card is signal_interactive
  const isSignalInteractive = useMemo(() => {
    if (!currentCard || currentCard.source !== 'flashcard') return false;
    const card = currentCard.data as Flashcard;
    return card.card_type === 'signal_interactive' && !!card.signal_data;
  }, [currentCard]);

  // Build chart option for signal cards
  const chartOption = useMemo(() => {
    if (!isSignalInteractive || !currentCard) return null;
    const card = currentCard.data as Flashcard;
    return buildSignalChartOption(card.signal_data);
  }, [isSignalInteractive, currentCard]);

  // Progress
  const progress = getProgress();

  // Handle start session
  const handleStartSession = async (modId: UUID, title: string) => {
    setShowCramToggle(false);
    await loadSession(modId, title, cramModePref);
  };

  // Handle rating
  const handleRate = async (rating: FSRSRating) => {
    await rateCard(rating);
    nextCard();
  };

  // Handle complete
  const handleComplete = async () => {
    await completeSession();
  };

  // Handle back
  const handleBack = () => {
    resetSession();
    setShowCramToggle(true);
    setCramModePref(false);
    router.push('/curriculum');
  };

  // Handle restart
  const handleRestart = () => {
    resetSession();
    setShowCramToggle(true);
    setCramModePref(false);
  };

  // Find module by param
  const targetModule = moduleIdParam
    ? allModules.find((m) => m.id === moduleIdParam) ?? null
    : null;

  // -----------------------------------------------------------------------
  // RENDER: Module Selection / Cram Mode Toggle (pre-session)
  // -----------------------------------------------------------------------
  if (showCramToggle && !status || status === 'idle') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#FDFBF7', color: '#1A1309', fontFamily: '"Inter", sans-serif' }}>
        <div style={{ maxWidth: '42rem', margin: '0 auto', padding: '3rem 1rem' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(26,19,9,0.08)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#1A1309', fontFamily: '"Fraunces", serif', letterSpacing: '-0.02em', margin: 0 }}>
                Study Session
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#6A5C4E', marginTop: '0.25rem' }}>
                {targetModule
                  ? targetModule.title_en
                  : 'Select a module to begin'}
              </p>
            </div>
            {/* Language Toggle EN|TH */}
            <button
              onClick={toggleLanguage}
              style={{
                border: '1px solid rgba(26,19,9,0.15)',
                backgroundColor: '#FFFFFF',
                padding: '0.4rem 0.8rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#6A5C4E',
                cursor: 'pointer',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#0d9488';
                (e.currentTarget as HTMLElement).style.color = '#0d9488';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.15)';
                (e.currentTarget as HTMLElement).style.color = '#6A5C4E';
              }}
              title={t('study.start')}
            >
              {language === 'en' ? 'TH' : 'EN'}
            </button>
          </div>

          {/* Cram Mode Toggle */}
          <div style={{ marginBottom: '2rem', border: '1px solid rgba(26,19,9,0.08)', backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1A1309', fontFamily: '"Fraunces", serif' }}>
                  Cram Mode
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6A5C4E', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  Study all cards without updating FSRS scheduling.
                  <br />
                  Stability & difficulty will NOT be affected.
                </div>
              </div>
              <button
                onClick={() => setCramModePref(!cramModePref)}
                style={{
                  position: 'relative',
                  width: '3rem',
                  height: '1.5rem',
                  borderRadius: '9999px',
                  border: cramModePref ? '1px solid #0d9488' : '1px solid rgba(26,19,9,0.2)',
                  backgroundColor: cramModePref ? '#0d9488' : '#e5e5e5',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  padding: 0
                }}
                aria-label="Toggle Cram Mode"
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '1px',
                    left: '1px',
                    width: '1.25rem',
                    height: '1.25rem',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    transition: 'transform 0.2s',
                    transform: cramModePref ? 'translateX(1.5rem)' : 'translateX(0)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                />
              </button>
            </div>
            {cramModePref && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(26,19,9,0.08)', fontSize: '0.8125rem', color: '#0d9488', fontWeight: 500 }}>
                ⚡ CRAM MODE ACTIVE — cards reviewed in this session will not
                affect your long-term memory scheduling.
              </div>
            )}
          </div>

          {/* Module List */}
          {!moduleIdParam && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.5rem' }}>
                Available Modules
              </div>
              {syllabusLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6A5C4E', fontSize: '0.875rem' }}>Loading modules...</div>
              ) : allModules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px dashed rgba(26,19,9,0.15)', color: '#6A5C4E', fontSize: '0.875rem' }}>
                  No modules found. Please <a href="/" style={{ color: '#0d9488', textDecoration: 'underline' }}>sync data</a> from the home page.
                </div>
              ) : (
                allModules.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => router.push(`/study?moduleId=${mod.id}`)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '1rem',
                      border: '1px solid rgba(26,19,9,0.08)',
                      backgroundColor: '#FFFFFF',
                      color: '#1A1309',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.2)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 8px rgba(0,0,0,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.08)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 4px rgba(0,0,0,0.01)';
                    }}
                  >
                    {language === 'en' ? mod.title_en : (mod.title_th || mod.title_en)}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Start button for targeted module */}
          {targetModule && (
            <button
              onClick={() => handleStartSession(targetModule.id, targetModule.title_en)}
              style={{
                marginTop: '2rem',
                width: '100%',
                padding: '1rem',
                border: 'none',
                backgroundColor: '#1A1309',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: 600,
                borderRadius: '9999px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                boxShadow: '0 4px 12px rgba(26,19,9,0.15)'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#30261A';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(26,19,9,0.2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1309';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(26,19,9,0.15)';
              }}
            >
              Begin Session{cramModePref ? ' (Cram)' : ''}
            </button>
          )}

          {/* Back button */}
          <button
            onClick={handleBack}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '0.75rem',
              border: '1px solid rgba(26,19,9,0.15)',
              backgroundColor: 'transparent',
              color: '#6A5C4E',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '9999px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#FFFFFF';
              (e.currentTarget as HTMLElement).style.color = '#1A1309';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#6A5C4E';
            }}
          >
            Back to Curriculum
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // RENDER: Active Session
  // -----------------------------------------------------------------------
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FDFBF7', color: '#1A1309', fontFamily: '"Inter", sans-serif', userSelect: 'none' }}>
      <div style={{ maxWidth: '42rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Top Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(26,19,9,0.08)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={handleBack}
            style={{ fontSize: '0.75rem', color: '#8A7F72', cursor: 'pointer', border: 'none', backgroundColor: 'transparent', fontWeight: 600, transition: 'color 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1A1309'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8A7F72'; }}
          >
            ← Exit
          </button>
          <div style={{ fontSize: '0.75rem', color: '#8A7F72', fontWeight: 600 }}>
            {remainingCards} / {totalCards} remaining
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#6A5C4E', fontWeight: 600 }}>
            {isCramMode && (
              <span style={{ color: '#0d9488', fontWeight: 700 }}>CRAM</span>
            )}
            {/* Language Toggle in active session */}
            <button
              onClick={toggleLanguage}
              style={{
                border: '1px solid rgba(26,19,9,0.15)',
                backgroundColor: '#FFFFFF',
                padding: '0.1rem 0.4rem',
                fontSize: '0.65rem',
                fontWeight: 700,
                color: '#6A5C4E',
                cursor: 'pointer',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#0d9488';
                (e.currentTarget as HTMLElement).style.color = '#0d9488';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.15)';
                (e.currentTarget as HTMLElement).style.color = '#6A5C4E';
              }}
            >
              {language === 'en' ? 'TH' : 'EN'}
            </button>
            <span>Streak: {streak}</span>
          </div>
        </div>

        {/* Module Title */}
        <div style={{ fontSize: '0.75rem', color: '#6A5C4E', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '1rem' }}>
          {moduleTitle}
        </div>

        {/* Progress Bar */}
        <div style={{ height: '4px', backgroundColor: '#e5e5e5', borderRadius: '2px', marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div
            style={{ height: '100%', backgroundColor: '#0d9488', width: `${progress.percentage}%`, transition: 'width 0.3s ease-in-out' }}
          />
        </div>

        {/* Card Area */}
        {currentCard && (
          <div style={{ border: '1px solid rgba(26,19,9,0.08)', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
          {/* Card Type Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', borderBottom: '1px solid rgba(26,19,9,0.05)', backgroundColor: '#FDFBF7' }}>
              <span style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                {currentCard.source}
                {isSignalInteractive && ' · signal'}
              </span>
              {needsScratchpad && (
                <span style={{ fontSize: '0.65rem', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                  scratchpad available
                </span>
              )}
            </div>

            {/* Front Content */}
            {'front_en' in currentCard.data && (
              <div style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '1.125rem', color: '#1A1309', lineHeight: 1.6, fontWeight: 500, fontFamily: '"Fraunces", serif' }}>
                  <MarkdownContent
                    text={language === 'th' && (currentCard.data as Flashcard).front_th
                      ? (currentCard.data as Flashcard).front_th!
                      : (currentCard.data as Flashcard).front_en}
                  />
                </div>
                {language === 'en' && (currentCard.data as Flashcard).front_th && (
                  <p style={{ fontSize: '0.875rem', color: '#8A7F72', marginTop: '0.5rem' }}>
                    {(currentCard.data as Flashcard).front_th}
                  </p>
                )}
                {language === 'th' && (currentCard.data as Flashcard).front_en && (
                  <p style={{ fontSize: '0.875rem', color: '#8A7F72', marginTop: '0.5rem' }}>
                    {(currentCard.data as Flashcard).front_en}
                  </p>
                )}
              </div>
            )}

            {/* Derivation Scratchpad (before flip) */}
            {needsScratchpad && !isFlipped && (
              <div style={{ borderTop: '1px solid rgba(26,19,9,0.08)', padding: '1rem 1.5rem', backgroundColor: '#FDFBF7' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                    Derivation Scratchpad
                  </span>
                  <button
                    onClick={drawing.clearCanvas}
                    style={{ fontSize: '0.65rem', color: '#6A5C4E', border: '1px solid rgba(26,19,9,0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1A1309'; (e.currentTarget as HTMLElement).style.color = '#1A1309'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.15)'; (e.currentTarget as HTMLElement).style.color = '#6A5C4E'; }}
                  >
                    Clear
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  style={{ width: '100%', height: '8rem', border: '1px solid rgba(26,19,9,0.15)', backgroundColor: '#FFFFFF', cursor: 'crosshair', touchAction: 'none', borderRadius: '8px' }}
                  onMouseDown={drawing.startDraw}
                  onMouseMove={drawing.draw}
                  onMouseUp={drawing.stopDraw}
                  onMouseLeave={drawing.stopDraw}
                  onTouchStart={drawing.startDraw}
                  onTouchMove={drawing.draw}
                  onTouchEnd={drawing.stopDraw}
                />
                <div style={{ fontSize: '0.65rem', color: '#8A7F72', marginTop: '0.5rem' }}>
                  Draw with mouse or stylus to derive equations before revealing the answer.
                </div>
              </div>
            )}

            {/* Signal Interactive Chart */}
            {isSignalInteractive && chartOption && !isFlipped && (
              <div style={{ borderTop: '1px solid rgba(26,19,9,0.08)', padding: '1rem 1.5rem' }}>
                <div style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Dynamic Signal
                </div>
                <div style={{ border: '1px solid rgba(26,19,9,0.08)', backgroundColor: '#FDFBF7', borderRadius: '8px', overflow: 'hidden' }}>
                  <ReactECharts
                    option={chartOption}
                    style={{ height: '10rem' }}
                    opts={{ renderer: 'canvas' }}
                    notMerge
                    lazyUpdate
                  />
                </div>
              </div>
            )}

            {/* Flip Button (when not flipped) */}
            {!isFlipped && (
              <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
                <button
                  onClick={flipCard}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid rgba(26,19,9,0.15)',
                    backgroundColor: '#FDFBF7',
                    color: '#1A1309',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#0d9488';
                    (e.currentTarget as HTMLElement).style.color = '#0d9488';
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.15)';
                    (e.currentTarget as HTMLElement).style.color = '#1A1309';
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#FDFBF7';
                  }}
                >
                  Reveal Answer
                </button>
              </div>
            )}

            {/* Back Content (after flip) */}
            {isFlipped && 'back_en' in currentCard.data && (
              <div style={{ borderTop: '1px solid rgba(26,19,9,0.08)', padding: '1.5rem', backgroundColor: '#FDFBF7' }}>
                <div style={{ fontSize: '1rem', color: '#0d9488', lineHeight: 1.6, fontWeight: 500 }}>
                  <MarkdownContent
                    text={language === 'th' && (currentCard.data as Flashcard).back_th
                      ? (currentCard.data as Flashcard).back_th!
                      : (currentCard.data as Flashcard).back_en}
                  />
                </div>
                {language === 'en' && (currentCard.data as Flashcard).back_th && (
                  <p style={{ fontSize: '0.8125rem', color: 'rgba(13,148,136,0.7)', marginTop: '0.5rem' }}>
                    {(currentCard.data as Flashcard).back_th}
                  </p>
                )}
                {language === 'th' && (currentCard.data as Flashcard).back_en && (
                  <p style={{ fontSize: '0.8125rem', color: 'rgba(13,148,136,0.7)', marginTop: '0.5rem' }}>
                    {(currentCard.data as Flashcard).back_en}
                  </p>
                )}

                {/* Show chart again on back for reference */}
                {isSignalInteractive && chartOption && (
                  <div style={{ marginTop: '1rem', border: '1px solid rgba(26,19,9,0.08)', backgroundColor: '#FFFFFF', borderRadius: '8px', overflow: 'hidden' }}>
                    <ReactECharts
                      option={chartOption}
                      style={{ height: '10rem' }}
                      opts={{ renderer: 'canvas' }}
                      notMerge
                      lazyUpdate
                    />
                  </div>
                )}
              </div>
            )}

            {/* Rating Buttons (after flip) */}
            {isFlipped && (
              <div style={{ borderTop: '1px solid rgba(26,19,9,0.08)', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.75rem', textAlign: 'center' }}>
                  How well did you know this?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.5rem' }}>
                  {([
                    { label: 'Again', key: 1, color: '#dc2626', bg: 'rgba(220,38,38,0.05)' },
                    { label: 'Hard', key: 2, color: '#ea580c', bg: 'rgba(234,88,12,0.05)' },
                    { label: 'Good', key: 3, color: '#0d9488', bg: 'rgba(13,148,136,0.05)' },
                    { label: 'Easy', key: 4, color: '#16a34a', bg: 'rgba(22,163,74,0.05)' },
                  ] as { label: string; key: number; color: string; bg: string }[]).map(({ label, key, color, bg }) => (
                    <button
                      key={key}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRate(key as FSRSRating);
                      }}
                      style={{
                        padding: '0.75rem 0',
                        border: `1px solid ${color}`,
                        backgroundColor: '#FFFFFF',
                        color: color,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderRadius: '9999px',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = bg;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#FFFFFF';
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Session Stats */}
        <div style={{ marginTop: '1.5rem', border: '1px solid rgba(26,19,9,0.08)', backgroundColor: '#FFFFFF', padding: '1rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.5rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Reviewed</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1309', fontFamily: '"Fraunces", serif' }}>
                {cardsReviewed}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Streak</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1309', fontFamily: '"Fraunces", serif' }}>{streak}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Best</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1309', fontFamily: '"Fraunces", serif' }}>
                {longStreak}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#8A7F72', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Avg</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1309', fontFamily: '"Fraunces", serif' }}>
                {averageRating.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Complete / Restart */}
        {status === 'complete' && (
          <div style={{ marginTop: '1.5rem', border: '1px solid rgba(13,148,136,0.3)', backgroundColor: 'rgba(13,148,136,0.05)', padding: '2rem 1.5rem', textAlign: 'center', borderRadius: '12px' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0d9488', fontFamily: '"Fraunces", serif', marginBottom: '0.25rem' }}>
              Session Complete
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6A5C4E', marginBottom: '1.5rem' }}>
              {cardsReviewed} cards reviewed · Streak: {streak}
              {isCramMode && ' · Cram Mode'}
            </div>
            <button
              onClick={handleRestart}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #0d9488',
                backgroundColor: '#0d9488',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: 700,
                borderRadius: '9999px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#0f766e';
                (e.currentTarget as HTMLElement).style.borderColor = '#0f766e';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#0d9488';
                (e.currentTarget as HTMLElement).style.borderColor = '#0d9488';
              }}
            >
              New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}