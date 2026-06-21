'use client';

// ============================================================================
// EgBE Sync Status Bar — Offline-First Sync Trigger
//
// Sits in the top nav bar. Shows:
//   - Network status (online/offline dot)
//   - Pending mutation count
//   - Last sync timestamp
//   - "Sync Now" button
//
// Wires to src/lib/sync-engine.ts — forceSyncNow, onNetworkStatusChange,
// startSyncScheduler.
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import {
  forceSyncNow,
  onNetworkStatusChange,
  startSyncScheduler,
} from '@/lib/sync-engine';
import { initDb } from '@/lib/db';
import type { SyncResult } from '@/lib/sync-engine';

export function SyncStatusBar() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  // Listen to network status
  useEffect(() => {
    const unsub = onNetworkStatusChange((online) => {
      setIsOnline(online);
    });
    return unsub;
  }, []);

  // Start auto sync scheduler on mount
  useEffect(() => {
    const cleanup = startSyncScheduler(30_000);
    return cleanup;
  }, []);

  // Load sync metadata
  const refreshMeta = useCallback(async () => {
    try {
      const db = await initDb();
      const lastSync = await db.getSyncMeta('last_sync_at');
      if (lastSync) setLastSyncAt(lastSync);

      const count = await db.getMutationQueueSize();
      setPendingCount(count);
    } catch {
      // Silently ignore
    }
  }, []);

  useEffect(() => {
    refreshMeta();
    const interval = setInterval(refreshMeta, 10_000);
    return () => clearInterval(interval);
  }, [refreshMeta]);

  // Handle manual sync
  const handleSync = useCallback(async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    try {
      const result = await forceSyncNow();
      setLastResult(result);
      setSyncStatus(result.status === 'error' ? 'error' : 'done');
      refreshMeta();
    } catch {
      setSyncStatus('error');
    }
    // Auto-reset display after 3s
    setTimeout(() => setSyncStatus('idle'), 3000);
  }, [syncStatus, refreshMeta]);

  const formattedTime = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const btnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.375rem 0.875rem',
    borderRadius: '9999px',
    border: '1px solid rgba(26,19,9,0.15)',
    backgroundColor: '#FDFBF7',
    color: '#1A1309',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: syncStatus === 'syncing' ? 'default' : 'pointer',
    opacity: syncStatus === 'syncing' ? 0.7 : 1,
    transition: 'background-color 0.15s, border-color 0.15s',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'var(--font-inter), sans-serif' }}>
      {/* Network indicator */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.625rem',
          borderRadius: '9999px',
          backgroundColor: isOnline ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
        }}
        title={isOnline ? 'Online' : 'Offline'}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isOnline ? '#22c55e' : '#ef4444' }} />
        <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isOnline ? '#15803d' : '#b91c1c' }}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Pending counter */}
      {pendingCount > 0 && (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#C45A1B' }}>
          {pendingCount} pending
        </span>
      )}

      {/* Last sync time */}
      {formattedTime && (
        <span style={{ fontSize: '0.75rem', color: '#8A7F72', fontWeight: 500 }}>
          Synced {formattedTime}
        </span>
      )}

      {/* Sync Button */}
      <button
        onClick={handleSync}
        disabled={syncStatus === 'syncing'}
        style={btnStyle}
        onMouseEnter={(e) => {
          if (syncStatus !== 'syncing') {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#f3f0e8';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.25)';
          }
        }}
        onMouseLeave={(e) => {
          if (syncStatus !== 'syncing') {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#FDFBF7';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(26,19,9,0.15)';
          }
        }}
      >
        {syncStatus === 'syncing' ? (
          <>
            <svg style={{ animation: 'spin 1s linear infinite', width: '12px', height: '12px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Syncing...
          </>
        ) : syncStatus === 'error' ? (
          <span style={{ color: '#dc2626' }}>Failed</span>
        ) : (
          'Sync Now'
        )}
      </button>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}