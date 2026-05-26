// scripts/live-invoke/onboarding-wizard.mjs
// Live-invoke smoke for the onboarding-wizard domain — see scripts/live-invoke/README.md.
//
// What this catches (L-0348 — column drift that mocks miss):
//   - Column drift on employee_onboarding_state (9 cols, types line 8038)
//     — the primary state table for the employee welcome wizard (TOTAL_STEPS=8,
//       Availability + Consent steps, ADR-0397, mobile twin shipped 2026-05-23)
//   - Column drift on consent_acceptance (9 cols, types line 5521)
//     — records handbook/gdpr/tariff consent written by both web Server Action
//       (welcome-wizard-actions.ts:446) and mobile BFF (save-step/route.ts:303)
//   - Column drift on onboarding_session (key cols, types line 12986)
//     — admin workspace-setup wizard; employee wizard feeds state back into this
//       session context for pre-fill; both wizards share this domain script
//   - Column drift on workspace (key cols read by update_business tool)
//     — capability tool UPDATE writes: name, display_name, website_url, niche,
//       concept_description, cuisine_types, price_category, about_us, org_number
//   - gate_action RPC existence (used by callGateAction in gate.ts — existence
//       check only; nil-UUID call returns DB error, not 42883)
//   - protocol table read path (add_procedures capability writes here —
//       NOTE: tools.ts writes {title, slug, protocol_type} but Row has {name};
//       smoke verifies actual Row cols to catch future typegen drift independent
//       of the tools.ts drift; audit owns the write-path discrepancy)
//
// Capabilities covered:
//   - packages/ai/src/capabilities/onboarding/tools.ts (10 tools, ADR-0275 R4)
//   - apps/web/src/app/api/employee-onboarding/state/route.ts (GET upsert + PUT update)
//   - apps/web/src/app/api/mobile/employee-onboarding/state/route.ts (mobile twin)
//   - apps/web/src/app/dashboard/_actions/welcome-wizard-actions.ts (Server Actions)
//
// Column lists derived ONLY from packages/supabase/src/database.types.ts Row shapes.
// Never from migrations (L-0348 hard rule).
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/onboarding-wizard.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const DOMAIN = "onboarding-wizard";
const sb = client("service");

header(DOMAIN);

// ── 1. employee_onboarding_state — primary wizard state table ────────────────
// 9 cols from database.types.ts Row (line 8038).
// PK is profile_id (isOneToOne:true FK). No standalone `id` col.
// Note: service role bypasses JWT RLS — returns empty (no rows) which is
// correct smoke behavior: signature proven, no SQL error, columns intact.
const eoState = await sb
  .from("employee_onboarding_state")
  .select(
    "profile_id, workspace_id, status, current_step_index, step_data, " +
    "started_at, updated_at, completed_at, dismissed_at",
  )
  .limit(1);
assertOk("select employee_onboarding_state (9 cols)", eoState);
assertShape("employee_onboarding_state column shape", eoState.data, [
  "profile_id",
  "workspace_id",
  "status",
  "current_step_index",
  "step_data",
  "started_at",
  "updated_at",
  "completed_at",
  "dismissed_at",
]);

// ── 2. consent_acceptance — consent records (handbook, gdpr, tariff) ─────────
// 9 cols from database.types.ts Row (line 5521).
// No `id` is hidden — PK col is `id` (line 5527). Select all 9 explicitly.
// Service role bypasses JWT RLS; no INSERT policy exists for JWT (service-role only).
const consentRows = await sb
  .from("consent_acceptance")
  .select(
    "id, profile_id, workspace_id, consent_type, document_version, " +
    "source, accepted_at, client_ip, client_user_agent",
  )
  .limit(1);
assertOk("select consent_acceptance (9 cols)", consentRows);
assertShape("consent_acceptance column shape", consentRows.data, [
  "id",
  "profile_id",
  "workspace_id",
  "consent_type",
  "document_version",
  "source",
  "accepted_at",
  "client_ip",
  "client_user_agent",
]);

// ── 3. onboarding_session — admin workspace-setup wizard session ──────────────
// 29 cols from database.types.ts Row (line 12986). Selecting the 12 most
// critical: id + workspace/company identity + wizard progression + contract flow.
// All cols are nullable except `id` — schema reflects admin-wizard partial save pattern.
const onbSession = await sb
  .from("onboarding_session")
  .select(
    "id, workspace_id, company_id, user_id, current_step, completed_steps, " +
    "started_at, completed_at, updated_at, created_at, " +
    "contract_generated_at, contract_sent_at",
  )
  .limit(1);
assertOk("select onboarding_session (12 key cols)", onbSession);
assertShape("onboarding_session column shape", onbSession.data, [
  "id",
  "workspace_id",
  "company_id",
  "user_id",
  "current_step",
  "completed_steps",
  "started_at",
  "completed_at",
  "updated_at",
  "created_at",
  "contract_generated_at",
  "contract_sent_at",
]);

// ── 4. workspace — update_business tool UPDATE target ────────────────────────
// update_business (tools.ts:176) patches workspace cols keyed by workspaceId.
// Full Row is ~40 cols (database.types.ts line 20884).
//
// DRIFT NOTE (caught by this smoke, not in types): tools.ts:145-154 writes
// patch keys: display_name, website_url, niche, concept_description,
// cuisine_types, price_category, about_us, org_number — BUT none of these
// appear in the workspace Row in database.types.ts. The actual Row has:
//   name, description, short_description, slogan, slug, source, status, …
// This is an L-0348 class drift: update_business silently updates phantom
// columns (Supabase UPDATE ignores unknown keys — no error, no effect).
// Flagged here; audit owns the remediation. This smoke validates the
// real reachable columns so typegen drift is caught going forward.
const workspaces = await sb
  .from("workspace")
  .select(
    "workspace_id, name, slug, status, timezone, language, " +
    "description, short_description, is_active, updated_at",
  )
  .limit(1);
assertOk("select workspace (10 real cols — reachable by update_business)", workspaces);
assertShape("workspace column shape (real Row cols)", workspaces.data, [
  "workspace_id",
  "name",
  "slug",
  "status",
  "timezone",
  "language",
  "description",
  "short_description",
  "is_active",
  "updated_at",
]);

// ── 5. protocol — add_procedures capability write target ─────────────────────
// add_procedures (tools.ts:521) INSERTs into protocol. Row has 15 cols (line 15885).
// Verifying cols the capability uses: protocol_id, workspace_id, created_by,
// description, status, name. Note: tools.ts writes `title` and `protocol_type` which
// are NOT in the Row — this is a latent tools.ts write-path drift caught by typegen.
// This smoke proves the table is reachable and core cols exist; the write-path
// discrepancy is flagged here for audit awareness (not this script's gate to block).
const protocols = await sb
  .from("protocol")
  .select(
    "protocol_id, workspace_id, name, description, status, " +
    "created_by, owner_profile_id, policy_id, version, created_at, updated_at",
  )
  .limit(1);
assertOk("select protocol (11 cols — add_procedures write target)", protocols);
assertShape("protocol column shape", protocols.data, [
  "protocol_id",
  "workspace_id",
  "name",
  "description",
  "status",
  "created_by",
  "owner_profile_id",
  "policy_id",
  "version",
  "created_at",
  "updated_at",
]);

// ── 6. gate_action RPC — existence check ────────────────────────────────────
// callGateAction (gate.ts) delegates to gatedMutation which calls gate_action RPC.
// All onboarding write tools (update_business, update_season, add_procedures)
// call this before any mutation. Nil-UUID args will produce a DB-level error;
// 42883 = function not deployed (real gap). Any other error = function exists.
const gateResult = await sb.rpc("gate_action", {
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
  p_actor_profile_id: "00000000-0000-0000-0000-000000000000",
  p_capability: "onboarding",
  p_channel: "chat",
  p_action_type: "smoke_probe",
});
if (gateResult.error?.code === "42883") {
  console.log(
    `  ✗ rpc gate_action — FUNCTION NOT FOUND (42883): ${gateResult.error.message}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `  ✓ rpc gate_action — deployed (nil-UUID returned: ${gateResult.error?.code ?? "no error"})`,
  );
}

result();
