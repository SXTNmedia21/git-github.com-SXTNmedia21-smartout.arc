// scripts/live-invoke/contracts.mjs
// Live-invoke smoke for the contracts domain — see scripts/live-invoke/README.md.
//
// Catches: column drift, RPC signature drift, missing functions, SelectQueryError
//          (the L-0348 family that mocks miss).
// Does NOT cover: business logic, permissions, DocuSeal webhook, create→sign→active
//                 lifecycle end-to-end — see Playwright + contract-service integration tests.
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/contracts.mjs
//
// Design choices (L-0348 discipline):
//   - Column lists derived EXCLUSIVELY from packages/supabase/src/database.types.ts
//     Row shapes. NEVER from migration SQL (migrations lie about current state).
//   - Two distinct "contract" tables exist:
//       1. `contract` — DocuSeal submission record (contract_id PK, docuseal_* cols)
//       2. `employment_contract` — HR/payroll dimension (contract_id PK, framework_snapshot)
//     The capability tools.ts uses BOTH. Smoke covers both separately.
//   - `compliance_drift` is a view (no workspace_id guard on service role = fine for smoke).
//   - `contract_template.workspace_id` is nullable — platform-level templates have null.
//   - `check_contract_intake_completion` and `anonymize_contract` are production RPCs;
//     we call with synthetic UUIDs to prove the function exists + returns without crash.
//     Empty / error-row results are acceptable — signature is what matters.

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("contracts");

// ── 1. contract_template — listEmployeeTemplates read path ───────────────────
// Capability: contract / listEmployeeTemplates
// Columns from database.types.ts contract_template.Row (key lineage cols included):
//   template_id, name, description, created_at, is_active, contract_type, workspace_id,
//   is_system, source_template_id, source_template_version, forked_at, published_at,
//   deprecated_at, version
const templates = await sb
  .from("contract_template")
  .select(
    "template_id, name, description, created_at, is_active, contract_type, " +
    "workspace_id, is_system, source_template_id, source_template_version, " +
    "forked_at, published_at, deprecated_at, version",
  )
  .limit(3);
assertOk("select contract_template (14 cols incl Gate G5 lineage)", templates);
assertShape("contract_template shape", templates.data, [
  "template_id",
  "name",
  "is_active",
  "contract_type",
  "is_system",
]);

// ── 2. contract — DocuSeal submission record / listEmployeeContracts path ────
// Capability: contract / listEmployeeContracts + sendEmployeeContract
// Columns from database.types.ts contract.Row (DocuSeal-side table):
//   contract_id, status, contract_type, created_at, sent_at, signed_at,
//   recipient_name, recipient_email, template_id, expires_at, workspace_id
const contracts = await sb
  .from("contract")
  .select(
    "contract_id, status, contract_type, created_at, sent_at, signed_at, " +
    "expires_at, recipient_name, recipient_email, template_id, workspace_id",
  )
  .limit(3);
assertOk("select contract (11 cols, DocuSeal record)", contracts);
assertShape("contract shape", contracts.data, [
  "contract_id",
  "status",
  "contract_type",
  "recipient_email",
  "template_id",
]);

// ── 3. employment_contract — HR/payroll dimension ────────────────────────────
// Capability: contract / explainContractClause + getIntakeProgress
// Columns from database.types.ts employment_contract.Row:
//   contract_id (PK), profile_id, workspace_id, status, contract_status,
//   employment_form, employment_role, employment_category, start_date,
//   framework_snapshot, position_title, source
const empContracts = await sb
  .from("employment_contract")
  .select(
    "contract_id, profile_id, workspace_id, status, contract_status, " +
    "employment_form, employment_role, employment_category, start_date, " +
    "framework_snapshot, position_title, source",
  )
  .limit(3);
assertOk("select employment_contract (12 cols incl framework_snapshot)", empContracts);
assertShape("employment_contract shape", empContracts.data, [
  "contract_id",
  "profile_id",
  "workspace_id",
  "status",
  "framework_snapshot",
]);

// ── 4. contract_obligation — obligation lifecycle ─────────────────────────────
// Capability: contract (obligation management)
// Columns from database.types.ts contract_obligation.Row:
//   id, contract_id, workspace_id, obligation_type, status, is_blocker,
//   reference_text, due_at, due_within_days, started_at, completed_at,
//   notified_at, waived_at, waived_by_user_id, waived_reason, created_at, updated_at
const obligations = await sb
  .from("contract_obligation")
  .select(
    "id, contract_id, workspace_id, obligation_type, status, is_blocker, " +
    "reference_text, due_at, due_within_days, started_at, completed_at, " +
    "notified_at, waived_at, waived_by_user_id, waived_reason, created_at, updated_at",
  )
  .limit(3);
assertOk("select contract_obligation (17 cols)", obligations);

// ── 5. contract_amendment — amendment lifecycle ──────────────────────────────
// Columns from database.types.ts contract_amendment.Row:
//   id, contract_id, workspace_id, status, amendment_date, change_summary,
//   field_changes, is_constructive_dismissal_risk, requires_employee_signature,
//   signed_by_employee_at, signed_by_employer_at, rejected_at, created_at, updated_at
const amendments = await sb
  .from("contract_amendment")
  .select(
    "id, contract_id, workspace_id, status, amendment_date, change_summary, " +
    "field_changes, is_constructive_dismissal_risk, requires_employee_signature, " +
    "signed_by_employee_at, signed_by_employer_at, rejected_at, " +
    "created_at, updated_at",
  )
  .limit(3);
assertOk("select contract_amendment (14 cols)", amendments);

// ── 6. contract_event — audit trail ──────────────────────────────────────────
// Columns from database.types.ts contract_event.Row:
//   id, contract_id, workspace_id, event_type, actor_type, actor_id,
//   details, user_agent, ip_address, created_at
const events = await sb
  .from("contract_event")
  .select(
    "id, contract_id, workspace_id, event_type, actor_type, actor_id, " +
    "details, user_agent, created_at",
  )
  .limit(3);
assertOk("select contract_event (9 cols, audit trail)", events);

// ── 7. compliance_drift view ──────────────────────────────────────────────────
// Used by getComplianceDriftForContract — this is a view, not a table.
// Columns from database.types.ts compliance_drift.Row:
//   contract_id, workspace_id, profile_id, framework_id, framework_snapshot,
//   drift, computed_at
const drift = await sb
  .from("compliance_drift")
  .select(
    "contract_id, workspace_id, profile_id, framework_id, " +
    "framework_snapshot, drift, computed_at",
  )
  .limit(3);
assertOk("select compliance_drift (7 cols, view)", drift);

// ── 8. check_contract_intake_completion RPC signature ────────────────────────
// Used by: contract-intake / submitFieldGroup (post-save completion check)
// Args: { p_profile_id: string; p_workspace_id: string } → Returns: Json
// Calling with synthetic UUIDs — expect either null or { complete: false }
// because no real intake data exists. The goal is confirming the function
// exists and the arg schema hasn't drifted.
const PROBE_UUID = "00000000-0000-0000-0000-000000000001";
const intakeCompletion = await sb.rpc("check_contract_intake_completion", {
  p_profile_id: PROBE_UUID,
  p_workspace_id: PROBE_UUID,
});
assertOk("rpc check_contract_intake_completion (signature smoke)", intakeCompletion);

// ── 9. anonymize_contract (GDPR path) — batch overload signature ──────────────
// database.types.ts has two overloads:
//   anonymize_contract({ p_contract_id: string }) → undefined
//   anonymize_contract({ p_dry_run?: boolean; p_workspace_id?: string }) → table rows
// We call the batch/dry-run overload with p_dry_run=true to prove existence
// without mutating any data. Returns array of { contract_id, cutoff, status, ... }.
const anonymize = await sb.rpc("anonymize_contract", { p_dry_run: true });
assertOk("rpc anonymize_contract (dry_run=true, GDPR path)", anonymize);

result();
