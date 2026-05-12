---
title: "Payroll MVP Ship-Blockers Spec"
status: accepted
created: 2026-05-10
updated: 2026-05-10
module: payroll
tags: [spec, payroll, mvp, ship-blocker]
---

# Payroll MVP Ship-Blockers

## Source

This spec is materialized by Council 2026-05-10 PM (full-depth shippability audit). The canonical implementation plan lives at:

- **Plan:** `docs/superpowers/plans/2026-05-10-payroll-mvp-blockers.md` (in `campaign/payroll` worktree)
- **Linear epic:** [SMA-327](https://linear.app/smartout/issue/SMA-327)
- **Linear issues:**
  - [SMA-343](https://linear.app/smartout/issue/SMA-343) S1 + B5 — Period creation + manual time entry
  - [SMA-344](https://linear.app/smartout/issue/SMA-344) S2a — Schema unblocker
  - [SMA-345](https://linear.app/smartout/issue/SMA-345) S2b — Resolver
  - [SMA-346](https://linear.app/smartout/issue/SMA-346) S3 — Feriepenger basis
  - [SMA-347](https://linear.app/smartout/issue/SMA-347) S4 — Lock notification
  - [SMA-348](https://linear.app/smartout/issue/SMA-348) ADR-DRAFT — Feriepenger boundary

## Goal

Close 5 SHIP-BLOCKERS + 1 ADR identified by Council 2026-05-10 PM so payroll feature is shippable for hourly + tariff-bound workers in mid-size Norwegian restaurants.

## 5 BLOCKERS (audit-verified)

1. **S1** — Period-creation UI missing. Manager fastlåst etter mai låst.
2. **S2** — Custom-rate workers paid kr 0. `hourly_rate` not on `employee_payroll_profile`. salary_query Botsson tool crashes on first call. Split into S2a (schema) + S2b (resolver).
3. **S3** — Feriepenger hardcoded `feriepenger_accrued: 0` in 4 output routes. Maria-persona regnskapsfører rejects file.
4. **S4** — `payroll.period_locked` event emits but no consumer wired. Ansatt får aldri varsling.
5. **B5** — `manualTimeEntryAction` server-action production-ready, no UI surface peker på den.

## 1 ADR

ADR-0295 Feriepenger boundary — codifies that Smartout exposes basis (12% × sum), regnskapsfører computes accrued + payout. Aligns with ADR-0250 (Skatteetaten deferred — same boundary class).

## Sortie sequence (4 days)

| Day | Scope |
|---|---|
| 1 | S2a (schema) + ADR-0295 (parallel) |
| 2 | S2b (resolver) + S3 (feriepenger) (parallel) |
| 3 | S4 (notification handler) |
| 4 | S1 + B5 bundle (period creation + manual time entry) |

## Acceptance

Per-blocker acceptance criteria documented in plan. Master criterion: 19 vitest cases pass + 52/52 typecheck green + 5 declared journeys verified.

See plan for task-level breakdown.
