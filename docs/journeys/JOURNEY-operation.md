---
title: "User Journeys — Season Planning (Module 15)"
status: done
updated: 2026-03-06
created: 2026-03-06
module: season-planning
tags: [module-15, season, budget, journeys]
---

# User Journeys — Season Planning (Module 15)

> Feature branch: `feat/operation` | Module 15 MVP
> Covers: Season selection, budget setup, day factors, hour factors, season overview

---

## Journey: Admin — Select a Season

**Precondition:** Admin is logged in and has at least one season created in the workspace. The Season Planning page is loaded (`/dashboard/season`).

1. User opens the Season Planning page. -> System fetches all seasons for the workspace via `useSeasons` hook. -> User sees the page header "Sesongplanlegging" with a season selector dropdown and an empty state message: "Velg en sesong for a starte planlegging."
2. User clicks the season selector dropdown. -> System renders all available seasons with name and status (draft/active/archived). -> User sees the list of seasons.
3. User selects a season from the dropdown. -> System sets `selectedSeasonId` state and fetches `season_budget` for that season. -> User sees a status badge (e.g., "ACTIVE" in green, "DRAFT" in yellow) next to the selector and the tab navigation appears with 4 tabs: Oversikt, Budsjett, Dagfaktorer, Timefaktorer.
4. If no budget exists yet for the selected season -> System disables the Oversikt, Dagfaktorer, and Timefaktorer tabs (grayed out, cursor-not-allowed). -> User sees only the Budsjett tab is clickable, guiding them to set up a budget first.

**Postcondition:** Season is selected, tab navigation is visible. Budget tab is always available; other tabs require a saved budget.

**Error paths:**
- No seasons exist -> System shows "Ingen sesonger opprettet enna." text instead of the dropdown. User must create a season elsewhere first.
- Network error on season fetch -> Loading skeleton shown indefinitely (TanStack Query retry behavior).

---

## Journey: Admin — Configure Season Budget (Happy Path)

**Precondition:** Admin has selected a season. No budget exists yet (first-time setup) OR budget was previously saved (editing).

1. User clicks the "Budsjett" tab. -> System renders the BudgetSetupTab component. If a budget exists, form fields are pre-populated; otherwise fields are empty with placeholders. -> User sees a form with 4 fields: Total omsetningsmaal (NOK), Maal lonnsandel (%), Gj.snitt timeslonn (NOK), Snittpris per gjest (NOK).
2. User enters total target revenue (e.g., 5000000). -> System updates local state. -> User sees the value in the input field.
3. User adjusts labor percentage (default 30%). -> System updates local state. -> User sees the percentage value.
4. User enters average hourly wage (e.g., 220 NOK). -> System updates local state. -> User sees the value.
5. User enters base price per guest (e.g., 450 NOK). -> System updates local state. -> User sees the value.
6. User clicks "Lagre budsjett". -> System calls `upsertBudget.mutate()` which performs an upsert on `season_budget` table (insert if new, update if existing). Button shows "Lagrer..." while pending. -> User sees button return to "Lagre budsjett" on success. TanStack Query invalidates the budget query, and other tabs become enabled.

**Postcondition:** `season_budget` row exists for this season with the configured values. Dagfaktorer, Timefaktorer, and Oversikt tabs are now enabled.

**Error paths:**
- User enters 0 or negative revenue -> `handleSave` returns early (no mutation fired), button stays enabled. No user feedback shown (silent validation).
- User leaves revenue empty -> "Lagre budsjett" button is disabled (`!totalTarget` check).
- Database error on upsert -> TanStack Query `onError` fires. No explicit toast shown in current implementation.

---

## Journey: Admin — Set Day Factors with Templates (Happy Path)

**Precondition:** Admin has selected a season and saved a budget. The budget's `season_budget_id` is available.

1. User clicks the "Dagfaktorer" tab. -> System fetches day factors for this budget via `useDayFactors`. If none exist, default restaurant factors are used (Mon=0.8, Tue=0.8, Wed=0.9, Thu=1.0, Fri=1.3, Sat=1.4, Sun=0.8). -> User sees 7 rows (Mon-Sun) each with a label, a horizontal bar chart showing relative weight, and a numeric input field.
2. User sees template buttons at top-right: "Restaurant", "Hotell", "Flat". -> System renders 3 template buttons. -> User can choose a preset or manually adjust each day.
3. User clicks "Hotell" template. -> System applies hotel distribution (Sun=1.0, Mon=1.0, Tue=1.1, Wed=1.1, Thu=1.3, Fri=1.4, Sat=1.1). Bar chart updates immediately. -> User sees the visual bars and numeric values update to reflect the hotel pattern.
4. User manually adjusts Friday factor from 1.4 to 1.6 by editing the input field. -> System updates local state. Bar chart width adjusts proportionally (relative to max factor). -> User sees the Friday bar grow taller.
5. User clicks "Lagre dagfaktorer". -> System calls `saveDayFactors.mutate(factors)` which upserts 7 rows in `day_factor` table. Button shows "Lagrer..." while pending. -> User sees button return to "Lagre dagfaktorer" on success.

**Postcondition:** 7 `day_factor` rows exist for this `season_budget_id` with the configured weights. These factors are now used in the Overview tab calculations.

**Error paths:**
- User enters 0 or negative factor -> `updateFactor` returns early, value unchanged.
- User enters non-numeric value -> `parseFloat` returns NaN, `updateFactor` returns early.

---

## Journey: Admin — Set Hour Factors Linked to Operating Hours (Happy Path)

**Precondition:** Admin has selected a season and saved a budget. Operating hours are configured in workspace settings (via `useOperatingHours` from settings module).

1. User clicks the "Timefaktorer" tab. -> System fetches hour factors via `useHourFactors` AND operating hours via `useOperatingHours`. Operating hours determine the visible hour range. -> User sees the tab heading "Timefaktorer" with a description showing the detected operating hours range (e.g., "10:00-22:00").
2. If operating hours are configured (e.g., open 10:00-22:00) -> System generates hour slots only for the open range (12 slots: 10-21). -> User sees 12 rows, each with an hour label (e.g., "10:00"), a horizontal bar, and a numeric input.
3. If no operating hours are configured -> System falls back to default range 10:00-22:00. -> User sees the default range with default hour factors.
4. If hour factors were previously saved -> System loads them from DB. -> User sees previously saved values.
5. If no hour factors exist -> System seeds from `DEFAULT_HOUR_FACTORS` (lunch peak at 12-13, dinner peak at 18-20), filtered to open hours. -> User sees sensible defaults with peak hours highlighted in green.
6. User adjusts the 19:00 factor from 1.4 to 1.8. -> System updates local state. Bar chart updates; the bar is highlighted in green (emerald) if factor >= 80% of max factor. -> User sees the 19:00 bar grow and potentially turn green.
7. User clicks "Lagre timefaktorer". -> System calls `saveHourFactors.mutate(factors)` which upserts rows in `hour_factor` table. -> User sees button return to "Lagre timefaktorer" on success.

**Postcondition:** `hour_factor` rows exist for this `season_budget_id` covering all open hours. These factors are used in the Overview tab hourly calculations.

**Error paths:**
- Operating hours query fails -> Falls back to 10:00-22:00 default range.
- User enters 0 or negative factor -> `updateFactor` returns early, value unchanged.
- All operating days are marked as closed -> System shows default 10:00-22:00 range (fallback).

---

## Journey: Admin — View Season Overview with Calculated Targets and Staffing (Happy Path)

**Precondition:** Admin has selected a season with a saved budget, day factors, and hour factors. Season has `start_date` and `end_date` set.

1. User clicks the "Oversikt" tab. -> System runs 3 calculation functions: `calculateDayTargets()`, `calculateHourTargets()`, `calculateStaffingNeed()`. All are pure functions using budget, day factors, hour factors, and operating hours as input. -> User sees the overview page with 3 sections.
2. **Metric cards section**: System calculates and displays 4 KPI cards:
   - "Sesongmaal" -> Total target revenue from budget (e.g., kr 5 000 000).
   - "Snitt/dag" -> Average daily target across the first week sample.
   - "Topp bemanning" -> Peak hour staffing need calculated as: `(hour_target * labor_pct) / avg_hourly_wage`, with the peak hour shown below (e.g., "kl 19:00").
   - "Gjester/dag" -> Estimated daily guests: `avg_daily_target / (base_price_per_guest * season_price_factor)`. Shows dash if base price not set.
3. **Weekly distribution chart**: System renders a bar chart for the first 7 days of the season. Each bar height is proportional to that day's revenue target. Labels show abbreviated weekday names (Man, Tir, Ons, etc.) and formatted NOK amounts. -> User sees visual distribution of revenue across the week, clearly showing which days are expected to be busiest.
4. **Hourly distribution chart** (peak day): System identifies the day with the highest target from the weekly sample, then runs `calculateHourTargets()` for that day. Renders a bar chart where each bar represents one operating hour. Bars at >= 80% of peak are highlighted in green. -> User sees the hourly revenue distribution for the busiest day, with peak hours visually emphasized.

**Postcondition:** Admin has a complete visual overview of: season revenue target, daily distribution, peak staffing needs, expected guest counts, and hourly revenue patterns. This information supports scheduling and hiring decisions.

**Error paths:**
- No budget exists -> System shows: "Sett opp budsjett forst for a se beregninger." (The Oversikt tab is also disabled in the page-level tab navigation when no budget exists, so this is a double guard.)
- No season start/end dates -> `calculateDayTargets` returns empty array. Metric cards show dashes or zeros. Charts are empty.
- Average hourly wage is 0 or not set -> `calculateStaffingNeed` returns `staffNeeded: 0`. "Topp bemanning" card shows dash.
- Base price per guest not set -> "Gjester/dag" card shows dash.
- No day factors saved -> Calculation engine uses factor 1.0 for all days (flat distribution).
- No hour factors saved -> SeasonOverviewTab uses empty array; `calculateHourTargets` defaults all factors to 1.0 (even distribution).

---

## Journey: Admin — Switch Between Seasons (Happy Path)

**Precondition:** Admin is on the Season Planning page with a season already selected. Multiple seasons exist.

1. User clicks the season selector dropdown. -> System shows all available seasons. -> User sees the list with current season highlighted.
2. User selects a different season. -> System updates `selectedSeasonId`. All hooks (`useSeasonBudget`, `useDayFactors`, `useHourFactors`) refetch data for the new season. Active tab resets to current tab (state preserved). -> User sees the tab content update with data from the newly selected season.
3. If the new season has no budget -> System disables Oversikt, Dagfaktorer, Timefaktorer tabs. Redirects to Budsjett tab behavior (user must set up budget first). -> User sees only Budsjett tab available.

**Postcondition:** All displayed data reflects the newly selected season. No data from the previous season leaks into the current view.

**Error paths:**
- Rapid season switching -> TanStack Query cancels in-flight requests for the previous season. No stale data displayed.
