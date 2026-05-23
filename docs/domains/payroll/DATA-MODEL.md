---
title: "Payroll — Data Model"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: payroll
tags: [domain, payroll, data-model, schema, migrations]
---

# Payroll — Data Model

> Actual schema. **Code wins** — verified against migrations. Every table cites the migration that creates or moves it. Enums verified from `supabase/migrations/20260422110000_payroll_enums.sql` + `20260422110500_payroll_absence_enums.sql`.

## Schema overview

The payroll domain spans two schemas:

| Schema | Tables | Notes |
|---|---|---|
| `payroll` | 24 tables (23 moved + 1 new) | Domain-specific schema per ADR-0057. Moved from `public` in `20260422110700_payroll_schema.sql` |
| `public` | 7 domain-owned tables | Cross-cutting tables that other domains also reference |
| `public` (K1a, read-only) | `tariff_rate_table`, `regulatory_framework`, `framework_rule`, `public_holiday` | Platform-seeded Riksavtalen baseline. Payroll reads; never writes. |

---

## `payroll` schema tables

### Core period + calc (Track 1, from `20260422110200_payroll_calculation_tables.sql`)

| Table | Key columns | FKs |
|---|---|---|
| `payroll.period` | `id`, `workspace_id`, `period_start`, `period_end`, `status payroll.period_status`, `locked_by`, `approved_by`, `locked_at` | `workspace_id → workspace`, `locked_by/approved_by → profile` |
| `payroll.calculation` | `id`, `workspace_id`, `period_id`, `schedule_shift_id`, `profile_id`, `employee_group_id`, `shift_type_id`, `derivation_version INT` | `period_id → period`, `schedule_shift_id → schedule_shift`, `profile_id → profile` |
| `payroll.calculation_line` | `id`, `workspace_id`, `calculation_id`, `wage_type payroll.wage_type`, `amount_cents INT`, `hours NUMERIC`, `supplement_rule_id` | `calculation_id → calculation`, `supplement_rule_id → payroll.supplement_rule` |
| `payroll.deviation` | `id`, `workspace_id`, `period_id`, `calculation_id`, `schedule_shift_id`, `profile_id`, `severity payroll.deviation_severity`, `acknowledged_by` | `period_id → period`, `profile_id → profile` |
| `payroll.manual_supplement` | `id`, `workspace_id`, `schedule_shift_id`, `supplement_rule_id`, `amount_cents INT`, `added_by` | `added_by → profile` |
| `payroll.export_event` | `id`, `workspace_id`, `period_id`, `exported_by`, `export_type` | `period_id → period`, `exported_by → profile` |
| `payroll.export_line` | `id`, `workspace_id`, `export_event_id`, `calculation_line_id`, `profile_id` | `export_event_id → export_event` |

### Absence + time-banks (Track 6, from `20260422110600_payroll_absence_tables.sql` + Phase1 `20260527100300_payroll_phase1_time_banks.sql`)

| Table | Key columns | Notes |
|---|---|---|
| `payroll.timebank_entry` | `id`, `workspace_id`, `profile_id`, `entry_type payroll.timebank_entry_type`, `amount_cents INT`, `hours NUMERIC` | Dual-currency (NOK+hours) per ADR-0254 |
| `payroll.sick_leave_period` | `id`, `workspace_id`, `profile_id`, `start_date`, `end_date`, `grade payroll.sick_leave_grade` | |
| `payroll.absence_ledger` | `id`, `workspace_id`, `profile_id`, `ledger_type payroll.absence_ledger_type` | |
| `payroll.absence_quota` | `id`, `workspace_id`, `profile_id`, `quota_type`, `year INT` | |
| `payroll.absence_type` | `id`, `workspace_id`, `name`, `category payroll.absence_category` | |

### Config tables (Track 2, from `20260422110100_payroll_config_tables.sql`)

| Table | Notes |
|---|---|
| `payroll.workspace_settings` | 19+ policy columns + `is_tariff_bound BOOLEAN` (added `20260527100200_payroll_phase1_workspace_policies.sql`) |
| `payroll.supplement_rule` | **Old config table** (renamed from `payroll_supplement_rule`). Supplement type config. Distinct from `public.supplement_rule` (Phase1 DSL). |
| `payroll.break_rule` | Break trigger config |
| `payroll.meal_rule` | Meal deduction/contribution rules |
| `payroll.working_time_rule` | AML working time constraints |
| `payroll.holiday_calendar` | Calendar definition |
| `payroll.holiday_entry` | Individual holiday entries |
| `payroll.salary_code` | Salary code catalog |
| `payroll.shift_type` | Shift type classification |
| `payroll.employee_group` | Employee grouping for payroll |
| `payroll.employee_group_member` | Group membership |

### New post-schema tables

| Table | Migration | Key columns |
|---|---|---|
| `payroll.consent_document` | `20260615110000_create_payroll_consent_document.sql:12` | `id`, `workspace_id`, `profile_id`, `document_type`, `signed_at` — deduction consent per ADR-0311 |

---

## `public` schema — domain-owned tables

| Table | Migration | workspace-scoped | Notes |
|---|---|---|---|
| `employee_payroll_profile` | `20260421100200_cascade_a1_domain_tables.sql:317` | yes | D2 resource. Stillingskode, ansiennitet FK to `employment_contract`, `is_tariff_bound` mirrors workspace setting, `overtime_mode`. Core-structure acknowledges payroll ownership (`docs/domains/core-structure/DATA-MODEL.md:227`). |
| `shift_cost_snapshot` | `20260421100200_cascade_a1_domain_tables.sql:379` | yes | C3 output. Tariff snapshot JSONB frozen at first calc. Author = day-session (after reconciliation approved); consumer = payroll. |
| `shift_pay_calculation_event` | `20260527100700_payroll_phase1_audit_event.sql:23` | yes | **INSERT-only** audit log per ADR-0251. Bokf. §13 — RLS rejects UPDATE/DELETE. `superseded_by_event_id` for supersession chain. |
| `payroll_ledger_archive` | `20260515100500_payroll_ledger_archive.sql:8` | no (company-scoped) | Bubble-migrated archive. Read-only per ADR-0110. No writes. |
| `supplement_rule` | `20260527100600_payroll_phase1_dynamic_supplements.sql:28` | yes | Phase1 DSL supplement rules. Distinct from `payroll.supplement_rule` (old config table). `is_active`, `version_hash` for idempotent eval. |
| `supplement_rule_match` | `20260527100600_payroll_phase1_dynamic_supplements.sql:127` | yes | **Append-only** audit: one row per supplement rule firing per shift. `no_update_supplement_rule_match` + `no_delete_supplement_rule_match` RLS policies (`20260527100600:159,162`). |
| `workspace_union_binding` | `20260618100000_workspace_union_binding_and_tariff_floor.sql:76` | yes | Written by cascade capability on behalf of payroll tariff tools (ADR-0356 delegation). Active binding per workspace. |

---

## `public` schema — K1a platform tables (read-only)

| Table | Notes |
|---|---|
| `tariff_rate_table` | Riksavtalen versioned rates. `effective_from`, `effective_to`, `law_version` per ADR-0252. `workspace_id IS NULL` = platform baseline. Migration: `20260421100200_cascade_a1_domain_tables.sql:259`. |
| `regulatory_framework` | Regulatory framework definitions (K1a). |
| `framework_rule` | Individual rules within a framework. Payroll reads for deviation check logic (W01–W12). |
| `public_holiday` | Norwegian holidays. Used in `interpret-shift.ts` for holiday pay classification. |

---

## Enums (payroll schema, from `20260422110000_payroll_enums.sql` + `20260422110500_payroll_absence_enums.sql`)

| Enum | Final name in `payroll.*` | Values |
|---|---|---|
| `payroll_wage_type` → | `payroll.wage_type` | `hourly`, `per_shift`, `monthly` |
| `payroll_rate_adjustment_type` → | `payroll.rate_adjustment_type` | `none`, `replace`, `add`, `percentage` |
| `payroll_salary_code_category` → | `payroll.salary_code_category` | (multiple — from enums migration) |
| `payroll_supplement_type` → | `payroll.supplement_type` | (multiple supplement type codes) |
| `payroll_supplement_rate_type` → | `payroll.supplement_rate_type` | `fixed_per_hour`, `percentage`, `fixed_per_shift` |
| `payroll_supplement_start_type` → | `payroll.supplement_start_type` | `time_of_day`, `after_shift_start` |
| `payroll_break_trigger_type` → | `payroll.break_trigger_type` | `after_duration`, `time_of_day` |
| `payroll_meal_rule_type` → | `payroll.meal_rule_type` | `deduction`, `contribution` |
| `payroll_period_status` → | `payroll.period_status` | `open`, `locked`, `approved`, `exported` |
| `payroll_deviation_severity` → | `payroll.deviation_severity` | `error`, `warning`, `info` |
| `payroll_rule_severity` → | `payroll.rule_severity` | `block`, `warn` |
| `payroll_custom_rate_type` → | `payroll.custom_rate_type` | `per_hour`, `per_shift` |
| `payroll_absence_category` → | `payroll.absence_category` | (from `20260422110500_payroll_absence_enums.sql:10`) |
| `payroll_absence_ledger_type` → | `payroll.absence_ledger_type` | (from `20260422110500_payroll_absence_enums.sql:29`) |
| `payroll_timebank_entry_type` → | `payroll.timebank_entry_type` | feriepenger/TOIL/wellness variants |
| `payroll_sick_leave_grade` → | `payroll.sick_leave_grade` | graded sick leave levels |

All 16 enums verified moved in `20260422110700_payroll_schema.sql:32-78`.

---

## FK map (key relationships)

```
profile ─────────────────────────── employee_payroll_profile (payroll-domain owned)
profile ── employment_contract ───── (ansiennitet source for seniority_resolver)
schedule_shift ─────────────────── payroll.calculation (per-shift calc row)
schedule_shift ── time_entry ──────── (actual hours; input layer)
payroll.period ─────────────────── payroll.calculation → payroll.calculation_line
payroll.period ─────────────────── payroll.deviation
payroll.period ─────────────────── payroll.export_event → payroll.export_line
shift_cost_snapshot ────────────── (authored by day-session; read by payroll calc engine)
shift_pay_calculation_event ─────── (audit of each calc; INSERT-only)
supplement_rule ────────────────── supplement_rule_match (audit of each rule firing)
workspace_union_binding ─────────── (active tariff binding per workspace)
tariff_rate_table ──────────────── (K1a; rate lookup during snapshotCost)
```

---

## RLS posture

**Standard dual-auth pattern (JWT + API key):** All `payroll.*` and payroll-owned public tables have:
- `jwt_read_*` — `auth.uid()` based read for authenticated workspace members
- `service_role_*` — unrestricted service role access
- PII-sensitive columns (`personal_number`, `tax_card_*`, `bank_account`) — additional `min_role=admin` gate enforced at capability tool level (ADR-0242), not only via RLS

**INSERT-only enforcement:**
- `shift_pay_calculation_event` — `no_update_*` + `no_delete_*` RLS policies per ADR-0251 (`20260527100700_payroll_phase1_audit_event.sql`)
- `supplement_rule_match` — same pattern (`20260527100600_payroll_phase1_dynamic_supplements.sql:159,162`)

**Storage:** `payroll-longsgrunnlag` private bucket — `lonnsgrunnlag_admin_read` + `lonnsgrunnlag_employee_read_own` policies (`20260604000007_payroll_phase4_lonnsgrunnlag_storage.sql:53,77`).

---

## Telemetry events (43 total, namespace `payroll.*`)

Verified from `packages/telemetry/src/registry.ts` — grep anchor `"// Naming: dot convention (payroll.*)"` at line ±7217.

**PII/Profile events:** `payroll.update_payroll_profile`, `payroll.set_pension_scheme`, `payroll.tax_card_queried`, `payroll.salary_queried`, `payroll.admin_filled_pii`, `payroll.personal_number_revealed`, `payroll.bank_account_revealed`

**Period lifecycle:** `payroll.period_created`, `payroll.period_locked`

**Deviations:** `payroll.deviation_acknowledged`, `payroll.deviation_blocked_approval`

**Supplements:** `payroll.manual_supplement_added`, `payroll.manual_supplement_deleted`, `payroll.supplement_rule_fired`, `payroll.supplement_rule_test_run`

**Time-banks:** `payroll.overtime_mode_changed`, `payroll.timebank_accrued`, `payroll.timebank_withdrawn`, `payroll.timebank_payout_forced`, `payroll.timebank_balance_adjusted`

**Recalc:** `payroll.recalc_triggered`, `payroll.recalc_triggered_by_supplement`, `payroll.recalc_triggered_by_tip_distribution`

**Line overrides (C4):** `payroll.line_override_proposed`, `payroll.line_override_approved`, `payroll.line_override_rejected`, `payroll.line_overridden`

**Tariff freeze:** `payroll.tariff_freeze_drift`

**Exports:** `payroll.csv_exported`, `payroll.csv_export_unmasked`, `payroll.csv_export_failed`

**Lønnsgrunnlag (PDF):** `payroll.lonnsgrunnlag_generated`, `payroll.lonnsgrunnlag_url_granted`, `payroll.lonnsgrunnlag_generation_failed`, `payroll.feriepenger_basis_computed`

**Consent (ADR-0311):** `payroll.deduction_consent_referenced`, `payroll.deduction_rejected_no_consent`, `payroll.consent_document.created`

**Tariff tools:** `payroll.workspace_tariff_setup`, `payroll.workspace_tariff_changed`, `payroll.supplement_override_added`, `payroll.tariff_view_loaded`, `payroll.tariff_view_loaded_mobile`

Note: The 11 events originally listed in the spec (`payroll.period_locked`, `payroll.deviation_acknowledged`, `payroll.deviation_blocked_approval`, `payroll.manual_supplement_added`, `payroll.overtime_mode_changed`, `payroll.timebank_accrued`, `payroll.timebank_withdrawn`, `payroll.timebank_payout_forced`, `payroll.supplement_rule_fired`, `payroll.recalc_triggered`, `payroll.tariff_freeze_drift`) are confirmed registered. Actual total is 43 events, expanded through Phases 2–7f.
