---
title: Plan — Scheduler TZ wrong-day bug fix (G10)
status: in_progress
updated: 2026-05-25
created: 2026-05-25
module: schedule
tags: [plan, scheduler, timezone, bug-fix, G10]
---

# Plan — Scheduler TZ wrong-day bug fix (G10)

## Context

Council 2026-05-25 ("Sett opp juni") flagged G10: schedule capability read-tools mis-interpret date-only strings as UTC midnight, then `.getDay()` returns local TZ weekday → in Europe/Oslo (CET +01 / CEST +02) a date `2026-06-23` becomes `Mon 22 Jun 23:00 UTC` → reported as **mandag** instead of tirsdag.

Same class as G10 is endemic — every `new Date("YYYY-MM-DD").getDay()` call is wrong in non-UTC zones.

## Scope

In:
- `packages/ai/src/capabilities/schedule/tools.ts:182` — primary offender (`list_shifts_for_day` or similar; verify exact tool by reading file)
- All sibling date-day extractions in same file (grep `getDay\(\)` + `getUTCDay\(\)` + `new Date\("20`)
- Unit tests covering boundary days (00:00 NO = 23:00 UTC prev day, DST transitions)

Out (defer):
- Scheduler write-tools (propose/accept/reject) — C1 sortie owns; not date-extraction critical
- Calendar Guardian — separate domain
- Mobile schedule client TZ — mobile is read-only consumer of BFF output

## Acceptance

1. `pnpm typecheck` 0 errors in `@smartout/ai`
2. `pnpm test packages/ai/src/capabilities/schedule/__tests__/` all green
3. NEW unit test: `tz-boundary.test.ts` covering:
   - Mon 2026-06-23 NO (= Mon 23:00 UTC Sun) → returns Mon shifts not Sun
   - DST spring-forward 2026-03-29 → returns Sun shifts not Sat
   - DST fall-back 2026-10-25 → returns Sun shifts (no double-day)
4. Manual trace: tool docstring explicitly states "Europe/Oslo" anchor

## Approach

Use `date-fns-tz`'s `formatInTimeZone(date, "Europe/Oslo", "yyyy-MM-dd")` OR `toZonedTime(date, "Europe/Oslo")` for weekday extraction. `date-fns-tz` already in `packages/ai/package.json` dependencies (verify).

Pattern: never `new Date(dateOnly)`. Either:
- Build explicit UTC midnight + convert: `parseISO(dateStr + "T00:00:00Z")` → `formatInTimeZone(d, "Europe/Oslo", "EEEE")`
- OR parse as workspace-TZ midnight: `fromZonedTime(dateStr + "T00:00:00", "Europe/Oslo")`

V1 hardcode `"Europe/Oslo"`. V2 reads workspace.timezone column (out-of-scope; deferred ADR).

## Tests

- Column-spy / behavior test pattern same as C1 (`load-solver-context.test.ts`).
- Mock Supabase response; verify tool input/output for boundary dates.

## Out-of-scope (explicit)

- workspace.timezone column + migration — V2.
- Write-tool TZ handling — C1 covered.
- UI date-rendering — separate sortie (UI uses `formatInTimeZone` already in DayPlanner).
