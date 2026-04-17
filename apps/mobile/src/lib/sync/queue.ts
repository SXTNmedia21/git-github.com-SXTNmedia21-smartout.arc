/**
 * Write queue operations for the offline sync system.
 *
 * All offline-capable mutations go through this queue:
 *   enqueue() → SyncWorker picks up → dequeueNext() → Supabase call → markSynced()
 *
 * Writes are processed FIFO. Failed writes are retried with exponential backoff
 * by the SyncWorker up to a configurable limit, after which they are marked failed.
 *
 * On web (where expo-sqlite is unavailable), enqueue() executes the action
 * immediately via the actionMap — no offline queue, direct Supabase call.
 */
import { Platform } from "react-native";
import { randomUUID } from "expo-crypto";

import type { PendingWrite, WriteAction } from "./types";
import { actionMap } from "./action-map";
import { validatePayload, type WriteActionPayload } from "./schemas";

/**
 * Lazily loads the SQLite database. Returns null on web where expo-sqlite
 * is not available.
 */
async function tryGetDb() {
  if (Platform.OS === "web") return null;
  try {
    const { getDb } = await import("./db");
    return await getDb();
  } catch {
    return null;
  }
}

/**
 * Adds a new write to the queue. Returns the client-generated row UUID.
 *
 * Payload is validated against the action's Zod schema BEFORE write
 * (ADR-0134 / Trust Freeze gate 2). A malformed payload throws ZodError
 * at the call site instead of sitting in SQLite until sync time.
 *
 * Surface accepts `Record<string, unknown>` so callers can pass full
 * row payloads (including columns the schema doesn't enumerate); the
 * schema gate enforces required-key presence + type at runtime, then
 * passes through unknown extras to the handler.
 */
export async function enqueue(
  action: WriteAction,
  payload: Record<string, unknown>,
): Promise<string> {
  // Throws ZodError if payload doesn't match the schema for this action.
  const validated = validatePayload(action, payload) as WriteActionPayload<typeof action>;

  const rowId = randomUUID();
  const db = await tryGetDb();

  if (!db) {
    // Web fallback: execute directly via Supabase (no offline queue)
    const handler = actionMap[action] as (p: typeof validated) => Promise<void>;
    await handler(validated);
    return rowId;
  }

  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO pending_writes (action, payload, row_id, status, retry_count, created_at)
     VALUES (?, ?, ?, 'pending', 0, ?)`,
    [action, JSON.stringify(validated), rowId, now],
  );

  return rowId;
}

/** Returns the oldest pending write (FIFO), or null if the queue is empty. */
export async function dequeueNext(): Promise<PendingWrite | null> {
  const db = await tryGetDb();
  if (!db) return null;

  const row = await db.getFirstAsync<{
    id: number;
    action: string;
    payload: string;
    row_id: string;
    status: string;
    retry_count: number;
    created_at: string;
    synced_at: string | null;
  }>(
    `SELECT id, action, payload, row_id, status, retry_count, created_at, synced_at
     FROM pending_writes
     WHERE status = 'pending'
     ORDER BY id ASC
     LIMIT 1`,
  );

  if (!row) return null;

  return {
    id: row.id,
    action: row.action as PendingWrite["action"],
    payload: row.payload,
    rowId: row.row_id,
    status: row.status as PendingWrite["status"],
    retryCount: row.retry_count,
    createdAt: row.created_at,
    syncedAt: row.synced_at,
  };
}

/** Marks a write as successfully synced with a timestamp. */
export async function markSynced(id: number): Promise<void> {
  const db = await tryGetDb();
  if (!db) return;
  const now = new Date().toISOString();

  await db.runAsync(`UPDATE pending_writes SET status = 'synced', synced_at = ? WHERE id = ?`, [
    now,
    id,
  ]);
}

/** Increments the retry count and marks the write as failed (status = 'failed') or back to pending. */
export async function markFailed(id: number, retryLimit: number = 5): Promise<void> {
  const db = await tryGetDb();
  if (!db) return;

  const row = await db.getFirstAsync<{ retry_count: number }>(
    `SELECT retry_count FROM pending_writes WHERE id = ?`,
    [id],
  );

  if (!row) return;

  const newCount = row.retry_count + 1;
  const newStatus = newCount >= retryLimit ? "failed" : "pending";

  await db.runAsync(`UPDATE pending_writes SET status = ?, retry_count = ? WHERE id = ?`, [
    newStatus,
    newCount,
    id,
  ]);
}

/** Resets all failed writes back to pending for a fresh retry cycle. */
export async function retryFailed(): Promise<void> {
  const db = await tryGetDb();
  if (!db) return;

  await db.runAsync(
    `UPDATE pending_writes SET status = 'pending', retry_count = 0 WHERE status = 'failed'`,
  );
}

/** Returns the number of writes that are pending or currently syncing. */
export async function getPendingCount(): Promise<number> {
  const db = await tryGetDb();
  if (!db) return 0;

  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_writes WHERE status IN ('pending', 'syncing')`,
  );

  return row?.count ?? 0;
}

/** Returns the number of writes that have permanently failed. */
export async function getFailedCount(): Promise<number> {
  const db = await tryGetDb();
  if (!db) return 0;

  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_writes WHERE status = 'failed'`,
  );

  return row?.count ?? 0;
}
