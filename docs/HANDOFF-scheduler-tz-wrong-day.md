---
title: Handoff — Scheduler TZ wrong-day fix (G10)
status: done
updated: 2026-05-25
created: 2026-05-25
module: schedule
tags: [handoff, scheduler, timezone, G10, fix]
---

# Handoff — Scheduler TZ wrong-day fix (G10)

## Summary

G10 was a date-display bug: the schedule capability returned the wrong
Norwegian weekday label (`local.weekday`) for shifts with a `shift_date`
column. Root cause: three tools constructed `new Date("YYYY-MMDDToDate
T00:00:00+02:00")` which hardcodes the CEST offset (+02:00). During winter
(CET = UTC+01:00) that instant falls one hour into the previous calendar
day, causing `Intl.DateTimeFormat` to return the wrong weekday — e.g.
"mandag" instead of "tirsdag" for 2026-06-23 in the Europe/Oslo zone.

The fix adds `osloWeekdayFromDateStr(dateStr)` to `oslo-time.ts`, which
anchors the date string to noon UTC (T12:00:00Z) — always within the
correct Oslo calendar day regardless of DST — then delegates to the
existing `osloWeekday()` (Intl with `timeZone:"Europe/Oslo"`).

## What changed

| File | Change |
|------|--------|
| `packages/ai/src/capabilities/schedule/oslo-time.ts` | Added `osloWeekdayFromDateStr(dateStr: string): string` — exported pure helper |
| `packages/ai/src/capabilities/schedule/tools.ts` | Import updated; 3 `local.weekday` computations replaced with `osloWeekdayFromDateStr(row.shift_date)` |
| `packages/ai/src/capabilities/schedule/__tests__/tz-boundary.test.ts` | NEW — 16 tests across all affected tools and boundary dates |

## Affected tools (all three `local.weekday` occurrences)

| Tool | Location | Fix |
|------|----------|-----|
| `get_my_shifts` | `getMyShifts` enriched map | `osloWeekdayFromDateStr(row.shift_date)` |
| `get_workspace_schedule` | `getWorkspaceSchedule` enriched map | `osloWeekdayFromDateStr(row.shift_date)` |
| `get_date_schedule_for_me` | `getDateScheduleForMe` enriched map | `osloWeekdayFromDateStr(row.shift_date)` |

## Decisions

### D1 — Noon UTC anchor, not fromZonedTime
Chosen: `new Date(\`\${dateStr}T12:00:00Z\`)` as the anchor instant.

Alternatives considered:
- `fromZonedTime(dateStr + "T00:00:00", "Europe/Oslo")` (date-fns-tz) — requires
  date-fns-tz dependency which is NOT present in `packages/ai/package.json`.
  Adding it for this single use would be scope creep.
- `parseISO(dateStr + "T00:00:00Z")` then `osloWeekday()` — noon anchor is
  safer (00:00Z is ~01:00–02:00 Oslo, very close to the day boundary; noon
  is always 13:00–14:00 Oslo, safe from any DST edge).

Noon UTC is correct because Norway's UTC offsets are +01:00 (CET) or +02:00
(CEST): noon UTC = 13:00 or 14:00 Oslo, always within the correct Oslo day.

### D2 — Hardcoded "Europe/Oslo" (V1)
V2 should read `workspace.timezone` column. Deferred: requires DB migration
+ capability plumbing. No ADR exists yet for V2. This is flagged in the plan
as out-of-scope.

### D3 — No date-fns-tz dependency added
`packages/ai/package.json` does not include `date-fns-tz`. The fix is
self-contained using `Intl.DateTimeFormat` + the existing `oslo-time.ts`
primitives. No new dependencies needed.

## Acceptance checklist

| Item | Status | Notes |
|------|--------|-------|
| 1. All `T00:00:00+02:00` patterns removed from tools.ts | PASS | 3 occurrences replaced; only comment reference remains |
| 2. Single consistent pattern applied | PASS | `osloWeekdayFromDateStr()` used uniformly |
| 3. New test: 2026-06-23 (Tuesday NO) → "tirsdag" | PASS | test: "G10 primary case" |
| 4. New test: DST spring-forward 2026-03-29 → "søndag" | PASS | unit + integration |
| 5. New test: DST fall-back 2026-10-25 → "søndag" | PASS | unit + integration |
| 6. New test: winter CET 2026-01-05 → "mandag" | PASS | unit + integration |
| 7. Tool docstring anchors explain Europe/Oslo contract | PASS | inline comments on each fix site |
| 8. `pnpm --filter @smartout/ai typecheck` — no new errors | PASS | 22 pre-existing (23 baseline); 0 new |
| 9. `vitest run src/capabilities/schedule/__tests__/` — all green | PASS | 43 pass, 3 skip (pre-existing TODO) |
| 10. No write-tools touched (C1 boundary) | PASS | read-only tools only |

## Test inventory (new file: tz-boundary.test.ts)

### osloWeekdayFromDateStr primitive (7 cases)
- 2026-06-23 CEST → tirsdag (G10 primary)
- 2026-06-22 CEST → mandag
- 2026-01-05 CET → mandag (winter hardcoded-offset off-by-one case)
- 2026-03-29 spring-forward → søndag
- 2026-03-28 day before spring-forward → lørdag
- 2026-10-25 fall-back → søndag
- 2026-10-26 day after fall-back → mandag

### getWorkspaceSchedule integration (4 cases)
- 2026-06-23 CEST → tirsdag
- 2026-01-05 CET → mandag
- 2026-03-29 spring-forward → søndag
- 2026-10-25 fall-back → søndag

### getDateScheduleForMe integration (3 cases)
- 2026-06-23 CEST → tirsdag
- 2026-03-29 spring-forward → søndag
- 2026-10-25 fall-back → søndag

### getMyShifts integration (2 cases)
- 2026-06-23 CEST → tirsdag
- 2026-01-05 CET → mandag

## Known issues / debt

| # | Issue | Severity | Owner |
|---|-------|----------|-------|
| 1 | V2 workspace.timezone — hardcoded "Europe/Oslo" | Medium | Deferred ADR |
| 2 | `getShiftColleagues` uses `enrichShiftRowWithOsloTime()` which derives weekday from TIMESTAMPTZ `start_time`, not from a date string — correctly not affected by G10 (TIMESTAMPTZ → `osloWeekday()` path is already correct) | N/A | Not a bug |
| 3 | Pre-existing 23 typecheck errors in `@smartout/ai` (journey, payroll, generators) — outside this sortie's scope | Low | Existing debt |
| 4 | Pre-existing 3 skipped tests in `tools-oslo-tz.test.ts` (schema-TODO comments) | Low | Existing debt |

## Learnings

**L-G10-1: date-fns-tz not required for Oslo-anchored date-string weekday extraction.**
The combination of Intl.DateTimeFormat (already in oslo-time.ts) + noon UTC anchor
covers all DST cases without any new dependency. Simpler and faster than date-fns-tz
for this use case.

**L-G10-2: +HH:MM offset hardcoding in date string literals is a silent TZ bug.**
`new Date("YYYY-MMDDToDateTime+02:00")` looks correct in summer but silently
corrupts in winter. Pattern to grep: `T00:00:00+0\d:00`. Prefer explicit TZ helpers
over offset literals in capability code.

**L-G10-3: `shift_date` (DATE column) vs `start_time` (TIMESTAMPTZ) require different
Oslo conversion paths.** `enrichShiftRowWithOsloTime()` is correct for TIMESTAMPTZ.
`osloWeekdayFromDateStr()` is correct for DATE-only strings. Never mix the two paths.

## Commits

| SHA | Description |
|-----|-------------|
| `280679613` | fix(schedule): replace hardcoded +02:00 offset with osloWeekdayFromDateStr (G10) |
| (this) | docs(schedule): HANDOFF for scheduler-tz-wrong-day sortie |

## Next steps

1. **Close G10 in BOTSSON-SYSTEM-MAP.md** — orchestrator task.
2. **V2 workspace.timezone** — requires ADR + `workspace.timezone` column migration +
   `AgentToolContext` plumbing to thread the value through. Estimate: 1 sortie.
3. **Monitor voice agent logs** for "tirsdag" → verify LLM quotes correct weekday
   after this fix ships to development.
