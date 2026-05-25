---
title: Scheduler solver column drift fix (L-0348 CRITICAL)
status: in_progress
updated: 2026-05-25
created: 2026-05-25
module: scheduling
tags: [scheduler, solver, bug-fix, L-0348, propose_plan, cascade-D4]
---

# Plan — Scheduler solver column drift fix

## Why

L-0348 (CRITICAL): `packages/ai/src/capabilities/scheduler/tools.ts:81-93,147` `loadSolverContext()` queries columns that do NOT exist in current schema. Result: `scheduler.propose_plan` silently returns empty or errors. Council 2026-05-25 surfaced via code-tracer (Layer 2 system-agent-coordinator). Blocks Phase 2 (set_day/hour_factor + apply_week_template) and Phase 3 (publish_week) of "Sett opp juni for meg" sortie chain.

## What is broken

| File:line | Code says | Schema reality |
|---|---|---|
| `scheduler/tools.ts:81-87` | `day_factor.date` + `day_factor.department_id` | `(season_budget_id, weekday INT 0-6)` — UNIQUE `uq_day_factor_weekday` |
| `scheduler/tools.ts:89-93` | `hour_factor.hour_of_day` + `hour_factor.department_id` | `(season_budget_id, hour INT 0-23)` — UNIQUE `uq_hour_factor_hour` |
| `scheduler/tools.ts:147,150` | `schedule_shift.date` + `schedule_shift.profile_id` | `shift_date` + `employee_id` |

Source migrations: `supabase/migrations/20260306100000_season_planning_tables.sql:95,140` + `20260301300000_schedule_shift_table.sql`.

## Scope (in)

1. Resolve active `season_budget_id` first via `planning_cycle.starts_at`/`ends_at` overlap + `season.is_active=true` filter
2. Rewrite `day_factor` query: SELECT `(season_budget_id, weekday, factor)` filtered by `season_budget_id`
3. Rewrite `hour_factor` query: SELECT `(season_budget_id, hour, factor)` filtered by `season_budget_id`
4. Rewrite `schedule_shift` query: SELECT use `shift_date` + `employee_id`
5. Demand-bucket loop: map JS `date.getUTCDay()` Sun=0..Sat=6 to canonical `weekday` 0-6 (verify migration enum convention — Mon=0 per Norwegian convention OR Sun=0 per JS native)
6. Integration test that runs `loadSolverContext` against seeded local Supabase + asserts non-empty `day_factors` + `hour_factors` + `existing_shifts` when seed has data

## Scope (out)

- `BASELINE_HEADCOUNT=2` replacement (ADR-0418 — separate solver sortie)
- Trainee paired-only eligibility (ADR-0419 — separate)
- `accept_proposal` TOCTOU race fix (H1 pre-existing — separate sortie, but `publish_week` per ADR-0420 must NOT inherit)
- New capability tools (deferred to Phase 1+2 of "Sett opp juni for meg" chain)

## Acceptance (falsifiable)

- [ ] `pnpm typecheck` 0 errors in `@smartout/ai` post-fix
- [ ] Integration test against seeded local Supabase: `loadSolverContext` returns ≥1 day_factor row, ≥1 hour_factor row when seed has data
- [ ] `propose_plan` against demo workspace produces `gap_count` reflecting actual demand × roster (not zero-fallback)
- [ ] `change_proposal` row written with `solver_inputs_hash` non-empty
- [ ] No regression in existing scheduler unit tests
- [ ] HANDOFF doc lists which Phase 2 tools (`set_day/hour_factor`, `apply_week_template`) now unblocked

## Out of scope / risks

- Weekday convention drift: if `day_factor.weekday` is Mon=0 (Norwegian) but JS `getUTCDay()` is Sun=0, mapping must convert. Verify via existing seed migration `20260306100000_season_planning_tables.sql` + any seed data.
- Active `season_budget` lookup may return zero rows if workspace has no active season — loader must error explicitly (not silent-empty) per L-0177.
- Same-day pre-work needed for C2 (G10 TZ bug `schedule/tools.ts:182`) — different file, different sortie.

## Files touched (estimated)

- `packages/ai/src/capabilities/scheduler/tools.ts` (3 query rewrites + season_budget resolver + bucket-build loop weekday mapping)
- `packages/ai/src/scheduler/solver/greedy.ts` (verify no upstream coupling on dropped columns)
- `packages/ai/src/scheduler/__tests__/load-solver-context.integration.test.ts` (NEW — first real integration test)
- HANDOFF doc at close

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-25
- L-0348: `docs/learnings/0348-solver-column-drift-silent-empty.md`
- ADR-0418 (D5 derivation), ADR-0419 (trainee filter)
- Schema source: `supabase/migrations/20260306100000_season_planning_tables.sql:24-141`
