---
id: "0085"
title: "Year Wheel Governance Policy"
status: accepted
date: 2026-04-10
updated: 2026-04-23
module: cascade
tags: [planning-cycle, year-wheel, governance, season]
superseded_by: "ADR-0200 §Consequences known-risk (partial — archive→activate partial-success window only)"
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

## Superseded-By

**ADR-0200** (2026-04-23) supersedes the §Consequences known-risk item in this ADR — specifically the "Long-term fix: wrap in a DB function/RPC" deferral for the archive→activate partial-success window.

The rest of ADR-0085 (single active cycle policy, status transitions, seasons without linked cycle, archive behavior) remains `accepted` and in force. Only the `activateCycle`/`activateSeason` two-sequential-DB-calls known-risk is closed.

ADR-0200 delivers the long-term fix as three coordinated layers:

1. `activate_season(p_workspace_id, p_season_id) RETURNS JSONB` — SECURITY DEFINER plpgsql RPC wrapping archive+activate in a single Postgres transaction.
2. `trg_season_activated` trigger extension — idempotent D1 copy (`NOT EXISTS` guard) from DEFAULT hours rows to SEASON hours rows.
3. Server Action `activate-season-action.ts` — the only application-layer call path in M1, gated by `gate_action({capability: 'season.activate'})`.

Status stays `accepted` (not `superseded`) because ADR-0085's scope is broader than the one deferral that ADR-0200 closes. When ADR-0200 text says "Supersedes ADR-0085 §Consequences known-risk" it refers exclusively to that section's long-term-fix deferral. Readers arriving at this ADR for cycle governance rules continue to find them here.

See: ADR-0200 §Supersedes and §Consequences for the full three-layer design.
