/**
 * Types for the offline write queue.
 *
 * PendingWrite represents a single queued mutation waiting to sync to Supabase.
 * Actions are the 9 operations that can be performed offline (spec 6.3).
 * WriteStatus tracks the lifecycle of each queued write.
 */

/** All offline-capable actions. Each maps to a specific Supabase call in action-map.ts. */
export type WriteAction =
  | "punch_in"
  | "punch_out"
  | "haccp_log"
  | "report_deviation"
  | "send_message"
  | "complete_task"
  | "confirm_shift"
  | "submit_handoff"
  | "confirm_hours"
  | "request_absence"
  | "cancel_absence"
  | "break_start"
  | "break_end"
  | "supplement_claim"
  | "shift_note_add"
  | "create_shift"
  | "create_task"
  | "create_day_info";

/** Lifecycle states for a pending write in the SQLite queue. */
export type WriteStatus = "pending" | "syncing" | "synced" | "failed";

/** A single row in the pending_writes SQLite table. */
export type PendingWrite = {
  /** SQLite auto-increment primary key */
  id: number;
  /** Which Supabase operation to perform */
  action: WriteAction;
  /** JSON-serialized payload for the Supabase call */
  payload: string;
  /** Client-generated UUID identifying the remote row */
  rowId: string;
  /** Current sync lifecycle state */
  status: WriteStatus;
  /** Number of failed sync attempts */
  retryCount: number;
  /** ISO timestamp when the write was enqueued */
  createdAt: string;
  /** ISO timestamp when the write was successfully synced (null if not yet synced) */
  syncedAt: string | null;
};
