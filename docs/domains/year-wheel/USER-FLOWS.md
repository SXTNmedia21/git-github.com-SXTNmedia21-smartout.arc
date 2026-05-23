---
title: "Year Wheel — User Flows"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: year-wheel
tags: [domain, year-wheel, season, user-flows, journeys]
---

# Year Wheel — User Flows

> Index of documented journeys for the year-wheel domain. Journeys are the primary deliverable alongside code per CLAUDE.md §Feature Closure.

## Journey files

| Journey | File | Status | Scope |
|---|---|---|---|
| Year Wheel — core flows | `docs/journeys/JOURNEY-year-wheel.md` | active | Canvas view, season lifecycle, quick-create, activate/archive |
| Season agent capability | `docs/journeys/JOURNEY-season-agent-capability.md` | active | Botsson chat flows for season tools |
| Season engine complete | `docs/journeys/JOURNEY-season-engine-complete.md` | active | Full season → D1 fanout → day-session flow |
| Season operations loop | `docs/journeys/JOURNEY-season-operations-loop.md` | active | Day-to-day manager usage within an active season |

## Surface flows (summary)

### Flow 1: Annual birds-eye view

**Entry:** `/dashboard/year-wheel`
**Actor:** Manager, Admin, Owner

1. Page loads with horizontal year timeline (current year default, `?year=` param controls)
2. Season blocks render as colored bars; planning event pins render as dots/bars
3. Sidebar shows all seasons with filter pills (all / active / draft / archived)
4. User can navigate years with prev/next chevrons (URL updates `?year=`)

### Flow 2: Create a season (draw-to-create)

**Entry:** Year-wheel canvas, empty area
**Actor:** Manager+

1. User clicks and drags on empty canvas area
2. `DrawPhantom` shows live rectangle preview
3. On release (if drag > minimum threshold): `SeasonQuickCreateSheet` opens with pre-filled start/end dates
4. User types season name → submits
5. New season appears in sidebar + canvas as draft block

**Alt path (quick-create button):** Opens `SeasonQuickCreateSheet` without pre-filled dates. Defaults to today + 7 days (verified: `year-wheel-redesign.spec.ts:39`).

### Flow 3: Activate a season

**Entry:** Season detail page `/dashboard/season/[id]` or Botsson chat
**Actor:** Manager+ (requires `season.activate` authority)
**Precondition:** Season status = `draft`, budget set + day_factors present + hour_factors present

1. Manager opens season detail page
2. Checks Overview tab or uses Botsson `getActivationReadiness`
3. Three D4 gate checks pass (budget > 0, day factors configured, hour factors configured)
4. Clicks "Activate" button → `SeasonActivationProposalModal` confirms action
5. `activateSeasonAction` → `activate_season` RPC:
   - Archives currently active season atomically
   - Sets this season status = `active`
   - `trg_season_activated` fires → seeds `department_operating_hours` (D1 fanout)
6. Toast: "[Season name] er nå aktiv — N avdelinger oppdatert"
7. Year-wheel canvas updates: new active block, previous active block archived

**Error paths:**
- `missing_budget` → toast error + return to BudgetSetupTab
- `missing_day_factors` → toast error + return to DayFactorsTab
- `missing_hour_factors` → toast error + return to HourFactorsTab
- `insufficient_authority` → toast error (manager role not held)

### Flow 4: Archive a season

**Entry:** Season detail page or Botsson `proposeArchiveSeason`
**Actor:** Manager+

1. User initiates archive
2. `archiveSeasonAction` direct UPDATE (status → `archived`)
3. Toast: "[Season name] er arkivert" or "var allerede arkivert" (idempotent)

### Flow 5: Configure season budget + factors

**Entry:** `/dashboard/season/[id]?tab=budget` (or `day`, `hour`)
**Actor:** Manager+

1. BudgetSetupTab: enter total target revenue, labor %, avg hourly wage, base price per guest
2. DayFactorsTab: set weight per weekday (0–6 = Monday–Sunday)
3. HourFactorsTab: set weight per hour (0–23)
4. Each save mutates `season_budget` / `day_factor` / `hour_factor` via TanStack mutation → `emit()` on success

### Flow 6: Botsson on year-wheel

**Entry:** Botsson orb on `/dashboard/year-wheel`
**Actor:** Any authenticated user

The 7 page-tools are wired via `useYearWheelTools` and registered as a `ClientToolKit`. Botsson can:
- Report current year state, active season, planning event count (`getYearWheelState`)
- List seasons filtered by status (`listSeasons`)
- Get detail for a specific season (`getSeasonDetail`)
- List planning events for current year (`listPlanningEvents`)
- Check activation readiness (`getSeasonProgress`)
- Activate a season (via toast UI) (`proposeActivateSeason`)
- Archive a season (via toast UI) (`proposeArchiveSeason`)

### Flow 7: Botsson on season detail

**Entry:** Botsson orb on `/dashboard/season/[id]`
**Actor:** Any authenticated user

6 tools via `useSeasonTools`:
- Get season metadata (`getSeasonStatus`)
- Check D4 gate completeness (`getActivationReadiness`)
- Get budget KPIs (`getBudgetSummary`)
- Get factor distribution summary (`getFactorSummary`)
- Propose activate (`proposeActivateSeason`)
- Propose archive (`proposeArchiveSeason`)

## Deferred flows (not yet accessible)

| Flow | Why deferred | Tracking |
|---|---|---|
| Season goals management | `SeasonGoalsTab.tsx` in `_deferred/` (L-0074) | CAMPAIGN M4 |
| Season procedures / policy binding UI | `SeasonProceduresTab.tsx` in `_deferred/` (L-0074) | CAMPAIGN M4 |
| Drag-to-resize season blocks | Spec §4.1 interaction; canvas handles pointer events but resize not wired | CAMPAIGN M2 |
| Duplicate season ("Copy last year") | `duplicate-season-action.ts` exists; no UI button wired in year-wheel shell | CAMPAIGN M4 |
| Voice mutations (M5) | Deferred per ADR-0201 §D5 | ADR-0201 M5 |
