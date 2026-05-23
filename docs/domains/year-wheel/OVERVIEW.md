---
title: "Year Wheel — Overview"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: year-wheel
tags: [domain, year-wheel, season, planning, D4, D5, cascade, overview]
---

# Year Wheel — Overview

> What + why + cascade placement. Code wins. Grep-able anchors throughout.

## What it is

The year-wheel domain is Smartout's **annual planning surface**. It gives managers a horizontal timeline view of the whole year — visualised as coloured season blocks and event pins — and lets them author the demand and service parameters that drive every downstream cascade dimension.

Two routes make up the surface:

| Route | File | Role |
|---|---|---|
| `/dashboard/year-wheel` | `apps/web/src/app/dashboard/year-wheel/page.tsx` | Birds-eye annual view: timeline canvas + season sidebar + companion rail |
| `/dashboard/season/[seasonId]` | `apps/web/src/app/dashboard/season/[seasonId]/page.tsx` | Season detail: budget, day factors, hour factors, operating hours, goals, procedures |

The domain is bounded by **what a manager authors before operations begin**. It does NOT include the runtime scheduling machinery that consumes season data.

## Why it exists

Hospitality managers think in energy levels and seasons, not in daily factors and hour weights. The previous module-15 approach exposed PostgreSQL concepts directly in the UI, creating cognitive overload and low adoption (PRD §2 problem statement).

The year-wheel reimagines this as:

- **"Draw, don't type"** — click-and-drag on empty canvas to create a season block (spec §4.1, implemented)
- **"The Safety Net"** — deleting a season reveals normal drift, not a void; cascade resolution falls back to `season_id IS NULL` rows
- **"The Exception Proves the Rule"** — planning events (pins) are visual alarm clocks for known demand spikes

## Cascade placement

The year-wheel domain sits at **D4 (Demand Signal) + D5 (Service Concept)** in the cascade model.

```
D1 Envelope        core-structure owns:
                   planning_cycle (year-wheel reads, does not own)
                   department_operating_hours (seeded by D1 fanout trigger on activation)

D4 Demand Signal   year-wheel OWNS:
                   season (primary record)
                   season_budget (revenue targets, labor model)
                   day_factor, hour_factor (demand distribution)
                   planning_event (D4 demand spikes — see GAPS: scheduling domain)

D5 Service Concept year-wheel OWNS:
                   season.season_type, season.description
                   season_goal (KPI targets per season)
                   season_policy_binding (which policies apply per season)
                   season_budget.base_price_per_guest, season_price_factor

C1 Calibration     consumes year-wheel:
                   season actuals feed calibration loop
                   day/hour factors feed planning_factors (learn_factors tool)

C3 Commercial      consumes year-wheel:
                   season period attribution for P&L
```

**Season as temporal envelope:** An active season is the temporal container around day-session operations. `department_session.season_id` FK points to the active season. When no season is active, cascade resolves to `season_id IS NULL` default rows (verified: `apps/web/src/app/dashboard/year-wheel/_definitions/season-planning.ts`).

## Relationship to adjacent domains

| Domain | Relationship | Direction |
|---|---|---|
| **core-structure** | `planning_cycle` (D1) is the year-wheel container. `department_operating_hours` is seeded by the activation trigger. | core-structure PROVIDES; year-wheel READS |
| **scheduling** (future domain) | Consumes season D4/D5 as upstream input for shift planning. `planning_event` (D4) will migrate to scheduling when that domain is defined. | year-wheel PROVIDES; scheduling CONSUMES |
| **day-session** | `department_session.season_id` links daily ops to the active season. Season activation seeds `department_operating_hours` which the day-session runtime reads. | year-wheel PROVIDES; day-session CONSUMES |
| **payroll** | Season period defines a time window for tariff `effective_from/to` slices and shift cost attribution. Payroll READS season dates; year-wheel does not touch tariff tables. | year-wheel PROVIDES period boundary; payroll CONSUMES |
| **procedure-engine** | `season_policy_binding` links season to HMS policies. Procedure-engine READS bindings; year-wheel OWNS the binding record. | year-wheel PROVIDES; procedure-engine READS |
| **botsson** | Two Botsson tool-kits registered: 7 tools on the year-wheel page + 6 tools on the season detail page. Both surfaces expose `proposeActivateSeason` + `proposeArchiveSeason` (dual-registration — see GAPS §Deviation D1). | year-wheel OWNS tool definitions; botsson HOSTS via ClientToolKit pattern |

## Design philosophy

> "From Chaos to Cascade" — validated against 7-persona Restaurant AI Council (PRD §3)

The core UX hypothesis is that spatial, timeline-first planning removes the cognitive barrier that prevented managers from engaging with the system's demand model. Season blocks on a canvas are legible; day_factor tables in a form are not.

This hypothesis drives several architectural choices:
- Canvas is client-rendered (`"use client"` page island) while the shell is server-rendered
- Quick-create sheet opens on draw-complete, not on button click
- Season detail route is separate from the year-wheel route (no drawer — prevents scroll trapping)
- Activation is gated (three D4 completeness checks) but the gate is surfaced as a checklist, not an error
