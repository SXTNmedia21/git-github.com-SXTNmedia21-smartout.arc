---
title: "Tri-layer D6 decomposition for M:N place→workshop relationships"
id: LEARNING_0308
status: canonical
layer: learning
created: 2026-05-18
updated: 2026-05-18
tags: [cascade, d6, pattern, decomposition, area-anchored]
---

# Learning-0308: Tri-layer D6 decomposition for M:N place→workshop relationships

## Context

Pre-implementation council on ADR-0367 evaluated four options for area-anchored Dagslinje: (A) add `location_id` to `department_session`, (B) add `location_id` to all session children, (C) introduce `day_line` as child of `department_session` + `shift_session` for per-employee runtime, (D) wrap `department_session` via FK. Option C selected unanimously across 5 reviewers.

## Discovery

The tri-layer D6 model — **aggregate → program → runtime** — is the canonical pattern for any case where a D6 production aggregate (one row per dept-day) needs to fan out across multiple physical or operational spaces while preserving:

1. The aggregate row's role as the C1 reconciliation + payroll anchor
2. Per-space configuration that may diverge from the aggregate (open/close hours, items, ownership)
3. Per-employee runtime witness state (clock-in, push subscription, item completion) that depends on which space they staff

| Layer | Question | Cardinality | Lifecycle owner |
|---|---|---|---|
| Aggregate | "What is the dept-day's accounting status?" | 1 per (dept, date) | C1 reconciliation, payroll |
| Program | "What is happening at this space today?" | N per aggregate (one per area) | Manager (admin authoring) |
| Runtime | "What is THIS employee doing on THIS shift?" | M per aggregate (one per shift × employee) | Auto-bound at shift insert; lifecycle via clock-in capability |

The pattern composes onto existing infrastructure rather than replacing it:
- Aggregate: kept untouched (payroll-FK preserved)
- Program: child via FK + UNIQUE on `(aggregate_id, location_id)`
- Runtime: child via FK + UNIQUE on `schedule_shift_id`
- M:N junction between Program and Runtime when one shift spans multiple programs (e.g. employee covers Bar + Event-floor)

Status on Program rows is DERIVED from `(parent aggregate.status, daily_reconciliation.locked, child.cancelled_at)` — never stored as own column. Closes the L-0064 dual-source-of-truth drift class.

## Impact

Reusable when a future module needs the same M:N decomposition:
- Multi-dept staffing of one area (event-floor staffed by Bar + Kitchen + Service)
- Multi-area span of one department (Bar-dept covering Bar + Restaurant + Event)
- Multi-property workspaces (deferred V2; same pattern with property layer above aggregate)
- Zone-grained shift assignment (V2; `shift_session.zone_id` nullable FK extends Runtime layer)

The pattern is **NOT** appropriate when:
- The aggregate doesn't have payroll/C1 obligations (no need to preserve)
- Cardinality is 1:1 (use single table with denormalized fields)
- The "program" layer is purely declarative configuration with no runtime state (use a templates table per ADR-0335 pattern)

## References

- ADR-0367 (Day Line Area-Anchored Runtime, accepted 2026-05-18)
- ADR-0156 (Day Control Panel — amended for multi-strip stack)
- ADR-0297 (Workforce snapshot — amended for `day_lines[]` + `my_shift_session{}`)
- L-0064 (phase-enum UI-vs-DB drift — closes pattern that derive-from-parent prevents)
- Cascade canonical spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
