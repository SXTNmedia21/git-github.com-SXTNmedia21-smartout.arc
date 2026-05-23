---
title: "Payroll — Architecture"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: payroll
tags: [domain, payroll, architecture, code-map]
---

# Payroll — Architecture

> L1–L5 code map. **Code wins.** Every component cited with a grep-able anchor. Line numbers are ±hints; use the anchor to re-verify.

## L1 — Surface (UI)

### Web Dashboard (manager/admin)

| Route | File | Purpose |
|---|---|---|
| `/dashboard/payroll` | `apps/web/src/app/dashboard/payroll/page.tsx` | Period list (create + view periods) |
| `/dashboard/payroll/[periodId]` | `apps/web/src/app/dashboard/payroll/[periodId]/page.tsx` | Period detail: Lines + Deviations + Manual supplements + Export |
| `/dashboard/payroll/tariff` | `apps/web/src/app/dashboard/payroll/tariff/page.tsx` | Tariff binding admin (setup + change + supplement overrides) |
| `/dashboard/my-salary/[lonnsgrunnlagId]` | `apps/web/src/app/dashboard/my-salary/[lonnsgrunnlagId]/page.tsx` | Employee self-view: lønnsgrunnlag PDF + signed URL |

Period detail components (grepped: `apps/web/src/app/dashboard/payroll/[periodId]/_components/`):
- `LinesTable.tsx` — calculation lines grid
- `DeviationList.tsx` — unacknowledged deviations, blocks lock button
- `ManualSupplementForm.tsx` — add/delete manual supplements
- `LineDrawer.tsx` — drill-down into a single line with full rule trace
- `ManualTimeEntryDialog.tsx` — ad-hoc time entry creation

Tariff admin components (grepped: `apps/web/src/app/dashboard/payroll/tariff/_components/`):
- `TariffClient.tsx` — main wrapper
- `CurrentBindingCard.tsx` — displays active `workspace_union_binding`
- `BindingHistoryList.tsx` — all historical bindings
- `ChangeBindingForm.tsx` — triggers `change_workspace_tariff` tool
- `AddSupplementForm.tsx` — triggers `add_supplement_override` tool
- `SupplementOverridesList.tsx` — workspace-specific rate overrides

Settings integration: `apps/web/src/app/dashboard/settings/_components/payroll-general-settings.tsx` — payroll workspace policy fields.

### Mobile (read-only)

Mobile has **no payroll route** in `apps/mobile/src/app/` — confirmed by `find apps/mobile/src/app -name '*payroll*'` returning empty. The skill claim of `apps/mobile/src/app/(me)/payroll/` is a **deviation** (logged in GAPS §D1).

Components in `apps/mobile/src/components/payroll/` (grepped, all exist):
- `TimebankScreen.tsx` — feriekonto/TOIL/wellness balance view
- `PayrollHomeCard.tsx` — dashboard card showing period status
- `PayslipList.tsx` — list of locked lønnsgrunnlag
- `PayslipScreen.tsx` — individual lønnsgrunnlag detail
- `SupplementBadges.tsx` — inline supplement badges on shifts
- `SupplementsDetailScreen.tsx` — full supplement breakdown
- `AbsenceDetail.tsx` — absence ledger entry detail
- `AbsenceBalanceScreen.tsx` — absence quota summary
- `AbsenceRequestScreen.tsx` — absence request form

Mobile lib (`apps/mobile/src/lib/payroll-calc.ts`, `apps/mobile/src/lib/supplements.ts`) — lightweight client-side calc for preview display (not authoritative; server calc wins).

## L2 — BFF / API Routes

All routes at `apps/web/src/app/api/payroll/` (grepped — 27 route folders):

| Route segment | Purpose |
|---|---|
| `create-period/` | POST — create new payroll period |
| `derive-shift-hours/` | POST — Layer 1: runs `interpretShift` for all period shifts |
| `snapshot-period-costs/` | POST — Layer 2: runs `snapshotCost` + supplement eval |
| `aggregate-period/` | POST — Layer 3: aggregates + emits timebank entries |
| `run-deviation-checks/` | POST — populates `payroll.deviation` |
| `lock-period/` | POST — gates on `deviations.unacked === 0` then calls `lock_period` tool |
| `add-manual-supplement/` | POST — `add_manual_supplement` capability tool |
| `delete-manual-supplement/` | DELETE — `delete_manual_supplement` tool |
| `propose-line-override/` | POST — `override_calculation_line` tool → creates `change_proposal` |
| `approve-proposal/` | POST — C4 authority gate |
| `reject-proposal/` | POST — C4 reject |
| `apply-line-override/` | POST — applies approved proposal to `calculation_line` |
| `pending-line-overrides/` | GET — list unapproved override proposals |
| `proposals/` | GET — all change proposals for a period |
| `export-period/` | POST — `export_period` tool → CSV generation |
| `exports/` | GET — list export events |
| `generate-pdf-bundle/` | POST — all employees in period |
| `generate-pdf-single/` | POST — single employee PDF |
| `longsgrunnlag-url/` | GET — signed URL for employee self-access |
| `reveal-personal-number/` | POST — `view_personal_number` tool (Høy PII, chat-only) |
| `reveal-bank-account/` | POST — `view_bank_account` tool (Høy PII) |
| `tariff/` | GET/POST — tariff binding queries |
| `recalculate-period/` | POST — `recalc_triggered` telemetry + re-run |
| `consent-documents/` | GET/POST — payroll deduction consent (ADR-0311) |
| `deduction-consents/` | GET — list consents |
| `_smoke/` | GET — smoke probe endpoint |
| `__tests__/` | `payroll-period-locked-handler.test.ts` |

## L3 — Engine / Orchestration

**Edge Function:** `supabase/functions/payroll-period-locked-handler/` — webhook-style handler that fires on period lock event (`payroll.period_locked` telemetry). Triggers `payroll.period_created` downstream notifications. Files: `index.ts`, `handler.ts`.

**Event Engine process:** `20260617100000_payroll_period_locked_notifier_process.sql` — registers an `engine_process` blueprint for period-locked notifications.

**pg_cron:** No payroll-specific cron jobs identified in `supabase/migrations/*payroll*` (pg_cron was globally disabled in prod per ADR-0388 and re-enabled in development; payroll currently uses BFF-triggered calc rather than scheduled runs).

**Recalc chain (ADR-0293 Pattern B):** `recalculate-period/` API → `payroll.recalc_triggered` emit → downstream supplement/tip recalc triggers via `20260604000003_payroll_phase2_recalc_triggers.sql`.

## L4 — Capability / Domain Logic

### `packages/payroll-calculate/src/` — Pure calc engine (14 files)

| File | Responsibility | Layer |
|---|---|---|
| `interpret-shift.ts` | Raw hours → classified shift context. Checks holiday, night, weekend, overtime triggers. | 1. Input |
| `oslo-time.ts` | Norwegian timezone helpers (Europe/Oslo). All shift times converted here first. | 1. Input |
| `evaluate-supplements.ts` | DSL supplement rules eval against shift context → `SupplementMatch[]` | 2. Regelmotor |
| `seniority-resolver.ts` | `employment_contract.start_date` → ansiennitet step → tariff row lookup | 2. Regelmotor |
| `overtime-resolver.ts` | OT 50%/100% classification per Aml. §10-6 + workspace `overtime_mode` | 2. Regelmotor |
| `stacking.ts` | Supplement stacking policy — which supplements can co-fire per `supplement_stacking_policy` | 2. Regelmotor |
| `snapshot-cost.ts` | Tariff snapshot + classified shift → cost per line (`calculation_line` rows) | 3. Output |
| `deviation-checks.ts` | W01–W12 checks (minstønn, OT cap, rest time) → `payroll.deviation` population | 3. Output |
| `aggregate-period.ts` | Aggregates all lines + manual supplements + tip distributions for a period | 3. Output |
| `timebank-emitter.ts` | Feriepenger accrual + TOIL + wellness → `payroll.timebank_entry` rows | 3. Output |
| `apply-override.ts` | Applies approved C4 line override to `payroll.calculation_line` | 3. Output |
| `cents.ts` | NOK arithmetic in integer cents. No floating-point. | Utility |
| `types.ts` | Shared types for all calc engine modules | Types |
| `index.ts` | Package entrypoint — re-exports public API | Entrypoint |

### `packages/ai/src/capabilities/payroll/` — AI capability

| File | Responsibility |
|---|---|
| `tools.ts` | 17 tools: `update_payroll_profile`, `query_tax_card`, `set_pension_scheme`, `view_personal_number`, `view_bank_account`, `salary_query`, `lock_period`, `acknowledge_deviation`, `set_overtime_mode`, `adjust_timebank_balance`, `force_timebank_payout`, `query_timebank_balance`, `override_calculation_line`, `add_manual_supplement`, `export_period`, `delete_manual_supplement`, `view_lonnsgrunnlag` |
| `tariff-tools.ts` | 3 tools: `setup_workspace_tariff`, `change_workspace_tariff`, `add_supplement_override` — all delegate to cascade capability per ADR-0356 |
| `gate.ts` | Authority gate configuration — `min_role: 'admin'`, `allowedChannels: ['chat']` |
| `index.ts` | Capability registration |
| `__tests__/update-payroll-profile.test.ts` | Unit test for `update_payroll_profile` tool |

**PII tier:** All payroll tools are `allowedChannels: ['chat']` only — no voice, no API. Høy PII isolation per ADR-0242.

**Delegation chain (`tariff-tools.ts`):** payroll gate fires first → calls cascade capability tool with `caller_capability='payroll'` → cascade gates independently → writes `workspace_union_binding` → emits `cascade.*` event → payroll emits `payroll.*` event. Both layers emit. Audit trail via `delegated_via` field. (ADR-0356)

## L5 — Persistence

Full schema reference: [DATA-MODEL.md](./DATA-MODEL.md).

**Core payroll schema (`payroll.*` — 23 tables):** period, calculation, calculation_line, deviation, manual_supplement, export_event, export_line, timebank_entry, sick_leave_period, absence_ledger, absence_quota, absence_type, working_time_rule, meal_rule, break_rule, supplement_rule (moved from public), holiday_entry, holiday_calendar, salary_code, shift_type, employee_group_member, employee_group, workspace_settings, consent_document.

**Public tables (payroll-domain owned):** `employee_payroll_profile`, `shift_cost_snapshot`, `shift_pay_calculation_event`, `payroll_ledger_archive`, `supplement_rule`, `supplement_rule_match`, `workspace_union_binding`.

**K1a platform tables (read-only for payroll):** `tariff_rate_table`, `regulatory_framework`, `framework_rule`, `public_holiday`.

**Storage:** `payroll-longsgrunnlag` private bucket — PDF per employee per period. RLS: admin read-all + employee read-own-only. (`20260604000007_payroll_phase4_lonnsgrunnlag_storage.sql:35`)

**RPCs:** `aggregate_period`, `derive_shift_hours`, `snapshot_period_costs`, `run_deviation_checks`, `payroll.recalculate_period` — atomic write wrappers. (`20260527100000_payroll_phase1_provenance.sql` et al.)
