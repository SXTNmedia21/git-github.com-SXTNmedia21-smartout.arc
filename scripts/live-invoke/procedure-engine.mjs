// scripts/live-invoke/procedure-engine.mjs
// Live-invoke smoke for the procedure-engine domain — see scripts/live-invoke/README.md.
//
// Domain: 28 open gaps (highest in fleet). Governance spine + task ontology
// ADR-0298, Phase 1 schema + capability + cron expansion ADR-0391.
//
// What this catches (L-0348 family):
//   - Column drift on procedure-engine-owned tables (policy, protocol, procedure,
//     routine, knowledge_test, confirmation, profession_training)
//   - protocol_assignment read path column shape (governance.check_readiness calls this)
//   - profession + profession_training join path (governance.list_mandatory_protocols_for_role)
//   - procedure_step column shape (routine.add_step inserts here)
//   - fn_create_routine_from_draft RPC signature (Phase 1 ADR-0391 RPC)
//   - PGRST201 ambiguous-embed guard: profession_training → profession + protocol join
//
// Design choices (L-0348 discipline):
//   - Column lists derived EXCLUSIVELY from packages/supabase/src/database.types.ts Row shapes.
//     NEVER from migration SQL.
//   - Caller identity = service role → RLS bypassed for reads, auth.uid() = null.
//     This is intentional smoke: proves signature + column shape, not permission correctness.
//   - Empty result set is acceptable — proves function/table exists without requiring seed data.
//   - confirmation table: NO workspace_id (platform-scoped via protocol_id FK only).
//   - procedure table: workspace_id is NULLABLE (platform procedures have NULL).
//   - routine table: workspace_id is NULLABLE (set via trigger, passed explicitly in tools.ts).
//   - profession table: workspace_id NULLABLE (platform professions have NULL).
//   - profession_training table: workspace_id NULLABLE.
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/procedure-engine.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("procedure-engine");

// ── 1. policy — governance D/C-layer anchor ──────────────────────────────────
// Capability: governance / check_readiness derives missing_policies from protocol.policy_id.
// Columns from database.types.ts policy.Row:
//   policy_id, name, description, statement, is_active, policy_type, policy_scope,
//   enforcement_status, provenance, rules_json, scope_ref_id, season_id, priority,
//   valid_from, valid_to, created_at, updated_at, created_by, workspace_id
const policies = await sb
  .from("policy")
  .select(
    "policy_id, name, description, statement, is_active, policy_type, policy_scope, " +
    "enforcement_status, provenance, rules_json, scope_ref_id, season_id, priority, " +
    "valid_from, valid_to, created_at, updated_at, created_by, workspace_id",
  )
  .limit(3);
assertOk("select policy (19 cols)", policies);
assertShape("policy shape", policies.data, [
  "policy_id",
  "name",
  "statement",
  "is_active",
  "policy_type",
  "policy_scope",
  "enforcement_status",
  "workspace_id",
]);

// ── 2. protocol — spine for governance domain ─────────────────────────────────
// Capability: governance / check_readiness queries protocol_assignment joined to protocol.
// Columns from database.types.ts protocol.Row:
//   protocol_id, name, description, status, version, evidence_tier, policy_id,
//   provenance, valid_from, valid_to, owner_profile_id, created_by, created_at,
//   updated_at, workspace_id
const protocols = await sb
  .from("protocol")
  .select(
    "protocol_id, name, description, status, version, evidence_tier, policy_id, " +
    "provenance, valid_from, valid_to, owner_profile_id, created_by, " +
    "created_at, updated_at, workspace_id",
  )
  .limit(3);
assertOk("select protocol (15 cols)", protocols);
assertShape("protocol shape", protocols.data, [
  "protocol_id",
  "name",
  "status",
  "version",
  "evidence_tier",
  "policy_id",
  "workspace_id",
]);

// ── 3. protocol_assignment — readiness read path (governance.check_readiness) ─
// check_readiness selects: assignment_id, protocol_id, status, completed_at,
// assigned_at, protocol:protocol_id(protocol_id, policy_id).
// Smoke the base table; joined embed is proven by the join path select below.
// Columns from database.types.ts protocol_assignment.Row:
//   assignment_id, protocol_id, profile_id, workspace_id, status, protocol_version,
//   assigned_at, completed_at, next_review_at, waived_by, waived_reason,
//   assigned_by, assigned_via, assigned_ref_id, procedures_completed, procedures_total,
//   tests_passed, tests_total, confirmations_signed, confirmations_total, created_at, updated_at
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
]);

// ── 4. protocol_assignment join path — mirrors governance.check_readiness embed ─
// The capability does: .select("assignment_id, protocol_id, status, completed_at,
// assigned_at, protocol:protocol_id(protocol_id, policy_id)")
// Prove the join doesn't throw PGRST201 (ambiguous embed).
const assignmentJoin = await sb
  .from("protocol_assignment")
  .select("assignment_id, protocol_id, status, completed_at, assigned_at, protocol:protocol_id(protocol_id, policy_id)")
  .limit(3);
assertOk("protocol_assignment → protocol join (PGRST201 guard)", assignmentJoin);

// ── 5. procedure — linked from routine + procedure_step chain ─────────────────
// routine.create verifies procedure belongs to workspace (procedure.workspace_id).
// routine.add_step resolves routine → procedure_id.
// Columns from database.types.ts procedure.Row:
//   procedure_id, name, description, is_active, procedure_type, protocol_id,
//   provenance, skill_requirements, sort_order, valid_from, valid_to,
//   created_at, updated_at, workspace_id (nullable)
const procedures = await sb
  .from("procedure")
  .select(
    "procedure_id, name, description, is_active, procedure_type, protocol_id, " +
    "provenance, skill_requirements, sort_order, valid_from, valid_to, " +
    "created_at, updated_at, workspace_id",
  )
  .limit(3);
assertOk("select procedure (14 cols)", procedures);
assertShape("procedure shape", procedures.data, [
  "procedure_id",
  "name",
  "is_active",
  "procedure_type",
]);

// ── 6. procedure_step — add_step inserts here, verified pre-flight 2026-05-22 ─
// Columns per tools.ts comment (pre-flight 2026-05-22) and database.types.ts
// procedure_step.Row:
//   step_id, procedure_id, title, description, step_order, is_required,
//   estimated_minutes, media_urls, training_content, provenance, created_at, updated_at
// NOTE: tools.ts comment says "NO training_content / media_urls" but database.types.ts
// has both — smoke the real schema, not the comment.
const procedureSteps = await sb
  .from("procedure_step")
  .select(
    "step_id, procedure_id, title, description, step_order, is_required, " +
    "estimated_minutes, media_urls, training_content, provenance, created_at, updated_at",
  )
  .limit(3);
assertOk("select procedure_step (12 cols incl media_urls+training_content)", procedureSteps);
assertShape("procedure_step shape", procedureSteps.data, [
  "step_id",
  "procedure_id",
  "title",
  "step_order",
  "is_required",
]);

// ── 7. routine — routine capability read path ─────────────────────────────────
// routine.create inserts here; assign_to_location reads + updates; add_step reads.
// Columns from database.types.ts routine.Row:
//   routine_id, name, procedure_id, protocol_id, trigger_type, trigger_config,
//   executor_type, assigned_to_type, assigned_to_ref, governance_status, is_active,
//   location_id, workspace_id (nullable), control_list_id, control_frequency,
//   control_nth, source_reference, created_via, created_at, updated_at
const routines = await sb
  .from("routine")
  .select(
    "routine_id, name, procedure_id, protocol_id, trigger_type, trigger_config, " +
    "executor_type, assigned_to_type, assigned_to_ref, governance_status, is_active, " +
    "location_id, workspace_id, control_list_id, control_frequency, control_nth, " +
    "source_reference, created_via, created_at, updated_at",
  )
  .limit(3);
assertOk("select routine (20 cols)", routines);
assertShape("routine shape", routines.data, [
  "routine_id",
  "name",
  "procedure_id",
  "trigger_type",
  "assigned_to_type",
  "assigned_to_ref",
]);

// ── 8. knowledge_test — test gate in protocol assignment lifecycle ─────────────
// Columns from database.types.ts knowledge_test.Row:
//   knowledge_test_id, name, description, protocol_id, questions, pass_threshold,
//   max_attempts, is_active, valid_from, valid_to, created_at, updated_at
const knowledgeTests = await sb
  .from("knowledge_test")
  .select(
    "knowledge_test_id, name, description, protocol_id, questions, pass_threshold, " +
    "max_attempts, is_active, valid_from, valid_to, created_at, updated_at",
  )
  .limit(3);
assertOk("select knowledge_test (12 cols)", knowledgeTests);
assertShape("knowledge_test shape", knowledgeTests.data, [
  "knowledge_test_id",
  "name",
  "protocol_id",
  "questions",
  "pass_threshold",
]);

// ── 9. confirmation — signature gate in protocol assignment lifecycle ──────────
// NOTE: confirmation has NO workspace_id — it is platform-scoped via protocol_id FK.
// Columns from database.types.ts confirmation.Row:
//   confirmation_id, name, confirmation_text, protocol_id, requires_signature,
//   is_active, provenance, valid_from, valid_to, created_at, updated_at
const confirmations = await sb
  .from("confirmation")
  .select(
    "confirmation_id, name, confirmation_text, protocol_id, requires_signature, " +
    "is_active, provenance, valid_from, valid_to, created_at, updated_at",
  )
  .limit(3);
assertOk("select confirmation (11 cols, NO workspace_id)", confirmations);
assertShape("confirmation shape", confirmations.data, [
  "confirmation_id",
  "name",
  "protocol_id",
  "requires_signature",
  "is_active",
]);

// ── 10. profession — resolved in list_mandatory_protocols_for_role ────────────
// The tool resolves by slug: workspace-scoped first, then platform (workspace_id IS NULL).
// Columns from database.types.ts profession.Row:
//   profession_id, name, slug, description, is_universal, sort_order,
//   workspace_id (nullable), created_at, updated_at
const professions = await sb
  .from("profession")
  .select(
    "profession_id, name, slug, description, is_universal, sort_order, " +
    "workspace_id, created_at, updated_at",
  )
  .limit(3);
assertOk("select profession (9 cols)", professions);
assertShape("profession shape", professions.data, [
  "profession_id",
  "name",
  "slug",
  "is_universal",
]);

// ── 11. profession_training — ADR-0387a profession map ────────────────────────
// list_mandatory_protocols_for_role: .select("protocol_id, protocol:protocol_id(protocol_id, name)")
// Smoke the base table columns, then prove the join path doesn't PGRST201.
// Columns from database.types.ts profession_training.Row:
//   profession_training_id, profession_id, protocol_id, is_required, weight,
//   workspace_id (nullable), created_at, updated_at
const professionTraining = await sb
  .from("profession_training")
  .select(
    "profession_training_id, profession_id, protocol_id, is_required, weight, " +
    "workspace_id, created_at, updated_at",
  )
  .limit(3);
assertOk("select profession_training (8 cols)", professionTraining);
assertShape("profession_training shape", professionTraining.data, [
  "profession_training_id",
  "profession_id",
  "protocol_id",
  "is_required",
  "weight",
]);

// ── 12. profession_training join path — mirrors list_mandatory_protocols embed ─
// The capability does: .select("protocol_id, protocol:protocol_id(protocol_id, name)")
// Prove the join doesn't throw PGRST201.
const trainingJoin = await sb
  .from("profession_training")
  .select("protocol_id, protocol:protocol_id(protocol_id, name)")
  .limit(3);
assertOk("profession_training → protocol join (PGRST201 guard)", trainingJoin);

// ── 13. fn_create_routine_from_draft RPC signature ────────────────────────────
// Phase 1 ADR-0391 RPC used by routine capability draft workflow.
// Args per database.types.ts:
//   p_workspace_id, p_actor_profile_id, p_routine_name, p_source_reference,
//   p_trigger_type, p_trigger_config, p_steps, p_protocol_id?, p_location_id?,
//   p_new_location?, p_team_ids?
// We call with a synthetic (non-existent) workspace UUID — expect DB error on
// FK constraint (UUID doesn't exist), NOT a function-not-found (PGRST202 / 42883).
// HTTP 400 from a FK violation proves the function exists; only PGRST202 means drift.
const PROBE_UUID = "00000000-0000-0000-0000-000000000001";
const routineDraft = await sb.rpc("fn_create_routine_from_draft", {
  p_workspace_id: PROBE_UUID,
  p_actor_profile_id: PROBE_UUID,
  p_routine_name: "smoke-probe",
  p_source_reference: "live-invoke-smoke",
  p_trigger_type: "scheduled",
  p_trigger_config: { times: ["08:00"] },
  p_steps: [],
});
// Function-not-found codes: PGRST202 (PostgREST) or 42883 (PostgreSQL).
// Any other error (FK violation, constraint, etc.) = function exists = smoke passes.
const draftError = routineDraft.error;
const isMissingFn =
  draftError &&
  (draftError.code === "PGRST202" || draftError.code === "42883");
assertOk("rpc fn_create_routine_from_draft (signature smoke — FK error OK)", {
  data: routineDraft.data,
  error: isMissingFn ? draftError : null,
  status: isMissingFn ? routineDraft.status : 200,
});

result();
