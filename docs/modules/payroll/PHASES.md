---
title: Payroll Implementation Phases
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, phases, roadmap, sortie-plan]
---

# Payroll Implementation Phases

> Eight phases. Phase 0a + 0b done. Phase 1 first sortie. Each phase = one sortie unless noted. Acceptance criteria are falsifiable.

## Phase Status Summary

| Phase | Title | Status | Sortie estimate |
|---|---|---|---|
| 0a | Schema | DONE (23 tables in `payroll.*`) | — |
| 0b | Capability skeleton | DONE (6 stub tools) | — |
| 0c | PII tools real bodies | IN PROGRESS | parallel w/ Phase 4 |
| **1** | **Calculation engine + manager review UI** | **PROPOSED** | **1 sortie** |
| 2 | Manual supplements + line override | proposed | 1 sortie |
| 3 | CSV export | proposed | 1 sortie |
| 4 | PDF lønnsslipp | proposed | 1 sortie + 1 ADR |
| 5 | Phase 0c complete (PII reveal + Skatteetaten fetch) | proposed | 1 sortie (parallel w/ 4) |
| 6 | A-melding XML | proposed | 1 sortie + 1 ADR |
| 7 | Tripletex push-sync | proposed | 1 sortie + 1 ADR |
| 8 | Recalc orchestration via Event Engine | proposed | 1 sortie |

---

## Phase 1 — Calculation Engine + Manager Review UI + Time-Banks + Dynamic Supplements (MVP)

**Goal:** Manager can open `/dashboard/payroll`, see one period's calculations (with feriekonto-accrual + TOIL-handling + admin-authored supplement rules firing correctly), drill into a profile, acknowledge deviations, and lock the period. All built ON TOP of existing Lønnsprofil + supplement-rules + timebank infrastructure.

### Scope

#### A. Calculation engine (NEW package)

- New package `packages/payroll-calculate/` (or live in `packages/ai/src/payroll/`)
  - `interpretShift(time_entry, framework_rules, holiday_calendar)` — Layer 3
  - `snapshotCost(interpretation, tariff_snapshot, payroll_profile)` — Layer 4
  - `aggregatePeriod(snapshots, manual_supplements, tip_distributions, timebank_emissions)` — Layer 5
  - `runDeviationChecks(calculation, framework_rules)` — W01–W12
  - **`evaluateSupplements(shift_context, supplement_rules)`** — dynamic supplements (see DYNAMIC-SUPPLEMENTS.md §2)
  - **`emitTimebankEntries(calculation, profile, workspace_settings)`** — feriekonto + TOIL accrual (see TIME-BANKS.md §5)

#### B. RPCs (atomic write wrappers)

- `derive_shift_hours(period_id)` — runs interpretShift for all shifts
- `snapshot_period_costs(period_id)` — runs snapshotCost + evaluateSupplements
- `aggregate_period(period_id)` — runs aggregatePeriod + emitTimebankEntries
- `run_deviation_checks(period_id)` — populates payroll_deviation

#### C. New pages (apps/web)

- `/dashboard/payroll/page.tsx` — period list
- `/dashboard/payroll/[periodId]/page.tsx` — period detail w/ Lines + Deviations + Manual + Tip + Export tabs
- `/dashboard/payroll/[periodId]/_components/{LinesTable,DeviationList,LineDrawer,LockModal,SupplementFireHistory}.tsx`
- `/dashboard/payroll/[periodId]/_hooks/{usePayrollLines,useDeviations,useLockPeriod,useShiftSupplements}.ts`

#### D. EXTEND existing surfaces (no replacement)

- `dashboard/people/[id]/_components/LonnsprofilSection.tsx` — add `overtime_mode` select, `toil_agreement_signed_at` badge, `holiday_allowance_pct` field, plus mount new `TimebankPanel` (feriekonto/TOIL/wellness summary)
- `dashboard/people/[id]/_components/TimebankPanel.tsx` (NEW) — three accounts visible side-by-side, with [Vis ledger] / [Justér saldo] / [Tving utbetaling] actions
- `dashboard/settings/_components/supplement-rules-settings.tsx` — add "Test rule" preview panel that calls `evaluateSupplements()` with draft rule against a chosen test shift
- `dashboard/settings/_components/payroll-general-settings.tsx` — add `toil_default_max_banked_hours`, `wellness_days_per_year_default`, `supplement_stacking_policy`, `split_shift_threshold_minutes` + `split_shift_allowance_amount`
- `apps/mobile/app/(app)/(me)/payroll/timebank.tsx` — add account-type filter chips (Feriepenger / Avspasering / Velferdsdager)

#### E. New capability tools (chat + UI)

- `lock_period`
- `acknowledge_deviation`
- `set_overtime_mode`
- `adjust_timebank_balance`
- `force_timebank_payout`
- `query_timebank_balance`
- `add_manual_supplement`

#### F. Schema migrations

- `<timestamp>_payroll_phase1_authority_seed.sql` — capability_default_registry rows
- `<timestamp>_payroll_phase1_time_banks.sql` — see TIME-BANKS.md §8
- `<timestamp>_payroll_phase1_dynamic_supplements.sql` — see DYNAMIC-SUPPLEMENTS.md §9

#### G. Telemetry events

- `payroll.period_locked`, `payroll.deviation_acknowledged`, `payroll.deviation_blocked_approval`
- `payroll.supplement_rule_fired`, `payroll.supplement_rule_test_run`
- `payroll.timebank_accrued`, `payroll.timebank_withdrawn`, `payroll.timebank_payout_forced`
- `payroll.overtime_mode_changed`

### Out of scope

- Approve period (Phase 1.5 — same sortie if time, else split)
- Export of any kind (Phase 3+)
- PDF (Phase 4)
- Manual supplements (Phase 2)
- Line override (Phase 2)

### Acceptance

1. **Calc correctness:** For one test workspace with 12 employees and one full month of shifts (mix of regular, OT, weekend, holiday, night), the engine produces correct totals matching hand-computed reference within ±0.01 NOK per employee.
2. **Lines visible:** Manager UI shows one row per profile with all sub-buckets (regular, OT, kvelds, helg, helligdag, manual, deductions, gross, net).
3. **Deviations populate:** W01 (rest period < 11h), W02 (OT cap), W09 (break < 30min) trigger correctly when test data violates them.
4. **Acknowledge gate:** Cannot lock period while severity=error deviation exists un-acknowledged. UI shows blocking message.
5. **Lock works:** `lock_period` capability tool transitions period.status to 'locked'. Telemetry emitted. Audit row in `activity_trail`.
6. **Re-run idempotent:** Running RPCs twice produces new versions with `derivation_version + 1`; old rows preserved.
7. **No regression:** Existing `/dashboard/my-salary`, `/dashboard/people/[id]` HR-tab, and mobile `(me)/payroll/*` surfaces continue to read correctly.
8. **Time-banks accrue correctly:**
   - Feriekonto NOK-accrual = `gross_eligible × holiday_allowance_pct / 100` per period; visible in TimebankPanel within 5s of period close.
   - TOIL hours-accrual fires only when `overtime_mode='banked'` AND `toil_agreement_signed_at IS NOT NULL`. Tillegg (50%/100%) still appears as `paid_out` line.
   - Wellness day usage: existing absence flow with `absence_type='wellness'` decrements `absence_quota.remaining_days`.
9. **Dynamic supplements fire:**
   - Workspace with 3 platform-seed rules + 2 admin-created rules computes correct supplement amounts.
   - Test-rule preview panel in `supplement-rules-settings` returns match within 500ms.
   - Each firing produces `shift_pay_calculation_event` row with `rule_id` in provenance.
   - Conflict-resolution: two overlapping `normal` rules respect default `category_exclusive` policy.
10. **Mode toggle:** `set_overtime_mode` from chat or `LonnsprofilSection` fires `payroll.overtime_mode_changed` telemetry. Without `toil_agreement_signed_at`, switch to `banked` is rejected with clear UX.
11. **Tariff freeze:** Re-running calc on a closed period returns identical results (tariff snapshot + rule version_hash both frozen).

### Estimate

- 1 sortie (5–8 days). Single agent (sonnet) for build, code-reviewer pass, system-steward verification.

### Blockers / open questions to resolve before start

- O1: Period rollback semantics (corrective period vs unlock)? — see [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) §6
- O2: Four-eyes default for approve_period — needed if Phase 1.5 ships in same sortie

---

## Phase 1.5 — Approve Period (option to bundle in Phase 1)

**Goal:** Period can transition locked → approved.

### Scope

- `approve_period` capability tool (level=confirm, min_role=admin)
- Workspace policy: `requires_four_eyes_for_period_approval` (default false; opt-in)
- Inbox entry type: `period_approval`
- UI: "Approve" button on locked period; four-eyes flow if policy enabled

### Acceptance

1. Single approver: period.status → 'approved' on confirm.
2. Four-eyes: first admin proposes, second admin approves; period stays 'locked' until second admin approves.
3. Cannot approve if any severity=error deviation un-acknowledged (defense-in-depth — also UI-blocked).
4. Re-approval is forbidden (status check).

---

## Phase 2 — Manual Supplements + Line Override

**Goal:** Manager can add tips/bonus, override wrong lines via change_proposal.

### Scope

- `add_manual_supplement` tool (level=confirm, min_role=manager) → inserts `payroll_manual_supplement` row
- `override_calculation_line` tool (level=confirm, min_role=manager) → creates `change_proposal` of kind `wage_line_override`
- Recalc-trigger on supplement insert/delete + on change_proposal applied
- Inbox: `wage_line_override` proposals
- UI: "Add manual supplement" + "Override line" actions in Lines drawer
- Telemetry: `payroll.manual_supplement_added`, `payroll.line_override_proposed`, `payroll.line_overridden`

### Acceptance

1. Manager adds 200 NOK supplement → recalculation runs → updated total visible in Lines tab in <2s.
2. Override flow: Manager proposes → admin sees in inbox → admin approves → recalc runs → line shows overridden amount with audit chain.
3. Period must be 'open' — adding to locked/approved rejected with clear error.

---

## Phase 3 — CSV Export

**Goal:** Admin downloads CSV (aggregate or audit) of approved period.

### Scope

- `packages/payroll-export/src/csv.ts` (NEW package, this is its first deliverable)
- Server Action `exportPeriodCsv(periodId, variant)`
- `export_period` capability tool with `format='csv'`
- `payroll_export_event` + `payroll_export_line` rows
- UI: Export tab → CSV options + download buttons
- Norwegian formatting: nb-NO locale, semicolon delimiter, BOM

### Acceptance

1. CSV opens cleanly in Norwegian Excel.
2. All numbers in CSV match values shown in Lines tab UI to ±0.01 NOK.
3. Audit variant: each line has provenance columns (rule_id, tariff_version, paragraf).
4. Aggregate variant: one row per profile.
5. Filename includes workspace slug + period + variant + timestamp.
6. Mask personnummer + bankkonto by default; admin-checkbox to include unmasked (audit-emit on export).

---

## Phase 4 — PDF Lønnsslipp

**Goal:** Per-employee PDF lønnsslipp, viewable on web + mobile, optionally emailable.

### Scope

- ADR: PDF library choice (`@react-pdf/renderer` recommended)
- `packages/payroll-export/src/pdf.ts` + `pdf/Payslip.tsx` + sub-components
- Storage bucket `payroll-payslips/`
- Signed URL generation (24h admin, 1h employee)
- `export_period` tool extended to `format='pdf'`
- Mobile: `apps/mobile/app/(app)/(me)/payroll/payslip-detail.tsx` reads signed URL and renders PDF
- Web: `/dashboard/my-salary/[payslipId]` shows PDF
- Telemetry: `payroll.payslip_generated`, `payroll.payslip_url_granted`

### Acceptance

1. Render time <5s for 12-employee workspace.
2. PDF renders correctly on iOS/Android mobile + Chrome/Safari/Firefox web.
3. Norwegian formatting throughout (numbers, dates, currency).
4. Personnummer + bankkonto visible by default (it IS lønnsslipp content); audit-emit on each generation.
5. SHA-256 verification footer present on every PDF.
6. Storage signed URLs expire correctly; expired URL returns 403.

### Parallel to Phase 4

- **Phase 5:** Phase 0c real PII bodies — needed so PDF can reveal bank account on mobile/web view.

---

## Phase 5 — Phase 0c Complete (PII Reveal + Skatteetaten Fetch)

**Goal:** Real bodies for `view_personal_number`, `view_bank_account`, `query_tax_card`. Skatteetaten Edge Function live (ADR-0250 implementation).

### Scope

- `view_personal_number`: RevealableField pattern, audit-emit, audit row in `activity_trail`
- `view_bank_account`: same pattern
- `query_tax_card`: real Skatteetaten Edge Function call (cert auth, 1Password creds)
- Edge Function `supabase/functions/skatteetaten-fetch/index.ts` per ADR-0250
- Cron: annual reconciliation (`pg_cron` 1. januar)
- Failure handling per ADR-0250 (404=warn, 503=retry, 401/403=alert+block, stale=warn, timeout=retry)

### Acceptance

1. Admin clicks "Reveal" → masked field shows value → audit row written within 100ms.
2. Skatteetaten fetch on contract activation completes within 30s; deviation W05 cleared if successful.
3. 401/403 from Skatteetaten alerts admin via Telegram + activity_trail.
4. Annual cron runs successfully on staging without manual intervention.

---

## Phase 6 — A-melding XML

**Goal:** Generate A-melding XML for any approved period; validate against Skatteetaten XSD; admin downloads OR (future) auto-submit.

### Scope

- ADR: submission strategy (manual download vs Tripletex-delegation vs direct Altinn)
- `packages/payroll-export/src/amelding.ts`
- `packages/payroll-export/src/amelding/codes.ts` — inntektskoder mapping
- XSD validation step (local pre-flight)
- `export_period` tool extended with `format='amelding'`
- UI: download button in Export tab

### Acceptance

1. Generated XML validates against Skatteetaten XSD.
2. Field count + values match Tripletex-generated XML for same period (cross-check).
3. Tip lines coded as 111-A correctly (or whichever code resolved in §7.2 of LEGAL-FRAMEWORK).
4. Constructive dismissal flag NOT in A-melding (it's HR concern, not Skatteetaten).

### Decisions blocking start

- O4: A-melding submission timing
- §7.2: Tips A-melding-koding decision
- §7.5: Frikort grenseverdier-håndtering

---

## Phase 7 — Tripletex Push-Sync

**Goal:** Approved period auto-pushes to Tripletex; reconciles per-line; reports drift.

### Scope

- ADR: Tripletex auth + idempotency strategy
- `packages/payroll-export/src/tripletex.ts` + `tripletex/client.ts`
- Edge Function `supabase/functions/tripletex-sync/index.ts`
- Token chain stored in 1Password
- `export_period` tool extended with `format='tripletex_api'`
- Per-line retry UI in export modal
- Telemetry: `payroll.tripletex_synced`, `payroll.tripletex_sync_failed`, `payroll.tripletex_drift_detected`

### Acceptance

1. 12-employee workspace round-trip: push → fetch → values match within 0.01 NOK.
2. SalaryType ID resolution from `payroll_salary_code.external_code` correct for all canonical codes.
3. Failed line: retry from UI; second attempt succeeds (or different error surfaces).
4. Tripletex period-locked rejection: clean error, no partial sync state.
5. Token expiry mid-sync: auto-refresh, resume from failed line.

### Decisions blocking start

- Tripletex partner-portal access (Pontus owns)
- Sandbox account for testing

---

## Phase 8 — Recalc Orchestration via Event Engine

**Goal:** Period close runs end-to-end via `engine_process` blueprint, no manual button-clicks except review/approve gates.

### Scope

- `engine_process` blueprint `payroll_period_close`:
  - wait_for_event (period_end_date passed)
  - start_process: derive_shift_hours, snapshot_costs, aggregate, deviations
  - assign_task: manager review (acknowledge errors)
  - lock_checkout: period.status=locked
  - assign_task: admin approve
  - update_entity: period.status=approved
  - start_process: exporters (CSV+PDF default; A-melding+Tripletex if enabled)
- Auto-recalc on tariff_rate_table change (only for status='open' periods)
- Auto-recalc on time_entry write (per-shift)
- `recalculate_period` capability tool (system-channel, autonomous)

### Acceptance

1. End-to-end: period_end_date passes → manager gets task → acknowledges errors → admin gets task → approves → exports run → `payroll.export_completed` emitted.
2. Tariff change on platform level fires recalc on all open periods within 60s; status-locked/approved periods unchanged.
3. Time_entry punch_out triggers per-shift recalc within 5s.

---

## Cross-Phase Decisions Required (ADRs)

| ADR | Subject | Phase blocked |
|---|---|---|
| ADR-0XXX | PDF library choice | 4 |
| ADR-0XXX | A-melding submission strategy | 6 |
| ADR-0XXX | Tripletex auth + idempotency | 7 |
| ADR-0XXX | Recalc trigger model (cron vs DB-trigger vs hybrid) | 8 |
| ADR-0XXX | Period rollback semantics (corrective period vs unlock) | 1 |
| ADR-0XXX | Four-eyes default policy | 1.5 |

---

## Cumulative Sortie Count

- Phase 1 + 1.5: 1 sortie (bundled)
- Phase 2: 1 sortie
- Phase 3: 1 sortie
- Phase 4 + 5: 2 parallel sorties (4 has dependency on 5 for PII reveal)
- Phase 6: 1 sortie
- Phase 7: 1 sortie
- Phase 8: 1 sortie

**Total: ~7 sorties** to reach full payroll engine. ~3-4 months of dev velocity at current pace.

---

## Out of Scope for v1 (Cumulative)

- Multi-tariff per workspace
- Lærling-rules (Opplæringsloven kap. 4) — separate ADR before opening
- Bonus / commission schemes outside Riksavtalen §6
- Severance / sluttvederlag calculations
- Foreign workers with non-Norwegian skattekort
- Non-NOK currency
- Manual period creation outside workspace settings
- Period reopen flow (always corrective period)
- Mobile authoring of payroll (witness only)
- Tip pool authoring outside existing flow
- Direct Altinn A-melding submission (delegated to Tripletex; future ADR if changed)
