---
title: Audit Delta — 2026-05-18 vs 2026-05-13
status: complete
created: 2026-05-18
updated: 2026-05-18
mode: full
baseline: 2026-05-13-adr-contract-validation
tags: [audit, delta, adr]
---

# Delta — 2026-05-18 vs 2026-05-13

## Summary

| Bucket | Count |
|---|---|
| New CRITICAL | 0 |
| New HIGH | 4 |
| New MEDIUM | 7 |
| New LOW | 11 |
| Regressed | 0 |
| Closed since baseline | 7 (BLs) + 4 (628041add today) = 11 |
| Unchanged open | ~2 (F-IF-01 elevated into per-file F-10/F-12; ADR-frontmatter case-typos uncovered this cycle) |
| Slices delivered | 12 of 14 (slices 03 + 14 absent) |

## Closed since baseline (baseline-listed items now verified gone)

| Baseline ID | Sev | Closed by | Verified this cycle |
|---|---|---|---|
| F-DB-09 (D6 sister tables WITH CHECK) | CRITICAL | A.2 merge 20a573288 + A.3 staff_event | Slice 07 — 3 new tables this cycle (day_line, shift_session, announcement_meta) all use per-verb WITH CHECK pattern; sister-pattern holding |
| F-OB-10-01 (17 legacy onboarding files) | CRITICAL | feat/audit-fob10-onboarding-cleanup, 27 files deleted, ADR-0041 amended | Slice 10 — `AnimatedWizardShell` is canonical, zero legacy files remain |
| F-CL-11 (legal voice channel on §14-6) | CRITICAL | 47bffe635 (allowedChannels narrowed to chat+system) | Slice 06 — FP-001 confirmed: `["chat","system"]` is intentional layered defence, no voice |
| F-EF-03 (5 unauthenticated intelligence EFs) | HIGH→ops-CRIT | feat/audit-fef03-intelligence-ef-auth (verifyInternalAuth on all 5) | NOT re-verified (slice 03 absent — recommend smoke before next full) |
| F-CL-12 (ADR-0293 Pattern B recalc) | HIGH | feat/payroll-f-cl-12-feriepenger-recalc-pattern-b 2026-05-16 | Slice 06 — payroll tools all call computeFeriepengerBasis + emit |
| F-CL-13 (ADR-0295 feriepenger_basis=0) | HIGH | feat/audit-fcl13-feriepenger-basis 2026-05-13 | Slice 06 — basis computed per profile from `@smartout/payroll-export` |
| F-CL-17 (deleteManualSupplement misattribution) | HIGH | same payroll sortie 2026-05-16, F-CL-17 regression test | Slice 06 — employee_id used as target_profile_id, ctx.profileId only as actor |

## Closed today (628041add and earlier)

| ID | Sev | What |
|---|---|---|
| F-07-SD-1 | LOW | 2 SECURITY DEFINER functions now have `SET search_path = public` |
| F-14-ATR-1 | MEDIUM | attach-routine-trigger testid static |
| F-02-PROFILE-1 | LOW | Profile lookup workspace_id filter on emma/botsson chat BFF |
| F-08-JR-1 | MEDIUM | 5 journey doc e2e path pointers updated |
| LOW-5 | LOW | TaskCreated.metadata description + scheduled_at registered (cd80b3a26) |
| Drift-baseline | n/a | drift-check baseline re-aligned earlier today |
| W2.2 | n/a | task schema W2.2 closed earlier today |

## New findings (in current, not in baseline)

### HIGH (4 new)

| ID | File:Line | Why new |
|---|---|---|
| F-11-OKLCH-COMP | ~50 component files, ~283 hits | ADR-0366 violation count newly quantified at slice level |
| F-11-OKLCH-GLOBAL | `globals.css:381,414,430-446,502-503,511` | ADR-0366 violations inside globals.css `[data-document-mode]` and utility classes (outside @theme) — new scope |
| F-10-I18N-WIZARD-1 | `onboarding/steps/ConfirmBusiness.tsx:31-39` | Wizard polish slice — `t()` available but bypassed on 9 fields |
| F-10-I18N-WIZARD-2 | `onboarding/steps/TariffSection.tsx:64-65,325,357,506,508` + `ConfirmRoles.tsx:20-83` | Two onboarding files don't import `useTranslation` at all |

### MEDIUM (7 new)

| ID | File:Line | Why new |
|---|---|---|
| M-001 | `billing-query/tools.ts:249-279` | Re-classified from baseline HIGH after company-scope anchor analysis |
| M-002 | `payroll/tools.ts:1104-1118, 1186` | Per-tool Trust Gate audit explicitly classifies gate-then-direct as MEDIUM with payroll-convention exception |
| M-003 | `shift-lifecycle/tools.ts:350-362, 177` | Same class as M-002 on shift-lifecycle |
| M-004 | `timeline-template/tools.ts:318-346` | ADR-0173 / ADR-0240 cross-namespace write to `session_hook` |
| F-04-OKLCH-DAY | 9 files under `components/day/` + `dashboard/schedule/_components/` | Day-component subset of F-11; called out at slice level |
| F-09-02 | ADR-0321 (`status: superseded`, 14 live refs) | Newly found in superseded-ADR audit (slice 09) |
| F-12-FM-MODULE / F-12-FM-NONE | ~2,800 docs missing `module:` field; 108 with no frontmatter at all | Baseline did not survey at this granularity |

### LOW (11 new — see synthesis for full list)

L-001 / L-002 / L-003 (capability hygiene); F-02-A (engine-dispatch idempotency advisory); F-02-B (day-line-push profile workspace scope); F-04-DUTY / F-04-STUB; F-06-02 / F-06-03 (legal cite_law docstring + deprecated contract-service webhook no emit); F-07-03 / F-07-04 (announcement_meta latent trigger + shift_session JWT write policy intent); F-09-01 (ADR-0322 undocumented gap); F-12-DATES (3 future-dated journey docs); F-12-PARTIAL (ReconciliationView partial migration).

## Regressed

**None.** No closure from baseline has re-appeared.

- Mobile L-0083 ESLint enforcement holding — slice 05 PASS, no `?? ""` fallbacks anywhere.
- ADR-0204 D6 mutation governance — slice 04 PASS on cascade boundary; gate-then-direct payroll convention re-classified MEDIUM, not regression.
- ADR-0299 sister-table pattern — slice 07 confirms new tables (`day_line`, `shift_session`, `announcement_meta`) use per-verb WITH CHECK.
- Voice/PII channel boundary — slice 06 + FP-001 confirms `allowedChannels` narrow correctly held.

## Unchanged open from baseline

| Baseline ID | Status |
|---|---|
| F-IF-01 (i18n adoption 15%) | Elevated this cycle into per-file findings F-10-WIZARD-1/2 + F-12-SURFACES. Backlog grew (DashboardShell, Login, WebDayControl confirmed 0 `t()`); not actively narrowed since baseline. |
| ADR frontmatter `Accepted` case-typo + ADR-0260 unscheduled + ADR-0053 stale + ADR-0273 future-date | Not re-checked this cycle (slice 09 surveyed superseded-ADR live refs only). Likely still open. |

## Bottom-line

**Stronger campaign than baseline.** All 3 baseline CRITICALs closed and remain closed. Zero regressions on cascade, RLS, telemetry, webhook, mobile, capability gate coverage. ADR-0367 in-flight (council-APPROVED) is structurally clean.

**Net direction:** Convergence on system invariants is holding. **Drift is concentrated in two axes that lack enforcement — ADR-0366 OKLCH literals and i18n adoption.** Both will continue to grow geometrically until ESLint rules ship. Slice 03 + 14 absence reduces audit signal — recommend post-cycle smoke verification on auth perimeter + missions.
