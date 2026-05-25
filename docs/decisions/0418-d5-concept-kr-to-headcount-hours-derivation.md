---
id: ADR-0418
title: D5 Concept parameter — kr→headcount-hours conversion lives outside solver
status: draft
date: 2026-05-25
author: System Council (system-steward chair)
related: ADR-0307, ADR-0309, cascade-spec-2026-03-21
tags: [scheduling, cascade, D4, D5, solver, season_budget, demand-sizing]
---

# ADR-0418 — kr→headcount-hours conversion is a D5 Concept derivation, NOT inside solver scoring

## Context

Council 2026-05-25 identified gap 10: `BASELINE_HEADCOUNT = 2` is hardcoded at `packages/ai/src/capabilities/scheduler/tools.ts:97`. Briefing proposed wiring `season_budget.target_revenue × labor_cost_pct` directly into the solver scoring function to replace the constant.

This blends D4 (Demand Signal — `day_factor`, `hour_factor`, `season_budget`) with C3 (Commercial Outcome — kr cost reasoning) inside the solver. Cascade invariant #2 ("every datum has one role") is violated when financial reasoning lives inside D4 demand scoring.

Per cascade canonical spec:
- D4 carries the demand SIGNAL (where + when + how much, dimensionless multipliers)
- D5 Concept parameterizes coefficients consumed by D1-D4 + D6
- C3 reasons about value + cost attribution
- Solver runs in D6 production after all dimensions have produced their inputs

## Decision

The conversion from kr (revenue × labor%) → headcount-hours is a **D5 Concept parameter** (workspace's labor economics: `avg_hourly_cost`, `position_required_coverage_minimum`).

Correct flow:

1. **D4 input** — derive `total_target_labor_hours = (season_budget.target_revenue × season_budget.labor_cost_pct) / D5.avg_hourly_cost`
2. **D4 distribution** — `day_factor × hour_factor` redistributes those hours across the week (per `season_budget_id, weekday|hour` UNIQUE — NOT per date|department per L-0348)
3. **D5 Concept parameter** — `position_required_coverage_minimum` defines per-position floor (e.g. "always ≥1 bartender")
4. **D6 Solver** — allocates shifts to honor distribution + coverage minimum

`loadSolverContext()` reads the derived `total_target_labor_hours` (NOT raw `season_budget`) and the D5 coverage minimum. Solver scoring function takes pre-derived `demand_buckets[].score` (already a number); does not perform kr-arithmetic.

`BASELINE_HEADCOUNT = 2` stays as documented V1 stub until the D5 Concept derivation step is implemented. Replacing it with a cross-dimensional shortcut (briefing proposal) is REJECTED.

## Consequences

- New D5 parameter required: `avg_hourly_cost` per workspace (or per department + season). Schema location: `workspace_config` or new `season_concept_parameter` table — to decide in implementation sortie.
- New derivation step in `loadSolverContext()` (read season_budget + D5 params → compute total_target_labor_hours → distribute via day/hour factor)
- Solver scoring function signature unchanged (still takes `demand_buckets[].score`)
- Scheduling domain `GAPS-AND-DEBT.md` adds tech-debt entry: `T6 — D4 demand sizing missing C3↔D4 derivation step`
- Audit trail preserved: kr math happens in a named function with explicit inputs, not buried in scoring formula

## Status

Draft — implementation deferred to Phase 2+ of "Sett opp juni for meg" sortie chain. Blocked on L-0348 (solver column drift) closing first.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-25
- `packages/ai/src/capabilities/scheduler/tools.ts:97,114` (BASELINE_HEADCOUNT hardcoded)
- `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` (D4/D5/C3 ontology)
- ADR-0307 (greedy solver V1), ADR-0309 (bundle proposal)
