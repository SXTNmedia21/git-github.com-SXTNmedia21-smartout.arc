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
import { emit } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";

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

  // Flip status to a new value on an existing pending absence request.
  // PK column is `schedule_absence_id` (NOT `id`) — silent no-op pre-fix
  // (reviewer-caught regression from the original `as any` era).
  cancel_absence: (p) =>
    assertOk(
      supabase
        .from("schedule_absence")
        .update({ status: p.status })
        .eq("schedule_absence_id", p.schedule_absence_id),
    ),

  // Update the breaks JSONB column on the active time_entry (start of break).
  // ADR-0134: emit "shift break_started" after successful DB write.
  // shift_id is resolved by querying the time_entry row after the update
  // so we have the canonical shift linkage for activity_trail routing.
  break_start: async (p) => {
    await assertOk(
      fromOtherSchema("timesheet", "time_entry")
        .update(p as never)
        .eq("time_entry_id", p.time_entry_id),
    );

    // Emit telemetry AFTER successful write (ADR-0134 — non-empty ids required)
    try {
      const { profileId, workspaceId } = await getProfileContext();
      // Resolve shift_id from time_entry (required by registry type: ShiftBreakStarted)
      const { data: entry } = await (
        fromOtherSchema("timesheet", "time_entry") as unknown as ReturnType<typeof supabase.from>
      )
        .select("shift_id")
        .eq("time_entry_id", p.time_entry_id)
        .maybeSingle();
      const shiftId: string =
        entry && typeof entry === "object" && "shift_id" in entry
          ? String((entry as { shift_id: string }).shift_id)
          : p.time_entry_id; // fallback: use time_entry_id so emit never has empty entity_id

      void emit({
        event: "shift break_started",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity_type: "shift",
          entity_id: shiftId,
          data: { shift_id: shiftId, time_entry_id: p.time_entry_id },
        },
      });
    } catch {
      // Never let telemetry failure block the sync queue
    }
  },

  // Update the breaks JSONB column on the active time_entry (end of break).
  // ADR-0134: emit "shift break_ended" after successful DB write.
  break_end: async (p) => {
    await assertOk(
      fromOtherSchema("timesheet", "time_entry")
        .update(p as never)
        .eq("time_entry_id", p.time_entry_id),
    );

    // Emit telemetry AFTER successful write (ADR-0134 — non-empty ids required)
    try {
      const { profileId, workspaceId } = await getProfileContext();
      // Resolve shift_id + compute break_minutes from updated breaks JSONB
      const { data: entry } = await (
        fromOtherSchema("timesheet", "time_entry") as unknown as ReturnType<typeof supabase.from>
      )
        .select("shift_id, breaks")
        .eq("time_entry_id", p.time_entry_id)
        .maybeSingle();
      const shiftId: string =
        entry && typeof entry === "object" && "shift_id" in entry
          ? String((entry as { shift_id: string }).shift_id)
          : p.time_entry_id;

      // Sum all completed break intervals to compute break_minutes
      type BreakInterval = { start?: string; end?: string };
      const breaks: BreakInterval[] =
        entry &&
        typeof entry === "object" &&
        "breaks" in entry &&
        Array.isArray((entry as { breaks: unknown }).breaks)
          ? (entry as { breaks: BreakInterval[] }).breaks
          : [];
      const breakMinutes = breaks.reduce((sum, b) => {
        if (!b.start || !b.end) return sum;
        const ms = new Date(b.end).getTime() - new Date(b.start).getTime();
        return sum + Math.max(0, Math.round(ms / 60_000));
      }, 0);

      void emit({
        event: "shift break_ended",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity_type: "shift",
          entity_id: shiftId,
          data: {
            shift_id: shiftId,
            time_entry_id: p.time_entry_id,
            break_minutes: breakMinutes,
            is_paid: false, // breaks are unpaid by default; tariff override is C1 concern
          },
        },
      });
    } catch {
      // Never let telemetry failure block the sync queue
    }
  },

  // Insert a manual supplement claim row in the payroll schema
  supplement_claim: (p) =>
    assertOk(fromOtherSchema("payroll", "manual_supplement").insert(p as never)),

  // Insert a shift note row in the public schema
  shift_note_add: (p) => assertOk(supabase.from("shift_note").insert(p as never)),

  // DEPRECATED: create_shift direct insert is replaced by POST /api/mobile/shifts BFF
  // (ADR-0270 R4 — offline shift-create removed; all shift creation via BFF).
  // This stub handles any residual queued entries gracefully — logs and no-ops
  // so they do not block the sync queue forever (M5 strategy: dead-letter handler).
  create_shift: async (_p) => {
    console.warn(
      "[sync] create_shift action is deprecated (ADR-0270). " +
        "Use POST /api/mobile/shifts BFF. This queue entry will be discarded.",
    );
    // Intentional no-op: do not insert to DB (would bypass gate + audit chain).
    // Queue entry advances to 'synced' status without a DB write.
  },

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

  // Merge a single wizard step into daily_reconciliation.wizard_state
  // (M2 polish #2). Mirrors useReconWizard.saveStep so the JSONB ends up
  // identical to the online write. Lazy-inserts the recon row on the
  // first step of a session that has no row yet.
  //
  // We intentionally duplicate the STEP_ORDER indexing rather than
  // importing from the wizard hook — keeping this file dependency-free
  // of UI hooks preserves the clean "only Supabase + schemas" surface.
  save_wizard_step: async (p) => {
    const STEP_INDEX: Record<typeof p.step_id, number> = {
      "00_stempletut": 0,
      "01_oversikt": 1,
      "02_omsetning": 2,
      "03_kontanttelling": 3,
      "04_avvik": 4,
      "05_segjennom": 5,
      "06_sendt": 6,
    };
    const thisIdx = STEP_INDEX[p.step_id];

    type WizardState = {
      last_completed_step: number;
      last_touched_at: string;
      step_data: Record<string, Record<string, unknown>>;
    };

    const { data: existing, error: fetchErr } = await supabase
      .from("daily_reconciliation")
      .select("reconciliation_id, wizard_state")
      .eq("session_id", p.session_id)
      .maybeSingle();
    if (fetchErr) {
      const err = new Error(fetchErr.message) as Error & { code?: string };
      err.code = fetchErr.code;
      throw err;
    }

    const current: WizardState =
      existing && existing.wizard_state && typeof existing.wizard_state === "object"
        ? (existing.wizard_state as unknown as WizardState)
        : {
            last_completed_step: -1,
            last_touched_at: new Date(0).toISOString(),
            step_data: {},
          };

    const nextLastIdx =
      thisIdx > (current.last_completed_step ?? -1) ? thisIdx : (current.last_completed_step ?? -1);

    const nextWizardState: WizardState = {
      last_completed_step: nextLastIdx,
      last_touched_at: p.client_touched_at,
      step_data: {
        ...(current.step_data ?? {}),
        [p.step_id]: p.step_data,
      },
    };

    if (!existing) {
      await assertOk(
        supabase.from("daily_reconciliation").insert({
          workspace_id: p.workspace_id,
          department_id: p.department_id,
          session_id: p.session_id,
          reconciliation_date: p.reconciliation_date,
          status: "open",
          wizard_state: nextWizardState as unknown,
        } as never),
      );
    } else {
      await assertOk(
        supabase
          .from("daily_reconciliation")
          .update({
            wizard_state: nextWizardState as unknown,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("reconciliation_id", existing.reconciliation_id),
      );
    }
  },
};
