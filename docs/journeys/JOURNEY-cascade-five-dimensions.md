---
title: "User Journeys — Cascade Five Dimensions"
status: done
updated: 2026-03-22
created: 2026-03-22
module: cascade
tags: [cascade, journey, dimensions, operating-hours, ui]
---

# User Journeys — Cascade Five Dimensions

## Journey: Admin views planned operating hours

**Precondition:** Department has `department_operating_hours` configured for the current day.

1. Admin opens dashboard Oversikt tab -> System fetches planned hours via `usePlannedHours` hook -> Admin sees planned open/close times displayed on the overview panel
2. Admin sees hours sourced from cascade `department_operating_hours` table (not legacy `operating_hours`)

**Postcondition:** Admin has visibility into cascade-driven planned hours for the department.

**Error paths:**

- No operating hours configured for department -> displays "Ingen planlagte timer" (no planned hours)
- Department not selected -> hook returns empty, no hours shown

---

## Journey: Admin creates hours override

**Precondition:** Department has base operating hours. Admin needs to adjust for a specific date (e.g., holiday, event).

1. Admin clicks hours override control -> System opens `HoursOverridePopover` component
2. Admin selects date and enters override open/close times -> System validates times (close > open)
3. Admin saves override -> System writes to `department_hours_override` table via `useHoursOverrides` hook -> Admin sees override reflected in planned hours display

**Postcondition:** Override stored in cascade D1 layer. Planned hours for that date reflect the override.

**Error paths:**

- Invalid time range (close before open) -> validation error, save blocked
- Duplicate override for same date -> upsert replaces existing override

---

## Journey: Admin views planning events

**Precondition:** Workspace has planning events (holidays, special events) configured.

1. Admin navigates to planning events calendar tab -> System fetches events via `usePlanningEvents` hook
2. Admin sees calendar view with planning events marked -> Events show name, date range, and type

**Postcondition:** Admin has visibility into D4 demand signals affecting scheduling.

**Error paths:**

- No planning events exist -> empty calendar, informational message shown

---

## Journey: Admin selects planning cycle

**Precondition:** Workspace has one or more planning cycles defined.

1. Admin clicks `PlanningCycleSelector` component -> System fetches cycles via `usePlanningCycles` hook
2. Admin selects a planning cycle -> System filters dashboard data to that cycle's date range
3. Dashboard updates to show data scoped to selected cycle

**Postcondition:** Dashboard context is set to the selected planning cycle.

**Error paths:**

- No planning cycles defined -> selector shows "Ingen sykluser" (no cycles), dashboard shows all data
- Only one cycle exists -> auto-selected, no dropdown interaction needed

---

## Journey: Developer uses Phase B cascade functions

**Precondition:** Developer working on schedule or cascade features in `apps/web/src/lib/cascade/`.

1. Developer imports cascade primitives (computeAnchoredTime, evaluateFrameworkRules, computeStateHash, validateProposalFreshness) -> TypeScript types enforce correct input shapes
2. Developer calls pure functions with dimension data -> Functions return deterministic results (no DB access)
3. Developer runs `vitest` -> 29 unit tests validate all edge cases

**Postcondition:** Cascade logic is testable without database, all functions are pure.

**Error paths:**

- Incorrect input types -> TypeScript compiler catches at build time
- Missing dimension data -> functions return safe defaults or throw typed errors
