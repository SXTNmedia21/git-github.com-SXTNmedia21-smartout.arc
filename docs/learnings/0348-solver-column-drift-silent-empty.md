---
id: L-0348
title: Solver column drift — loadSolverContext queries non-existent columns, returns silent-empty
status: published
date: 2026-05-25
severity: CRITICAL
related: [L-typegen-behind-db (2026-05-22), L-0177 (silent fallback), L-0176 (docstring drift)]
tags: [scheduling, solver, schema-drift, silent-failure, propose_plan]
---

# L-0348 — Solver column drift in loadSolverContext

## What happened

Council 2026-05-25 ("Sett opp juni for meg" gap analysis). Code-tracer Layer 2 (system-agent-coordinator) verified column names against `packages/supabase/src/database.types.ts`. Found `packages/ai/src/capabilities/scheduler/tools.ts:81-93,147` queries:

| Query target | Code says | Schema reality |
|---|---|---|
| `day_factor.date` + `day_factor.department_id` | filter by date+dept | `day_factor` has `(season_budget_id, weekday INT 0-6)` only — UNIQUE `uq_day_factor_weekday` per `20260306100000_season_planning_tables.sql:95` |
| `hour_factor.hour_of_day` + `hour_factor.department_id` | filter by hour+dept | `hour_factor` has `(season_budget_id, hour INT 0-23)` only — UNIQUE `uq_hour_factor_hour` per same migration line 140 |
| `schedule_shift.date` + `schedule_shift.profile_id` | join schema | actual columns: `shift_date` + `employee_id` per `20260301300000_schedule_shift_table.sql` |

PostgREST silently returns empty array (or 400 on the `.eq`/`.gte` call against unknown column). `loadSolverContext` returns empty `day_factors`, empty `hour_factors`, empty `existing_shifts`. Solver gets default factor 1.0 across all hours + zero existing shifts. `propose_plan` outputs incoherent proposals or errors silently.

## Why it matters

`scheduler.propose_plan` is the cornerstone of the "AI plans your week" promise. Demoing it on a fresh workspace will appear to work because empty cascade returns plausible-looking proposals. Real data exposes the drift.

## Class

Sibling of:
- **L-typegen-behind-db (2026-05-22)** — `gen types --local` against behind DB silently drops columns; code references non-existent columns; PostgREST returns SelectQueryError
- **L-0177 (silent fallback)** — workspace_id resolution silently falls back to JWT default when row not found
- **L-0176 (docstring drift)** — function body diverges from docstring claim

All three: declarative surface succeeds at TypeScript level, fails at runtime with no error path.

## Root cause hypothesis

Solver was likely written against an aspirational schema design where `day_factor` would be per-date + per-department (richer model). Migrations landed the simpler per-`season_budget_id` model. Solver code never updated. No integration test caught the drift because tests probably stubbed `loadSolverContext` directly.

## Fix

3-place column rename + filter shape rewrite in `scheduler/tools.ts:81-93,147`:

```ts
// Before (broken)
.from("day_factor").select("date, factor, department_id").eq("department_id", cycle.department_id)
// After
.from("day_factor").select("season_budget_id, weekday, factor").eq("season_budget_id", <active_budget_id>)

// Before (broken)
.from("hour_factor").select("hour_of_day, factor, department_id").eq("department_id", cycle.department_id)
// After
.from("hour_factor").select("season_budget_id, hour, factor").eq("season_budget_id", <active_budget_id>)

// Before (broken)
.from("schedule_shift").select("schedule_shift_id, profile_id, start_time, end_time, date")
// After
.from("schedule_shift").select("schedule_shift_id, employee_id, start_time, end_time, shift_date")
```

Solver bucket-building loop needs to map weekday (Mon=0..Sun=6 vs JS `getUTCDay()` Sun=0..Sat=6) AND lookup factor by `(season_budget_id, weekday)` not `(department_id, date)`.

Implies: `loadSolverContext` must first resolve active `season_budget_id` for the planning_cycle's date range. Add SELECT against `season_budget` filtered by `season.is_active = true` + date range overlap.

## Prevention rule

Promote to Phase 2.5 council fact-check (already covers migration-dependency check per L-0042; add solver-schema-coherence check): whenever a council brief references a solver/capability that reads cascade tables, grep the column names against `database.types.ts` for every `.select()` / `.eq()` / `.gte()` / `.lte()` chain. 0 match = false claim.

Also: scheduler unit tests should NOT stub `loadSolverContext` — integration tests against real schema MUST exercise the loader end-to-end. Add Vitest integration test that runs `loadSolverContext` against seeded local Supabase + asserts non-empty outputs given seeded factors.

## Verification command

```bash
# For any capability tool reading cascade tables
grep -E '\.from\("(day_factor|hour_factor|schedule_shift|season_budget)"\)' packages/ai/src/ -rn
# Then for each hit, grep the column names against database.types.ts
```

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-25
- `packages/ai/src/capabilities/scheduler/tools.ts:60-250` (broken loader)
- `packages/supabase/src/database.types.ts:6782-6809,10488-10515,16945,16956` (real schema)
- `supabase/migrations/20260306100000_season_planning_tables.sql:24-141` (UNIQUE constraints)
- `supabase/migrations/20260301300000_schedule_shift_table.sql` (column names)
