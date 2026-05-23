// =============================================================================
// _tests/overdue-notify.test.ts — Notif agent Wave 2 — session-task-overdue-cron
// -----------------------------------------------------------------------------
// Verifies structural invariants of session-task-overdue-cron/index.ts:
//
//   T1 — overdue-status-update:    the handler writes status='overdue' for past-due tasks
//   T2 — assignee-notification:    a notification_outbox row is inserted for the assignee
//   T3 — manager-notification:     notification_outbox rows are inserted for dept managers
//   T4 — manager-resolution:       manager lookup uses workspace_id + department_id + role IN
//   T5 — manager-dedup:            manager who IS the assignee is skipped (no double notification)
//   T6 — activity-trail:           an activity_trail row is written with event 'session_task.overdue'
//   T7 — no-assignee-path:         when assigned_to is null only managers are notified
//   T8 — compliance-priority:      compliance-required tasks use priority=2
//   T9 — grace-period:             TASK_OVERDUE_GRACE_MINUTES env is read and applied to cutoff
//   T10 — system-actor:            activity_trail uses SYSTEM_ACTOR_ID
//
// Test strategy: source-parse (same as session-hook-executor/routine-expand.test.ts
// and analyze-workspace/auth_test.ts). Avoids live Supabase / network — reads the
// TypeScript source as a string and asserts structural patterns. This is the
// correct approach for Deno Edge Functions that use Deno.serve() and cannot be
// imported as modules without full Deno Deploy env.
//
// Run: deno test --allow-read supabase/functions/session-task-overdue-cron/_tests/overdue-notify.test.ts
// =============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("../index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

// ─────────────────────────────────────────────────────────────────────────────
// T1 — status='overdue' written on UPDATE
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("T1: handler updates session_task.status to 'overdue'", () => {
  assert(
    source.includes(`status: "overdue"`),
    "T1 fail: UPDATE does not set status='overdue' — missing `status: \"overdue\"` literal",
  );
});

Deno.test("T1b: handler filters only pending/available/in_progress rows", () => {
  assert(
    source.includes('"pending", "available", "in_progress"'),
    "T1b fail: status filter must include 'pending', 'available', 'in_progress' — found neither",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T2 — assignee notification inserted
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("T2: assignee receives notification_outbox insert", () => {
  // Must guard on assigned_to truthy before inserting assignee notification.
  assert(
    source.includes("row.assigned_to") && source.includes("notification_outbox"),
    "T2 fail: no notification_outbox insert guarded by assigned_to",
  );
});

Deno.test("T2b: assignee notification uses recipient_id = row.assigned_to", () => {
  assert(
    source.includes("recipient_id: row.assigned_to"),
    "T2b fail: assignee notification does not use `recipient_id: row.assigned_to`",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T3 — manager notification inserted
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("T3: manager notification_outbox inserts happen inside a loop", () => {
  // The manager loop inserts one row per manager.
  assert(
    source.includes("for (const mgr of managers"),
    "T3 fail: no manager notification loop — missing `for (const mgr of managers`",
  );
});

Deno.test("T3b: manager notification uses recipient_id = mgr.profile_id", () => {
  assert(
    source.includes("recipient_id: mgr.profile_id"),
    "T3b fail: manager notification does not use `recipient_id: mgr.profile_id`",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T4 — manager resolution via profile table with role filter
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('T4: manager lookup uses role IN ["manager","admin","owner"]', () => {
  assert(
    source.includes('"manager", "admin", "owner"'),
    'T4 fail: manager query does not include role IN ["manager","admin","owner"]',
  );
});

Deno.test("T4b: manager lookup filters by workspace_id", () => {
  assert(
    source.includes("eq(\"workspace_id\", row.workspace_id)"),
    'T4b fail: manager query missing .eq("workspace_id", row.workspace_id)',
  );
});

Deno.test("T4c: manager lookup filters active profiles", () => {
  assert(
    source.includes(`eq("is_active", true)`),
    "T4c fail: manager query missing .eq(\"is_active\", true)",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T5 — manager dedup: assignee who is also manager is skipped
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("T5: manager loop skips when profile_id === assigned_to", () => {
  assert(
    source.includes("mgr.profile_id === row.assigned_to"),
    "T5 fail: manager dedup missing — `mgr.profile_id === row.assigned_to` not found",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T6 — activity_trail with correct event key
// ─────────────────────────────────────────────────────────────────────────────

Deno.test('T6: activity_trail insert uses event key "session_task.overdue"', () => {
  assert(
    source.includes('"session_task.overdue"'),
    "T6 fail: activity_trail event key 'session_task.overdue' not found",
  );
});

Deno.test("T6b: activity_trail uses entity_type='session_task'", () => {
  assert(
    source.includes(`entity_type: "session_task"`),
    "T6b fail: activity_trail entity_type is not 'session_task'",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T7 — no-assignee path: null assigned_to skips assignee notification
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("T7: assignee notification guarded by if (row.assigned_to)", () => {
  // Guard must be present so null assigned_to skips the assignee insert.
  assert(
    source.includes("if (row.assigned_to)"),
    "T7 fail: no `if (row.assigned_to)` guard — null assignee would cause FK violation",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T8 — compliance priority = 2
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("T8: compliance-required tasks use priority 2", () => {
  // The code must branch on is_compliance_required to pick priority=2.
  assert(
    source.includes("is_compliance_required ? 2 : 1"),
    "T8 fail: compliance priority branching `is_compliance_required ? 2 : 1` not found",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T9 — grace period env var is applied
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("T9: TASK_OVERDUE_GRACE_MINUTES env var is read", () => {
  assert(
    source.includes("TASK_OVERDUE_GRACE_MINUTES"),
    "T9 fail: TASK_OVERDUE_GRACE_MINUTES env var not referenced",
  );
});

Deno.test("T9b: cutoff is computed from grace period", () => {
  assert(
    source.includes("graceMin * 60 * 1000"),
    "T9b fail: cutoff not computed from grace minutes — `graceMin * 60 * 1000` not found",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T10 — SYSTEM_ACTOR_ID used for activity_trail
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("T10: activity_trail uses SYSTEM_ACTOR_ID", () => {
  assert(
    source.includes("SYSTEM_ACTOR_ID"),
    "T10 fail: SYSTEM_ACTOR_ID constant not found — activity_trail.actor_id must be system actor",
  );
});

Deno.test("T10b: SYSTEM_ACTOR_ID is the known system UUID", () => {
  assert(
    source.includes("00000000-0000-0000-0000-000000000001"),
    "T10b fail: SYSTEM_ACTOR_ID does not match the seeded system actor UUID",
  );
});
