'use client';

// ============================================================================
// EgBE Memory Engine — Image Occlusion Page
//
// Displays occlusion sets from Dexie (OcclusionSet + OcclusionRegion).
// Regions rendered as masked overlays on top of an image. Click a region to
// reveal its label. Impeccable.style brutalist UI.
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { initDb } from '@/lib/db';
import { useLanguageStore } from '@/stores/language-store';
import type { OcclusionSet, OcclusionRegion, UUID } from '@/types/schema';

export default function OcclusionPage() {
  const { language, toggleLanguage, t } = useLanguageStore();
  const [sets, setSets] = useState<OcclusionSet[]>([]);
  const [regionsBySet, setRegionsBySet] = useState<Map<UUID, OcclusionRegion[]>>(new Map());
  const [activeSetId, setActiveSetId] = useState<UUID | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<UUID>>(new Set());
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const db = await initDb();
      const allSets = await db.occlusionSets.toArray();
      setSets(allSets);

      if (allSets.length > 0 && !activeSetId) {
        setActiveSetId(allSets[0].id);
      }

      const regionMap = new Map<UUID, OcclusionRegion[]>();
      for (const s of allSets) {
        const regions = await db.occlusionRegions
          .where('occlusion_set_id')
          .equals(s.id)
          .toArray();
        regionMap.set(s.id, regions);
      }
      setRegionsBySet(regionMap);
      setHasLoaded(true);
    })();
  }, []);

  const activeSet = sets.find((s) => s.id === activeSetId) ?? null;
  const activeRegions = activeSetId ? regionsBySet.get(activeSetId) ?? [] : [];

  const toggleReveal = useCallback((regionId: UUID) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) next.delete(regionId);
      else next.add(regionId);
      return next;
    });
  }, []);

  const revealAll = useCallback(() => {
    setRevealedIds(new Set(activeRegions.map((r) => r.id)));
  }, [activeRegions]);

  const resetAll = useCallback(() => {
    setRevealedIds(new Set());
  }, []);

  const numRevealed = activeRegions.filter((r) => revealedIds.has(r.id)).length;
  const totalRegions = activeRegions.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono antialiased">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6 mb-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 uppercase">
              Image Occlusion
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              {t('study.occlusion') || 'Click masked regions to reveal labels'}
            </p>
          </div>
          <button
            onClick={toggleLanguage}
            className="border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-teal-400 hover:border-teal-600 transition-colors uppercase tracking-wider"
          >
            {language === 'en' ? 'TH' : 'EN'}
          </button>
        </div>

        {/* Empty state */}
        {hasLoaded && sets.length === 0 && (
          <div className="border border-zinc-800 bg-zinc-900/50 p-8 text-center">
            <p className="text-sm text-zinc-400 mb-2">No occlusion sets found</p>
            <p className="text-xs text-zinc-600">
              Seed occlusion data on the{' '}
              <a href="/" className="text-teal-500 hover:text-teal-400 underline">
                home page
              </a>.
            </p>
          </div>
        )}

        {sets.length > 0 && (
          <>
            {/* Set selector */}
            <div className="flex flex-wrap gap-2 mb-6">
              {sets.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSetId(s.id);
                    setRevealedIds(new Set());
                  }}
                  className={`border px-3 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                    activeSetId === s.id
                      ? 'border-teal-500 text-teal-400 bg-teal-950/30'
                      : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  {language === 'th' && s.title_th ? s.title_th : s.title_en}
                </button>
              ))}
            </div>

            {/* Stats bar */}
            <div className="flex items-center justify-between mb-6 text-xs text-zinc-500">
              <span>
                {numRevealed} / {totalRegions} revealed
              </span>
              <div className="flex gap-2">
                <button
                  onClick={revealAll}
                  className="border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-teal-400 hover:border-teal-600 transition-colors uppercase tracking-wider"
                >
                  Reveal All
                </button>
                <button
                  onClick={resetAll}
                  className="border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-teal-400 hover:border-teal-600 transition-colors uppercase tracking-wider"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Image canvas + overlay regions */}
            {activeSet && (
              <div className="border border-zinc-800 bg-zinc-900">
                <div className="border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                    {activeSet.image_url
                      ? `Image: ${activeSet.image_url}`
                      : 'No image'}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {activeSet.image_width}x{activeSet.image_height}
                  </span>
                </div>

                <div className="relative w-full" style={{ minHeight: '320px' }}>
                  {/* Placeholder image */}
                  <div
                    className="w-full h-80 bg-zinc-950 flex items-center justify-center text-zinc-700 text-xs"
                    style={{
                      aspectRatio: activeSet.image_width && activeSet.image_height
                        ? `${activeSet.image_width} / ${activeSet.image_height}`
                        : undefined,
                    }}
                  >
                    {activeSet.image_url ? (
                      <img
                        src={activeSet.image_url}
                        alt={activeSet.title_en}
                        className="max-w-full max-h-80 object-contain"
                      />
                    ) : (
                      <span className="uppercase tracking-widest">Image Placeholder</span>
                    )}
                  </div>

                  {/* Overlay regions — normalized coords 0–1, convert to % */}
                  {activeRegions
                    .sort((a, b) => a.reveal_order - b.reveal_order)
                    .map((region) => {
                      const isRevealed = revealedIds.has(region.id);
                      return (
                        <button
                          key={region.id}
                          onClick={() => toggleReveal(region.id)}
                          className={`absolute border-2 transition-all duration-150 cursor-pointer ${
                            region.shape === 'ellipse' ? 'rounded-full' : ''
                          }`}
                          style={{
                            left: `${(region.x ?? 0) * 100}%`,
                            top: `${(region.y ?? 0) * 100}%`,
                            width: `${(region.width ?? 0.2) * 100}%`,
                            height: `${(region.height ?? 0.15) * 100}%`,
                          }}
                        >
                          {isRevealed ? (
                            <div className="w-full h-full flex items-center justify-center bg-teal-950/80 border-teal-600 p-1">
                              <span className="text-[10px] text-teal-200 text-center leading-tight">
                                {language === 'th' && region.label_th
                                  ? region.label_th
                                  : region.label_en}
                              </span>
                            </div>
                          ) : (
                            <div className="w-full h-full bg-zinc-800/90 border-zinc-600 hover:bg-zinc-700/80 flex items-center justify-center transition-colors">
                              <span className="text-[10px] text-zinc-500 font-bold">
                                {region.reveal_order}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Region list (table view) */}
            {activeRegions.length > 0 && (
              <div className="mt-8 border border-zinc-800">
                <div className="border-b border-zinc-800 px-4 py-2">
                  <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest">
                    Region Labels
                  </h3>
                </div>
                <div className="divide-y divide-zinc-800/50">
                  {activeRegions
                    .sort((a, b) => a.reveal_order - b.reveal_order)
                    .map((region) => {
                      const isRevealed = revealedIds.has(region.id);
                      return (
                        <button
                          key={region.id}
                          onClick={() => toggleReveal(region.id)}
                          className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs transition-colors ${
                            isRevealed
                              ? 'bg-teal-950/30 text-teal-300'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                          }`}
                        >
                          <span className="w-5 text-right text-zinc-600 font-mono">
                            {region.reveal_order}
                          </span>
                          <span className="flex-1">
                            {isRevealed
                              ? language === 'th' && region.label_th
                                ? region.label_th
                                : region.label_en
                              : '???'}
                          </span>
                          <span className="text-zinc-700 font-mono text-[10px]">
                            {region.shape}
                          </span>
                          <span className="text-zinc-700">
                            {isRevealed ? '\u25CF' : '\u25CB'}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}