/**
 * Zod schemas for every offline WriteAction (ADR-0134 / Trust Freeze gate 2).
 *
 * enqueue() validates payloads against these BEFORE writing to SQLite. A
 * malformed payload fails fast at the call site instead of sitting in the
 * queue and exploding at sync time.
 *
 * Each schema validates ONLY the columns the corresponding SQL operation
 * touches — not the full DB row shape. Required keys must be present;
 * unknown keys are stripped (z.strict() would be too brittle for evolving
 * payloads).
 *
 * Supabase-generated types are the ultimate truth; these schemas are the
 * runtime gate, not a re-derivation of every table column. If a schema
 * drifts from the DB, the sync-time error remains the safety net.
 */
import { z } from "zod";

import type { WriteAction } from "./types";

const uuid = z.string().uuid();
const isoTimestamp = z.string().datetime({ offset: true });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const isoTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:MM[:SS]");

// ── timesheet.time_entry ────────────────────────────────────────────────────

const punchInSchema = z.object({
  time_entry_id: uuid,
  shift_id: uuid,
  profile_id: uuid,
  workspace_id: uuid,
  punch_in: isoTimestamp,
  status: z.literal("clocked_in"),
});

const punchOutSchema = z.object({
  time_entry_id: uuid,
  punch_out: isoTimestamp,
  status: z.literal("completed"),
});

const breakBoundarySchema = z
  .object({
    time_entry_id: uuid,
    breaks: z.unknown(), // JSONB column — opaque at queue boundary
  })
  .catchall(z.unknown());

// ── public.haccp_log ────────────────────────────────────────────────────────

const haccpLogSchema = z
  .object({
    workspace_id: uuid,
    profile_id: uuid,
  })
  .catchall(z.unknown());

// ── public.deviation ────────────────────────────────────────────────────────

const reportDeviationSchema = z
  .object({
    workspace_id: uuid,
  })
  .catchall(z.unknown());

// ── public.channel_message ──────────────────────────────────────────────────
// NOTE: column is `sender_id` per database.types.ts. Some legacy callers
// (useShiftChat.ts) pass `conversation_id` instead of `channel_id` — those
// targets the DEPRECATED chat_message system per ADR-0132 and will fail at
// sync. Schema requires only `sender_id` so the legacy callers continue to
// work until the chat_message → channel_message migration completes.

const sendMessageSchema = z
  .object({
    sender_id: uuid,
  })
  .catchall(z.unknown());

// ── public.session_task ─────────────────────────────────────────────────────

const completeTaskSchema = z
  .object({
    id: uuid,
    status: z.string(),
  })
  .catchall(z.unknown());

const completeCheckpointSchema = z.object({
  task_id: uuid,
  status: z.string(),
  completed_by: uuid.nullable(),
  completed_at: isoTimestamp.nullable(),
  evidence: z.unknown().optional(),
});

const signChecklistSchema = z.object({
  task_ids: z.array(uuid).min(1),
  status: z.string(),
  completed_by: uuid,
  completed_at: isoTimestamp,
});

const createTaskSchema = z
  .object({
    workspace_id: uuid,
    department_session_id: uuid,
  })
  .catchall(z.unknown());

// ── public.schedule_shift ───────────────────────────────────────────────────

const confirmShiftSchema = z
  .object({
    schedule_shift_id: uuid,
  })
  .catchall(z.unknown());

/**
 * @deprecated ADR-0270 R4 — create_shift offline action removed.
 * Mobile shift creation now routes through POST /api/mobile/shifts BFF.
 * Schema retained for type-narrowing of any residual queued entries;
 * action-map handler is a no-op stub that dead-letters gracefully.
 */
const createShiftSchema = z
  .object({
    schedule_shift_id: uuid,
    shift_date: isoDate,
    start_time: isoTime,
    end_time: isoTime,
    workspace_id: uuid,
    role: z.string(),
  })
  .catchall(z.unknown());

// ── public.shift_approval ───────────────────────────────────────────────────

const confirmHoursSchema = z
  .object({
    approval_id: uuid,
  })
  .catchall(z.unknown());

// ── public.session_note ─────────────────────────────────────────────────────

const submitHandoffSchema = z
  .object({
    workspace_id: uuid,
  })
  .catchall(z.unknown());

// ── public.schedule_absence ─────────────────────────────────────────────────
// PK is `schedule_absence_id`; employee FK is `employee_id` (not `profile_id`).

const requestAbsenceSchema = z
  .object({
    schedule_absence_id: uuid,
    workspace_id: uuid,
    employee_id: uuid,
    shift_date: isoDate,
    start_date: isoDate,
    end_date: isoDate,
    absence_type: z.string(),
  })
  .catchall(z.unknown());

const cancelAbsenceSchema = z.object({
  schedule_absence_id: uuid,
  // Matches public.absence_status enum
  status: z.enum(["pending", "approved", "rejected"]),
});

// ── payroll.manual_supplement ───────────────────────────────────────────────

const supplementClaimSchema = z
  .object({
    id: uuid,
    workspace_id: uuid,
    added_by: uuid,
    schedule_shift_id: uuid,
  })
  .catchall(z.unknown());

// ── public.shift_note ───────────────────────────────────────────────────────

const shiftNoteAddSchema = z
  .object({
    workspace_id: uuid,
  })
  .catchall(z.unknown());

// ── public.schedule_day_info ────────────────────────────────────────────────
// Column is `date` (not `shift_date`).

const createDayInfoSchema = z
  .object({
    workspace_id: uuid,
    date: isoDate,
  })
  .catchall(z.unknown());

// ── public.daily_reconciliation (wizard_state JSONB merge) ──────────────────
// The wizard persists per-step data into daily_reconciliation.wizard_state.
// Online path runs in useReconWizard.saveStep (load → merge → upsert). The
// offline path enqueues the raw step snapshot — the action handler replays
// the same merge logic at sync time so the JSONB ends up identical to the
// online write. Resolves M2 polish #2 + ADR-0134 offline-durability gap.
//
// The handler needs session_id (to resolve the reconciliation row) plus
// the wizard step + its full client-captured data. It also needs the
// workspace/department ids for the lazy-insert case (first step of a
// session that has no recon row yet).

const saveWizardStepSchema = z.object({
  session_id: uuid,
  workspace_id: uuid,
  department_id: uuid,
  // Matches the WizardStepId union in use-recon-wizard.ts. Duplicated
  // here because types.ts does not import the wizard hook to avoid
  // bundler cycles; drift is caught by the wizard call-site passing
  // the typed id.
  step_id: z.enum([
    "00_stempletut",
    "01_oversikt",
    "02_omsetning",
    "03_kontanttelling",
    "04_avvik",
    "05_segjennom",
    "06_sendt",
  ]),
  step_data: z.record(z.unknown()),
  // ISO-date (YYYY-MM-DD) for the lazy-insert reconciliation_date column.
  reconciliation_date: isoDate,
  // Client-captured merge timestamp — server uses this as last_touched_at
  // so resumability thresholds reflect the user's action time, not the
  // sync-drain time.
  client_touched_at: isoTimestamp,
});

// ── Schema registry ─────────────────────────────────────────────────────────

export const writeActionSchemas = {
  punch_in: punchInSchema,
  punch_out: punchOutSchema,
  haccp_log: haccpLogSchema,
  report_deviation: reportDeviationSchema,
  send_message: sendMessageSchema,
  complete_task: completeTaskSchema,
  confirm_shift: confirmShiftSchema,
  submit_handoff: submitHandoffSchema,
  confirm_hours: confirmHoursSchema,
  request_absence: requestAbsenceSchema,
  cancel_absence: cancelAbsenceSchema,
  break_start: breakBoundarySchema,
  break_end: breakBoundarySchema,
  supplement_claim: supplementClaimSchema,
  shift_note_add: shiftNoteAddSchema,
  create_shift: createShiftSchema,
  create_task: createTaskSchema,
  create_day_info: createDayInfoSchema,
  complete_checkpoint: completeCheckpointSchema,
  sign_checklist: signChecklistSchema,
  save_wizard_step: saveWizardStepSchema,
} as const satisfies Record<WriteAction, z.ZodTypeAny>;

/** Inferred payload type per WriteAction. */
export type WriteActionPayload<A extends WriteAction> = z.infer<(typeof writeActionSchemas)[A]>;

/**
 * Validates a payload against its action's schema.
 * Throws ZodError on mismatch — caller (enqueue) surfaces a meaningful error
 * instead of letting a malformed payload sit in SQLite until sync time.
 */
export function validatePayload<A extends WriteAction>(
  action: A,
  payload: unknown,
): WriteActionPayload<A> {
  const schema = writeActionSchemas[action];
  return schema.parse(payload) as WriteActionPayload<A>;
}
