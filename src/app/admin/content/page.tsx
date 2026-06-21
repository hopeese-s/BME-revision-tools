'use client';

import { useEffect, useState } from 'react';

import {
  FileText,
  BrainCircuit,
  Library,
  EyeOff,
  Plus,
  Save,
  Trash2,
  Search,
  Zap,
  Layers,
  Tag,
} from 'lucide-react';
import { initDb } from '@/lib/db';
import type {
  UUID,
  Module,
  Flashcard,
  EquationBank,
  Scenario,
  ScenarioNode,
  ScenarioTransition,
  CardType,
  ScenarioNodeType,
} from '@/types/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentTab = 'flashcards' | 'equations' | 'scenarios' | 'occlusion';

interface ModuleOption {
  value: UUID;
  label: string;
  path: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState<ContentTab>('flashcards');
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Flashcard form state ──
  const [fcModuleId, setFcModuleId] = useState<UUID | ''>('');
  const [fcCardType, setFcCardType] = useState<CardType>('basic');
  const [fcFrontEn, setFcFrontEn] = useState('');
  const [fcFrontTh, setFcFrontTh] = useState('');
  const [fcBackEn, setFcBackEn] = useState('');
  const [fcBackTh, setFcBackTh] = useState('');
  const [fcTags, setFcTags] = useState('');
  const [fcDifficulty, setFcDifficulty] = useState<string>('');
  const [fcFrontLatex, setFcFrontLatex] = useState('');
  const [fcBackLatex, setFcBackLatex] = useState('');

  // ── Equation form state ──
  const [eqModuleId, setEqModuleId] = useState<UUID | ''>('');
  const [eqNameEn, setEqNameEn] = useState('');
  const [eqNameTh, setEqNameTh] = useState('');
  const [eqLatex, setEqLatex] = useState('');
  const [eqDescEn, setEqDescEn] = useState('');
  const [eqDescTh, setEqDescTh] = useState('');
  const [eqTags, setEqTags] = useState('');
  const [eqVarsJson, setEqVarsJson] = useState('');

  // ── Scenario form state ──
  const [scModuleId, setScModuleId] = useState<UUID | ''>('');
  const [scTitleEn, setScTitleEn] = useState('');
  const [scTitleTh, setScTitleTh] = useState('');
  const [scDescEn, setScDescEn] = useState('');
  const [scDescTh, setScDescTh] = useState('');
  const [scDomain, setScDomain] = useState('clinical');

  // ── List state ──
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [equations, setEquations] = useState<EquationBank[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Submission feedback ──
  const [toast, setToast] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Load modules + content on mount and tab switch
  // -----------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const db = await initDb();
      const mods = await db.modules.toArray();
      setModules(
        mods.map(m => ({
          value: m.id,
          label: m.title_en,
          path: m.title_en,
        })),
      );
      setIsLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadContent() {
      const db = await initDb();
      switch (activeTab) {
        case 'flashcards':
          setFlashcards(await db.flashcards.toArray());
          break;
        case 'equations':
          setEquations(await db.equationBanks.toArray());
          break;
        case 'scenarios':
          setScenarios(await db.scenarios.toArray());
          break;
      }
    }
    loadContent();
  }, [activeTab]);

  // -----------------------------------------------------------------------
  // Toast helper
  // -----------------------------------------------------------------------
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // -----------------------------------------------------------------------
  // Flashcard handlers
  // -----------------------------------------------------------------------
  async function addFlashcard() {
    if (!fcModuleId || !fcFrontEn || !fcBackEn) return;
    const db = await initDb();
    const id = crypto.randomUUID() as UUID;
    const existing = await db.flashcards.where('module_id').equals(fcModuleId).count();
    await db.flashcards.put({
      id,
      module_id: fcModuleId,
      card_type: fcCardType,
      front_en: fcFrontEn,
      front_th: fcFrontTh || null,
      back_en: fcBackEn,
      back_th: fcBackTh || null,
      front_latex: fcFrontLatex || null,
      back_latex: fcBackLatex || null,
      front_markdown: null,
      back_markdown: null,
      occlusion_set_id: null,
      tags: fcTags ? fcTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      difficulty_tier: fcDifficulty ? (parseInt(fcDifficulty, 10) as 1 | 2 | 3 | 4 | 5) : null,
      sort_order: existing + 1,
      _sync_version: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    setFcFrontEn(''); setFcFrontTh(''); setFcBackEn(''); setFcBackTh('');
    setFcTags(''); setFcDifficulty(''); setFcFrontLatex(''); setFcBackLatex('');
    setFlashcards(await db.flashcards.toArray());
    showToast('Flashcard added ✓');
  }

  async function deleteFlashcard(id: UUID) {
    if (!confirm('Delete this flashcard?')) return;
    const db = await initDb();
    await db.flashcards.delete(id);
    setFlashcards(await db.flashcards.toArray());
    showToast('Flashcard deleted');
  }

  // -----------------------------------------------------------------------
  // Equation handlers
  // -----------------------------------------------------------------------
  async function addEquation() {
    if (!eqModuleId || !eqNameEn || !eqLatex) return;
    const db = await initDb();
    const id = crypto.randomUUID() as UUID;
    let variables: { symbol: string; name_en: string; name_th: string | null; unit: string | null }[] = [];
    try {
      if (eqVarsJson.trim()) {
        variables = JSON.parse(eqVarsJson);
      }
    } catch {
      showToast('Invalid JSON for variables');
      return;
    }
    const existing = await db.equationBanks.where('module_id').equals(eqModuleId).count();
    await db.equationBanks.put({
      id,
      module_id: eqModuleId,
      name_en: eqNameEn,
      name_th: eqNameTh || null,
      latex_source: eqLatex,
      description_en: eqDescEn || null,
      description_th: eqDescTh || null,
      variables,
      tags: eqTags ? eqTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      sort_order: existing + 1,
      _sync_version: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    setEqNameEn(''); setEqNameTh(''); setEqLatex(''); setEqDescEn('');
    setEqDescTh(''); setEqTags(''); setEqVarsJson('');
    setEquations(await db.equationBanks.toArray());
    showToast('Equation added ✓');
  }

  async function deleteEquation(id: UUID) {
    if (!confirm('Delete this equation?')) return;
    const db = await initDb();
    await db.equationBanks.delete(id);
    setEquations(await db.equationBanks.toArray());
    showToast('Equation deleted');
  }

  // -----------------------------------------------------------------------
  // Scenario handlers
  // -----------------------------------------------------------------------
  async function addScenario() {
    if (!scModuleId || !scTitleEn) return;
    const db = await initDb();
    const id = crypto.randomUUID() as UUID;
    const now = new Date().toISOString();

    await db.scenarios.put({
      id,
      module_id: scModuleId,
      title_en: scTitleEn,
      title_th: scTitleTh || null,
      description_en: scDescEn || null,
      description_th: scDescTh || null,
      domain: scDomain,
      difficulty: null,
      time_limit_seconds: null,
      _sync_version: 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    // Create an initial entry node so the scenario can be started
    await db.scenarioNodes.put({
      id: crypto.randomUUID() as UUID,
      scenario_id: id,
      node_type: 'prompt',
      content_en: 'Scenario Started. Please edit this entry node.',
      content_th: null,
      image_url: null,
      is_entry_point: true,
      _sync_version: 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    setScTitleEn(''); setScTitleTh(''); setScDescEn(''); setScDescTh('');
    setScenarios(await db.scenarios.toArray());
    showToast('Scenario added ✓');
  }

  async function deleteScenario(id: UUID) {
    if (!confirm('Delete this scenario and all its nodes?')) return;
    const db = await initDb();
    await db.scenarios.delete(id);
    await db.scenarioNodes.where('scenario_id').equals(id).delete();
    await db.scenarioTransitions.where('to_node_id').anyOf(
      (await db.scenarioNodes.where('scenario_id').equals(id).toArray()).map(n => n.id),
    ).delete();
    setScenarios(await db.scenarios.toArray());
    showToast('Scenario deleted');
  }

  // -----------------------------------------------------------------------
  // Filters
  // -----------------------------------------------------------------------
  function filterBySearch<T extends { id: string }>(items: T[], getText: (item: T) => string): T[] {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => getText(item).toLowerCase().includes(q));
  }

  // -----------------------------------------------------------------------
  // Styles
  // -----------------------------------------------------------------------
  const inputStyle: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, sans-serif",
    border: '1px solid rgba(26, 19, 9, 0.15)',
    backgroundColor: '#FDFBF7',
    padding: '8px 12px',
    fontSize: '0.8125rem',
    outline: 'none',
    width: '100%',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '0.625rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ink-faint)',
    marginBottom: 4,
    display: 'block',
  };

  const tabStyle = (tab: ContentTab): React.CSSProperties => ({
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '0.8125rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    padding: '12px 24px',
    background: 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--amber)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--ink)' : 'var(--ink-faint)',
    cursor: 'pointer',
    transition: 'all 150ms',
    marginBottom: -2,
  });

  const moduleLabel = (moduleId: UUID): string => {
    const m = modules.find(m => m.value === moduleId);
    return m ? m.label : 'Unknown Module';
  };

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
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-5 py-3 text-sm font-semibold animate-in slide-in-from-top-2"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            backgroundColor: 'var(--ink)',
            color: 'var(--cream)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold tracking-tight mb-2"
          style={{ fontFamily: "'Fraunces', Georgia, serif", color: 'var(--ink)' }}
        >
          Content Management
        </h1>
        <p
          className="text-sm"
          style={{ fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--ink-muted)' }}
        >
          Create and manage flashcards, equations, scenarios, and image occlusion sets.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 mb-8" style={{ borderBottom: '2px solid rgba(26, 19, 9, 0.08)' }}>
        {([
          ['flashcards', 'Flashcards'],
          ['equations', 'Equations'],
          ['scenarios', 'Scenarios'],
          ['occlusion', 'Occlusion'],
        ] as [ContentTab, string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
            {label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative mb-8">
        <Search
          size={16}
          strokeWidth={1.5}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }}
        />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full"
          style={{
            ...inputStyle,
            paddingLeft: 40,
            fontSize: '0.8125rem',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
        />
      </div>

      {/* ═══════════════ FLASHCARDS TAB ═══════════════ */}
      {activeTab === 'flashcards' && (
        <div>
          {/* Form */}
          <div
            className="p-6 mb-8"
            style={{ backgroundColor: 'var(--cream-dark)', border: '1px solid rgba(26, 19, 9, 0.1)' }}
          >
            <div className="flex items-center gap-2 mb-5">
              <FileText size={18} strokeWidth={2} style={{ color: 'var(--amber)' }} />
              <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                New Flashcard
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label style={labelStyle}>Module</label>
                <select value={fcModuleId} onChange={e => setFcModuleId(e.target.value as UUID)} style={selectStyle}>
                  <option value="">Select module...</option>
                  {modules.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Card Type</label>
                <select value={fcCardType} onChange={e => setFcCardType(e.target.value as CardType)} style={selectStyle}>
                  <option value="basic">Basic</option>
                  <option value="cloze">Cloze</option>
                  <option value="equation">Equation</option>
                  <option value="image_occlusion">Image Occlusion</option>
                  <option value="multi_choice">Multi-Choice</option>
                  <option value="signal_interactive">Signal Interactive</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label style={labelStyle}>Front (EN) *</label>
                <textarea rows={3} value={fcFrontEn} onChange={e => setFcFrontEn(e.target.value)}
                  style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Front (TH)</label>
                <textarea rows={3} value={fcFrontTh} onChange={e => setFcFrontTh(e.target.value)}
                  style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label style={labelStyle}>Back (EN) *</label>
                <textarea rows={3} value={fcBackEn} onChange={e => setFcBackEn(e.target.value)}
                  style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Back (TH)</label>
                <textarea rows={3} value={fcBackTh} onChange={e => setFcBackTh(e.target.value)}
                  style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label style={labelStyle}>Tags (comma-separated)</label>
                <input value={fcTags} onChange={e => setFcTags(e.target.value)}
                  placeholder="e.g. anatomy, year1"
                  style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Difficulty (1-5)</label>
                <input type="number" min={1} max={5} value={fcDifficulty} onChange={e => setFcDifficulty(e.target.value)}
                  style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                />
              </div>
              <div />
            </div>

            <details className="mb-4">
              <summary style={{ ...labelStyle, cursor: 'pointer', display: 'inline-block', marginBottom: 8 }}>
                LaTeX Content (optional)
              </summary>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Front LaTeX</label>
                  <textarea rows={2} value={fcFrontLatex} onChange={e => setFcFrontLatex(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Back LaTeX</label>
                  <textarea rows={2} value={fcBackLatex} onChange={e => setFcBackLatex(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </details>

            <button onClick={addFlashcard} className="imp-btn imp-btn-accent" style={{ width: '100%' }}>
              <Plus size={16} /> Add Flashcard
            </button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {filterBySearch(flashcards, f => `${f.front_en} ${f.back_en} ${f.tags.join(' ')}`).map(fc => (
              <div
                key={fc.id}
                className="p-3 flex items-start justify-between group transition-all duration-150"
                style={{ backgroundColor: '#FDFBF7', border: '1px solid rgba(26, 19, 9, 0.06)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.06)'; }}
              >
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5"
                      style={{ backgroundColor: 'rgba(196, 90, 27, 0.08)', color: 'var(--amber)', textTransform: 'uppercase' }}
                    >
                      {fc.card_type}
                    </span>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--ink-faint)' }}
                    >
                      {moduleLabel(fc.module_id)}
                    </span>
                    {fc.difficulty_tier && (
                      <span
                        className="text-[10px] ml-auto"
                        style={{ color: 'var(--ink-faint)' }}
                      >
                        Tier {fc.difficulty_tier}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    Q: {fc.front_en}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                    A: {fc.back_en.substring(0, 120)}{fc.back_en.length > 120 ? '...' : ''}
                  </div>
                </div>
                <button
                  onClick={() => deleteFlashcard(fc.id)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150"
                  style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-faint)'; }}
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
            {flashcards.length === 0 && (
              <div className="p-12 text-center" style={{ color: 'var(--ink-faint)' }}>
                <FileText size={36} strokeWidth={1} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p className="text-sm">No flashcards yet. Add one above.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ EQUATIONS TAB ═══════════════ */}
      {activeTab === 'equations' && (
        <div>
          <div
            className="p-6 mb-8"
            style={{ backgroundColor: 'var(--cream-dark)', border: '1px solid rgba(26, 19, 9, 0.1)' }}
          >
            <div className="flex items-center gap-2 mb-5">
              <BrainCircuit size={18} strokeWidth={2} style={{ color: '#8b5cf6' }} />
              <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                New Equation
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label style={labelStyle}>Module</label>
                <select value={eqModuleId} onChange={e => setEqModuleId(e.target.value as UUID)} style={selectStyle}>
                  <option value="">Select module...</option>
                  {modules.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Name (EN) *</label>
                <input value={eqNameEn} onChange={e => setEqNameEn(e.target.value)}
                  placeholder="e.g. Nernst Equation"
                  style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label style={labelStyle}>Name (TH)</label>
                <input value={eqNameTh} onChange={e => setEqNameTh(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>LaTeX Source *</label>
                <input value={eqLatex} onChange={e => setEqLatex(e.target.value)}
                  placeholder="E_{eq} = \\frac{RT}{zF} \\ln\\frac{[X]_{out}}{[X]_{in}}"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label style={labelStyle}>Description (EN)</label>
                <textarea rows={2} value={eqDescEn} onChange={e => setEqDescEn(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description (TH)</label>
                <textarea rows={2} value={eqDescTh} onChange={e => setEqDescTh(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div className="mb-4">
              <label style={labelStyle}>Variables (JSON array)</label>
              <textarea
                rows={4}
                value={eqVarsJson}
                onChange={e => setEqVarsJson(e.target.value)}
                placeholder={`[\n  { "symbol": "E_eq", "name_en": "Equilibrium potential", "name_th": null, "unit": "V" },\n  { "symbol": "R", "name_en": "Gas constant", "name_th": null, "unit": "J/(mol·K)" }\n]`}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.75rem' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
              />
            </div>

            <div>
              <label style={labelStyle}>Tags (comma-separated)</label>
              <input value={eqTags} onChange={e => setEqTags(e.target.value)} style={inputStyle} />
            </div>

            <button onClick={addEquation} className="imp-btn imp-btn-accent mt-4" style={{ width: '100%' }}>
              <Plus size={16} /> Add Equation
            </button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {filterBySearch(equations, eq => `${eq.name_en} ${eq.latex_source}`).map(eq => (
              <div
                key={eq.id}
                className="p-3 flex items-start justify-between group transition-all duration-150"
                style={{ backgroundColor: '#FDFBF7', border: '1px solid rgba(26, 19, 9, 0.06)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.06)'; }}
              >
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--ink-faint)' }}>
                      {moduleLabel(eq.module_id)}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
                      {eq.variables.length} variables
                    </span>
                  </div>
                  <div className="text-sm font-medium font-mono" style={{ color: 'var(--ink)' }}>
                    {eq.latex_source}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                    {eq.name_en}
                  </div>
                </div>
                <button
                  onClick={() => deleteEquation(eq.id)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150"
                  style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-faint)'; }}
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
            {equations.length === 0 && (
              <div className="p-12 text-center" style={{ color: 'var(--ink-faint)' }}>
                <BrainCircuit size={36} strokeWidth={1} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p className="text-sm">No equations yet. Add one above.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ SCENARIOS TAB ═══════════════ */}
      {activeTab === 'scenarios' && (
        <div>
          <div
            className="p-6 mb-8"
            style={{ backgroundColor: 'var(--cream-dark)', border: '1px solid rgba(26, 19, 9, 0.1)' }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Library size={18} strokeWidth={2} style={{ color: '#059669' }} />
              <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                New Scenario
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label style={labelStyle}>Module</label>
                <select value={scModuleId} onChange={e => setScModuleId(e.target.value as UUID)} style={selectStyle}>
                  <option value="">Select module...</option>
                  {modules.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Domain</label>
                <select value={scDomain} onChange={e => setScDomain(e.target.value)} style={selectStyle}>
                  <option value="clinical">Clinical</option>
                  <option value="instrumentation">Instrumentation</option>
                  <option value="circuit_debug">Circuit Debug</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label style={labelStyle}>Title (EN) *</label>
                <input value={scTitleEn} onChange={e => setScTitleEn(e.target.value)}
                  style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Title (TH)</label>
                <input value={scTitleTh} onChange={e => setScTitleTh(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label style={labelStyle}>Description (EN)</label>
                <textarea rows={3} value={scDescEn} onChange={e => setScDescEn(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description (TH)</label>
                <textarea rows={3} value={scDescTh} onChange={e => setScDescTh(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <button onClick={addScenario} className="imp-btn imp-btn-accent" style={{ width: '100%' }}>
              <Plus size={16} /> Add Scenario
            </button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {filterBySearch(scenarios, sc => `${sc.title_en} ${sc.description_en || ''}`).map(sc => (
              <div
                key={sc.id}
                className="p-3 flex items-start justify-between group transition-all duration-150"
                style={{ backgroundColor: '#FDFBF7', border: '1px solid rgba(26, 19, 9, 0.06)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26, 19, 9, 0.06)'; }}
              >
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5"
                      style={{ backgroundColor: 'rgba(5, 150, 105, 0.08)', color: '#059669', textTransform: 'uppercase' }}
                    >
                      {sc.domain}
                    </span>
                    <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--ink-faint)' }}>
                      {moduleLabel(sc.module_id!)}
                    </span>
                  </div>
                  <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {sc.title_en}
                  </div>
                  {sc.description_en && (
                    <div className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                      {sc.description_en.substring(0, 150)}{sc.description_en.length > 150 ? '...' : ''}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteScenario(sc.id)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150"
                  style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-faint)'; }}
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
            {scenarios.length === 0 && (
              <div className="p-12 text-center" style={{ color: 'var(--ink-faint)' }}>
                <Library size={36} strokeWidth={1} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p className="text-sm">No scenarios yet. Add one above.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ OCCLUSION TAB ═══════════════ */}
      {activeTab === 'occlusion' && (
        <div
          className="p-12 text-center"
          style={{
            backgroundColor: '#FDFBF7',
            border: '1px solid rgba(26, 19, 9, 0.06)',
            color: 'var(--ink-faint)',
          }}
        >
          <EyeOff size={40} strokeWidth={1} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <h3
            className="text-lg font-bold mb-2"
            style={{ fontFamily: "'Fraunces', Georgia, serif", color: 'var(--ink)' }}
          >
            Image Occlusion Builder
          </h3>
          <p className="text-sm mb-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            Create labelled image occlusion sets by uploading a diagram, CT, or micrograph,
            then drawing rectangular regions over structures to be tested.
          </p>
          <div
            className="p-6 mb-4"
            style={{ backgroundColor: 'var(--cream-dark)', border: '1px dashed rgba(26, 19, 9, 0.2)' }}
          >
            <p className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: 'var(--ink-muted)' }}>
              Upload Image
            </p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="block mx-auto text-sm"
              style={{ color: 'var(--ink-muted)' }}
            />
          </div>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--ink-faint)' }}>
            Region drawing canvas coming soon — use the Study → Occlusion page for full implementation
          </p>
        </div>
      )}
    </div>
  );
}