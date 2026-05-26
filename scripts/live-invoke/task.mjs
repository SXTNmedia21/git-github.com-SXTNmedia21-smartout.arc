// scripts/live-invoke/task.mjs
// Live-invoke smoke for the task domain (ADR-0298) — the universal task ontology.
//
// What this catches:
//   - Column drift on fn_list_my_tasks output (16 columns)
//   - Signature drift on the 4 task source tables (session_task, schedule_day_task,
//     personal_task, emma_task — engine_state_step excluded per R2)
//   - SECURITY DEFINER function existence + permission grant
//   - The L-0348 class: drifts caught in C1 scheduler 2026-05-25 + Phase 1 turnus
//
// Caller identity = service role → auth.uid() is null → CTE returns empty → all
// 4 UNION arms return empty. That is the desired smoke behavior: signature
// proven, no SQL error, columns intact.
//
// Bootstrap note 2026-05-26: first version of this script caught 4 of my own
// column-name assumptions vs actual schema (session_id vs department_session_id,
// personal_task missing description+assigned_to+completed_at, emma_task uses
// profile_id not assigned_to, schedule_day_task uses schedule_day_task_id+label+
// task_status+shift_date). This is exactly the L-0348 class — proof the scaffold
// works on its first run.

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("task");

// ── 1. fn_list_my_tasks signature + column shape ─────────────────────────────
// 16 expected columns per migration 20260606120100. Any drift = production bug.
const listMine = await sb.rpc("fn_list_my_tasks");
assertOk("rpc fn_list_my_tasks (default window)", listMine);
assertShape("fn_list_my_tasks column shape", listMine.data, [
  "id",
  "source",
  "raw_status",
  "status",
  "title",
  "description",
  "due_at",
  "priority",
  "assigned_to",
  "workspace_id",
  "session_id",
  "hook_id",
  "compliance",
  "created_at",
  "completed_at",
  "origin_actor",
]);

// ── 2. fn_list_my_tasks with explicit window ─────────────────────────────────
const listMineWindow = await sb.rpc("fn_list_my_tasks", {
  p_window_start: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  p_window_end: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
});
assertOk("rpc fn_list_my_tasks (explicit window)", listMineWindow);

// ── 3. session_task base table ───────────────────────────────────────────────
// Note: FK is department_session_id (NOT session_id); hook FK is session_hook_id.
const sessionTasks = await sb
  .from("session_task")
  .select(
    "id, status, title, description, department_session_id, session_hook_id, " +
    "day_line_id, is_compliance_required, assigned_to, completed_at, " +
    "completed_by, scheduled_at, generated_by, origin, created_at, updated_at, workspace_id",
  )
  .limit(1);
assertOk("select session_task (17 cols incl ADR-0367 day_line_id)", sessionTasks);

// ── 4. personal_task base table ──────────────────────────────────────────────
// Slim by design: title + priority + status + due_at + profile_id. No description.
const personalTasks = await sb
  .from("personal_task")
  .select(
    "id, title, due_at, priority, status, profile_id, workspace_id, " +
    "notified_due_soon_at, notified_overdue_at, created_at, updated_at",
  )
  .limit(1);
assertOk("select personal_task (11 cols)", personalTasks);

// ── 5. emma_task base table ──────────────────────────────────────────────────
// profile_id not assigned_to; position + mission + context for emma orchestration.
const emmaTasks = await sb
  .from("emma_task")
  .select(
    "id, title, description, status, due_at, priority, position, mission, " +
    "context, profile_id, workspace_id, triggered_at, " +
    "notified_due_soon_at, notified_overdue_at, created_at, updated_at",
  )
  .limit(1);
assertOk("select emma_task (16 cols)", emmaTasks);

// ── 6. schedule_day_task base table ──────────────────────────────────────────
// Distinct schema: schedule_day_task_id PK (not id), label (not title),
// task_status (not status), shift_date (not due_at). Day-anchored, not time-anchored.
const dayTasks = await sb
  .from("schedule_day_task")
  .select(
    "schedule_day_task_id, label, category, task_status, shift_date, " +
    "highlight, assigned_to, completed_at, workspace_id, created_at, updated_at",
  )
  .limit(1);
assertOk("select schedule_day_task (11 cols, day-anchored)", dayTasks);

// ── 7. fn_normalize_session_task_status helper (used inside fn_list_my_tasks) ─
const normalize = await sb.rpc("fn_normalize_session_task_status", {
  p_raw: "completed",
});
assertOk("rpc fn_normalize_session_task_status", normalize);

result();
