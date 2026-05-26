// scripts/live-invoke/payroll.mjs
// Live-invoke smoke for the payroll domain — see scripts/live-invoke/README.md.
//
// L-0348 protection: column drift on payroll schema tables that mocks miss.
// Promoted to systemic rule 2026-05-25 after 3rd occurrence in C1 scheduler +
// Phase 1 turnus. Column lists are sourced EXCLUSIVELY from
// packages/supabase/src/database.types.ts Row types — NEVER from migration SQL.
//
// Design choices:
//   1. payroll schema tables are accessed via .schema("payroll").from("<table>")
//      matching the exact call pattern in packages/ai/src/capabilities/payroll/tools.ts.
//      Do NOT omit .schema("payroll") — supabase-js defaults to public schema and the
//      call will 404 silently or return an unrelated public table if names clash.
//   2. Caller = service role → auth.uid() is null → RLS returns empty for
//      workspace-scoped rows. That is expected: we prove signature, not data presence.
//   3. tariff_rate_table lives in the PUBLIC schema (workspace_id IS NULL for K1a
//      platform-level rows) — queried without .schema() prefix.
//   4. employee_payroll_profile also lives in PUBLIC schema (public.employee_payroll_profile).
//   5. Empty result on assertShape is OK — empty signals signature OK, not drift.
//
// Smoke coverage (7 assertions — 6 reads):
//   A. payroll.period            — payroll schema table, core approval loop
//   B. payroll.supplement_rule   — payroll schema table, tariff Phase 7f critical path
//   C. payroll.timebank_entry    — payroll schema table, TOIL / overtime bank
//   D. payroll.workspace_settings — payroll schema table, per-workspace config
//   E. payroll.manual_supplement — payroll schema table, ad-hoc supplement claims
//   F. public.tariff_rate_table  — public schema, K1a platform rates (Phase 7f)
//   G. public.employee_payroll_profile — public schema, per-employee salary config
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/payroll.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("payroll");

// ── A. payroll.period — the payroll approval lifecycle table ─────────────────
// Production: tools.ts L873-874 reads .schema("payroll").from("period")
// Row keys from database.types.ts payroll.Tables.period.Row (12 cols).
const periods = await sb
  .schema("payroll")
  .from("period")
  .select(
    "id, workspace_id, start_date, end_date, status, " +
    "approved_at, approved_by, locked_at, locked_by, " +
    "exported_at, created_at, updated_at",
  )
  .limit(1);
assertOk("payroll.period select (12 cols)", periods);
assertShape("payroll.period shape", periods.data, [
  "id",
  "workspace_id",
  "start_date",
  "end_date",
  "status",
  "approved_at",
  "approved_by",
  "locked_at",
  "locked_by",
  "exported_at",
  "created_at",
  "updated_at",
]);

// ── B. payroll.supplement_rule — tariff Phase 7f critical path ───────────────
// Production: tools.ts reads supplement rules when computing tariff-bound pay.
// Row keys from database.types.ts payroll.Tables.supplement_rule.Row (32 cols).
// Asserting a key subset: the ADR-0356 union-binding cols + core identity cols.
const suppRules = await sb
  .schema("payroll")
  .from("supplement_rule")
  .select(
    "id, workspace_id, name, supplement_type, rate_type, rate_value, " +
    "is_active, salary_code, weekdays, time_window_start, time_window_end, " +
    "employee_group_ids, shift_type_ids, sort_order, created_at, updated_at",
  )
  .limit(1);
assertOk("payroll.supplement_rule select (16-col subset)", suppRules);
assertShape("payroll.supplement_rule shape", suppRules.data, [
  "id",
  "workspace_id",
  "name",
  "supplement_type",
  "rate_type",
  "rate_value",
  "is_active",
  "weekdays",
  "sort_order",
  "created_at",
  "updated_at",
]);

// ── C. payroll.timebank_entry — TOIL / overtime bank ─────────────────────────
// Production: tools.ts L1126-1127 reads .schema("payroll").from("timebank_entry")
// Row keys from database.types.ts payroll.Tables.timebank_entry.Row (15 cols).
const timebankEntries = await sb
  .schema("payroll")
  .from("timebank_entry")
  .select(
    "id, workspace_id, profile_id, entry_type, account_type, hours, " +
    "value_amount, value_unit, effective_date, expiry_date, " +
    "payroll_calculation_id, schedule_absence_id, " +
    "description, created_by, created_at",
  )
  .limit(1);
assertOk("payroll.timebank_entry select (15 cols)", timebankEntries);
assertShape("payroll.timebank_entry shape", timebankEntries.data, [
  "id",
  "workspace_id",
  "profile_id",
  "entry_type",
  "account_type",
  "hours",
  "value_amount",
  "value_unit",
  "effective_date",
  "created_at",
]);

// ── D. payroll.workspace_settings — per-workspace payroll config ─────────────
// Production: read before calculating periods, overtime, punch rules.
// Row keys from database.types.ts payroll.Tables.workspace_settings.Row (37 cols).
// Asserting the critical columns that Phase 7f tariff tools depend on.
const wsSettings = await sb
  .schema("payroll")
  .from("workspace_settings")
  .select(
    "id, workspace_id, period_type, period_start_day, " +
    "is_tariff_bound, active_binding_id, active_union_id, " +
    "overtime_requires_pre_approval, overtime_warn_threshold_minutes, " +
    "vacation_pay_pct, pension_pct, employer_social_security_pct, " +
    "supplement_stacking_policy, shift_grouping, " +
    "toil_default_max_banked_hours, created_at, updated_at",
  )
  .limit(1);
assertOk("payroll.workspace_settings select (17-col subset)", wsSettings);
assertShape("payroll.workspace_settings shape", wsSettings.data, [
  "id",
  "workspace_id",
  "period_type",
  "period_start_day",
  "is_tariff_bound",
  "active_binding_id",
  "active_union_id",
  "vacation_pay_pct",
  "pension_pct",
  "created_at",
  "updated_at",
]);

// ── E. payroll.manual_supplement — ad-hoc supplement claims ─────────────────
// Production: tools.ts L1682-1683 reads .schema("payroll").from("manual_supplement")
// Row keys from database.types.ts payroll.Tables.manual_supplement.Row (12 cols).
const manualSupplements = await sb
  .schema("payroll")
  .from("manual_supplement")
  .select(
    "id, workspace_id, schedule_shift_id, supplement_rule_id, " +
    "added_by, amount, description, salary_code, " +
    "status, employee_comment, reviewed_at, reviewed_by, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("payroll.manual_supplement select (14 cols incl updated_at)", manualSupplements);
assertShape("payroll.manual_supplement shape", manualSupplements.data, [
  "id",
  "workspace_id",
  "schedule_shift_id",
  "added_by",
  "amount",
  "description",
  "status",
  "created_at",
  "updated_at",
]);

// ── F. public.tariff_rate_table — K1a platform-level tariff rates ─────────────
// PUBLIC schema (no .schema() prefix). workspace_id IS NULL for K1a rows.
// Phase 7f: tariff tools read this table for rate lookups.
// Row keys from database.types.ts public.Tables.tariff_rate_table.Row (18 cols).
// L-0348 NOTE: framework_rule has NO workspace_id (K1a platform) — this table
//   similarly has nullable workspace_id. Do not filter by workspace_id for platform rows.
const tariffRates = await sb
  .from("tariff_rate_table")
  .select(
    "id, workspace_id, rate_type, amount, unit, law_version, " +
    "effective_from, effective_until, source, paragraf_ref, " +
    "role_class, seniority_level, seniority_years, profession_id, " +
    "verbatim_pending, provenance, seeded_at, " +
    "seeded_from_framework_binding_id, created_at, updated_at",
  )
  .limit(1);
assertOk("public.tariff_rate_table select (20 cols)", tariffRates);
assertShape("public.tariff_rate_table shape", tariffRates.data, [
  "id",
  "rate_type",
  "amount",
  "unit",
  "law_version",
  "effective_from",
  "source",
  "verbatim_pending",
  "provenance",
  "created_at",
  "updated_at",
]);

// ── G. public.employee_payroll_profile — per-employee salary config ───────────
// PUBLIC schema. Core read in payroll tools (L157, L308, L716, L1038, L1054).
// Row keys from database.types.ts public.Tables.employee_payroll_profile.Row (38 cols).
// Asserting the Phase 7 salary + tax-card columns that caused drift in prior sorties.
const payrollProfiles = await sb
  .from("employee_payroll_profile")
  .select(
    "id, profile_id, workspace_id, salary_type, monthly_salary, hourly_rate, " +
    "agreed_weekly_hours, currency, overtime_mode, " +
    "tax_card_type, tax_card_year, tax_percentage, tax_table_number, " +
    "pension_opt_out, pension_scheme_id, trade_union_member, " +
    "tariff_category, tariff_override_id, has_fagbrev, " +
    "seniority_start_date, sector_experience_years, " +
    "employee_number, payroll_tripletex_employee_id, payroll_sync_status, " +
    "payroll_last_synced_at, valid_from, valid_until, " +
    "seeded_at, seeded_from_template_id, created_at, updated_at",
  )
  .limit(1);
assertOk("public.employee_payroll_profile select (31-col subset)", payrollProfiles);
assertShape("public.employee_payroll_profile shape", payrollProfiles.data, [
  "id",
  "profile_id",
  "workspace_id",
  "salary_type",
  "overtime_mode",
  "tariff_category",
  "tax_card_type",
  "pension_opt_out",
  "trade_union_member",
  "seniority_start_date",
  "valid_from",
  "created_at",
  "updated_at",
]);

result();
