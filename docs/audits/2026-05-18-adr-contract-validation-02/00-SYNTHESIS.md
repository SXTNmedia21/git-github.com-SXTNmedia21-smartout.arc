---
title: Audit Synthesis — 2026-05-18 (full)
status: complete
created: 2026-05-18
updated: 2026-05-18
mode: full
slices: 12_of_14
baseline: 2026-05-13
run_id: 2026-05-18-adr-contract-validation-02
tags: [audit, synthesis, adr, contract-validation]
---

# Audit Synthesis — 2026-05-18 (full)

## Verdict — YELLOW (SAFE TO PROMOTE, design/i18n debt growing)

No CRITICAL findings. No HIGH findings on cascade boundary, capability gate coverage, RLS hardening, webhook integrity, or telemetry contract. ADR-0367 in-flight day-line work is council-APPROVED and passes per-slice integrity checks. 2026-05-13 CRITICALs (F-DB-09, F-OB-10-01, F-CL-11, F-EF-03) all remain closed. Mobile L-0083 enforcement holding.

Yellow rating is driven by **two systemic HIGH-class debts that grew vs baseline**: (1) hardcoded Norwegian text in `.tsx` files (~378 files, 90% of Norwegian-containing files have no i18n), and (2) ADR-0366 OKLCH literal violations (~283 occurrences in ~50 component files plus 18 in `globals.css` outside `@theme`). Neither blocks promotion but both are accelerating without enforcement.

**Coverage caveat:** Slices 03 (Edge Functions) and 14 (Missions/E2E) were not delivered in this run. Edge Function auth perimeter was last verified 2026-05-13 (F-EF-03 closed); webhook layer in slice 13 is clean. Mission/E2E coverage is unverified this cycle.

---

## Totals

| Severity | Count | vs Baseline |
|---|---|---|
| CRITICAL | 0 | -3 |
| HIGH | 5 | -35 |
| MEDIUM | 7 | -19 |
| LOW | 11 | -9 |
| INFO/Cosmetic | 8 | n/a |
| **Total tracked** | **31** | -58 (from 89) |

Slice 03 + Slice 14 missing — totals reflect only 12 delivered slices. Findings concentrated in: i18n adoption (HIGH), ADR-0366 OKLCH literals (HIGH), payroll gate-then-direct pattern variant (MEDIUM cluster), journey doc pointer staleness (MEDIUM).

---

## Closed during run (commit 628041add and earlier today)

| ID | Slice | Severity | What closed |
|---|---|---|---|
| F-07-SD-1 | 07 | LOW | 2 SECURITY DEFINER functions missing `SET search_path = public` — `trigger_channel_message_notification`, `get_channel_messages` (628041add) |
| F-14-ATR-1 | 14 | MEDIUM | `attach-routine-trigger` testid made static (628041add) |
| F-02-PROFILE-1 | 02 | LOW | Profile lookup `workspace_id` filter on emma/botsson chat BFF (628041add) |
| F-08-JR-1 | 08 | MEDIUM | 5 journey doc e2e path pointers (`apps/e2e/day-line/...` → `apps/e2e/tests/day-line/...`) (628041add — pre-finding closure) |
| LOW-5 | 07 | LOW | TaskCreated.metadata `description` + `scheduled_at` optional fields registered (cd80b3a26 earlier today) |
| Drift baseline | n/a | n/a | drift-check baseline re-aligned earlier today |
| W2.2 | 07 | n/a | task schema W2.2 closed earlier today |

---

## Open findings — by severity

### CRITICAL
None.

### HIGH

| ID | File:Line | ADR | Description | Open since |
|---|---|---|---|---|
| F-11-OKLCH-COMP | ~50 files, ~283 occurrences (DashboardShell, NavItem, WorkspaceSwitcher, SlotPicker, ApplyTemplateDialog, SavedTimelinesDropdown, schedule/_components/*) | 0366 | Component-level Tailwind arbitrary `[oklch(...)]` literals — should be CSS variable tokens | 2026-05-18 (new) |
| F-11-OKLCH-GLOBAL | `apps/web/src/app/globals.css:381, 414, 430-446, 502-503, 511` (~18) | 0366 | OKLCH literals outside `@theme inline` + `@layer base` blocks | 2026-05-18 (new) |
| F-12-I18N-SURFACES | `DashboardShell.tsx` (0 `t()`), `WebDayControl.tsx` (0 `t()`), `app/login/page.tsx` (0 `t()`) | CLAUDE.md i18n | 3 critical surfaces fully un-migrated; entire DashboardShell hardcoded NO | 2026-05-13 (worsened) |
| F-10-I18N-WIZARD-1 | `apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx:31-39` | CLAUDE.md i18n | 9 field labels + 9 placeholders hardcoded Norwegian; `t()` available via props but bypassed | 2026-05-18 (new) |
| F-10-I18N-WIZARD-2 | `apps/web/src/app/onboarding/steps/TariffSection.tsx:64-65,325,357,506,508` + `ConfirmRoles.tsx:20-83` | CLAUDE.md i18n | TariffSection + ConfirmRoles do not import `useTranslation` at all; radio options + error messages + role suggestions hardcoded | 2026-05-18 (new) |

### MEDIUM

| ID | File:Line | ADR | Description | Open since |
|---|---|---|---|---|
| M-001 | `packages/ai/src/capabilities/billing-query/tools.ts:249-279` | 0151 | `get_usage_snapshot` accepts body-supplied `workspace_id`; company-scope anchor limits blast radius but ADR-0151 violation persists | 2026-05-18 (downgraded from baseline HIGH) |
| M-002 | `packages/ai/src/capabilities/payroll/tools.ts:1104-1118, 1186` | 0204 | `adjust_timebank_balance` + `force_timebank_payout` — gate-then-direct insert outside `gatedMutation` (payroll convention pattern) | 2026-05-18 (new explicit; pattern pre-existing) |
| M-003 | `packages/ai/src/capabilities/shift-lifecycle/tools.ts:350-362, 177` | 0204 | `approve_shift` + `publish_shift` — gate-then-direct update outside `gatedMutation` | 2026-05-18 (new) |
| M-004 | `packages/ai/src/capabilities/timeline-template/tools.ts:318-346` | 0173, 0240 | `apply_template` inserts `session_hook` directly instead of delegating to operations capability (cross-namespace write) | 2026-05-18 (new) |
| F-04-OKLCH-DAY | 9 files under `apps/web/src/components/day/` + `dashboard/schedule/_components/` (~20 occurrences) | 0366 | Day-component sub-cluster of HIGH F-11 family (SaveTemplate, SavedTimelines, ApplyTemplate, SlotPicker, TimelineTab, shift-employee-tag, shift-task-tag, week-grid:430, shift-ghost-tag) | 2026-05-18 (new, subset of F-11) |
| F-09-02 | ADR-0321 (Swap↔Marketplace Convergence V2) | 0304 | Marked `superseded` but 14 live references outside `decisions/`; ADR-0304 mandates code deletion at close-feature | 2026-05-18 (new) |
| F-12-FM-MODULE | ~2,800 of 2,936 docs/*.md | CLAUDE.md frontmatter | `module:` field missing from majority — ADRs, plans, learnings all lack it; aspirational requirement not enforced | 2026-05-13 (unchanged) |
| F-12-FM-NONE | 108 docs/*.md | CLAUDE.md frontmatter | Zero frontmatter at all (concentrated `docs/research/`, `docs/superpowers/plans/`, `docs/design/`) | 2026-05-13 (unchanged) |

### LOW

| ID | File:Line | ADR | Description | Open since |
|---|---|---|---|---|
| L-001 | `packages/ai/src/capabilities/billing-query/tools.ts:249-279` | 0186 | `get_usage_snapshot` returns PII-adjacent counted_profile_ids without read-emit | 2026-05-18 |
| L-002 | `packages/ai/src/capabilities/schedule/tools.ts:138` | n/a | `getShiftColleagues` uses `.eq("id", ...)` instead of `schedule_shift_id` on first query (inconsistent with line 148) | 2026-05-18 |
| L-003 | `packages/ai/src/capabilities/contract-intake/tools.ts:396-445` | 0099 | `get_intake_progress` reads PII columns (personal_number, bank_account, address) without explicit gate; self-scoped read, no audit-emit | 2026-05-18 |
| F-02-A | `supabase/functions/engine-dispatch/index.ts:208-228` | 0042 | Idempotency SELECT advisory only; UNIQUE index is true guard; concurrent dispatch ticks could race | 2026-05-18 |
| F-02-B | `supabase/functions/engine-dispatch/handlers/day-line-push.ts:296` | 0367 | Profile lookup by `employee_id` without workspace scope filter | 2026-05-18 (new) |
| F-04-DUTY | `OversiktTab` `updateDutyLeaderMutation:105` | 0186 | Comment claims emit lives in Server Action; Server Action body unverified — possible L-0176 docstring drift | 2026-05-18 |
| F-04-STUB | `evaluate-framework-rules.ts:128 (sunday_holiday_shift), :140 (split_shift_gap)` | n/a | Two rule stubs lack ADR-phase deferral annotation; sunday_holiday_shift produces false negative on holidays | 2026-05-18 |
| F-06-02 | `packages/ai/src/capabilities/legal/index.ts` `cite_law` | 0078, 0163 | Docstring says "chat channel only" but `allowedChannels` includes `system`; no Layer-3 guard in tool body | 2026-05-18 |
| F-06-03 | `services/contract-service/src/routes/webhooks.ts` | 0249 | Deprecated DocuSeal webhook handler still inserts contract_event with no `emit()`; not in production traffic path but residual maintenance trap | 2026-05-18 |
| F-07-03 | `supabase/migrations/20260620140200_announcement_meta.sql` | n/a | `set_updated_at` trigger present but no `updated_at` column on `announcement_meta`; will error on first UPDATE (RPC-only writes today, so latent) | 2026-05-18 |
| F-07-04 | `supabase/migrations/20260620120300_shift_session.sql` | 0044 | `shift_session` has no JWT INSERT/UPDATE policy; service_role-only write path; document intent or add policy before mobile direct-write | 2026-05-18 |
| F-09-01 | `docs/decisions/0322-*` | n/a | ADR-0322 slot has no file, no decision-log row, no cross-reference; not documented as reserved | 2026-05-18 |
| F-12-DATES | `JOURNEY-audit-fsc04-*.md` (3 files) | CLAUDE.md frontmatter | Future-dated `updated: 2026-06-10` | 2026-05-18 |
| F-12-PARTIAL | `ReconciliationView.tsx:142, 197, 327` | CLAUDE.md i18n | Partial i18n migration (2 `t()` calls + 7 Norwegian characters remaining) | 2026-05-18 |

### INFO / Cosmetic

GAP-MOB-01 (spokesperson content-authoring on mobile, no ADR exception doc); GAP-MOB-02 (BFF route `/api/mobile/shifts` not yet built, Phase 3a); stale "Ultravox" docstring in `apps/mobile/.../botsson-provider.tsx:7`; F-06-04 (legal `classify_amendment` Phase 0c stub); F-09 superseded ADR live-ref sweep needed (0035/0041/0046/0055/0145/0146/0147); F-11 perf-budgets coverage 4/12 high-complexity routes (`/dashboard/hms`, `/dashboard/komm/*`, `/dashboard/year-wheel`, `/dashboard/season/*` missing); F-11 motion magic numbers ~19 files (non-canonical springs in KpiPillGrid, OtpVerificationForm, login/page.tsx).

---

## Delta vs baseline 2026-05-13

| Bucket | Count | Notes |
|---|---|---|
| **New CRITICAL** | 0 | Baseline 3 CRITICALs (F-DB-09, F-OB-10-01, F-CL-11) all closed and remain closed. F-EF-03 closed and not re-verified (slice 03 missing). |
| **New HIGH** | 4 | F-11-OKLCH-COMP (ADR-0366 component violations, 283 hits); F-11-OKLCH-GLOBAL (globals.css OKLCH outside @theme); F-10-I18N-WIZARD-1 (ConfirmBusiness fields); F-10-I18N-WIZARD-2 (TariffSection + ConfirmRoles entire file no `useTranslation`) |
| **New MEDIUM** | 7 | M-001 (billing-query body workspace_id, downgraded from baseline HIGH); M-002/M-003/M-004 (gate-then-direct + cross-namespace write — pre-existing pattern now explicitly classified); F-04-OKLCH-DAY (subset of F-11); F-09-02 (ADR-0321 superseded with live refs); F-02-B day-line-push profile workspace scope |
| **New LOW** | 11 | L-001/L-002/L-003 capability hygiene; F-02-A advisory idempotency; F-04-DUTY/F-04-STUB; F-06-02/F-06-03; F-07-03/F-07-04; F-09-01 ADR-0322 gap; F-12 future dates / partial i18n |
| **Regressed** | 0 | No baseline closure has re-appeared. Mobile L-0083 ESLint enforcement holding (slice 05 PASS). ADR-0099 / ADR-0151 / ADR-0163 perimeter intact. |
| **Closed since baseline** | 7 | Per baseline § Closed: F-DB-09, F-OB-10-01, F-CL-11, F-EF-03, F-CL-12, F-CL-13, F-CL-17 — all confirmed closed by 2026-05-13/14/16 commits and slice 06 + slice 07 re-verification. Plus today's 628041add: F-02-PROFILE-1, F-07-SD-1, F-14-ATR-1, F-08-JR-1. |
| **Unchanged open from baseline** | ~2 | F-IF-01 (i18n adoption, NOW elevated to per-file findings F-10/F-12); ADR drift items (`Accepted` case-typos, ADR-0260 unscheduled, ADR-0053 stale) — not actively re-checked this cycle. |

**Bottom-line delta:** 7 baseline items closed including all 3 CRITICALs + the F-EF-03 quota-abuse vector. **Zero regressions.** ADR-0204 D6 mutation governance backlog **shrank** vs baseline (the gate-then-direct pattern in payroll/shift-lifecycle/operations is now explicitly classified as MEDIUM with ADR amendment recommended, rather than HIGH backlog). The 4 new HIGHs are entirely in the i18n + ADR-0366 design-system axes — both axes that lack enforcement.

See `delta.md` for explicit baseline match table.

---

## Recommended next sortier (max 5, prioritized)

1. **ADR-0366 OKLCH token migration — Phase 1: high-traffic surfaces** (M, ADR-0366)
   - Scope: `DashboardShell.tsx`, `NavItem.tsx`, `WorkspaceSwitcher.tsx`, `SlotPicker.tsx`, `ApplyTemplateDialog.tsx`, `SavedTimelinesDropdown.tsx`, plus the 6 `[data-document-mode]` OKLCH literals in `globals.css`. Add ~4–6 new CSS variable tokens to `tokens.css` + `tokens.ts`.
   - Acceptance: grep `oklch(` in `apps/web/src/{components,app}/**/*.{tsx,css}` returns 0 for the 6 target files; design-tokens build passes; Storybook (if present) renders unchanged; `globals.css` `@theme` block is the only OKLCH location outside `tokens.css`.

2. **Onboarding wizard i18n migration** (M, CLAUDE.md i18n)
   - Scope: `ConfirmBusiness.tsx`, `TariffSection.tsx`, `ConfirmRoles.tsx` — add `useTranslation` import + key namespace `onboarding.fields.*` / `onboarding.tariff.*` / `onboarding.roles.*`. Both `nb` and `en` JSON files updated atomically.
   - Acceptance: 0 hardcoded NO strings in those 3 files; type-check passes; e2e `onboarding-step3-tariff.spec.ts` passes against new i18n keys.

3. **Capability gate-then-direct → `mutateWithGate` migration + ADR amendment** (L, ADR-0204)
   - Scope: One sortie ships an ADR amendment formally permitting the `callGateAction + direct write` pattern as a documented variant OR migrates payroll/shift-lifecycle/operations/onboarding tools to `mutateWithGate`. Includes M-002, M-003, M-004 family.
   - Acceptance: Either ADR-0204 §Variants section accepts payroll convention with audit-table linkage requirement, or all gate-then-direct sites in `tools.ts` use `mutateWithGate`. Trust Gate table in `smartout-agent-dev` SKILL.md updated.

4. **DashboardShell + Login + WebDayControl i18n migration** (L, CLAUDE.md i18n)
   - Scope: 3 highest-visibility surfaces fully un-migrated. Each is a self-contained sortie. DashboardShell first (~30+ hardcoded strings); Login second (entry point); WebDayControl third (operational surface, NORWEGIAN_DAYS array stays as date-locale utility).
   - Acceptance: `t()` adoption in all 3 files; en + nb locale JSON updated; smoke navigation green.

5. **ADR registry hygiene sweep** (S, ADR-0304)
   - Scope: Document ADR-0322 as `reserved/renumbered — do not reuse` in decision log (F-09-01). Run sister-sweep on ADR-0321's 14 live refs to confirm docs-only (F-09-02). Backfill `module:` field on ADRs via path-derived script OR amend protocol to scope `module:` requirement to `docs/modules/**` only (F-12-FM-MODULE). Fix 3 future-dated journey docs (F-12-DATES).
   - Acceptance: 0322 row present in decision log; ADR-0321 references documented as historical; protocol clarified; 3 journey docs back-dated to 2026-05-18.

---

## Cross-cutting patterns

**1. Enforcement-less ADRs accumulate violations geometrically.** ADR-0366 (OKLCH literal ban) has no ESLint rule and no CI check. Result: 283 component-level violations across ~50 files, plus 18 inside `globals.css` itself. The same dynamic that produced the L-0083 mobile empty-string backlog (closed only when ESLint rule shipped 2026-05-14) is now playing out on design tokens. The CLAUDE.md "no hardcoded Norwegian" rule has the same shape: aspirational, not enforced, 90% of NO-containing files have zero i18n. **Pattern:** any ADR that bans a syntactic shape (raw OKLCH, empty-string fallback, hardcoded NO text) must ship the ESLint rule in the same sortie or the rule reverts to convention. Promote to baseline gate.

**2. Mid-audit pattern reclassification ≠ regression.** The 2026-05-13 baseline classified ADR-0204 gate-then-direct payroll/shift-lifecycle pattern as HIGH backlog growth. This cycle re-classifies the same pattern as MEDIUM with documented exception path (M-002/M-003): the docstring at `payroll/tools.ts:69` explicitly names it "established payroll convention." This is convergence-on-meaning, not regression — but it does expose that ADR-0204's canonical `gatedMutation` requirement has a de-facto variant that the ADR itself doesn't acknowledge. Recommend ADR-0204 amendment or full migration; do not leave the convention undocumented.

**3. Slice coverage discipline is fragile under in-flight pressure.** Slices 03 (Edge Functions) and 14 (Missions/E2E) were not delivered this cycle. Baseline 2026-05-13 had both. The audit framework loses signal on auth perimeter (last verified 5 days ago) and mission/E2E coverage every time a slice is skipped. The deploy-pipeline has `drift-check` + `adr-contract-audit` as complementary scopes per ADR-0265 — sliced audits need a similar "missing slice = mandatory follow-up smoke" rule. F-EF-03 (5 unauthenticated intelligence EFs closed 2026-05-13 by feat/audit-fef03-intelligence-ef-auth) should be re-verified by a slice-03 smoke probe before the next full audit.
