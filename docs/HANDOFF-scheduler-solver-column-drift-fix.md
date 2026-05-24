---
title: HANDOFF — Scheduler solver column drift fix (L-0348)
status: ready_for_close
updated: 2026-05-25
created: 2026-05-25
module: scheduling
tags: [handoff, scheduler, solver, bug-fix, L-0348]
---

# HANDOFF — Scheduler solver column drift fix

## Summary

CRITICAL bug fix. `scheduler.propose_plan` was silently broken in development since the column-name drift between `loadSolverContext` (`packages/ai/src/capabilities/scheduler/tools.ts:60-250`) and current schema went undetected. Solver got empty `day_factor` + `hour_factor` + `existing_shift` results across the board, fell back to factor=1.0, and produced incoherent proposals. Council 2026-05-25 ("Sett opp juni for meg" gap analysis, code-tracer Layer 2 system-agent-coordinator) surfaced via `database.types.ts` cross-check.

Fix replaces 4 column families (day_factor, hour_factor, schedule_shift, profile) + adds active `season_budget_id` resolver via `season` table date-range overlap.

## What was built

| Component | File | Change |
|---|---|---|
| Solver loader | `packages/ai/src/capabilities/scheduler/tools.ts:77-249` | 3-place column rewrite + season_budget resolver + weekday convention mapping |
| Regression test | `packages/ai/src/capabilities/scheduler/__tests__/load-solver-context.test.ts` (NEW) | 4 column-spy tests lock fix against future drift |
| Mock chain | `packages/ai/src/capabilities/scheduler/__tests__/tools.test.ts:73-83` | extended with `.or()` + `.order()` + `.limit()` for season-budget resolver chain |

## What changed (schema reality)

| Was queried | Is queried |
|---|---|
| `day_factor.date` + `department_id` (NONE exist) | `day_factor.weekday` + `season_budget_id` (per migration `20260306100000:95`) |
| `hour_factor.hour_of_day` + `department_id` (NONE exist) | `hour_factor.hour` + `season_budget_id` (per migration `:140`) |
| `schedule_shift.date` + `profile_id` (NONE exist) | `schedule_shift.shift_date` + `employee_id` (per migration `20260301300000`) |
| `profile.employment_status` (does NOT exist) | `profile.status` (profile_status enum) |

Weekday convention: `day_factor.weekday` uses 0=Mon..6=Sun (Norwegian). JS `Date.getUTCDay()` returns 0=Sun..6=Sat. Conversion: `weekday = (jsDay + 6) % 7`.

Active season_budget resolution: SELECT `season` WHERE `workspace_id` + `status='active'` + `start_date <= cycle_end` + `(end_date IS NULL OR end_date >= cycle_start)`, then SELECT `season_budget` by `season_id`. If no active season → `seasonBudgetId = null` → day/hour factor queries skipped → solver falls back to factor=1.0 (degraded but non-broken).

## Decisions made

| ADR/decision | Where registered |
|---|---|
| Trainee paired-only behavior NOT implemented in this sortie | Plan §scope-out; per ADR-0419 separate sortie |
| BASELINE_HEADCOUNT=2 stays hardcoded | Plan §scope-out; per ADR-0418 D5 Concept derivation separate sortie |
| accept_proposal TOCTOU race NOT fixed | Plan §scope-out; pre-existing H1, separate sortie |
| Use unit-level column-spy tests (NOT live-DB integration) | Trade-off: live integration would need seeded local Supabase + new infra; column-spy locks the same regression at much lower cost. Live verification recommended as manual /verify pass after merge. |

## Learnings

| L | What |
|---|---|
| L-0348 (existing) | This sortie closes the CRITICAL flagged by council 2026-05-25 |
| New observation | profile.employment_status drift was 4th column-family broken — council briefing only enumerated 3. Pattern: code-tracer enumeration sometimes misses adjacent same-class drifts. Sibling of L-0350 (briefing tool-count off-by-one). Worth tracking in next council if 2nd occurrence within 30 days. |

## Acceptance status (vs plan)

| Item | Status |
|---|---|
| `pnpm typecheck` 0 errors in @smartout/ai | ✓ 7/7 turbo tasks successful |
| Integration test against seeded local Supabase | ⚠️ REPLACED with column-spy unit test (4 tests in `load-solver-context.test.ts`) — see decisions table. Live integration deferred to manual /verify. |
| `propose_plan` against demo workspace produces real `gap_count` | ⚠️ NEEDS MANUAL VERIFY — run `/verify` post-merge on dev w/ seeded workspace + active season + planning_cycle |
| No regression in existing scheduler unit tests | ✓ 34/34 green (4 + 9 + 13 + 8) |
| HANDOFF doc | ✓ this file |

## Next steps

1. Manual /verify on dev: run propose_plan via Botsson chat against demo workspace w/ active season; assert `change_proposal.changes->gap_count` is non-zero AND `proposed_shifts[]` non-empty when roster is thin.
2. Close C2 (G10 TZ wrong-day) — next pre-work sortie.
3. Close C3 (G9 profile_id BFF forgery, ADR-0151 compliance) — pre-work.
4. After 3/3 pre-work done → Phase 1 (diagnose_turnus_disabled + wire timeline_template into mr-botsson).

## Known issues / debt

- L-0348 closed but parent solver still has BASELINE_HEADCOUNT=2 hardcoded (ADR-0418 deferred).
- Single role "employee" + position_id = department_id (V1 limits documented in spec).
- accept_proposal TOCTOU race (`scheduler/tools.ts:432-437`) NOT touched — `publish_week` per ADR-0420 must NOT inherit pattern (use SELECT FOR UPDATE).
- Tests are mock-based; no real integration against seeded Supabase yet. Recommended infra investment for any future scheduler sortie.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-25
- L-0348: `docs/learnings/0348-solver-column-drift-silent-empty.md`
- ADRs: ADR-0418 (D5 Concept), ADR-0419 (trainee), ADR-0420 (publish_week)
- Plan: `docs/superpowers/plans/2026-05-25-scheduler-solver-column-drift-fix.md`
- Journey: `docs/journeys/JOURNEY-scheduler-solver-column-drift-fix.md`
- Commits: `b97eaebf1` (plan+journey), `bdf2bc2d2` (fix+tests)
