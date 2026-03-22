---
title: "Worklog — cascade-foundation"
status: done
updated: 2026-03-22
created: 2026-03-22
module: cascade
tags: [cascade, bootstrap, rules, tariff, governance, demand]
---

# Worklog — cascade-foundation

> Branch: `feat/cascade-foundation` | Worktree: wt-2 | Started: 2026-03-22

## Status: Done

## Done

- [x] Phase A+B schema validation (17 tables, 9 enums)
- [x] Phase B migration — 3 new tables + 6 ALTERs
- [x] K1a platform seed — 8 rules, 8 triggers, 5 tariff rates
- [x] Fix hospitality.ts rates + add dept offsets + payroll templates
- [x] Cascade types — bootstrap, tariff, evaluation
- [x] Bootstrap cascade Edge Function — 10-step, idempotent
- [x] Hook bootstrap into finalize-workspace
- [x] Rewrite evaluateFrameworkRules() — 14 tests
- [x] Tariff resolution — loader + pure function, 10 tests
- [x] Invite dialog — employment type + payroll fields
- [x] Accept-invitation employee cascade
- [x] Contract signed payroll sync (DB trigger)
- [x] Session filter by department_type
- [x] Operating hours offset model
- [x] Change proposal preview + apply EF + UI
- [x] snapshot_basis enum + cost provenance columns
- [x] buildEntityContext() — 9 tests
- [x] useShiftRuleCheck() + shift-modal integration
- [x] usePublishValidation() hook
- [x] "shift published" payload enrichment + "shift completed" emit
- [x] cascade_cost_snapshot engine action + seed
- [x] Admin settings: Regelverk section (rules, tariffs, proposals)
- [x] propagateBudgetTargets() — 7 tests
- [x] cascade_budget_propagation engine action + seed
- [x] Telemetry registry update (budget/factor events)
- [x] Final validation — 359 tests, typecheck clean

## Decisions

| Date       | Decision                                                  | Reason                                 |
| ---------- | --------------------------------------------------------- | -------------------------------------- |
| 2026-03-22 | Dual-layer: client pure functions + server engine actions | Instant UI + authoritative computation |
| 2026-03-22 | Skip server RPC for shift validation                      | No API consumers yet                   |
| 2026-03-22 | Cost snapshots: planned + actual                          | Planning + accounting                  |
| 2026-03-22 | Push + invalidate for demand propagation                  | Fast reads, always current             |
| 2026-03-22 | Admin visibility in settings, not top-level page          | Admins think in "settings"             |

## Log

| Date       | Time  | Event                                |
| ---------- | ----- | ------------------------------------ |
| 2026-03-22 | 13:56 | Feature started                      |
| 2026-03-22 | 14:45 | Foundation phase complete — 18 tasks |
| 2026-03-22 | 15:30 | Operational layer plan — 22 tasks    |
| 2026-03-22 | 16:40 | All tasks complete                   |
| 2026-03-22 | 16:55 | 359 tests, typecheck clean           |
| 2026-03-22 | 17:00 | Feature closure                      |
