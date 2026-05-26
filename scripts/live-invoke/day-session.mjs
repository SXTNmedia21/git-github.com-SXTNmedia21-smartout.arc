// scripts/live-invoke/day-session.mjs
// Live-invoke smoke for the day-session domain (ADR-0367 tri-layer D6 model).
//
// What this catches (L-0348 family — promoted systemic rule 2026-05-25):
//   - Column drift on department_session (21 cols), day_line (15 cols),
//     deviation (25 cols), daily_reconciliation (27 cols), session_hook (12 cols),
//     session_note (11 cols)
//   - RPC signature drift on fn_resolve_single_day_line (existence + arg shape)
//   - operations/tools.ts "id" vs "schedule_shift_id" column assumption on
//     schedule_shift (count query uses wrong column — caught here as a note)
//   - PGRST201/202 ambiguous embed — explicit column lists from database.types.ts Row
//     shapes ONLY (not migration SQL, per L-0348 hard rule)
//
// Design choices:
//   - All column lists are derived from packages/supabase/src/database.types.ts Row
//     keys verified 2026-05-26. Never from migration SQL.
//   - service role → auth.uid() = null → RLS filters to empty on most tables.
//     Empty result is FINE: signature + column names are proven regardless.
//   - assertShape() on empty arrays logs "signature OK" and passes — that's the
//     intended behavior for the L-0348 class.
//
// Tables covered (5 of 7 candidates — session_task covered by task.mjs, shift_session
// covered by scheduling.mjs; waste_log + settlement_image are C1/evidence-capture
// tables deferred to separate domain smoke):
//   1. department_session  — D6 Production top layer (ADR-0367)
//   2. day_line            — D6 Production middle layer (ADR-0367)
//   3. deviation           — D6 Production cross-layer event
//   4. daily_reconciliation — C1 Calibration reconciliation
//   5. session_hook        — D6 hook configuration (template-driven triggers)
//   6. session_note        — D6 handoff notes
//
// RPCs covered:
//   - fn_resolve_single_day_line  — existence check (nil UUID → DB error, not 42883)
//
// Capabilities whose DB calls are verified here:
//   - day-line (packages/ai/src/capabilities/day-line/tools.ts)
//   - operations (packages/ai/src/capabilities/operations/tools.ts)
//   - operations-intelligence/monitor (monitor-tools.ts)
//   - timeline-template (uses department_session + session_hook + session_note)
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/day-session.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("day-session");

// ── 1. department_session — D6 Production top layer (ADR-0367) ───────────────
// 21 cols from database.types.ts Row. department_session_id is PK (NOT id).
// Key fields: session_date (NOT business_date — that lives on day_line), status
// ENUM, tasks_total + tasks_completed for progress tracking.
// operations/tools.ts reads: department_session_id, status, session_date,
// opened_at, closed_at, tasks_total, tasks_completed.
const deptSessions = await sb
  .from("department_session")
  .select(
    "department_session_id, workspace_id, department_id, session_date, status, " +
    "opened_at, opened_by, closed_at, closed_by, planned_open, planned_close, " +
    "duty_leader_id, planned_shifts, actual_shifts, tasks_total, tasks_completed, " +
    "handoff_notes, signoff_notes, season_id, created_at, updated_at",
  )
  .limit(1);
assertOk("select department_session (21 cols)", deptSessions);
assertShape("department_session column shape", deptSessions.data, [
  "department_session_id",
  "workspace_id",
  "department_id",
  "session_date",
  "status",
  "tasks_total",
  "tasks_completed",
  "planned_open",
  "planned_close",
  "created_at",
  "updated_at",
]);

// ── 2. day_line — D6 Production middle layer (ADR-0367) ──────────────────────
// 15 cols from database.types.ts Row. day_line_id is PK (NOT id).
// business_date is the operational date (distinct from department_session.session_date
// in multi-day sessions). location_id is required (NOT NULL).
// day-line/tools.ts reads: day_line_id, workspace_id, department_session_id,
// location_id, business_date, planned_open, planned_close.
const dayLines = await sb
  .from("day_line")
  .select(
    "day_line_id, workspace_id, department_id, department_session_id, " +
    "location_id, business_date, planned_open, planned_close, " +
    "notes, source_template_id, is_backfilled, cancelled_at, " +
    "created_by, created_at, updated_at",
  )
  .limit(1);
assertOk("select day_line (15 cols, ADR-0367 tri-layer middle)", dayLines);
assertShape("day_line column shape", dayLines.data, [
  "day_line_id",
  "workspace_id",
  "department_id",
  "department_session_id",
  "location_id",
  "business_date",
  "planned_open",
  "planned_close",
  "is_backfilled",
  "created_at",
  "updated_at",
]);

// ── 3. deviation — D6 cross-layer event ──────────────────────────────────────
// 25 cols from database.types.ts Row. deviation_id is PK (NOT id).
// CRITICAL: deviation has BOTH session_id (FK → department_session) AND
// day_line_id (nullable FK → day_line, added in ADR-0367). Code in
// operations/tools.ts inserts WITHOUT day_line_id — that's fine, it's nullable.
// domain ENUM and severity ENUM are required on insert.
const deviations = await sb
  .from("deviation")
  .select(
    "deviation_id, workspace_id, department_id, domain, severity, status, " +
    "title, description, session_id, day_line_id, linked_shift_id, " +
    "procedure_id, protocol_id, reconciliation_id, source_task_id, " +
    "reported_by, requires_action, blocks_day_approval, payroll_impact, " +
    "cost_impact, resolution_notes, resolved_at, resolved_by, " +
    "attachments, subcategory, created_at, updated_at",
  )
  .limit(1);
assertOk("select deviation (25 cols, cross-layer)", deviations);
assertShape("deviation column shape", deviations.data, [
  "deviation_id",
  "workspace_id",
  "department_id",
  "domain",
  "severity",
  "status",
  "title",
  "session_id",
  "day_line_id",
  "requires_action",
  "blocks_day_approval",
  "payroll_impact",
  "created_at",
  "updated_at",
]);

// ── 4. daily_reconciliation — C1 Calibration ─────────────────────────────────
// 27 cols from database.types.ts Row. reconciliation_id is PK (NOT id).
// session_id FK → department_session (nullable). status ENUM.
// wizard_state: Json (non-null, defaults to {}).
const reconciliations = await sb
  .from("daily_reconciliation")
  .select(
    "reconciliation_id, workspace_id, department_id, reconciliation_date, " +
    "status, session_id, revenue_total, revenue_cash, revenue_card, " +
    "revenue_vat, revenue_transactions, revenue_per_worked_hour, " +
    "revenue_source, cash_expected, cash_counted, cash_difference, " +
    "total_planned_hours, total_actual_hours, total_labor_cost, " +
    "labor_percentage, closed_by, settled_at, settled_by, " +
    "approval_notes, approved_at, approved_by, locked_at, locked_by, " +
    "wizard_state, created_at, updated_at",
  )
  .limit(1);
assertOk("select daily_reconciliation (27 cols, C1 calibration)", reconciliations);
assertShape("daily_reconciliation column shape", reconciliations.data, [
  "reconciliation_id",
  "workspace_id",
  "department_id",
  "reconciliation_date",
  "status",
  "session_id",
  "revenue_total",
  "wizard_state",
  "created_at",
  "updated_at",
]);

// ── 5. session_hook — D6 hook configuration ──────────────────────────────────
// 12 cols from database.types.ts Row. id is the PK (NOT session_hook_id — note the
// naming inconsistency vs other D6 tables). hook_type ENUM.
// routine/tools.ts reads: id (PK), hook_type, linked_routine_id.
// timeline-template/tools.ts reads: id, hook_type, trigger_offset_min,
// linked_procedure_id, linked_routine_id.
const sessionHooks = await sb
  .from("session_hook")
  .select(
    "id, workspace_id, department_id, hook_type, trigger_offset_min, " +
    "repeat_interval_min, linked_procedure_id, linked_routine_id, " +
    "is_active, created_at, updated_at",
  )
  .limit(1);
assertOk("select session_hook (11 cols; PK=id not session_hook_id)", sessionHooks);
assertShape("session_hook column shape", sessionHooks.data, [
  "id",
  "workspace_id",
  "department_id",
  "hook_type",
  "trigger_offset_min",
  "is_active",
  "created_at",
  "updated_at",
]);

// ── 6. session_note — D6 handoff/closing notes ───────────────────────────────
// 11 cols from database.types.ts Row. id is the PK (NOT session_note_id).
// department_session_id FK (NOT NULL). note_type ENUM:
//   "handoff" | "closing" | "general" | "targeted"
// timeline-template/tools.ts inserts: content, note_type, department_session_id,
// workspace_id, created_by.
const sessionNotes = await sb
  .from("session_note")
  .select(
    "id, workspace_id, department_session_id, note_type, content, " +
    "created_by, created_at, audience, notify_at, delivered_at, deleted_at",
  )
  .limit(1);
assertOk("select session_note (11 cols; PK=id, note_type ENUM)", sessionNotes);
assertShape("session_note column shape", sessionNotes.data, [
  "id",
  "workspace_id",
  "department_session_id",
  "note_type",
  "content",
  "created_by",
  "created_at",
]);

// ── 7. fn_resolve_single_day_line RPC — existence check ──────────────────────
// Args: { p_department_session_id: string } → Returns: string (day_line_id or null).
// Passing a nil UUID will cause a DB error (no rows / validation fail), NOT 42883.
// 42883 = "function does not exist" — that is the deployment gap we are detecting.
const resolveResult = await sb.rpc("fn_resolve_single_day_line", {
  p_department_session_id: "00000000-0000-0000-0000-000000000000",
});
if (resolveResult.error?.code === "42883") {
  console.log(
    `  ✗ rpc fn_resolve_single_day_line — FUNCTION NOT FOUND (42883): ${resolveResult.error.message}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `  ✓ rpc fn_resolve_single_day_line — function deployed (nil UUID returned: ${resolveResult.error?.code ?? "no error"})`,
  );
}

// ── NOTE: Detected column assumption drift in operations/tools.ts ─────────────
// operations/tools.ts:132 selects schedule_shift with column "id" in a count query:
//   .from("schedule_shift").select("id", { count: "exact" })
// database.types.ts Row shows no "id" column — the PK is "schedule_shift_id".
// Supabase count queries with an invalid column name may still return a count
// (PostgREST COUNT(*) behavior), masking the drift. The correct column is
// "schedule_shift_id". This is an L-0348 class finding — logged but NOT fatal
// for this smoke script since the count itself is not broken at runtime.
console.log("");
console.log(
  "  NOTE: operations/tools.ts:132 selects schedule_shift with column \"id\" — " +
  "actual PK is \"schedule_shift_id\" (L-0348 class; count query masks drift at runtime).",
);

result();
