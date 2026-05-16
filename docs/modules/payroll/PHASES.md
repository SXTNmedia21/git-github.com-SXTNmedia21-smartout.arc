---
title: Payroll Implementation Phases
status: draft
updated: 2026-05-16
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
| 0c | PII tools real bodies | DONE (Phase 5 superseded) | — |
| **1** | **Calculation engine + manager review UI** | **PROPOSED** | **1 sortie** |
| 2 | Manual supplements + line override | DONE | 1 sortie |
| 3 | CSV export | DONE | 1 sortie |
| 4 | PDF lønnsgrunnlag | DONE | 1 sortie + 1 ADR |
| 5 | PII reveal (Skatteetaten REMOVED — out of scope per Pontus 2026-05-08) | DONE | 1 sortie |
| ~~6~~ | ~~A-melding XML~~ | **OUT OF SCOPE** — Smartout does NOT handle A-melding. Accountant submits via Tripletex/Visma using lønnsgrunnlag from Phase 3/4. |
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

### Close-out gaps

Phase 1 code shipped (HANDOFF-payroll-phase-1.md). The following gaps remain open before Phase 1 is considered fully closed:

- **G1 — Golden-month expected fixture (cents-exact §10.1):** PENDING. `packages/payroll-calculate/__tests__/golden-month/expected/` is empty. Spec §10.1 requires `aggregated_periods.json`, `payroll_lines.json`, `deviations.json`, `timebank_entries.json` with cents-exact match against engine output. Current integration test uses structural invariants only. Blocks §10.1 acceptance criterion sign-off.
- **G3 — W11 Oslo-TZ bug:** PENDING. `checkW11` slices ISO date string for day grouping. Shifts starting 22:00 UTC (= 00:00 Oslo CEST) fall in the wrong day-bucket. Fix: replace string-slice grouping with Oslo timezone conversion before bucketing. Add boundary test scenario.
- **G4 — W04 4-week rolling boundary test:** PENDING. Current negative test does not exercise the full 4-week rolling window (only 3 shifts in 1 week). Needed scenario: 4 weeks × 46h = 24h OT (under 25h cap, must NOT fire W04).
- **G5 — 43-shift fixture vs §10.1 600-shift spec:** PENDING decision. Golden-month input uses 43 shifts vs the spec-stated ~600. Pontus to decide: scale up to 600 OR formally accept 43 with a documented scope-cut ADR. Blocking §10.1 criterion until resolved.

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

## Phase 4 — PDF Lønnsgrunnlag

**Goal:** Per-employee PDF lønnsgrunnlag (wage basis document), viewable on web + mobile, optionally emailable. Includes hours worked, supplement lines, tip distribution, and totals. Designed for handoff to accountant or as a reference document for the employee. **NOT a tax-compliant lønnsslipp** — the accountant produces the actual lønnsslipp (with net pay, tax deduction, A-melding reporting) from this basis using Tripletex or Visma.

### Scope

- ADR: PDF library choice (`@react-pdf/renderer` recommended)
- `packages/payroll-export/src/pdf.ts` + `pdf/LonnsgrunnlagDocument.tsx` + sub-components
- Storage bucket `payroll-lonnsgrunnlag/`
- Signed URL generation (24h admin, 1h employee)
- `export_period` tool extended to `format='pdf'`
- Mobile: `apps/mobile/app/(app)/(me)/payroll/lonnsgrunnlag-detail.tsx` reads signed URL and renders PDF
- Web: `/dashboard/my-salary/[lonnsgrunnlagId]` shows PDF
- Telemetry: `payroll.lonnsgrunnlag_generated`, `payroll.lonnsgrunnlag_url_granted`

### Content — wage basis scope

- Hours: regular, overtime, absence-adjusted
- Supplement lines: per tariff code (kveldstillegg, helgetillegg, OT-tillegg, etc.)
- Manual supplements and deductions authored in Phase 2
- Tip distribution if applicable (see SMARTOUT_TIPS_PRD.md)
- Brutto total (before tax)
- Provenance: period, tariff version, workspace orgnr

Out of scope for this PDF (accountant produces these):
- Tax deduction (tabelltrekk)
- Net pay after tax
- A-melding inntektskoder
- OTP employer/employee split

### Acceptance

1. Render time <5s for 12-employee workspace.
2. PDF renders correctly on iOS/Android mobile + Chrome/Safari/Firefox web.
3. Norwegian formatting throughout (numbers, dates, currency).
4. Personnummer + bankkonto visible by default (it IS lønnsgrunnlag content); audit-emit on each generation.
5. SHA-256 verification footer present on every PDF.
6. Storage signed URLs expire correctly; expired URL returns 403.
7. PDF header reads "Lønnsgrunnlag" — NOT "Lønnsslipp".

### Parallel to Phase 4

- **Phase 5:** PII reveal real bodies — needed so PDF can reveal bank account on mobile/web view. (Skatteetaten fetch removed from Phase 5 per Pontus 2026-05-08 — out of Smartout scope.)

---

## Phase 5 — PII Reveal

**Goal:** Real bodies for `view_personal_number` and `view_bank_account` (the 2 reveal stubs at `packages/ai/src/capabilities/payroll/tools.ts:314` + `:383`). `query_tax_card` stays DB-read-only as already implemented at `tools.ts:162` — data into the `tax_card_*` columns arrives from Tripletex sync (Phase 7) OR manual admin entry via the existing `update_payroll_profile` capability tool. Smartout does NOT initiate any Skatteetaten fetch.

### Scope

- `view_personal_number`: RevealableField pattern, audit-emit, audit row in `activity_trail`
- `view_bank_account`: same pattern
- BFF route wiring for both reveal tools (chat-channel only per ADR-0078 Høy-PII)
- Web UI integration on payroll detail surface (RevealableField component)
- `query_tax_card` body unchanged — already a DB read of `employee_payroll_profile.tax_*` columns

### OUT OF SCOPE (decision Pontus 2026-05-08)

- ❌ Skatteetaten Edge Function (`supabase/functions/skatteetaten-fetch/`)
- ❌ pg_cron annual reconciliation
- ❌ `skatteetaten.*` telemetry events (registry never gets them)
- ❌ Deviation W05 (stale tax-card warning) — no longer applicable
- ❌ TLS client certificate handling
- ❌ 1Password Skatteetaten items
- ❌ ADR-0250 implementation contract — marked **deferred**, retained as historical reference

Tax-card data path: regnskapssystem (Tripletex/Visma) sync OR admin manual entry. Smartout is upstream of regnskap, never the API client to Skatteetaten.

### Acceptance

1. Admin clicks "Reveal" on a masked personnummer → field shows value within 100ms + audit row written to `activity_trail` with `actor_id`, `target_profile_id`, `field_revealed`.
2. Same for bank account.
3. Employee can self-reveal their own personnummer/bank account (admin-or-self gate per existing pattern).
4. Cross-workspace reveal rejected (ADR-0151 forgery defence — verify target profile in caller's workspace).
5. ADR-0250 frontmatter `status: deferred` confirmed; Phase 5 ships without any Skatteetaten code or env vars.

---

## ~~Phase 6 — A-melding XML~~ (REMOVED — out of Smartout scope)

**Decision (Pontus 2026-05-08):** Smartout does NOT handle A-melding. Smartout = team-management system delivering lønnsgrunnlag (Phase 3 CSV + Phase 4 PDF) to the accountant. The accountant produces and submits A-melding via Tripletex/Visma using that lønnsgrunnlag. This boundary is non-negotiable: Smartout is upstream of the payroll/regnskap layer, never the submitter to Altinn.

If the accountant is on Tripletex, Phase 7 (Tripletex Push-Sync) covers the data handoff. A-melding submission belongs to Tripletex's responsibility from there.

**Removed from spec:**
- ~~`packages/payroll-export/src/amelding.ts`~~
- ~~`packages/payroll-export/src/amelding/codes.ts`~~
- ~~`export_period` tool `format='amelding'` extension~~
- ~~A-melding XML download UI~~

**What we still do (carries to Phase 3/4 lønnsgrunnlag):**
- Capture inntektskoder per supplement-rule via `payroll_salary_code.amelding_inntektskode` for accountant's downstream mapping (the field stays in DB; we surface it in the lønnsgrunnlag CSV/PDF)
- Tip lines correctly classified per §7.2 of LEGAL-FRAMEWORK so accountant can apply the right A-melding code (111-A or alternative)
- All values frozen + provenance preserved per ADR-0251 — accountant gets audit-ready basis, not a raw dump

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
  - start_process: exporters (CSV+PDF default; Tripletex if enabled — NO A-melding, accountant owns submission)
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
<!-- ADR-0XXX A-melding submission strategy — REMOVED 2026-05-08, Phase 6 out of scope -->
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
- A-melding (any form: XML, Altinn submission, Tripletex-delegated) — entirely accountant scope, never Smartout (Pontus 2026-05-08)
