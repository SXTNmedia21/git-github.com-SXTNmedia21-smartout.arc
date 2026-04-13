---
title: "Year Wheel (Årshjul) UX Pivot"
status: superseded
superseded_by: docs/modules/MODULE_YEAR_WHEEL_PRD.md
created: 2026-04-10
updated: 2026-04-12
module: season
tags: [spec, ux, ia, design, hospitality]
---

> **SUPERSEDED:** This spec's content has been absorbed into the Year Wheel PRD v2.0.0
> (`docs/modules/MODULE_YEAR_WHEEL_PRD.md`, Sections 2-4). Retained as design decision origin story.

# Year Wheel (Årshjul) UX & IA Pivot

## Context & Problem
The current `/dashboard/season` module presents "Season Planning" as a highly technical, granular interface focused on daily factors, hour factors, and budgets. This creates cognitive overload for the daily user (restaurant/bar managers). In the hospitality industry, a "Season" is not the top-level mental model; it is merely a building block within the **Annual Plan (Årshjul)**.

## The Pivot
We are transitioning the Information Architecture (IA) from a database-driven "Season Config" view to a strategic "Year Wheel" (Årshjul) view. 
Granular mathematical configurations (factors, budgets) will be hidden behind progressive disclosure, catering to the 95% "set and forget" reality of hospitality management.

## 1. Information Architecture (IA) hierarchy

**Old IA (Flat & Technical):**
- `/dashboard/season`
  - Budgets
  - Day Factors
  - Hour Factors

**New IA (Strategic & Progressive):**
- `/dashboard/year-wheel` (Årshjul - Visual overview of the year)
  - **Drilldown 1: Period Configuration** (Seasons & Events - dates, titles, tags)
  - **Drilldown 2: Advanced Weighting** (The Machine Room - budgets, day factors, hour factors)

## 2. The Mental Model: Canvas, Blocks, and Pins

To avoid redundant data entry and match the mental model of a hospitality leader, the Year Wheel UI relies on three visual and logical layers. It leverages the Cascade Core Foundation where `season_id IS NULL` represents the baseline.

### Layer 1: The Canvas (Normal Drift / Baseline)
- **Concept:** The Year Wheel starts entirely empty. An empty wheel does NOT mean "no data"; it means **"Business as Usual" (Normal drift)**.
- **UX Rules:** 
  - Do NOT force users to create continuous blocks covering 365 days (e.g., no need to create a "Normal Spring" season).
  - The empty space implicitly falls back to the workspace's default operating hours and default staffing needs.

### Layer 2: The Blocks (Seasons / Structural Overrides)
- **Concept:** Structural periods where the baseline rules change significantly (e.g., "Sommersesong" where the patio opens and hours are extended).
- **UX Rules:**
  - Users drag/plot blocks onto the Canvas.
  - When the block ends, the system safely falls back to the Canvas (Normal drift).

### Layer 3: The Pins (Events & Special Days / Volume Spikes)
- **Concept:** Isolated days or short bursts where the operational concept remains the same, but the volume (and thus staffing needs) spikes or drops dramatically (e.g., "17. mai", "Lokal festival").
- **UX Rules:**
  - Plotted as distinct "pins" on the wheel.
  - Can be placed inside the Canvas (Normal drift) OR inside a Block (Season). 
  - Pins ALWAYS trump the underlying layers for that specific date (Date Override).

## 3. The "Killer Feature": Duplicate Last Year

The hospitality industry is intensely cyclical. The primary action when planning a new year is referencing the previous one.

**UX Flow:**
1. User navigates to the next calendar year on the Year Wheel.
2. The wheel is empty (Canvas).
3. A prominent call-to-action: **"Kopier [forrige år] som utgangspunkt"** (Duplicate [Last Year] as baseline).
4. With one click, all Blocks (Seasons) and Pins (Events) are cloned to the new year (with date-math shifting holidays/weekends appropriately where possible).
5. *Future capability:* "Duplicate last year, but increase budget targets by X%."

## 4. Route & Naming Changes (Implementation Guidelines)

- **Routing:** Rename/remap `/dashboard/season` to `/dashboard/year-wheel`.
- **i18n / Menu Text:** Change top-level navigation from "Sesong" to "Årshjul".
- **Visual Design:** The top-level view should be a visual timeline or circular representation of 12 months, immediately communicating the "shape" of the year before exposing any forms or tables.
- **Progressive Disclosure:** Accessing `day_factor` or `hour_factor` should require explicit intent (e.g., clicking a "Rediger vekting/faktorer" button inside a specific Season/Event block).

## 5. Architectural Alignment (Cascade Model)

This UX pivot aligns perfectly with the underlying Cascade scheduling architecture:
- `default(day_of_week, season_id IS NULL)` = **The Canvas**
- `season_specific(day_of_week)` = **The Blocks**
- `override(date)` = **The Pins**

By building the UI to match this exact resolution order, we minimize redundant data rows in `season_budget` and `department_operating_hours`, reducing DB bloat and keeping the system performant.