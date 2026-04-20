---
id: "0085"
title: "Year Wheel Governance Policy"
status: accepted
date: 2026-04-10
module: cascade
tags: [planning-cycle, year-wheel, governance, season]
---

# ADR-0085: Year Wheel Governance Policy

## Context

Planning cycles (year wheel periods) need explicit governance rules
for lifecycle management. Without documented policy, operators may
create conflicting active periods or leave orphaned seasons.

## Decision

### Single Active Cycle Policy

Only ONE planning cycle may be `active` at a time per workspace.
Activating a new cycle automatically archives the currently active one.
This prevents ambiguous "which cycle applies now?" questions.

### Status Transitions

```
draft → active → archived
         ↑          │
         └──────────┘ (reactivation allowed)
```

- **draft**: Cycle is being configured, not yet operational.
- **active**: Current operational cycle. Seasons linked to it receive
  events and factors. Only one per workspace.
- **archived**: Historical. Read-only. Can be reactivated if needed
  (which archives the current active cycle).

### Seasons Without Linked Cycle

Seasons with `planning_cycle_id = NULL` are valid but operate without
cycle-scoped events or period boundaries. The UI shows "Ingen" in the
cycle selector. No automatic fallback assignment occurs.

### Archive Behavior

Archiving a cycle does NOT archive its linked seasons. Seasons have
independent lifecycle (draft → active → archived). A season can remain
active even when its linked cycle is archived.

## Consequences

- `usePlanningCycles.activateCycle` must archive the current active cycle
  before activating the new one (implemented in Task 12).
- UI must clearly show which cycle is active and prevent confusion.
- Reactivation of archived cycles is allowed for correction scenarios.
- **Known risk:** `activateCycle` performs two sequential DB calls (archive then activate). If the second fails, the workspace temporarily has zero active cycles. This matches the existing `activateSeason` pattern and is acceptable for MVP. Long-term fix: wrap in a DB function/RPC.

### Note on scope

This ADR should be registered in `docs/decisions/0000-decision-log.md`. Additionally, `docs/reference/DATABASE.md` should be updated with the two new tables (`season_goal`, `season_policy_binding`) — this is a lightweight follow-up task.
