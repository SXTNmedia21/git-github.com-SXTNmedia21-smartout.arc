// scripts/live-invoke/billing.mjs
// Live-invoke smoke for the billing domain — see scripts/live-invoke/README.md.
//
// L-0348 protection: column drift on billing schema + public-schema billing tables
// that mocks miss. Column lists sourced EXCLUSIVELY from
// packages/supabase/src/database.types.ts Row types — NEVER from migration SQL.
//
// Design choices:
//   1. Core billing schema tables use .schema("billing").from("<table>") — same
//      pattern as payroll.mjs. Omitting .schema("billing") silently falls through
//      to public schema and 404s or hits an unrelated table.
//   2. billing.invoice, billing.dunning_state, billing.pricing_terms do NOT exist
//      as billing-schema tables. The prompt listed them as aspirational; actual
//      schema placement per database.types.ts (verified 2026-05-26):
//        - public.invoice (line 10876 in database.types.ts)
//        - public.pricing_terms (line 15103)
//        - public.dunning_escalation_log (line 7691) — no dunning_state table exists
//      These are queried without .schema() prefix (public schema default).
//   3. billing schema tables confirmed in database.types.ts billing block (lines 10-268):
//        billing.settlement_run, billing.settlement_period, billing.settlement_artifact,
//        billing.accountant_company_grant
//   4. Caller = service role → auth.uid() null → RLS returns empty for user-scoped
//      rows. Expected: proves signature + column integrity, not data presence.
//   5. billing.v_workspace_kartotek_summary view provides cross-company visibility
//      for the admin accountant portal — included as critical read.
//
// Smoke coverage (9 assertions — 7 reads + 1 RPC + 1 view):
//   A. billing.settlement_run         — core settlement lifecycle table
//   B. billing.settlement_period      — workspace-scoped period status
//   C. billing.settlement_artifact    — PDF/CSV output per run
//   D. billing.accountant_company_grant — accountant portal access grants
//   E. public.invoice                 — merchant invoice (most business-critical)
//   F. public.pricing_terms           — pricing config, invoicing dependency
//   G. public.dunning_escalation_log  — auto-dunning audit trail
//   H. billing.list_unsettled_workspaces (RPC) — used by dunning + accountant portal
//   I. billing.v_workspace_kartotek_summary (view) — admin kartotek read
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/billing.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("billing");

// ── A. billing.settlement_run — core settlement lifecycle ────────────────────
// Row shape: 12 cols per database.types.ts billing.Tables.settlement_run.Row
// NOTE: no workspace_id here — scope is workspace_ids[] array (multi-workspace runs).
const settlementRuns = await sb
  .schema("billing")
  .from("settlement_run")
  .select(
    "run_id, scope, status, initiated_by, period_start, period_end, " +
    "workspace_ids, summary, started_at, completed_at, error_message, created_at",
  )
  .limit(1);
assertOk("billing.settlement_run select (12 cols)", settlementRuns);
assertShape("billing.settlement_run shape", settlementRuns.data, [
  "run_id",
  "scope",
  "status",
  "initiated_by",
  "period_start",
  "period_end",
  "workspace_ids",
  "summary",
  "started_at",
  "created_at",
]);

// ── B. billing.settlement_period — workspace-scoped period status ─────────────
// Row shape: 11 cols per database.types.ts billing.Tables.settlement_period.Row
// PK is period_id (not id). workspace_id present (workspace-scoped table).
const settlementPeriods = await sb
  .schema("billing")
  .from("settlement_period")
  .select(
    "period_id, workspace_id, period_start, period_end, status, " +
    "locked_at, locked_by, closed_at, closed_by, created_at, updated_at",
  )
  .limit(1);
assertOk("billing.settlement_period select (11 cols)", settlementPeriods);
assertShape("billing.settlement_period shape", settlementPeriods.data, [
  "period_id",
  "workspace_id",
  "period_start",
  "period_end",
  "status",
  "created_at",
  "updated_at",
]);

// ── C. billing.settlement_artifact — PDF/CSV output per run ──────────────────
// Row shape: 7 cols per database.types.ts billing.Tables.settlement_artifact.Row
// No created_at/updated_at — use generated_at instead. No workspace_id (run-scoped).
const artifacts = await sb
  .schema("billing")
  .from("settlement_artifact")
  .select(
    "artifact_id, run_id, artifact_type, storage_path, mime_type, " +
    "file_size_bytes, generated_at",
  )
  .limit(1);
assertOk("billing.settlement_artifact select (7 cols)", artifacts);
assertShape("billing.settlement_artifact shape", artifacts.data, [
  "artifact_id",
  "run_id",
  "artifact_type",
  "storage_path",
  "mime_type",
  "generated_at",
]);

// ── D. billing.accountant_company_grant — accountant portal access ────────────
// Row shape: 10 cols per database.types.ts billing.Tables.accountant_company_grant.Row
// PK is grant_id. No workspace_id (company-scoped, not workspace-scoped).
const grants = await sb
  .schema("billing")
  .from("accountant_company_grant")
  .select(
    "grant_id, company_id, user_id, scope, granted_at, granted_by, " +
    "revoked_at, revoked_by, revoke_reason, created_at, updated_at",
  )
  .limit(1);
assertOk("billing.accountant_company_grant select (11 cols)", grants);
assertShape("billing.accountant_company_grant shape", grants.data, [
  "grant_id",
  "company_id",
  "user_id",
  "scope",
  "granted_at",
  "granted_by",
  "created_at",
  "updated_at",
]);

// ── E. public.invoice — merchant invoice (most business-critical table) ───────
// PUBLIC schema (no .schema() prefix). 27 cols per database.types.ts public.invoice.Row.
// PK is invoice_id (not id). company_id scoped (not workspace_id).
// dunning_status and ehf_exported_at are billing-domain critical for Fase 3B Peppol.
const invoices = await sb
  .from("invoice")
  .select(
    "invoice_id, company_id, invoice_number, invoice_type, status, " +
    "amount_excl_vat, amount_incl_vat, vat_amount, vat_rate, currency, " +
    "period_from, period_to, pricing_terms_id, issued_at, due_at, sent_at, " +
    "paid_at, payment_date, payment_reference, payment_channel, " +
    "dunning_status, ehf_exported_at, " +
    "credits_invoice_id, void_reason, voided_at, voided_by, " +
    "created_by, created_at, updated_at",
  )
  .limit(1);
assertOk("public.invoice select (29 cols incl Peppol + dunning cols)", invoices);
assertShape("public.invoice shape", invoices.data, [
  "invoice_id",
  "company_id",
  "invoice_type",
  "status",
  "amount_excl_vat",
  "amount_incl_vat",
  "vat_amount",
  "currency",
  "period_from",
  "period_to",
  "dunning_status",
  "ehf_exported_at",
  "created_at",
  "updated_at",
]);

// ── F. public.pricing_terms — pricing config, invoicing dependency ────────────
// PUBLIC schema. 24 cols per database.types.ts public.pricing_terms.Row.
// PK is pricing_terms_id. company_id scoped; workspace_id nullable (company-wide terms).
// agreement_period typed as `unknown` in database.types.ts — Postgres range type.
const pricingTerms = await sb
  .from("pricing_terms")
  .select(
    "pricing_terms_id, company_id, workspace_id, contract_id, " +
    "billing_interval, currency, delivery_channel, invoice_format, " +
    "price_per_employee, free_users, overage_price_per_user, monthly_cost, " +
    "payment_terms_days, discount_percent, discount_label, " +
    "onboarding_cost, onboarding_package, trial_days, " +
    "effective_from, effective_until, notes, " +
    "created_by, created_at, updated_at",
  )
  .limit(1);
assertOk("public.pricing_terms select (24 cols)", pricingTerms);
assertShape("public.pricing_terms shape", pricingTerms.data, [
  "pricing_terms_id",
  "company_id",
  "billing_interval",
  "currency",
  "price_per_employee",
  "free_users",
  "payment_terms_days",
  "effective_from",
  "created_at",
  "updated_at",
]);

// ── G. public.dunning_escalation_log — auto-dunning audit trail ───────────────
// PUBLIC schema. 5 cols per database.types.ts public.dunning_escalation_log.Row.
// PK is log_id (integer serial, NOT uuid). Tied to invoice_id.
// NOTE: no dunning_state table exists in database.types.ts — dunning_escalation_log
//       is the actual audit table for dunning stage transitions.
const dunningLog = await sb
  .from("dunning_escalation_log")
  .select(
    "log_id, invoice_id, from_stage, to_stage, escalated_at",
  )
  .limit(1);
assertOk("public.dunning_escalation_log select (5 cols)", dunningLog);
assertShape("public.dunning_escalation_log shape", dunningLog.data, [
  "log_id",
  "invoice_id",
  "to_stage",
  "escalated_at",
]);

// ── H. billing.list_unsettled_workspaces RPC — dunning + accountant portal ───
// Returns [{workspace_id, workspace_name, company_id, company_name,
//            period_id, period_start, period_end, period_status}]
// p_user_id with service role = no grants → empty result expected (signature OK).
const listUnsettled = await sb
  .schema("billing")
  .rpc("list_unsettled_workspaces", {
    p_period_end: new Date().toISOString().slice(0, 10),
    p_user_id: "00000000-0000-0000-0000-000000000000",
  });
assertOk("billing.rpc list_unsettled_workspaces (empty OK, signature proven)", listUnsettled);

// ── I. billing.v_workspace_kartotek_summary — admin kartotek view ─────────────
// View shape: 15 cols per database.types.ts billing.Views.v_workspace_kartotek_summary.Row.
// Aggregates invoice + subscription state per workspace for accountant portal.
const kartotek = await sb
  .schema("billing")
  .from("v_workspace_kartotek_summary")
  .select(
    "workspace_id, workspace_name, workspace_slug, " +
    "company_id, company_name, company_org_number, company_created_at, " +
    "subscription_plan, subscription_status, " +
    "invoice_count_total, invoice_count_outstanding, amount_outstanding_incl_vat, " +
    "last_invoice_at, last_paid_at, member_count",
  )
  .limit(1);
assertOk("billing.v_workspace_kartotek_summary view (15 cols)", kartotek);
assertShape("billing.v_workspace_kartotek_summary shape", kartotek.data, [
  "workspace_id",
  "company_id",
  "subscription_plan",
  "subscription_status",
  "invoice_count_total",
  "amount_outstanding_incl_vat",
]);

result();
