---
title: Slice 07 — db-rls-telemetry Audit
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, db-rls-telemetry, adr]
---

## Summary

Top 5 findings ranked by severity:

1. **HIGH** — `public.supplement_rule_match` shipped WITHOUT `api_key_read` in `20260527100600`; fixed in a follow-on migration `20260527101100`. Window of vulnerability: any API-key-authed calc engine call between those two migrations would silently return zero rows. In-progress (campaign/payroll); fix landed same campaign branch.
2. **HIGH** — `payroll.admin_filled_pii` routes to `engine_event` (4 destinations) while sibling PII-reveal events (`personal_number_revealed`, `bank_account_revealed`) intentionally exclude PostHog per ADR-0077. Comment in registry explains engine_event inclusion as "downstream onboarding reactions" — rationale is thin for a PII-fill event; engine_event fanout on raw PII events risks event-subscriber leakage into non-PII-safe consumers.
3. **MEDIUM** — `payroll.timebank_entry` had `api_key_read_payroll_timebank` policy on the pre-move `public.payroll_timebank_entry` table. Schema move (`20260422110700`) uses `ALTER TABLE ... SET SCHEMA` which preserves existing policies by name — BUT the payroll schema tables now require `get_api_workspace_id()` to remain functional, and no post-move policy audit is present in any migration. Risk: low in practice (PostgreSQL preserves policies on SET SCHEMA) but no explicit verification migration exists.
4. **MEDIUM** — `payroll.supplement_rule_test_run` routes to `posthog` only (no `activity_trail`). This is an "Admin preview" event. If a manager or admin uses test-run to probe whether a supplement rule fires for a specific employee, no audit record exists. Potential compliance gap for Arbeidstilsynet inspection scenarios.
5. **LOW** — `payroll.timebank_accrued` routes to `activity_trail` only (no `logger`). High-frequency exclusion from PostHog is intentional per spec §9 comment, but structured stdout via `logger` is absent — makes real-time stage-engine debugging of accrual logic harder.

---

## Findings Table

| ID | Severity | File:Line | ADR | Evidence |
|----|----------|-----------|-----|----------|
| F-07-01 | HIGH | `supabase/migrations/20260527100600_payroll_phase1_dynamic_supplements.sql:~70` | ADR-0029 | `supplement_rule_match` created with `jwt_read` only; no `api_key_read` policy. Calc engine uses API key auth and would return 0 rows silently. Fixed in `20260527101100` same campaign. |
| F-07-02 | HIGH | `packages/telemetry/src/registry.ts:12134` | ADR-0004, ADR-0077 | `payroll.admin_filled_pii` routes to `engine_event`; no comment justifying why PII-fill triggers downstream automation while `personal_number_revealed` + `bank_account_revealed` explicitly exclude engine_event for the inverse reason. Risk of PII data surfacing in event-subscriber context. |
| F-07-03 | MEDIUM | `supabase/migrations/20260422110700_payroll_schema.sql:110–161` | ADR-0029 | `SET SCHEMA` for 23 payroll tables preserves RLS policies by name but no post-move verification migration confirms `get_api_workspace_id()` still resolves. No explicit dual-auth re-audit after schema move. |
| F-07-04 | MEDIUM | `packages/telemetry/src/registry.ts:11489` | ADR-0004 | `payroll.supplement_rule_test_run` → `["posthog"]` only. Admin-initiated rule probe leaves no audit record. Compliance gap for Arbeidstilsynet tariff audits. |
| F-07-05 | MEDIUM | `packages/telemetry/src/registry.ts:11486` | ADR-0004 | `payroll.supplement_rule_fired` → `["activity_trail"]` only. High-frequency exclusion from PostHog intentional; but omission of `logger` blocks real-time stdout visibility in stage-engine. |
| F-07-06 | LOW | `packages/telemetry/src/registry.ts:11463` | ADR-0004 | `payroll.timebank_accrued` → `["activity_trail"]` only; no `logger`. Same pattern as F-07-05; debugging accrual in production requires querying `activity_trail` rather than reading structured logs. |
| F-07-07 | LOW | `supabase/migrations/20260527100000_payroll_phase1_provenance.sql:18` | ADR-0004 | Comment says "Default intentionally retained for Phase 1... Phase 2 will DROP DEFAULT." Phase 2 migrations (`20260602*`) do not contain `ALTER TABLE payroll.calculation ALTER COLUMN provenance DROP DEFAULT`. Default remains; every insert can silently omit provenance and violate ADR-0076 snapshot-and-forward intent. |
| F-07-08 | INFO | `supabase/migrations/20260602000000_payroll_employee_profile_rate_columns.sql` | ADR-0011 | `employee_payroll_profile` columns `hourly_rate`, `monthly_salary`, `remuneration_type`, `currency` added as `ALTER TABLE public.employee_payroll_profile` — correct table name. No ADR-0011 violation. |

---

## Per-ADR Rollup

| ADR | Title | Verdict | Notes |
|-----|-------|---------|-------|
| ADR-0004 | Unified Telemetry & Audit Trail | ⚠️ partial | `supplement_rule_test_run` lacks `activity_trail`. `timebank_accrued` + `supplement_rule_fired` lack `logger`. `admin_filled_pii` engine_event justification thin. All payroll events have at least one destination. |
| ADR-0011 | user_identity table naming | ✅ compliant | All payroll migrations reference `public.user_identity` or `public.profile` correctly. No `public.user` references found. |
| ADR-0012 | Subscription on company table | ✅ compliant | No `stripe_subscription` table references in any payroll migration. `company.subscription_*` pattern not violated. |
| ADR-0029 | Workspace API Gateway — dual-auth | ⚠️ partial | `supplement_rule_match` had gap (fixed same campaign). `payroll.*` schema tables rely on pre-move policies; no explicit re-verification. `shift_pay_calculation_event` correctly has both JWT + API key policies. `change_proposal` correctly has both. |
| ADR-0044 | Invitation table naming | ✅ compliant | No `workspace_invite` references in payroll migrations. Not in scope for payroll surface. |
| ADR-0107 | BotssonProvider Channel Derivation | ✅ compliant | No mobile provider code in payroll surface. Telemetry events carry `channel` from session context, not device label. Out of scope for migration surface. |
| ADR-0151 | Stage-engine profile_id server derivation | ✅ compliant | `payroll.personal_number_revealed` + `payroll.bank_account_revealed` events include `target_profile_id` in data payload (not used as actor). No `profile_id` accepted in body schema for payroll capability tools visible in this slice. |

---

## Verified Intentional

- **FP-001** (validate_aml_14_6 channel inversion) — not in scope for this slice.
- **FP-002** (Riksavtalen tariff rates) — not in scope for this slice.
- **`payroll.timebank_accrued` → activity_trail only** — registry comment explicitly states "High-frequency — activity_trail only (floods PostHog per spec §9)." The posthog exclusion is intentional. Logger absence is F-07-06 (LOW) not a design violation.
- **`payroll.supplement_rule_fired` → activity_trail only** — same high-frequency spec §9 rationale. Intentional for PostHog; logger absence is F-07-05 (MEDIUM) due to debugging impact.
- **`supplement_rule` with nullable `workspace_id`** — intentional design per Phase 1: `workspace_id IS NULL` = platform-level Riksavtalen template; `workspace_id = uuid` = workspace override. RLS correctly reads both. `database.types.ts` reflects `workspace_id: string | null`. Compliant.
- **`shift_pay_calculation_event` no `updated_at`** — append-only design per ADR-0251. No `updated_at` is correct; audit tables use `created_at` only. Supersession via `superseded_by_event_id` chain.
- **`payroll.recalc_triggered_by_supplement` + `payroll.recalc_triggered_by_tip_distribution` → logger + activity_trail only** — registry comment: "High-frequency (fires per supplement insert/delete and per tip employee at pool approval time) → activity_trail only to avoid PostHog flooding." Intentional. PostHog exclusion correct.

---

## In-Progress (mid-campaign)

Campaign `campaign/payroll` (merged 16:24 UTC 2026-05-12). All findings below are tagged **in-progress** — they exist on the campaign branch and are not regressions introduced against main.

| ID | Severity | File | Notes |
|----|----------|------|-------|
| F-07-01 | in-progress | `20260527100600` + `20260527101100` | Gap + fix both on campaign branch. Fix migration (`101100`) landed and properly adds `api_key_read_supplement_rule_match`. |
| F-07-07 | in-progress | `20260527100000` provenance default | Comment says Phase 2 will DROP DEFAULT. Phase 2 migrations (`20260602*`) present but none drops the default. Needs a follow-on migration. |

---

## Database.types.ts State

Verified against latest campaign migrations:

- `employee_payroll_profile`: `hourly_rate`, `monthly_salary`, `remuneration_type`, `currency`, `holiday_allowance_pct` — **all present** in `database.types.ts` (lines 7532–7664). Types match migration column definitions.
- `payroll.workspace_settings`: all 19 Phase 1 columns (`toil_default_max_banked_hours`, `wellness_days_per_year_default`, `supplement_stacking_policy`, `split_shift_*`, `overtime_*`, `punch_rounding_*`, `punch_window_*`, `adhoc_default_*`, `forced_break_*`, `requires_four_eyes_*`, `manager_punch_*`, `employee_can_dispute_*`, `is_tariff_bound`) — **all present** (lines 1653–1685).
- `payroll.calculation.provenance`: **present** as `Json` type (line 557). Matches migration.
- `supplement_rule.workspace_id`: **correctly nullable** (`string | null`) per platform-level row design.
- `shift_pay_calculation_event`: **present** (lines 17749–17873). Schema matches migration.

Types regenerated and current. No stale `database.types.ts` drift detected for payroll surface.
