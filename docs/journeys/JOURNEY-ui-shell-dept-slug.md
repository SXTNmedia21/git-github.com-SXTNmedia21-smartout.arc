---
title: JOURNEY — ui-shell dept-slug
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: mobile-schedule
tags: [mobile, journey]
---

# JOURNEY — Dept-filter ruter via department.slug, ikke substring

## Journey: Bruker filtrerer på avdeling "Bar" — vanlig sak

**Precondition:** Mobile signed in. Workspace has departments seeded with slugs (`kjokken`, `sal`, `bar`, `event`). Current week has shifts assigned to each department via `position.department_id`.

1. User taps "Avdeling ▾" on ShiftListScreen → System opens 4-row dropdown → User sees Kjøkken / Sal / Bar / Event.
2. User taps "Bar" → System sets scope `{ kind: "dept", value: "bar" }` → Shift list filters to only shifts whose `department.slug === "bar"`.
3. User taps "Avdeling ▾ → Kjøkken" → Filter switches; only kitchen shifts visible.

**Postcondition:** All shifts in the visible list share `dept === "bar"` (or selected slug). NO shifts from another department leak through.

**Error paths:**
- A shift's `position.department_id` is NULL → shift falls back to `kjokken` slug (existing behavior). Documented gap; not regressed by this change.

## Journey: Avdeling med navn uten keyword (Lounge / Vinkjeller)

**Precondition:** Workspace has a department named "Lounge" with slug "bar" (admin intent: lounge is a bar variant). Shifts assigned to Lounge.

1. User taps "Avdeling ▾ → Bar" → System filters to slug `bar`.
2. Lounge-shifts appear in the list (because `department.slug === "bar"`, regardless of name).

**Before this change:** `toDeptSlug("Lounge")` did NOT contain `bar` substring → fell back to `"kjokken"` → Lounge-shifts showed up in Kjøkken filter, NOT Bar.

**Postcondition:** Slug-based routing is authoritative. Display name is purely cosmetic.

**Error paths:**
- DB has a slug NOT in `Department` union → TypeScript fails OR slug renders as the design-token fallback color. Build agent must audit `SELECT DISTINCT slug FROM department` before shipping; widen union if needed.

## Journey: Calendar viser strukturert dept fra feed

**Precondition:** Mobile signed in. CalendarScreen mounted. FeedItems include shifts.

1. User taps "Vakter"-chip on FilterChips → Calendar items filtered to type=shift.
2. Each shift item renders with the correct dept-color derived from `feedItem.dept` (slug from DB), not from substring of `subtitle`.

**Postcondition:** Dept-color in calendar matches dept-color in ShiftListScreen for the same shift.

**Error paths:**
- FeedItem missing `dept` → fall back to `kjokken` with a `console.warn` (fail-loud per L-0177 pattern); do NOT silently mis-route.
