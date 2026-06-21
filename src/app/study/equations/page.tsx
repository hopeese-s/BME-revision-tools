'use client';

// ============================================================================
// EgBE Memory Engine — Equation Bank Page
//
// Displays equation bank entries from Dexie. Each equation shows its
// LaTeX-rendered formula, variable definitions, tags, and a "copy LaTeX"
// button. Impeccable.style brutalist UI.
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { initDb } from '@/lib/db';
import { useLanguageStore } from '@/stores/language-store';
import type { EquationBank, UUID } from '@/types/schema';

export default function EquationsPage() {
  const { language, toggleLanguage, t } = useLanguageStore();
  const [equations, setEquations] = useState<EquationBank[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<UUID | null>(null);

  useEffect(() => {
    (async () => {
      const db = await initDb();
      const all = await db.equationBanks.orderBy('sort_order').toArray();
      setEquations(all);
      setHasLoaded(true);
    })();
  }, []);

  // Collect all unique tags
  const allTags = Array.from(
    new Set(equations.flatMap((eq) => eq.tags))
  ).sort();

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const filtered = equations.filter((eq) => {
    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = language === 'th' && eq.name_th ? eq.name_th.toLowerCase() : eq.name_en.toLowerCase();
      const desc = language === 'th' && eq.description_th ? eq.description_th : eq.description_en ?? '';
      const symbols = eq.variables.map((v) => v.symbol.toLowerCase()).join(' ');
      if (!name.includes(q) && !desc.toLowerCase().includes(q) && !symbols.includes(q)) {
        return false;
      }
    }
    // Filter by selected tags
    if (selectedTags.size > 0) {
      if (!eq.tags.some((tag) => selectedTags.has(tag))) {
        return false;
      }
    }
    return true;
  });

  const handleCopyLatex = useCallback((eq: EquationBank) => {
    navigator.clipboard.writeText(eq.latex_source).then(() => {
      setCopiedId(eq.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono antialiased">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6 mb-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 uppercase">
              Equation Bank
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              {t('study.equations') || 'Reference library of LaTeX-rendered equations'}
            </p>
          </div>
          <button
            onClick={toggleLanguage}
            className="border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-teal-400 hover:border-teal-600 transition-colors uppercase tracking-wider"
          >
            {language === 'en' ? 'TH' : 'EN'}
          </button>
        </div>

        {/* Search + Tag filter bar */}
        <div className="flex flex-col gap-3 mb-8">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'th' ? 'ค้นหาสมการ...' : 'Search equations...'}
            className="w-full bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-teal-600 transition-colors"
          />

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`border px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                    selectedTags.has(tag)
                      ? 'border-teal-500 text-teal-400 bg-teal-950/30'
                      : 'border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {selectedTags.size > 0 && (
                <button
                  onClick={() => setSelectedTags(new Set())}
                  className="border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 hover:text-red-400 hover:border-red-800 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Empty state */}
        {hasLoaded && equations.length === 0 && (
          <div className="border border-zinc-800 bg-zinc-900/50 p-8 text-center">
            <p className="text-sm text-zinc-400 mb-2">No equations found</p>
            <p className="text-xs text-zinc-600">
              Seed equation data on the{' '}
              <a href="/" className="text-teal-500 hover:text-teal-400 underline">
                home page
              </a>.
            </p>
          </div>
        )}

        {filtered.length === 0 && equations.length > 0 && (
          <div className="border border-zinc-800 bg-zinc-900/50 p-8 text-center">
            <p className="text-sm text-zinc-400">No equations match your filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedTags(new Set());
              }}
              className="mt-2 text-xs text-teal-500 hover:text-teal-400 underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Equation cards */}
        <div className="space-y-6">
          {filtered.map((eq) => (
            <div
              key={eq.id}
              className="border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors"
            >
              {/* Card header */}
              <div className="flex items-start justify-between px-4 py-3 border-b border-zinc-800/50">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-tight">
                    {language === 'th' && eq.name_th ? eq.name_th : eq.name_en}
                  </h3>
                  {(eq.description_en || eq.description_th) && (
                    <p className="text-xs text-zinc-500 mt-1">
                      {language === 'th' && eq.description_th
                        ? eq.description_th
                        : eq.description_en}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleCopyLatex(eq)}
                  className={`ml-3 shrink-0 border px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                    copiedId === eq.id
                      ? 'border-teal-500 text-teal-400 bg-teal-950/40'
                      : 'border-zinc-700 text-zinc-500 hover:text-teal-400 hover:border-teal-600'
                  }`}
                  title="Copy LaTeX to clipboard"
                >
                  {copiedId === eq.id ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* LaTeX display */}
              <div className="px-4 py-4 bg-zinc-950 border-b border-zinc-800/30">
                <code className="text-sm text-teal-300/90 break-all font-mono">
                  {eq.latex_source}
                </code>
              </div>

              {/* Variables table */}
              {eq.variables.length > 0 && (
                <div className="px-4 py-2 border-b border-zinc-800/30">
                  <h4 className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                    Variables
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-zinc-600 text-left">
                          <th className="pb-1 pr-3 font-normal uppercase tracking-wider">Symbol</th>
                          <th className="pb-1 pr-3 font-normal uppercase tracking-wider">Name</th>
                          <th className="pb-1 font-normal uppercase tracking-wider">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/30">
                        {eq.variables.map((v, i) => (
                          <tr key={i} className="text-zinc-400">
                            <td className="py-1 pr-3 font-mono text-teal-300/80 whitespace-nowrap">
                              {v.symbol}
                            </td>
                            <td className="py-1 pr-3 whitespace-nowrap">
                              {language === 'th' && v.name_th ? v.name_th : v.name_en}
                            </td>
                            <td className="py-1 text-zinc-500 whitespace-nowrap">
                              {v.unit ?? '\u2014'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tags */}
              {eq.tags.length > 0 && (
                <div className="px-4 py-2 flex flex-wrap gap-1.5">
                  {eq.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] text-zinc-600 border border-zinc-800 px-1.5 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Stats footer */}
        {equations.length > 0 && (
          <div className="mt-8 pt-4 border-t border-zinc-800 text-[10px] text-zinc-600 text-right">
            {filtered.length} of {equations.length} equations
            {(searchQuery || selectedTags.size > 0) ? ' (filtered)' : ''}
          </div>
        )}
      </div>
    </div>
  );
}