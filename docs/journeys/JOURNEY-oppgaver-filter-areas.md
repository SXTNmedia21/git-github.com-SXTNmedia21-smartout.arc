---
title: "JOURNEY — Manager filters by area chip + Avvik chip"
status: done
created: 2026-05-24
updated: 2026-05-24
feature: p11-oppgaver-page
module: day-session
tags: [journey, oppgaver, filter]
---

# Manager filters timeline by area + deviations

**Precondition:** Manager on `/dashboard/oppgaver`. 6 area chips visible in toolbar.

## Happy path

1. Manager clicks **Kjøkken** chip → `FilterChip` toggles `aria-pressed="true"`, fg/bg inverts (Manager Timeline chip recipe) → `setActiveAreaIds(["kjokken-id"])` runs.
2. Telemetry emits `oppgaver.area_filter_changed { active_area_count: 1, triggered_by: "ui" }`.
3. `dimmedBandIds` derived → other 5 area bands receive `opacity-50` class → Kjøkken band stays at full opacity → focus visible.
4. Manager clicks **Bar** → second area added to active → 4 areas dimmed.
5. Manager clicks **Avvik** chip (destructive tone, count badge shows `2`) → `setDeviationsOnly(true)` → filtered task list now shows only `status === "missed"` rows → emits `area_filter_changed` with `active_area_count: 2`.
6. Manager clicks Avvik again to clear → returns to all tasks within Kjøkken+Bar areas.

**Postcondition:** Manager isolated 2 areas + filtered to deviations. 3+ filter events landed. Visual focus matches mental model ("show me what's broken in kitchen/bar right now").

## Error paths

- **All areas toggled off:** `dimmedBandIds` returns `undefined` → all bands at full opacity (no filter effectively).
- **Count badge wrong:** Pre-existing C2 from P10 (`DayEvent.location_id` missing) means count may include all-workspace tasks. P11 inherits same data shape; full per-area count requires `location_id` extension (deferred).
