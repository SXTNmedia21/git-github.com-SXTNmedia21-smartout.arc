---
title: PLAN — ui-shell dept slug
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: mobile-schedule
tags: [mobile, scope-chips, dept-filter, ui-shell]
---

# PLAN — dept-slug (read department.slug from DB; drop substring heuristics)

## Problem

Two mobile hooks derive a `Department` slug from free-text instead of reading the structured DB column:

1. `apps/mobile/src/hooks/queries/use-team-shifts.ts:55-62` — `toDeptSlug(name)` substring-matches `department.name` ("Kjøkken Kveld" → kjokken). Fallback "kjokken" silently wins for any non-matching string.
2. `apps/mobile/src/hooks/queries/use-calendar-items.ts:62-71` — `extractDept(subtitle)` substring-matches `FeedItem.subtitle` ("Bar – kveld" → bar). Same fallback to "kjokken".

`department` table already has a `slug text NOT NULL` column (canonical) verified via `docker exec supabase_db_smartout.ai psql ... \d department`. The substring heuristic is unnecessary and silently mis-routes departments whose name lacks the keyword (e.g. "Lounge", "Vinkjeller").

## Goal

Read `department.slug` directly in the queries. Remove `toDeptSlug` + `extractDept`. UI receives a typed `Department` slug from the data layer; no more substring guessing.

## Constraints

- `Department` union (`apps/mobile/src/components/calendar/types.ts`) currently restricted to `"kjokken" | "sal" | "bar" | "event"`. DB slug values must align — verify via SQL before shipping. If new slugs exist (e.g. "lounge"), extend the union OR widen to `string` with type-guarded narrowing at UI consumer level.
- No new RLS surface; both reads already workspace-isolated via JWT.
- Existing `dept-color` fallback in `use-team-shifts.ts:238-240` (DB color → design-token color) must be preserved.
- `useOperationsFeed` (consumed by `useCalendarItems`) currently returns unstructured `subtitle: string`. Either (a) extend FeedItem with a typed `dept` field, or (b) keep extraction in feed but read `department.slug` there. **Decision: (b)** — fix at the source query, not in the consumer.

## Approach

1. **Verify DB slugs** — `docker exec supabase_db_smartout.ai psql -U postgres -d postgres -c "SELECT DISTINCT slug FROM department ORDER BY slug;"`. If any slug ∉ `Department` union, widen the type OR add the slug to the union with design-token color entries (`packages/design-tokens/src/native.ts` department palette).

2. **use-team-shifts.ts** — add `slug` to the embedded select:
   ```ts
   department:department_id (department_id, slug, name, color)
   ```
   Replace `const deptSlug = toDeptSlug(dept?.name)` with `const deptSlug = (dept?.slug as Department | undefined) ?? "kjokken"`. Delete `toDeptSlug` function. Update `PositionRow` type.

3. **use-operations-feed.ts** (location TBD by build agent; likely `apps/mobile/src/hooks/queries/use-operations-feed.ts`) — extend FeedItem with optional `dept: Department`. Populate from `department.slug` in the source query.

4. **use-calendar-items.ts** — replace `extractDept(subtitle)` with `fi.dept ?? "kjokken"` (or a fail-fast warn when dept missing). Delete `extractDept` + `DEPT_LIST` constant.

5. **Tests** — `apps/mobile/src/__tests__/use-team-shifts.test.tsx` (if exists) + `apps/mobile/src/__tests__/use-calendar-items.test.tsx` (likely exists per ADR-0267). Update mocks to provide `department.slug`. Assert dept passes through unchanged.

6. **Manual verify** — http://localhost:8083 → ScopeChips "Avdeling ▾ → Bar" → only bar-shifts visible. Then create a test department with name "Lounge" + slug "lounge" (if union widened) and verify routing.

## Decisions to register

- ADR: "Mobile dept-routing reads `department.slug` from DB; drop substring heuristics" (rationale: silent mis-routing on non-keyword names).
- Possible: "Department union widened to include {slug-X}" if new slugs found.

## Acceptance

- Falsifiable: a department named "Lounge" (slug "bar") routes via DB slug "bar" — substring of "Lounge" never picks up the "bar" substring incorrectly. Confirmed via SQL seed + manual scope-filter test.
- `grep -r "toDeptSlug\|extractDept" apps/mobile packages/` returns ZERO matches.
- Typecheck green; existing tests pass.

## Out of scope

- No schema migration. `department.slug` already exists.
- No design-token palette expansion unless DB slug audit forces it.
- Web surfaces (`apps/web/`) unchanged — they already select `department_id` + `name` and don't use substring heuristics.

## Files expected to touch

- `apps/mobile/src/hooks/queries/use-team-shifts.ts` (remove toDeptSlug, extend select)
- `apps/mobile/src/hooks/queries/use-calendar-items.ts` (remove extractDept)
- `apps/mobile/src/hooks/queries/use-operations-feed.ts` (extend FeedItem with dept, extend its query)
- `apps/mobile/src/components/calendar/types.ts` (potentially widen Department union)
- `packages/design-tokens/src/native.ts` (potentially extend department palette)
- `apps/mobile/src/__tests__/use-calendar-items.test.tsx` (update mocks)
- `docs/decisions/0000-decision-log.md` (register ADR)
- `docs/journeys/JOURNEY-ui-shell-dept-slug.md`
- `docs/HANDOFF-ui-shell-dept-slug.md` (at closure)
