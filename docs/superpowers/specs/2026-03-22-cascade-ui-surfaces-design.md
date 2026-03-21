---
title: "Cascade UI Surfaces — Design Spec"
status: done
updated: 2026-03-22
created: 2026-03-22
module: cascade
tags: [cascade, ui, schedule, season, override, planning-event, planning-cycle]
---

# Cascade UI Surfaces — Design Spec

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Make the cascade scheduling layer visible and editable in the dashboard through 4 UI surfaces.

**Architecture:** Wire existing cascade DB tables + pure functions to new/modified React components. No new migrations needed — all tables exist from A1/A2.

---

## Surface 1: Planned Hours on OversiktTab

**Problem:** `OversiktTab` displays `Åpningstider: 11:00 - 23:00` as hardcoded `useState`. The real planned hours exist on `department_session.planned_open/planned_close` (set at session creation by `resolveEffectiveHours()`), but the UI doesn't read them.

**Solution:**

1. Create `usePlannedHours(departmentId, dateId)` hook:
   - Query `department_session` for the date → if found, return `planned_open`/`planned_close`
   - If no session: query `department_operating_hours` + `department_hours_override` for the date, run `resolveEffectiveHours()` client-side → return preview
   - Return: `{ openTime, closeTime, source: "session" | "preview", hasOverride: boolean, isLoading }`

2. Replace `useState("11:00 - 23:00")` in `OversiktTab` with `usePlannedHours()`:
   - Session data: display normally
   - Preview data: muted text + "Planlagt" label
   - Override badge: small orange dot or "Unntak" chip when `hasOverride` is true
   - Clicking the hours row opens the override popover (Surface 2)

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-planned-hours.ts`
- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/OversiktTab.tsx` (lines 47, 199-212)

---

## Surface 2: Hours Override Popover

**Problem:** No UI to create/edit/delete `department_hours_override` rows. Currently only the voice AI tool queries overrides.

**Solution:**

1. Create `useHoursOverrides(departmentId, dateId?)` hook:
   - Query `department_hours_override` for the department, optionally filtered to a single date
   - Mutations: `createOverride`, `updateOverride`, `deleteOverride`
   - Emit telemetry on mutations

2. Create `HoursOverridePopover` component:
   - Triggered by clicking the hours row in OversiktTab
   - Shows current override if one exists for the date, or empty form
   - Form fields: open_time (time input), close_time (time input), is_closed toggle, reason (text), link to planning_event (optional select)
   - Actions: Save, Delete (if existing), Cancel
   - On save: upsert to `department_hours_override`, invalidate `usePlannedHours` query

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-hours-overrides.ts`
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/HoursOverridePopover.tsx`
- Modify: `OversiktTab.tsx` — wrap hours display in clickable element, render popover

---

## Surface 3: Planning Events Tab in Season Page

**Problem:** `planning_event` table exists but has no UI. Events drive demand signals and optionally link to hour overrides.

**Solution:**

1. Create `usePlanningEvents(seasonId)` hook:
   - Query `planning_event` joined via `planning_cycle_id` → `season.planning_cycle_id` for the selected season
   - Also accept direct workspace-scoped query (events not tied to a cycle)
   - Mutations: `createEvent`, `updateEvent`, `deleteEvent`

2. Create `PlanningEventsTab` component:
   - Add "Hendelser" tab to season page (5th tab, icon: `CalendarDays`)
   - Calendar month grid as primary view:
     - Shows current month with navigation arrows
     - Event dots on dates (color-coded by category)
     - Click date to see events list + add new
   - Below calendar: upcoming events list (next 30 days)
     - Each row: date, name, category badge, demand_multiplier, confidence indicator
     - Click to edit, delete button
   - Create form: name, date, end_date (optional), category (select from enum), source, demand_multiplier (slider 0.5-3.0), expected_covers, confidence, is_recurring, reason

**Category color mapping:**

- `external_scraped` → blue
- `cultural_commercial` → purple
- `internal` → green
- `weather` → amber
- `recurring` → zinc/gray

**Files:**

- Create: `apps/web/src/app/dashboard/season/_hooks/use-planning-events.ts`
- Create: `apps/web/src/app/dashboard/season/_components/PlanningEventsTab.tsx`
- Modify: `apps/web/src/app/dashboard/season/page.tsx` — add tab to TABS array

---

## Surface 4: Planning Cycle Selector

**Problem:** `planning_cycle` table exists but has no UI. Seasons link to cycles via `season.planning_cycle_id`.

**Solution:**

1. Create `usePlanningCycles(workspaceId)` hook:
   - Query `planning_cycle` ordered by `start_date` desc
   - Mutations: `createCycle`, `updateCycle`

2. Add planning cycle selector to season overview:
   - Dropdown in the season page header area (near `SeasonSelector`)
   - Shows current cycle name + date range
   - Dropdown lists all cycles with status badges
   - "Ny planperiode" button opens inline form: name, start_date, end_date, total_revenue_target, status
   - When a cycle is selected/created, link it to the current season via `season.planning_cycle_id` update

**Files:**

- Create: `apps/web/src/app/dashboard/season/_hooks/use-planning-cycles.ts`
- Create: `apps/web/src/app/dashboard/season/_components/PlanningCycleSelector.tsx`
- Modify: `apps/web/src/app/dashboard/season/page.tsx` — add selector below SeasonSelector

---

## Shared Decisions

| Decision                                          | Reason                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| No new migrations                                 | All tables exist from A1/A2                                              |
| Override popover, not modal                       | Lightweight, stays in context of the day panel                           |
| Events in season page, not schedule               | Strategic planning belongs with season tools                             |
| Cycle as selector, not tab                        | Set-and-forget; doesn't need dedicated space                             |
| `resolveEffectiveHours()` client-side for preview | Function is pure, already in `lib/cascade/`, no server round-trip needed |
| `usePlannedHours` composes existing hooks         | Avoids duplicating query logic                                           |

---

## Type Additions Needed

Add to `apps/web/src/lib/cascade/types.ts`:

- `PlanningEventRow` — mirrors DB table
- `PlanningCycleRow` — mirrors DB table
- Update `DepartmentHoursOverrideRow` — add missing `season_id` field

---

## Out of Scope

- Change proposal UI (no cascade preview modal yet)
- Framework rule configuration UI
- Tariff/cost display
- Shift anchoring UI
