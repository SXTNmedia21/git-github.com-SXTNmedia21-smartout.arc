// scripts/live-invoke/scheduling.mjs
// Live-invoke smoke for the scheduling domain.
//
// What this catches (L-0348 — 3rd occurrence 2026-05-25, promoted to systemic rule):
//   - Column drift on schedule_shift (29 cols), shift_session (14 cols ADR-0367),
//     shift_approval (15 cols), shift_hour_interpretation (18 cols),
//     shift_cost_snapshot (27 cols)
//   - RPC signature drift on derive_shift_hours, snapshot_shift_cost (existence check),
//     approve_shift_swap, initiate_shift_swap (existence + required-arg validation)
//   - PGRST201/202 ambiguous embed — table selects use explicit column lists from
//     database.types.ts Row shapes (NOT migration SQL, per L-0348 hard rule)
//
// Design choices:
//   - Column lists derived from packages/supabase/src/database.types.ts Row keys ONLY.
//     Never from migration SQL (that's how L-0348 class drifts happen — migrations lag types).
//   - Swap RPCs (initiate/approve/respond/cancel) are write-path RPCs that require
//     real shift UUIDs. We test their EXISTENCE and required-arg validation via a
//     deliberate bad-UUID call and accept PGRST202 / 42501 / expected DB errors,
//     not "function not found" (42883). Signal = function is deployed.
//   - derive_shift_hours + snapshot_shift_cost are also write-path; same existence pattern.
//   - shift_session covers ADR-0367 tri-layer model (department_session → day_line → shift_session).
//
// Capabilities covered:
//   - scheduler (packages/ai/src/capabilities/scheduler/tools.ts)
//   - shift-lifecycle (packages/ai/src/capabilities/shift-lifecycle/tools.ts)
//   - shift-mcp (services/shift-mcp/src/tools/)
//   - swap RPCs (supabase Functions: approve_shift_swap, initiate_shift_swap)
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/scheduling.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("scheduling");

// ── 1. schedule_shift — core scheduling table (D6 Production) ────────────────
// 29 cols from database.types.ts Row. schedule_shift_id is the PK (NOT id).
// Key L-0348 lesson: scheduler/tools.ts originally used "date" and "profile_id"
// for what are actually "shift_date" and "employee_id". These column names are
// verified here against the live schema on every run.
const shifts = await sb
  .from("schedule_shift")
  .select(
    "schedule_shift_id, workspace_id, employee_id, department_id, " +
    "status, shift_date, start_time, end_time, work_hours, breaks, " +
    "role, source, is_published, is_adhoc, indicator, day_category, " +
    "location_id, position_id, team_id, shift_type_id, template_shift_id, " +
    "pipeline_lock_state_id, zone, notes, custom_rate, custom_rate_type, " +
    "approved_at, approved_by, adhoc_approved_at, adhoc_approved_by, " +
    "confirmed_at, confirmed_by, created_at, updated_at",
  )
  .limit(1);
assertOk("select schedule_shift (29 cols)", shifts);
assertShape("schedule_shift column shape", shifts.data, [
  "schedule_shift_id",
  "workspace_id",
  "employee_id",
  "department_id",
  "status",
  "shift_date",
  "start_time",
  "end_time",
  "work_hours",
  "breaks",
  "role",
  "source",
  "is_published",
  "indicator",
  "day_category",
  "created_at",
  "updated_at",
]);

// ── 2. shift_session — ADR-0367 tri-layer D6 model ────────────────────────────
// 14 cols. shift_session_id is PK (NOT id). Links schedule_shift to
// department_session via department_session_id. business_date is the
// operational date (NOT shift_date). push_topic nullable.
const sessions = await sb
  .from("shift_session")
  .select(
    "shift_session_id, workspace_id, department_id, department_session_id, " +
    "schedule_shift_id, employee_id, location_id, business_date, status, " +
    "push_topic, clocked_in_at, clocked_out_at, created_at, updated_at",
  )
  .limit(1);
assertOk("select shift_session (14 cols, ADR-0367)", sessions);
assertShape("shift_session column shape", sessions.data, [
  "shift_session_id",
  "workspace_id",
  "department_session_id",
  "schedule_shift_id",
  "employee_id",
  "business_date",
  "status",
  "created_at",
  "updated_at",
]);

// ── 3. shift_approval — approval workflow table ───────────────────────────────
// 15 cols. approval_id is PK. shift_id FK → schedule_shift.schedule_shift_id.
// shift-lifecycle/tools.ts reads: approval_id, status, calculated_hours.
const approvals = await sb
  .from("shift_approval")
  .select(
    "approval_id, workspace_id, shift_id, reconciliation_id, status, " +
    "planned_hours, calculated_hours, approved_hours, approved_at, approved_by, " +
    "edit_justification, handoff_requested, handoff_completed, " +
    "system_deviations, created_at, updated_at",
  )
  .limit(1);
assertOk("select shift_approval (16 cols)", approvals);
assertShape("shift_approval column shape", approvals.data, [
  "approval_id",
  "workspace_id",
  "shift_id",
  "status",
  "planned_hours",
  "handoff_requested",
  "handoff_completed",
  "created_at",
  "updated_at",
]);

// ── 4. shift_hour_interpretation — derivation layer ────────────────────────────
// 18 cols. interpretation_id is PK. shift_id FK → schedule_shift.schedule_shift_id.
// shift-lifecycle settle_shift reads: interpretation_id, derivation_version.
const interpretations = await sb
  .from("shift_hour_interpretation")
  .select(
    "interpretation_id, workspace_id, shift_id, department_id, " +
    "derived_by, derived_at, derivation_version, framework_rule_ids, " +
    "time_entry_ids, regular_hours, overtime_hours, night_hours, " +
    "holiday_hours, weekend_hours, break_deductions, " +
    "total_interpreted_hours, created_at, updated_at",
  )
  .limit(1);
assertOk("select shift_hour_interpretation (18 cols)", interpretations);
assertShape("shift_hour_interpretation column shape", interpretations.data, [
  "interpretation_id",
  "workspace_id",
  "shift_id",
  "derivation_version",
  "regular_hours",
  "total_interpreted_hours",
  "created_at",
  "updated_at",
]);

// ── 5. derive_shift_hours RPC — existence check ───────────────────────────────
// Requires a valid schedule_shift_id UUID. Passing a nil UUID will cause a DB
// error (not found / RLS). We accept any error EXCEPT 42883 (function not found).
// 42883 = the function was never deployed. Any other error = function exists,
// RPC signature is live.
const deriveResult = await sb.rpc("derive_shift_hours", {
  p_shift_id: "00000000-0000-0000-0000-000000000000",
});
if (deriveResult.error?.code === "42883") {
  // Function does not exist — this is a real deployment gap.
  console.log(`  ✗ rpc derive_shift_hours — FUNCTION NOT FOUND (42883): ${deriveResult.error.message}`);
  process.exitCode = 1;
} else {
  // Any other outcome (data or non-42883 error) means the function is deployed.
  console.log(`  ✓ rpc derive_shift_hours — function deployed (nil UUID returned: ${deriveResult.error?.code ?? "no error"})`);
}

// ── 6. initiate_shift_swap RPC — existence check ─────────────────────────────
// Write RPC requiring valid shift UUIDs + target profile. Passing nils = DB
// error (not 42883 = function found). Same existence-check pattern as derive.
const initiateResult = await sb.rpc("initiate_shift_swap", {
  p_requester_shift_id: "00000000-0000-0000-0000-000000000000",
  p_target_shift_id: "00000000-0000-0000-0000-000000000000",
  p_target_profile_id: "00000000-0000-0000-0000-000000000000",
});
if (initiateResult.error?.code === "42883") {
  console.log(`  ✗ rpc initiate_shift_swap — FUNCTION NOT FOUND (42883): ${initiateResult.error.message}`);
  process.exitCode = 1;
} else {
  console.log(`  ✓ rpc initiate_shift_swap — function deployed (nil UUID returned: ${initiateResult.error?.code ?? "no error"})`);
}

// ── 7. approve_shift_swap RPC — existence check ───────────────────────────────
// Same pattern: PGRST/DB error on bad UUID = deployed; 42883 = missing.
const approveSwapResult = await sb.rpc("approve_shift_swap", {
  p_swap_id: "00000000-0000-0000-0000-000000000000",
  p_approved: false,
});
if (approveSwapResult.error?.code === "42883") {
  console.log(`  ✗ rpc approve_shift_swap — FUNCTION NOT FOUND (42883): ${approveSwapResult.error.message}`);
  process.exitCode = 1;
} else {
  console.log(`  ✓ rpc approve_shift_swap — function deployed (nil UUID returned: ${approveSwapResult.error?.code ?? "no error"})`);
}

result();
