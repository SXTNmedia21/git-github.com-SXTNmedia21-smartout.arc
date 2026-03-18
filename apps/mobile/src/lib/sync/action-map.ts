/**
 * Maps each offline action to its corresponding Supabase call.
 *
 * This is the only file that knows about database tables and schemas.
 * The SyncWorker calls actionMap[action](payload) — it never touches
 * Supabase directly. Adding a new offline-capable action = one new entry here.
 *
 * PKs used: time_entry_id, schedule_shift_id, approval_id, id (session_task).
 * timesheet schema: time_entry lives in the `timesheet` schema, not `public`.
 */
import { supabase } from "@/lib/supabase";

import type { WriteAction } from "./types";

type ActionHandler = (payload: Record<string, unknown>) => Promise<void>;

/**
 * Wraps a Supabase query and throws on error.
 * Supabase client returns { data, error } instead of throwing,
 * so we need to convert errors into exceptions for the SyncWorker.
 */
async function assertOk(
  query: PromiseLike<{ error: { message: string; code?: string } | null }>,
): Promise<void> {
  const { error } = await query;
  if (error) {
    const err = new Error(error.message) as Error & { code?: string };
    err.code = error.code;
    throw err;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any --
 * Offline payloads are serialised as Record<string, unknown> in SQLite.
 * Supabase's generated types expect exact row shapes, but the queue
 * already validates action ↔ payload shape at enqueue time. The `as any`
 * casts here are safe because assertOk() will surface any DB-level
 * constraint violations at sync time. */
export const actionMap: Record<WriteAction, ActionHandler> = {
  punch_in: (p) =>
    assertOk(
      supabase
        .schema("timesheet")
        .from("time_entry")
        .insert(p as any),
    ),

  punch_out: (p) =>
    assertOk(
      supabase
        .schema("timesheet")
        .from("time_entry")
        .update(p as any)
        .eq("time_entry_id", p.time_entry_id as string),
    ),

  haccp_log: (p) => assertOk(supabase.from("haccp_log").insert(p as any)),

  report_deviation: (p) => assertOk(supabase.from("deviation").insert(p as any)),

  send_message: (p) => assertOk(supabase.from("chat_message").insert(p as any)),

  complete_task: (p) =>
    assertOk(
      supabase
        .from("session_task")
        .update(p as any)
        .eq("id", p.id as string),
    ),

  confirm_shift: (p) =>
    assertOk(
      supabase
        .from("schedule_shift")
        .update(p as any)
        .eq("schedule_shift_id", p.schedule_shift_id as string),
    ),

  submit_handoff: (p) => assertOk(supabase.from("session_note").insert(p as any)),

  confirm_hours: (p) =>
    assertOk(
      supabase
        .from("shift_approval")
        .update(p as any)
        .eq("approval_id", p.approval_id as string),
    ),
};
