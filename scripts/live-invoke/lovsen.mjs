// scripts/live-invoke/lovsen.mjs
// Live-invoke smoke for the lovsen domain — see scripts/live-invoke/README.md.
//
// What this catches:
//   - Column drift on K1a platform tables (regulatory_framework, framework_rule,
//     framework_trigger, tariff_rate_table WHERE workspace_id IS NULL)
//   - Column drift on workspace_framework_binding (workspace→K1a join)
//   - Column drift on payroll.consent_document (validate_aml_14_15 read path)
//   - RPC / table existence — the L-0348 family that mocks miss
//
// Key architecture facts (verified against packages/supabase/src/database.types.ts):
//   - regulatory_framework has NO workspace_id — K1a platform-level (line 16116-16168)
//   - framework_rule has NO workspace_id — K1a platform-level (line 9912-9979)
//   - framework_trigger has NO workspace_id — K1a platform-level (line 9980-10038)
//   - tariff_rate_table.workspace_id IS NULL for K1a rows (line 19715-19738)
//   - workspace_framework_binding has workspace_id (line 21467-21521) — join table
//   - consent_document lives in payroll schema (line 294, 704) — payroll.consent_document
//
// Capability tools.ts read paths (packages/ai/src/capabilities/legal/tools.ts):
//   - validate_aml_14_6:  employment_contract + regulatory_framework + framework_rule
//   - validate_aml_14_15: payroll.consent_document (via aml-14-15.ts validateAml1415Logic)
//   - cite_law:           stub (Phase 0c+) — future: regulatory_framework + framework_rule
//   - classify_amendment: stub (Phase 0c+) — no DB reads in current body
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/lovsen.mjs

import { createClient } from "@supabase/supabase-js";
import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

// payroll schema client — same URL/key, different schema option.
// Mirrors aml-14-15.ts line 65: supabaseAdmin.schema("payroll")
function requireEnv(name) {
  const v = process.env[name];
  if (!v || v.startsWith("op://")) {
    console.error(`[live-invoke] ENV missing or unresolved: ${name}`);
    process.exit(2);
  }
  return v;
}
const sbPayroll = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    db: { schema: "payroll" },
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

header("lovsen");

// ── 1. regulatory_framework — K1a platform-level ────────────────────────────
// Capability: validate_aml_14_6 reads this to resolve framework_id by code.
// tools.ts line 196-200: .from("regulatory_framework").select("framework_id").eq("code", "hospitality.no.default.v1")
// Row columns from database.types.ts line 16117-16130:
//   framework_id, code, name, industry, jurisdiction, is_active, version,
//   parent_framework_id, metadata, description, created_at, updated_at
// NO workspace_id — K1a platform rows only.
const frameworks = await sb
  .from("regulatory_framework")
  .select(
    "framework_id, code, name, industry, jurisdiction, is_active, " +
    "version, parent_framework_id, metadata, description, created_at, updated_at",
  )
  .limit(3);
assertOk("select regulatory_framework (12 cols, K1a platform — no workspace_id)", frameworks);
assertShape("regulatory_framework shape", frameworks.data, [
  "framework_id",
  "code",
  "name",
  "industry",
  "is_active",
  "version",
]);

// ── 2. framework_rule — K1a platform-level (aml.14_6.% rules) ───────────────
// Capability: validate_aml_14_6 reads all 17 bokstav rules for a given framework_id.
// tools.ts line 225-231: .from("framework_rule").select("rule_id, code, evaluation_config, rule_type, severity")
//   .eq("framework_id", ...).like("code", "aml.14_6.%")
// Row columns from database.types.ts line 9913-9931:
//   rule_id, framework_id, code, category, rule_type, severity, description,
//   description_no, evaluation_config, default_outcome, source_reference,
//   outcome_overridable, config_loosen_allowed, config_tighten_allowed,
//   override_min_level, created_at, updated_at
// NO workspace_id — K1a platform rows only.
const rules = await sb
  .from("framework_rule")
  .select(
    "rule_id, framework_id, code, category, rule_type, severity, description, " +
    "description_no, evaluation_config, default_outcome, source_reference, " +
    "outcome_overridable, config_loosen_allowed, config_tighten_allowed, " +
    "override_min_level, created_at, updated_at",
  )
  .limit(5);
assertOk("select framework_rule (17 cols, K1a — no workspace_id)", rules);
assertShape("framework_rule shape", rules.data, [
  "rule_id",
  "framework_id",
  "code",
  "rule_type",
  "severity",
  "evaluation_config",
]);

// ── 3. framework_trigger — K1a platform-level ───────────────────────────────
// Used by the event engine to fire compliance checks when session state changes.
// Row columns from database.types.ts line 9981-9995:
//   trigger_id, framework_id, code, trigger_mode, description, description_no,
//   is_enabled, is_disableable, threshold_tune_allowed, linked_rule_ids,
//   source_entity_type, evaluation_config, created_at, updated_at
// NO workspace_id — K1a platform rows only.
const triggers = await sb
  .from("framework_trigger")
  .select(
    "trigger_id, framework_id, code, trigger_mode, description, description_no, " +
    "is_enabled, is_disableable, threshold_tune_allowed, linked_rule_ids, " +
    "source_entity_type, evaluation_config, created_at, updated_at",
  )
  .limit(5);
assertOk("select framework_trigger (14 cols, K1a — no workspace_id)", triggers);
assertShape("framework_trigger shape", triggers.data, [
  "trigger_id",
  "framework_id",
  "code",
  "trigger_mode",
  "is_enabled",
]);

// ── 4. tariff_rate_table — K1a platform slice (workspace_id IS NULL) ─────────
// Lovsen AUTHORS these rows; payroll READS them.
// K1a slice = WHERE workspace_id IS NULL (workspace-scoped rows have workspace_id set).
// Row columns from database.types.ts line 19716-19738:
//   id, amount, unit, rate_type, effective_from, effective_until, law_version,
//   source, role_class, seniority_level, seniority_years, profession_id,
//   paragraf_ref, provenance, verbatim_pending, seeded_at,
//   seeded_from_framework_binding_id, metadata, workspace_id (nullable), created_at, updated_at
const tariffK1a = await sb
  .from("tariff_rate_table")
  .select(
    "id, amount, unit, rate_type, effective_from, effective_until, law_version, " +
    "source, role_class, seniority_level, seniority_years, profession_id, " +
    "paragraf_ref, provenance, verbatim_pending, seeded_at, " +
    "seeded_from_framework_binding_id, metadata, workspace_id, created_at, updated_at",
  )
  .is("workspace_id", null)
  .limit(3);
assertOk("select tariff_rate_table K1a slice (21 cols, workspace_id IS NULL)", tariffK1a);
assertShape("tariff_rate_table shape", tariffK1a.data, [
  "id",
  "amount",
  "unit",
  "rate_type",
  "effective_from",
  "law_version",
  "source",
  "provenance",
]);

// ── 5. workspace_framework_binding — join table (has workspace_id) ────────────
// Links a workspace to its active K1a regulatory framework.
// validate_aml_14_6 falls back to platform framework when binding absent (tools.ts line 195).
// Row columns from database.types.ts line 21468-21478:
//   id, workspace_id, framework_id, is_active, activated_at, activated_by,
//   deactivated_at, created_at, updated_at
const bindings = await sb
  .from("workspace_framework_binding")
  .select(
    "id, workspace_id, framework_id, is_active, activated_at, activated_by, " +
    "deactivated_at, created_at, updated_at",
  )
  .limit(3);
assertOk("select workspace_framework_binding (9 cols, workspace-scoped join)", bindings);
assertShape("workspace_framework_binding shape", bindings.data, [
  "id",
  "workspace_id",
  "framework_id",
  "is_active",
]);

// ── 6. payroll.consent_document — validate_aml_14_15 read path ───────────────
// aml-14-15.ts line 65-71: supabaseAdmin.schema("payroll").from("consent_document")
//   .select("consent_document_id, workspace_id, employee_profile_id, consent_type, status, signed_at, expires_at")
// Row columns from database.types.ts line 705-719 (payroll schema, line 294):
//   consent_document_id, consent_type, court_order_reference, created_at,
//   docuseal_submission_id, employee_profile_id, expires_at, paragraph_ref,
//   signed_at, signed_document_url, status, superseded_by_id, updated_at, workspace_id
const consentDocs = await sbPayroll
  .from("consent_document")
  .select(
    "consent_document_id, workspace_id, employee_profile_id, consent_type, status, " +
    "signed_at, expires_at, paragraph_ref, court_order_reference, " +
    "docuseal_submission_id, signed_document_url, superseded_by_id, " +
    "created_at, updated_at",
  )
  .limit(3);
assertOk("select payroll.consent_document (14 cols, payroll schema)", consentDocs);
assertShape("payroll.consent_document shape", consentDocs.data, [
  "consent_document_id",
  "workspace_id",
  "employee_profile_id",
  "consent_type",
  "status",
  "signed_at",
]);

result();
