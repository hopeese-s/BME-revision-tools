'use client';

import { useEffect, useState } from 'react';
import {
  BookOpen,
  FileText,
  Library,
  BrainCircuit,
  TrendingUp,
  CalendarCheck,
  Layers,
} from 'lucide-react';
import { initDb } from '@/lib/db';
import { useSyllabusStore } from '@/stores/syllabus-store';

interface DashboardStats {
  totalYears: number;
  totalCourses: number;
  totalModules: number;
  totalFlashcards: number;
  totalEquations: number;
  totalScenarios: number;
  totalOcclusionSets: number;
  totalCardsStudied: number;
  mutationQueueSize: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { years } = useSyllabusStore();

  useEffect(() => {
    async function loadStats() {
      try {
        const db = await initDb();

        const [
          yearsArr,
          courses,
          modules,
          flashcards,
          equations,
          scenarios,
          occlusionSets,
          reviewLogs,
          mutationSize,
        ] = await Promise.all([
          db.years.toArray(),
          db.courses.toArray(),
          db.modules.toArray(),
          db.flashcards.toArray(),
          db.equationBanks.toArray(),
          db.scenarios.toArray(),
          db.occlusionSets.toArray(),
          db.reviewLogs.toArray(),
          db.getMutationQueueSize(),
        ]);

        setStats({
          totalYears: yearsArr.length,
          totalCourses: courses.length,
          totalModules: modules.length,
          totalFlashcards: flashcards.length,
          totalEquations: equations.length,
          totalScenarios: scenarios.length,
          totalOcclusionSets: occlusionSets.length,
          totalCardsStudied: reviewLogs.length,
          mutationQueueSize: mutationSize,
        });
      } catch {
        // Silently fail — stats aren't critical
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  const statCards = [
    { icon: BookOpen, label: 'Courses', value: stats?.totalCourses ?? '—', color: '#0d9488' },
    { icon: Layers, label: 'Modules', value: stats?.totalModules ?? '—', color: '#C45A1B' },
    { icon: FileText, label: 'Flashcards', value: stats?.totalFlashcards ?? '—', color: '#6366f1' },
    { icon: BrainCircuit, label: 'Equations', value: stats?.totalEquations ?? '—', color: '#8b5cf6' },
    { icon: Library, label: 'Scenarios', value: stats?.totalScenarios ?? '—', color: '#059669' },
    { icon: TrendingUp, label: 'Reviews Logged', value: stats?.totalCardsStudied ?? '—', color: '#d97706' },
    { icon: CalendarCheck, label: 'Occlusion Sets', value: stats?.totalOcclusionSets ?? '—', color: '#dc2626' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--cream)', padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            marginBottom: '0.5rem',
            fontFamily: "'Fraunces', Georgia, serif",
            color: 'var(--ink)'
          }}
        >
          Admin Dashboard
        </h1>
        <p
          style={{
            fontSize: '1rem',
            color: '#8A7F72',
            fontFamily: "'Inter', system-ui, sans-serif"
          }}
        >
          Manage content, curriculum, and synchronize offline data.
        </p>
      </div>

      {/* Stat Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {isLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: '112px',
                backgroundColor: 'rgba(26, 19, 9, 0.05)',
                border: '1px solid rgba(26, 19, 9, 0.1)',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
          ))
        ) : (
          statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                style={{
                  padding: '1.25rem',
                  backgroundColor: '#FDFBF7',
                  border: '1px solid rgba(26, 19, 9, 0.1)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.15s, border-color 0.15s',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.borderColor = 'rgba(196, 90, 27, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.1)';
                }}
              >
                {/* Color bar at top */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    backgroundColor: card.color,
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `${card.color}15`,
                    }}
                  >
                    <Icon size={18} strokeWidth={2} color={card.color} />
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '1.875rem',
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                    marginBottom: '0.25rem',
                    fontFamily: "'Fraunces', Georgia, serif",
                    color: 'var(--ink)'
                  }}
                >
                  {card.value}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    color: 'rgba(26, 19, 9, 0.5)'
                  }}
                >
                  {card.label}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sync Status Card */}
      {stats && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1.25rem',
            backgroundColor: '#FDFBF7',
            border: '1px solid rgba(26, 19, 9, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  color: 'rgba(26, 19, 9, 0.5)'
                }}
              >
                Offline Sync Queue
              </div>
              <div
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  fontFamily: "'Fraunces', Georgia, serif",
                  color: 'var(--ink)'
                }}
              >
                {stats.mutationQueueSize === 0 ? (
                  <span style={{ color: '#059669' }}>All synced ✓</span>
                ) : (
                  <span style={{ color: 'var(--amber)' }}>
                    {stats.mutationQueueSize} pending mutation{stats.mutationQueueSize !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div
              style={{
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: stats.mutationQueueSize === 0
                  ? 'rgba(5, 150, 105, 0.1)'
                  : 'rgba(196, 90, 27, 0.1)',
              }}
            >
              <CalendarCheck
                size={24}
                strokeWidth={2}
                color={stats.mutationQueueSize === 0 ? '#059669' : 'var(--amber)'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}