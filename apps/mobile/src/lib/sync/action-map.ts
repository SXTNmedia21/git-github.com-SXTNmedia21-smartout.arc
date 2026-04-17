/**
 * Maps each offline action to its corresponding Supabase call.
 *
 * This is the only file that knows about database tables and schemas.
 * The SyncWorker calls actionMap[action](payload) — it never touches
 * Supabase directly. Adding a new offline-capable action = one new entry
 * here AND a new Zod schema in ./schemas.ts.
 *
 * Payloads are pre-validated by enqueue() against the schemas in
 * ./schemas.ts (ADR-0134 / Trust Freeze gate 2). Handlers receive
 * validated, well-shaped payloads — no defensive casting needed for
 * payload contents.
 *
 * The only remaining `as never` casts are for cross-schema access
 * (timesheet, payroll) — Supabase's generated types don't expose those
 * schemas through the typed client, so we narrow rather than widen.
 *
 * PKs used: time_entry_id, schedule_shift_id, approval_id, id (session_task),
 *           id (schedule_absence — absence request uses `id` as PK).
 * timesheet schema: time_entry lives in the `timesheet` schema, not `public`.
 * schedule_absence lives in the `public` schema.
 */
import { supabase } from "@/lib/supabase";

import type { WriteAction } from "./types";
import type { WriteActionPayload } from "./schemas";

type ActionHandler<A extends WriteAction> = (payload: WriteActionPayload<A>) => Promise<void>;

type ActionMap = { [A in WriteAction]: ActionHandler<A> };

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

/**
 * Bridges to a non-public Supabase schema (timesheet, payroll) since the
 * generated types only model the `public` schema. The cast is contained
 * to this single helper so action handlers stay typed.
 */
function fromOtherSchema(schemaName: "timesheet" | "payroll", table: string) {
  return (
    supabase as unknown as {
      schema: (s: string) => { from: (t: string) => ReturnType<typeof supabase.from> };
    }
  )
    .schema(schemaName)
    .from(table);
}

export const actionMap: ActionMap = {
  punch_in: (p) => assertOk(fromOtherSchema("timesheet", "time_entry").insert(p as never)),

  punch_out: (p) =>
    assertOk(
      fromOtherSchema("timesheet", "time_entry")
        .update(p as never)
        .eq("time_entry_id", p.time_entry_id),
    ),

  haccp_log: (p) => assertOk(supabase.from("haccp_log").insert(p as never)),

  report_deviation: (p) => assertOk(supabase.from("deviation").insert(p as never)),

  send_message: (p) => assertOk(supabase.from("channel_message").insert(p as never)),

  complete_task: (p) =>
    assertOk(
      supabase
        .from("session_task")
        .update(p as never)
        .eq("id", p.id),
    ),

  confirm_shift: (p) =>
    assertOk(
      supabase
        .from("schedule_shift")
        .update(p as never)
        .eq("schedule_shift_id", p.schedule_shift_id),
    ),

  submit_handoff: (p) => assertOk(supabase.from("session_note").insert(p as never)),

  confirm_hours: (p) =>
    assertOk(
      supabase
        .from("shift_approval")
        .update(p as never)
        .eq("approval_id", p.approval_id),
    ),

  // Insert a new absence request row — `id` is the client-generated UUID PK
  request_absence: (p) => assertOk(supabase.from("schedule_absence").insert(p as never)),

  // Flip status to a new value on an existing pending absence request
  cancel_absence: (p) =>
    assertOk(
      supabase
        .from("schedule_absence")
        .update({ status: p.status })
        .eq("id", p.schedule_absence_id),
    ),

  // Update the breaks JSONB column on the active time_entry (start of break)
  break_start: (p) =>
    assertOk(
      fromOtherSchema("timesheet", "time_entry")
        .update(p as never)
        .eq("time_entry_id", p.time_entry_id),
    ),

  // Update the breaks JSONB column on the active time_entry (end of break)
  break_end: (p) =>
    assertOk(
      fromOtherSchema("timesheet", "time_entry")
        .update(p as never)
        .eq("time_entry_id", p.time_entry_id),
    ),

  // Insert a manual supplement claim row in the payroll schema
  supplement_claim: (p) =>
    assertOk(fromOtherSchema("payroll", "manual_supplement").insert(p as never)),

  // Insert a shift note row in the public schema
  shift_note_add: (p) => assertOk(supabase.from("shift_note").insert(p as never)),

  // Insert a new schedule_shift row (manager creates a shift)
  create_shift: (p) => assertOk(supabase.from("schedule_shift").insert(p as never)),

  // Insert a new session_task row (manager creates a task for today's session)
  create_task: (p) => assertOk(supabase.from("session_task").insert(p as never)),

  // Insert a new schedule_day_info row (quick note/event/alert for a date)
  create_day_info: (p) => assertOk(supabase.from("schedule_day_info").insert(p as never)),

  // Mark a single checklist checkpoint as completed (cleaning checklists)
  complete_checkpoint: (p) =>
    assertOk(
      supabase
        .from("session_task")
        .update({
          status: p.status,
          completed_by: p.completed_by,
          completed_at: p.completed_at,
          evidence: p.evidence ?? null,
        } as never)
        .eq("id", p.task_id),
    ),

  // Batch-complete all remaining checklist tasks (sign-off)
  sign_checklist: async (p) => {
    for (const taskId of p.task_ids) {
      await assertOk(
        supabase
          .from("session_task")
          .update({
            status: p.status,
            completed_by: p.completed_by,
            completed_at: p.completed_at,
          } as never)
          .eq("id", taskId)
          .eq("status", "pending"),
      );
    }
  },
};
