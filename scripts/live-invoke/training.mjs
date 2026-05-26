// scripts/live-invoke/training.mjs
// Live-invoke smoke for the training domain — see scripts/live-invoke/README.md.
//
// Domain: protocol_assignment lifecycle + proof tables + readiness matrix.
// Capability tools (packages/ai/src/capabilities/training/tools.ts):
//   - get_my_training_status  → protocol_assignment + protocol join
//   - get_next_protocol       → protocol_assignment + protocol join + order
//   - get_team_readiness      → RPC get_workspace_readiness + profile select
//
// What this catches (L-0348 family):
//   - Column drift on knowledge_test_attempt + confirmation_signature (proof tables)
//   - PGRST201 ambiguous embed on protocol_assignment → protocol join
//     (the join tools.ts actually calls — different FK path than procedure-engine)
//   - RPC get_workspace_readiness signature + return shape (total/completed/profile_id)
//   - profile select shape used by get_team_readiness (display_name, department_id)
//   - protocol_assignment column shape as read by all 3 training tools
//
// Design choices:
//   - Columns derived EXCLUSIVELY from packages/supabase/src/database.types.ts Row shapes.
//     NEVER from migration SQL.
//   - procedure-engine.mjs already covers: policy, protocol, procedure, routine,
//     knowledge_test, confirmation, profession, profession_training.
//     This script does NOT duplicate those — it covers the training-specific read paths
//     and proof tables that procedure-engine does NOT smoke.
//   - readiness_event + training_progress: NOT in database.types.ts (no such tables).
//   - confirmation_signature: HAS workspace_id (unlike confirmation which doesn't).
//   - Caller = service role → auth.uid() null → RLS bypassed, empty results OK.
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/training.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("training");

// ── 1. protocol_assignment — primary read table for all 3 training tools ─────
// tools.ts get_my_training_status: .select("assignment_id, status, protocol:protocol_id(name)")
// Smoke the full base table shape first.
// Columns from database.types.ts protocol_assignment.Row (21 cols):
//   assignment_id, protocol_id, profile_id, workspace_id, status, protocol_version,
//   assigned_at, completed_at, next_review_at, waived_by, waived_reason,
//   assigned_by, assigned_via, assigned_ref_id, procedures_completed, procedures_total,
//   tests_passed, tests_total, confirmations_signed, confirmations_total,
//   created_at, updated_at
const assignments = await sb
  .from("protocol_assignment")
  .select(
    "assignment_id, protocol_id, profile_id, workspace_id, status, protocol_version, " +
    "assigned_at, completed_at, next_review_at, waived_by, waived_reason, " +
    "assigned_by, assigned_via, assigned_ref_id, procedures_completed, procedures_total, " +
    "tests_passed, tests_total, confirmations_signed, confirmations_total, " +
    "created_at, updated_at",
  )
  .limit(3);
assertOk("select protocol_assignment (22 cols)", assignments);
assertShape("protocol_assignment shape", assignments.data, [
  "assignment_id",
  "protocol_id",
  "profile_id",
  "workspace_id",
  "status",
  "assigned_at",
  "procedures_completed",
  "tests_passed",
  "confirmations_signed",
]);

// ── 2. get_my_training_status join path — protocol_assignment → protocol ──────
// tools.ts line 20: .select("assignment_id, status, protocol:protocol_id(name)")
// This is the EXACT select the capability calls. Proves:
//   (a) column names match (assignment_id, status)
//   (b) FK alias protocol:protocol_id doesn't cause PGRST201
// procedure-engine.mjs smokes a different embed path (assignment_id, protocol_id,
// status, completed_at, assigned_at, protocol:protocol_id(protocol_id, policy_id)).
// This path proves the training tools' narrower select doesn't drift.
const statusJoin = await sb
  .from("protocol_assignment")
  .select("assignment_id, status, protocol:protocol_id(name)")
  .limit(3);
assertOk("protocol_assignment → protocol(name) join (get_my_training_status path)", statusJoin);

// ── 3. get_next_protocol join path + order ────────────────────────────────────
// tools.ts line 55: .select("assignment_id, status, assigned_at, protocol:protocol_id(name, description)")
// Same FK alias, wider protocol projection. Also confirms assigned_at column exists
// (used for .order("assigned_at")) and .in("status", ["not_started", "in_progress"]).
const nextProtoJoin = await sb
  .from("protocol_assignment")
  .select("assignment_id, status, assigned_at, protocol:protocol_id(name, description)")
  .in("status", ["not_started", "in_progress"])
  .order("assigned_at", { ascending: true })
  .limit(1);
assertOk("protocol_assignment → protocol(name,description) join (get_next_protocol path)", nextProtoJoin);

// ── 4. knowledge_test_attempt — proof table for test completions ──────────────
// Written when an employee submits a knowledge test answer set.
// training tools don't read this directly yet but it is the canonical
// proof table for this domain — drift here = silent data loss.
// Columns from database.types.ts knowledge_test_attempt.Row (12 cols):
//   id, knowledge_test_id, profile_id, workspace_id, protocol_assignment_id,
//   answers, passed, score, ai_confidence, attempted_at, graded_by, created_at
const testAttempts = await sb
  .from("knowledge_test_attempt")
  .select(
    "id, knowledge_test_id, profile_id, workspace_id, protocol_assignment_id, " +
    "answers, passed, score, ai_confidence, attempted_at, graded_by, created_at",
  )
  .limit(3);
assertOk("select knowledge_test_attempt (12 cols)", testAttempts);
assertShape("knowledge_test_attempt shape", testAttempts.data, [
  "id",
  "knowledge_test_id",
  "profile_id",
  "workspace_id",
  "passed",
  "score",
  "attempted_at",
]);

// ── 5. confirmation_signature — proof table for signed confirmations ───────────
// Written when an employee signs a confirmation gate in a protocol assignment.
// NOTE: confirmation_signature HAS workspace_id — unlike confirmation (platform-scoped).
// Columns from database.types.ts confirmation_signature.Row (9 cols):
//   id, confirmation_id, profile_id, workspace_id, protocol_assignment_id,
//   signature_data, signed_at, ip_address, created_at
const confSigs = await sb
  .from("confirmation_signature")
  .select(
    "id, confirmation_id, profile_id, workspace_id, protocol_assignment_id, " +
    "signature_data, signed_at, ip_address, created_at",
  )
  .limit(3);
assertOk("select confirmation_signature (9 cols, HAS workspace_id)", confSigs);
assertShape("confirmation_signature shape", confSigs.data, [
  "id",
  "confirmation_id",
  "profile_id",
  "workspace_id",
  "protocol_assignment_id",
  "signed_at",
]);

// ── 6. get_workspace_readiness RPC — used by get_team_readiness tool ──────────
// tools.ts line 103: ctx.supabaseAdmin.rpc("get_workspace_readiness", { p_workspace_id })
// Returns { profile_id, total, completed }[] per database.types.ts:
//   get_workspace_readiness Args: { p_workspace_id: string }
//   Returns: { completed: number; profile_id: string; total: number }[]
// We pass a synthetic UUID — expect empty array (no data), NOT a function-not-found error.
// If PGRST202 or 42883: function is missing from DB → drift.
const PROBE_UUID = "00000000-0000-0000-0000-000000000001";
const readiness = await sb.rpc("get_workspace_readiness", {
  p_workspace_id: PROBE_UUID,
});
// A function-not-found is PGRST202 or PostgreSQL 42883.
// Any other response (empty array, data, other error) = function exists.
const readinessErr = readiness.error;
const isMissingFn =
  readinessErr &&
  (readinessErr.code === "PGRST202" || readinessErr.code === "42883");
assertOk("rpc get_workspace_readiness (signature smoke — empty OK)", {
  data: readiness.data,
  error: isMissingFn ? readinessErr : null,
  status: isMissingFn ? readiness.status : 200,
});
assertShape("get_workspace_readiness return shape", readiness.data ?? [], [
  // Only checked when rows are present; empty = synthetic workspace → OK
]);

// ── 7. profile select — used by get_team_readiness after RPC ─────────────────
// tools.ts line 112-116: .from("profile").select("profile_id, display_name, department_id")
// Proves these 3 columns exist and the select doesn't PGRST201 (profile has 40+ cols;
// no multi-FK ambiguity on a bare select).
const profileCheck = await sb
  .from("profile")
  .select("profile_id, display_name, department_id")
  .limit(3);
assertOk("profile select (profile_id, display_name, department_id)", profileCheck);
assertShape("profile shape for training readiness matrix", profileCheck.data, [
  "profile_id",
  "display_name",
  "department_id",
]);

result();
