---
title: Journey — Scheduler TZ wrong-day bug fix
status: in_progress
updated: 2026-05-25
created: 2026-05-25
module: schedule
tags: [journey, scheduler, timezone, G10]
---

# Journey — Manager queries day shifts, gets correct weekday

## J1 — Manager: "Vis vakter for tirsdag 2026-06-23"

**Role:** Manager
**Precondition:**
- Workspace timezone implicitly Europe/Oslo
- 1+ schedule_shift rows exist for shift_date = 2026-06-23

**Steps:**
1. Manager opens Botsson chat → asks "vis vakter for 23. juni"
2. Intent classifier routes → schedule capability
3. Stage engine calls `list_shifts_for_day({ date: "2026-06-23" })`
4. Tool returns shifts AND header text "Tirsdag 23. juni 2026: N vakter"

**Postcondition:**
- Returned weekday label = "Tirsdag" (NOT "Mandag")
- Returned shifts WHERE shift_date = '2026-06-23' (DATE equality, no TZ ambiguity)

**Error paths:**
- DST transition day (29 Mar / 25 Oct 2026): weekday label correct, no skipped/doubled day
- No shifts: tool returns "Ingen vakter for tirsdag 23. juni 2026"

## What changes vs broken state

BEFORE: `new Date("2026-06-23").getDay()` returns `1` (Mon) in NO TZ — JS parses as UTC midnight (Mon 23:00 UTC in CEST). Tool reports "Mandag".

AFTER: `formatInTimeZone(parseISO("2026-06-23T00:00:00Z"), "Europe/Oslo", "EEEE")` returns "tirsdag". Or equivalent UTC-pinned arithmetic.
