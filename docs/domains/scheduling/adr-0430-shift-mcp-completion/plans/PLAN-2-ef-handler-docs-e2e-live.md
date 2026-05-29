---
title: "PLAN-2 — workspace-api handler + landing docs + E2E + live-invoke"
status: in_progress
updated: 2026-05-29
created: 2026-05-29
module: scheduling
tags: [adr-0430, workspace-api, e2e, live-invoke, L-0348, P0]
---

# PLAN-2 — EF handler + landing docs + E2E + MANDATORY live-invoke

**Branch:** `feat/adr-0430-shift-mcp-completion` · **Model:** sonnet · **Worktree:** `~/dev/smartout.ai-wt-1`

## A. `supabase/functions/workspace-api/handlers/schedules.ts` — `handleGetShifts`

The raw SQL `SELECT` (~line 38-44) lists `zone` (dropped col → SQL error at runtime). Fix:

1. REMOVE `zone` from the column list.
2. ADD a correlated subquery aggregating zone names via the M:N path
   `schedule_shift → shift_session (schedule_shift_id) → shift_zone (shift_session_id) → zone (zone_id)`:

```sql
SELECT schedule_shift_id, employee_id, position_id, team_id,
       shift_date, role, start_time, end_time, work_hours, breaks,
       day_category, status, is_published, notes,
       COALESCE((
         SELECT array_agg(DISTINCT z.name ORDER BY z.name)
         FROM shift_session ss
         JOIN shift_zone sz ON sz.shift_session_id = ss.shift_session_id
         JOIN zone z ON z.zone_id = sz.zone_id
         WHERE ss.schedule_shift_id = schedule_shift.schedule_shift_id
       ), ARRAY[]::text[]) AS zones,
       created_at, updated_at
FROM schedule_shift
WHERE workspace_id = $1
```

   - `zones` is a `text[]` of zone names (was scalar `zone TEXT`). Empty array when no zones assigned.
   - This stays within the existing `executeWithWorkspaceContext` raw-SQL pattern + RLS (subquery runs under same workspace context).
3. Keep all WHERE filters + ORDER BY + LIMIT/OFFSET unchanged.

**Contract decision (orchestrator, recorded in STATE.md):** expose `zones[]` (not omit). ADR-0430-coherent; silent drop = breaking change to a documented API consumer.

## B. `apps/landing/src/app/docs/api/page.tsx` — List Shifts docs (~line 975-1000)

Update the example response JSON + any field listing that shows `zone`:
- If the example shows `"zone": "..."`, change to `"zones": ["Kjøkken", "Bar"]` (array of zone names).
- If there's a response-fields table mentioning `zone`, update the row to `zones` `string[]` "Zone names assigned to this shift (M:N, ADR-0430)".

## C. E2E specs that turn red

1. `apps/e2e/procedure-engine/journey-4-shift-location.spec.ts:201` — inserts `schedule_shift.location_id` (dropped col). M4 removed location_id from schedule_shift; location is now session-derived. REWRITE the insert to not set location_id (location flows from day_line via the trigger). If the test asserts on `location_id` of schedule_shift, update to assert via the session/day_line path, or DELETE the assertion if it no longer maps to a real column. Keep the journey intent (shift + location) valid.
2. `apps/e2e/db/triggers/shift-session-trigger.spec.ts:133` — asserts `OF location_id` trigger (the old trigger fired on UPDATE OF location_id). The trigger was rewritten (migration 20260801000005) to drop the `OF location_id` clause. UPDATE the assertion to match the new trigger definition (no `OF location_id`), or DELETE if obsolete.

Run a grep across `apps/e2e/` for any other `schedule_shift` insert/select that sets `zone` or `location_id` and fix.

## D. MANDATORY GATE — live-invoke (closes L-0348, the gate Phase b deferred)

This is the AC that would have caught all three regressions. Must be GREEN before close.

1. `npx supabase start` (local). `supabase db reset` to apply all migrations incl. M1-M4.
2. Seed minimal fixture: 1 workspace, 1 department, 1 location, `department_location` link, 1+ zone in that location, 1 employee profile, a department_session for the date (so `ensure_shift_session` trigger materializes shift_session + day_line). Use existing seed.sql or a Node fixture script under the sortie `reports/` folder.
3. Node script (TypeScript via `tsx`, written to `docs/domains/scheduling/adr-0430-shift-mcp-completion/reports/live-invoke.ts`):
   - **create_shift** with `department_id` (or `department_session_id`) + `zone_ids: [<seeded zone>]` → assert: returns shift row, no PGRST204, `schedule_shift` row has correct `department_id`, `shift_zone` has 1 row for the session.
   - **create_shift** with NO department → assert isError `department_unresolved`.
   - **update_shift** with `zone_ids: [<other zone>]` → assert shift_zone reconciled (old deleted, new inserted).
   - **GET /v1/shifts** (invoke the EF handler logic, or curl the served function) → assert 200, response includes `zones: [...]`, no SQL error.
4. Capture output to `reports/live-invoke-result.txt`. PASTE the assertions-passed summary into STATE.md gate history.

If `npx supabase start` is impossible in this environment (Docker/RAM), the gate is NOT satisfied — surface, do not fake-green. (Per mandate: do not skip the L-0348 closer.)

## Acceptance (PLAN-2)

- EF handler compiles (Deno check or tsc as applicable) + zones[] subquery valid.
- Landing docs updated.
- E2E specs no longer reference dropped columns; `pnpm --filter ... typecheck` green on e2e.
- **Live-invoke GREEN** (the closer).

## Commit

Split or single: `fix(workspace-api): GET /v1/shifts expose zones[] post-M4 (ADR-0430 L-0348)` + `test(e2e): rewrite shift specs for M4 dropped columns (ADR-0430)` + `chore(scheduling): live-invoke harness proves shift-mcp + EF green (L-0348 closer)`.
