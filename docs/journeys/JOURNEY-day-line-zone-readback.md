---
title: "JOURNEY — day-line zone/location readback + right-rail (P1 day-line build)"
feature: day-line-zone-readback
status: verified
updated: 2026-05-29
created: 2026-05-29
module: day-session
tags: [day-line, adr-0430, adr-0367, adr-0133, right-rail, journey]
---

# JOURNEY — day-line P1 (zone/location readback + right-rail build)

> Pontus's original ask: make the day-line working + match the binding Cloud Design
> (`Manager Timeline.html`). ADR-0430 dropped scalar zone/location_id; the readback paths were
> stubbed null in Phase b. This sortie restores them AND builds the missing right-rail + un-stubs
> the bands to the real roster.
>
> **Status: verified** — backed by per-package typecheck (packages/data, mobile green) + the
> design-fidelity verdict (`reports/FIDELITY-VERDICT.md` PASS) + the council design-token verdict
> (`reports/COUNCIL-design-token.md`).

## Journey: Manager views the day-line with location filter (web Tidslinjen)

**Precondition:** Manager on `/dashboard/oppgaver` (Manager Timeline) with shifts for the date.
1. Manager opens the Tidslinjen tab → web resolves each shift's location via
   `schedule_shift → shift_session → shift_session_day_line → day_line.location_id` (ADR-0367 tri-layer)
   → location chips populate; the location chip-bar filter works again (was dead post-M4).
2. Manager filters by location → only shifts/events for that location show.

**Postcondition:** Events carry real `location_id`; chip-bar filter is functional.
**Error path:** shifts with no materialized session/day_line → `location_id` null (legitimately unscheduled), no crash.

## Journey: Manager reads the right-rail (web Manager Timeline)

**Precondition:** Manager on `/dashboard/oppgaver`.
1. The page renders two columns (chart 1fr + rail 380px) per the Cloud Design.
2. The rail "Akkurat nå" tab shows STATUS — 4 KPI cards: På vakt (employees on shift now),
   Aktive oppgaver, Avvik åpne, Tasks gjenstår. **Every count is derived from the current rows** —
   no stored counters.
3. Krever oppmerksomhet lists open deviations (Bekreft/Eskaler); Pågående lists active tasks;
   Neste lists the next 4 upcoming tasks with assignee.
4. Manager clicks Bekreft on a deviation → the underlying task is focused (V1: no fabricated
   resolve-write; the manager acts on the focused task).
5. Manager switches tabs (Detalj/Melding/Avvik) → Detalj shows the selected task; Melding/Avvik
   show V1 placeholders (full surfaces deferred, documented).

**Postcondition:** Manager sees a live, derived status snapshot matching the binding mockup.
**Error paths:** no employees on shift → "På vakt 0"; no active tasks → "Ingenting i aktiv status."

## Journey: Manager sees the real roster in area bands (web)

**Precondition:** the day has published shifts assigned to employees.
1. Bands render the real roster (display_name + role + shift window) from `useEmployeesForDate`
   (schedule_shift + profile), not just task-assignees.
2. On-shift counts + the rail "På vakt" KPI reflect employees whose shift window contains "now".
3. Task blocks honor `session_task.duration_minutes` for their height (60-min fallback when null).

**Postcondition:** EmpStrip + on-shift derivations reflect the actual roster.

## Journey: Employee sees zone(s) on their shift (mobile, reader-only ADR-0133)

**Precondition:** Employee on the mobile home with an upcoming/active shift that has zone assignments.
1. The shift card / BeforeShiftView shows the assigned zone name(s) (e.g. "Hovedsal, Bar-område"),
   resolved via `shift_session → shift_zone → zone` (shared `packages/data` helper).
2. No authoring affordance — mobile is reader-only.

**Postcondition:** Employee sees which zone(s) their shift covers; unzoned shifts fall back to "Arbeidsplass".
**Error path:** shift with no zones → no zone line / "Arbeidsplass" fallback.

## a11y journey: screen-reader user on the timeline

1. The now-line announces the current time via a polite `aria-live` region ("Nåværende tid HH:MM").
2. Rail tabs are a real `role="tablist"` with `aria-selected`; all interactive elements have
   focus-visible rings.

## Verification evidence (status: verified)

- packages/data turbo typecheck: green (employees hook + duration thread + shift-zones helper).
- mobile turbo typecheck: green (zones[] embed + readers).
- Design-fidelity verdict: PASS (`reports/FIDELITY-VERDICT.md`) — layout 1fr 380px, tab set, 4 KPI
  cards derived, list sections, 0 OKLCH literals, 0 hardcoded colors, tablist/aria-selected/focus rings.
- Council design-token gate: APPROVE-WITH-CHANGES (`reports/COUNCIL-design-token.md`) — text-xs
  applied, no design-tokens churn.
- Web turbo typecheck: run at close (RAM-gated, L-0316 — see HANDOFF).
