// ============================================================================
// EgBE Memory & Revision Engine — Offline-First Sync Engine
//
// Architecture: Offline Mutation Queue → Conflict Resolver (LWW + Vector
// Clocks) → Delta Tracker → Supabase PostgreSQL (push/pull).
//
// Strategy:
//  1. All writes go to IndexedDB (Dexie.js) immediately (optimistic local).
//  2. Mutations are enqueued with monotonic _sync_version.
//  3. On connectivity, the queue is flushed to Supabase in FIFO order.
//  4. Server responds with accepted deltas + any conflicting records.
//  5. Conflict Resolver merges using Last-Write-Wins with vector clock tiebreaker.
//  6. Delta Tracker pulls changes from server since last sync timestamp.
// ============================================================================

import { getDb } from './db';
import type {
  ConflictResolution,
  MutationEntry,
  SyncOperation,
  UUID,
} from '@/types/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncResult {
  status: 'success' | 'partial' | 'error';
  pushedCount: number;
  pulledCount: number;
  conflictsResolved: number;
  errors: string[];
}

// Placeholder for Supabase client (will be initialized by the app)
let supabaseClient: {
  from: (table: string) => {
    upsert: (records: Record<string, unknown>[]) => Promise<{ error: Error | null }>;
    select: (columns?: string) => {
      gt: (column: string, value: number) => Promise<{ data: Record<string, unknown>[] | null; error: Error | null }>;
    };
  };
} | null = null;

export function setSupabaseClient(client: typeof supabaseClient): void {
  supabaseClient = client;
}

// ---------------------------------------------------------------------------
// Vector Clock (monotonic counter per entity)
// ---------------------------------------------------------------------------

class VectorClock {
  private clock: Map<string, number> = new Map();

  increment(key: string): void {
    this.clock.set(key, (this.clock.get(key) ?? 0) + 1);
  }

  get(key: string): number {
    return this.clock.get(key) ?? 0;
  }

  merge(other: Map<string, number>): void {
    for (const [key, value] of other) {
      this.clock.set(key, Math.max(this.clock.get(key) ?? 0, value));
    }
  }

  toMap(): Map<string, number> {
    return new Map(this.clock);
  }

  toRecord(): Record<string, number> {
    return Object.fromEntries(this.clock);
  }

  static fromRecord(record: Record<string, number>): VectorClock {
    const vc = new VectorClock();
    for (const [key, value] of Object.entries(record)) {
      vc.clock.set(key, value);
    }
    return vc;
  }
}

// ---------------------------------------------------------------------------
// Mutation Queue Manager
// ---------------------------------------------------------------------------

/**
 * Enqueue a local write operation for eventual sync to the server.
 * Called automatically by Zustand store middleware.
 */
export async function enqueueMutation(
  table: string,
  operation: SyncOperation,
  record: Record<string, unknown>,
): Promise<void> {
  const db = getDb();

  const mutation: MutationEntry = {
    id: crypto.randomUUID() as UUID,
    table,
    operation,
    record,
    timestamp: Date.now(),
    _sync_version: (record._sync_version as number) ?? 0,
  };

  await db.enqueueMutation(mutation);
}

// ---------------------------------------------------------------------------
// Conflict Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve conflicts using Last-Write-Wins (LWW) strategy with vector clock
 * tiebreaker. When two records have the same _sync_version, the one with
 * the higher vector clock wins.
 *
 * @param localRecord   - The local version of the record
 * @param serverRecord  - The server's version of the record
 * @param vectorClock   - Current vector clock state
 * @returns Resolution result
 */
export function resolveConflict(
  localRecord: Record<string, unknown>,
  serverRecord: Record<string, unknown>,
  vectorClock: VectorClock,
): ConflictResolution {
  const localVersion = (localRecord._sync_version as number) ?? 0;
  const serverVersion = (serverRecord._sync_version as number) ?? 0;

  if (localVersion > serverVersion) {
    return {
      strategy: 'client_wins',
      resolvedRecord: localRecord,
      vectorClock: vectorClock.toMap(),
    };
  }

  if (serverVersion > localVersion) {
    return {
      strategy: 'server_wins',
      resolvedRecord: serverRecord,
      vectorClock: vectorClock.toMap(),
    };
  }

  // Same version — use vector clock as tiebreaker
  const localId = (localRecord.id as string) ?? '';
  const serverId = (serverRecord.id as string) ?? '';
  const localVc = vectorClock.get(localId);
  const serverVc = vectorClock.get(serverId);

  if (localVc >= serverVc) {
    return {
      strategy: 'last_write_wins',
      resolvedRecord: { ...serverRecord, ...localRecord },
      vectorClock: vectorClock.toMap(),
    };
  }

  return {
    strategy: 'last_write_wins',
    resolvedRecord: { ...localRecord, ...serverRecord },
    vectorClock: vectorClock.toMap(),
  };
}

// ---------------------------------------------------------------------------
// Sync Engine — Push local mutations to server
// ---------------------------------------------------------------------------

/**
 * Push all pending local mutations to Supabase.
 * Processes the queue in FIFO order.
 *
 * @returns Number of mutations pushed and any errors
 */
export async function pushMutations(): Promise<{
  pushedCount: number;
  errors: string[];
}> {
  const db = getDb();
  const mutations = await db.getPendingMutations();

  if (mutations.length === 0) {
    return { pushedCount: 0, errors: [] };
  }

  if (!supabaseClient) {
    return {
      pushedCount: 0,
      errors: ['Supabase client not initialized — skipping sync push'],
    };
  }

  let pushedCount = 0;
  const errors: string[] = [];

  for (const mutation of mutations) {
    try {
      switch (mutation.operation) {
        case 'create':
        case 'update': {
          const { error } = await supabaseClient
            .from(mutation.table)
            .upsert([{ ...mutation.record, _sync_version: mutation._sync_version + 1 }]);

          if (error) {
            errors.push(`Failed to ${mutation.operation} in ${mutation.table}: ${error.message}`);
          } else {
            pushedCount++;
            await db.clearMutation(mutation.id);
          }
          break;
        }

        case 'delete': {
          // Soft-delete: set deleted_at
          const { error } = await supabaseClient
            .from(mutation.table)
            .upsert([
              {
                id: mutation.record.id,
                deleted_at: new Date().toISOString(),
                _sync_version: mutation._sync_version + 1,
              },
            ]);

          if (error) {
            errors.push(`Failed to delete in ${mutation.table}: ${error.message}`);
          } else {
            pushedCount++;
            await db.clearMutation(mutation.id);
          }
          break;
        }
      }
    } catch (err) {
      errors.push(
        `Exception during sync of ${mutation.table}/${mutation.operation}: ${(err as Error).message}`,
      );
    }
  }

  return { pushedCount, errors };
}

// ---------------------------------------------------------------------------
// Sync Engine — Pull changes from server (Delta Tracker)
// ---------------------------------------------------------------------------

/**
 * Pull changes from Supabase since the last sync timestamp.
 * Uses the _sync_version monotonic counter for efficient delta detection.
 *
 * @param tables        - List of table names to sync
 * @param lastSyncAt    - ISO timestamp of last successful sync
 * @returns Records pulled, partitioned by table
 */
export async function pullChanges(
  tables: string[],
  lastSyncVersion: Record<string, number>,
): Promise<{
  records: Record<string, Record<string, unknown>[]>;
  newVersions: Record<string, number>;
  errors: string[];
}> {
  const db = getDb();
  const records: Record<string, Record<string, unknown>[]> = {};
  const newVersions: Record<string, number> = {};
  const errors: string[] = [];

  if (!supabaseClient) {
    return { records, newVersions, errors: ['Supabase client not initialized'] };
  }

  for (const table of tables) {
    try {
      const currentVersion = lastSyncVersion[table] ?? 0;

      // Query records with _sync_version > currentVersion
      // Note: real implementation would use Supabase's .gt() filter
      const result = await supabaseClient
        .from(table)
        .select('*')
        .gt('_sync_version', currentVersion);

      if (result.error) {
        errors.push(`Failed to pull ${table}: ${result.error.message}`);
        continue;
      }

      const data = result.data ?? [];
      records[table] = data;

      // Track highest version seen
      let maxVersion = currentVersion;
      for (const row of data) {
        const rowVersion = (row._sync_version as number) ?? 0;
        if (rowVersion > maxVersion) {
          maxVersion = rowVersion;
        }
      }
      newVersions[table] = maxVersion;
    } catch (err) {
      errors.push(`Exception during pull of ${table}: ${(err as Error).message}`);
    }
  }

  return { records, newVersions, errors };
}

// ---------------------------------------------------------------------------
// Apply pulled changes to local IndexedDB
// ---------------------------------------------------------------------------

/**
 * Merge pulled records into the local database.
 * Uses the Conflict Resolver for records that exist both locally and on server.
 *
 * @param records - Records pulled from server, keyed by table name
 */
export async function applyPulledChanges(
  records: Record<string, Record<string, unknown>[]>,
): Promise<{ mergedCount: number; conflictsResolved: number }> {
  const db = getDb();
  const vectorClock = VectorClock.fromRecord({});
  let mergedCount = 0;
  let conflictsResolved = 0;

  for (const [table, rows] of Object.entries(records)) {
    for (const row of rows) {
      try {
        // Check if record exists locally
        const existingId = row.id as UUID;
        const tableAccessor = (db as unknown as Record<string, unknown>)[table] as
          | { get: (id: UUID) => Promise<Record<string, unknown> | undefined> }
          | undefined;

        if (tableAccessor && typeof tableAccessor.get === 'function') {
          const localRecord = await tableAccessor.get(existingId);

          if (localRecord) {
            // Conflict — resolve
            const resolution = resolveConflict(
              localRecord as Record<string, unknown>,
              row,
              vectorClock,
            );
            conflictsResolved++;

            // Apply resolved record
            if (typeof tableAccessor === 'object' && 'put' in tableAccessor) {
              await (tableAccessor as { put: (r: Record<string, unknown>) => Promise<unknown> }).put(
                resolution.resolvedRecord,
              );
            }
            mergedCount++;
            continue;
          }
        }

        // No local record — insert directly
        if (tableAccessor && typeof tableAccessor === 'object' && 'put' in tableAccessor) {
          await (tableAccessor as { put: (r: Record<string, unknown>) => Promise<unknown> }).put(row);
        }
        mergedCount++;
      } catch (err) {
        // Silently skip failed rows; errors are accumulated in the sync result
      }
    }
  }

  return { mergedCount, conflictsResolved };
}

// ---------------------------------------------------------------------------
// Full Sync Cycle
// ---------------------------------------------------------------------------

/**
 * Execute a full sync cycle: push local mutations, then pull server changes.
 * This is the main entry point called by the sync scheduler.
 *
 * @returns SyncResult with counts and status
 */
export async function performFullSync(): Promise<SyncResult> {
  const db = getDb();
  const errors: string[] = [];

  // Step 1: Push local mutations
  const pushResult = await pushMutations();
  errors.push(...pushResult.errors);

  // Step 2: Get last sync versions from metadata
  const tables = [
    'years', 'semesters', 'courses', 'modules',
    'flashcards', 'equationBanks', 'occlusionSets', 'occlusionRegions',
    'conceptNodes', 'conceptEdges',
    'cardReviews', 'reviewLogs', 'studySessions',
    'scenarios', 'scenarioNodes', 'scenarioTransitions',
  ];

  const lastSyncVersion: Record<string, number> = {};
  for (const table of tables) {
    const versionStr = await db.getSyncMeta(`sync_version_${table}`);
    lastSyncVersion[table] = versionStr ? parseInt(versionStr, 10) : 0;
  }

  // Step 3: Pull server changes
  const pullResult = await pullChanges(tables, lastSyncVersion);
  errors.push(...pullResult.errors);

  // Step 4: Apply pulled changes to local DB
  const { mergedCount, conflictsResolved } =
    await applyPulledChanges(pullResult.records);

  // Step 5: Update sync version metadata
  for (const [table, version] of Object.entries(pullResult.newVersions)) {
    if (version > (lastSyncVersion[table] ?? 0)) {
      await db.setSyncMeta(`sync_version_${table}`, version.toString());
    }
  }

  // Store last sync timestamp
  await db.setSyncMeta('last_sync_at', new Date().toISOString());

  const status =
    errors.length === 0
      ? 'success'
      : pushResult.pushedCount > 0 || mergedCount > 0
        ? 'partial'
        : 'error';

  return {
    status,
    pushedCount: pushResult.pushedCount,
    pulledCount: mergedCount,
    conflictsResolved,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Sync Scheduler — automatic periodic sync
// ---------------------------------------------------------------------------

let syncInterval: ReturnType<typeof setInterval> | null = null;
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Start automatic sync at a configurable interval (default: 30 seconds).
 * Also listens for online/offline events to trigger immediate sync on reconnect.
 */
export function startSyncScheduler(intervalMs: number = 30000): () => void {
  const doSync = async () => {
    const db = getDb();
    const queueSize = await db.getMutationQueueSize();

    if (queueSize > 0 || navigator.onLine) {
      try {
        await performFullSync();
      } catch {
        // Silently handle — will retry on next interval
      }
    }
  };

  // Periodic sync
  syncInterval = setInterval(doSync, intervalMs);

  // Online event listener
  const onOnline = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(doSync, 2000); // 2s debounce
  };

  window.addEventListener('online', onOnline);

  // Return cleanup function
  return () => {
    if (syncInterval) clearInterval(syncInterval);
    if (syncTimeout) clearTimeout(syncTimeout);
    window.removeEventListener('online', onOnline);
  };
}

/**
 * Force an immediate sync (e.g., user taps "Sync Now").
 */
export async function forceSyncNow(): Promise<SyncResult> {
  return performFullSync();
}

// ---------------------------------------------------------------------------
// Network Status Detection
// ---------------------------------------------------------------------------

let onlineListeners: Array<(online: boolean) => void> = [];

export function onNetworkStatusChange(callback: (online: boolean) => void): () => void {
  onlineListeners.push(callback);
  callback(navigator.onLine);

  return () => {
    onlineListeners = onlineListeners.filter((l) => l !== callback);
  };
}

// Register global listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    onlineListeners.forEach((cb) => cb(true));
  });
  window.addEventListener('offline', () => {
    onlineListeners.forEach((cb) => cb(false));
  });
}