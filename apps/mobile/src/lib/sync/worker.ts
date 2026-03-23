/**
 * SyncWorker — drains the offline write queue when connectivity is available.
 *
 * Event-driven, not polling: NetInfo state changes and explicit flush() calls
 * trigger processing. Writes are sent FIFO with exponential backoff on failure
 * (2^n seconds, max 60s, up to 5 retries before marking permanently failed).
 *
 * Special HTTP status handling:
 *   409 (conflict) → mark as synced (data already exists on server)
 *   401 (unauthorized) → attempt token refresh, then retry once
 */
import type { NetInfoState } from "@react-native-community/netinfo";
import NetInfo from "@react-native-community/netinfo";

import { supabase } from "@/lib/supabase";

import { actionMap } from "./action-map";
import { dequeueNext, getFailedCount, getPendingCount, markFailed, markSynced } from "./queue";
import { getDb } from "./db";

const MAX_RETRIES = 5;
const MAX_BACKOFF_MS = 60_000;

/** Calculate exponential backoff: 2^retryCount seconds, capped at 60s */
function backoffMs(retryCount: number): number {
  return Math.min(Math.pow(2, retryCount) * 1000, MAX_BACKOFF_MS);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Singleton worker that processes the offline write queue.
 * Call start() once at app boot, stop() on teardown.
 */
export class SyncWorker {
  private unsubscribeNetInfo: (() => void) | null = null;
  private isProcessing = false;
  private isOnline = true;
  private onStatusChange: (() => void) | null = null;

  /**
   * Register a callback fired after each sync cycle completes.
   * Used by the SyncStatus Zustand store to refresh counts.
   */
  setOnStatusChange(cb: () => void): void {
    this.onStatusChange = cb;
  }

  /** Start listening for connectivity changes and begin processing. */
  start(): void {
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      /* When connectivity returns, flush the queue */
      if (wasOffline && this.isOnline) {
        void this.flush();
      }

      this.onStatusChange?.();
    });

    /* Process anything that was queued while the app was closed */
    void this.flush();
  }

  /** Stop listening and cancel any in-flight processing. */
  stop(): void {
    this.unsubscribeNetInfo?.();
    this.unsubscribeNetInfo = null;
  }

  /** Process all pending writes in FIFO order. Safe to call multiple times — re-entrant guard. */
  async flush(): Promise<void> {
    if (this.isProcessing || !this.isOnline) return;

    this.isProcessing = true;

    try {
      let write = await dequeueNext();

      while (write && this.isOnline) {
        const db = await getDb();

        /* Mark as syncing so other flush() calls skip it */
        await db.runAsync(`UPDATE pending_writes SET status = 'syncing' WHERE id = ?`, [write.id]);

        try {
          const payload = JSON.parse(write.payload) as Record<string, unknown>;
          const handler = actionMap[write.action];
          await handler(payload);
          await markSynced(write.id);
        } catch (err: unknown) {
          const isConflict = hasCode(err, "23505") || hasHttpStatus(err, 409);
          const isAuthError = hasHttpStatus(err, 401);

          if (isConflict) {
            /* Data already exists on server — treat as successful */
            await markSynced(write.id);
          } else if (isAuthError) {
            /* Try refreshing the session token once */
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (!refreshError) {
              /* Retry the write after token refresh */
              try {
                const payload = JSON.parse(write.payload) as Record<string, unknown>;
                await actionMap[write.action](payload);
                await markSynced(write.id);
              } catch {
                await markFailed(write.id, MAX_RETRIES);
              }
            } else {
              await markFailed(write.id, MAX_RETRIES);
            }
          } else {
            await markFailed(write.id, MAX_RETRIES);

            /* If the write is going back to pending (not permanently failed), wait before retry */
            if (write.retryCount + 1 < MAX_RETRIES) {
              await delay(backoffMs(write.retryCount));
            }
          }
        }

        this.onStatusChange?.();
        write = await dequeueNext();
      }
    } finally {
      this.isProcessing = false;
      this.onStatusChange?.();
    }
  }

  /** Current pending + failed counts for the status indicator. */
  async getCounts(): Promise<{ pending: number; failed: number }> {
    const [pending, failed] = await Promise.all([getPendingCount(), getFailedCount()]);
    return { pending, failed };
  }

  /** Whether the device currently has connectivity. */
  get online(): boolean {
    return this.isOnline;
  }
}

/** Check if an error has a specific Postgres error code (e.g. 23505 = unique_violation). */
function hasCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === code
  );
}

/** Check if an error carries an HTTP status (Supabase errors include this). */
function hasHttpStatus(err: unknown, status: number): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  return e.status === status || e.statusCode === status;
}

/** Singleton instance — import this in providers and hooks. */
export const syncWorker = new SyncWorker();
