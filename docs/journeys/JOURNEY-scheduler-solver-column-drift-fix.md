---
title: Journey — Scheduler solver column drift fix
status: in_progress
updated: 2026-05-25
created: 2026-05-25
module: scheduling
tags: [journey, scheduler, propose_plan, L-0348]
---

# Journey — `propose_plan` returns real proposals (not silent-empty)

## J1 — Manager invokes Botsson `propose_plan` against active planning cycle

**Role:** Manager (with `scheduler` capability authority `confirm`)
**Precondition:**
- Workspace has active `season` + `season_budget` row
- `planning_cycle` row exists for the target window (e.g. Uke 26, 2026)
- ≥1 active `profile` + `employment_contract` rows for the workspace
- `day_factor` rows seeded (7 rows per workspace, default 1.0 from `season.create`)
- `hour_factor` rows seeded (24 rows per workspace, default 1.0)
- At least one `day_factor.factor` != 1.0 OR `hour_factor.factor` != 1.0 to test non-trivial demand

**Steps (happy path):**
1. Manager opens Botsson chat on `/dashboard/schedule` →
   System renders chat panel "Hei. Hva trenger du hjelp med?"
2. Manager types: "Foreslå vaktplan for uke 26" →
   Intent classifier routes to `scheduler` capability
3. Stage Engine calls `scheduler.propose_plan({ planning_cycle_id: <uuid> })` →
   `loadSolverContext()` reads:
   - `planning_cycle` envelope (D1)
   - active `season_budget_id` for the cycle window
   - `day_factor` rows by `(season_budget_id, weekday)` — POST-FIX correct schema
   - `hour_factor` rows by `(season_budget_id, hour)` — POST-FIX
   - `profile` + `employment_contract` (D2)
   - `schedule_absence` (D2)
   - `schedule_shift` by `(workspace_id, department_id, shift_date)` — POST-FIX uses `shift_date`
   - `framework_rule` (D3)
4. `solveGreedy(solverInput)` runs greedy constraint solver →
   produces `SolverProposal` with `proposed_shifts[]` + `gaps[]` + `objective_score`
5. `mutateWithGate` (ADR-0204) wraps INSERT to `change_proposal` (kind=`scheduler_bundle`) →
   Manager sees in chat: "Planforslag opprettet (proposal_id=...). Foreslåtte vakter: N. Mangler: M (gap-rate X%). Kvalitetsscore: Y%. Gå til /dashboard/schedule/proposed-plan for å godkjenne eller avvise."

**Postcondition:**
- 1 `change_proposal` row in DB with non-empty JSONB `proposed_shifts[]`
- `gap_count` reflects real demand×roster mismatch (NOT silent-zero)
- `solver_inputs_hash` populated for re-derivability
- Telemetry `scheduler.proposal.proposed` emitted with non-empty `proposed_shift_count`

**Error paths:**
- **No active season_budget for cycle window** → tool returns "Ingen aktiv sesong-budget for planleggingsperioden. Aktiver sesong først via /dashboard/year-wheel."
- **planning_cycle not found** → existing error path (line 73-75) keeps "planning_cycle not found or not in workspace"
- **Channel != chat** → existing ADR-0288 guard (line 273) keeps "propose_plan er bare tilgjengelig i chat — ikke via stemme"
- **mutateWithGate denies** → existing `MutateWithGateDenied` path (line 365-367)

## What changes vs broken state

BEFORE fix: `loadSolverContext` silently returns empty `day_factors[]` + `hour_factors[]` + `existing_shifts[]` because PostgREST `.eq("date", ...)` against non-existent column either errors (400) or returns empty (silent). `solveGreedy` runs with default factor=1.0 across all buckets + zero existing shifts → outputs incoherent proposals. Manager sees plausible-looking output that doesn't reflect actual season demand.

AFTER fix: real `day_factor` + `hour_factor` rows feed the solver. Manager sees gaps that reflect actual coverage shortfall.
