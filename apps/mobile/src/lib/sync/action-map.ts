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

  report_deviation: async (p) => {
    // Routed through BFF (ADR-0132 + ADR-0114 closure).
    // BFF resolves actor from Bearer JWT; no workspace_id/profile_id in
    // the body per ADR-0151. gate_action + admin insert + emit happen
    // server-side in reportDeviationAction.
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Not authenticated");
    const response = await fetch("/api/mobile/deviations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(p),
    });
    if (!response.ok) {
      const err = (await response.json().catch(() => ({ error: response.statusText }))) as {
        error?: string;
      };
      throw new Error(err.error ?? `HTTP ${response.status}`);
    }
  },

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

  // Creates a session_task via the web BFF — routes through gate_action +
  // emit() instead of direct insert (ADR-0099, ADR-0134, ADR-0266).
  // Identity (workspace_id, profile_id) is derived server-side from the
  // Bearer JWT; the body carries only task fields (ADR-0151).
  create_task: async (p) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No session — cannot create task via BFF");

    // Extract task-specific fields from the pre-validated payload.
    // workspace_id is intentionally excluded — BFF derives it from JWT.
    const { workspace_id: _omit, ...taskFields } = p as typeof p & {
      workspace_id?: string;
      department_session_id: string;
      title?: string;
      assigned_to?: string | null;
      session_hook_id?: string | null;
      is_compliance_required?: boolean;
      reason?: string;
    };

    const body = {
      sessionId: taskFields.department_session_id,
      title: taskFields.title ?? "",
      ownerProfileId: taskFields.assigned_to ?? null,
      hookId: taskFields.session_hook_id ?? null,
      isComplianceRequired: taskFields.is_compliance_required ?? false,
      reason: taskFields.reason ?? "Opprettet fra mobil",
    };

    const res = await fetch(getMobileTasksUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`create_task BFF ${res.status}: ${text || res.statusText}`);
    }
  },

  // Routed through BFF (ADR-0132 + ADR-0114 closure).
  // BFF resolves actor from Bearer JWT; no workspace_id/createdBy in the
  // body per ADR-0151. gate_action + admin insert + emit happen server-side
  // in createDayInfoAction.
  create_day_info: async (p) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error("Not authenticated");
    const response = await fetch("/api/mobile/day-info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(p),
    });
    if (!response.ok) {
      const err = (await response.json().catch(() => ({ error: response.statusText }))) as {
        error?: string;
      };
      throw new Error(err.error ?? `HTTP ${response.status}`);
    }
  },

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

  // Create a booking via BFF (ADR-0270, ADR-0267).
  // NEVER inserts into schedule_day_booking directly — the BFF re-derives
  // workspace_id + profile_id server-side (ADR-0151) and runs gate_action()
  // (ADR-0099). contact_person is PII (ADR-0267); transit is allowed only on
  // 'system' channel which the BFF enforces; voice is rejected by the action
  // layer (ADR-0078). workspace_id is NOT included in the payload (ADR-0151).
  create_booking: async (p) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No session — cannot create booking");

    const res = await fetch(getBookingCreateUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        shift_date: p.shift_date,
        booking_time: p.booking_time,
        title: p.title,
        guest_count: p.guest_count,
        contact: p.contact,
        notes: p.notes,
        // workspace_id intentionally omitted — derived server-side (ADR-0151).
      }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? `BFF error ${res.status}`);
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
