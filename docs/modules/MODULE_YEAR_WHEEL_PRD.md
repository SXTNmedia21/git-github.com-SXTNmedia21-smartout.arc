---
title: "PRD — Year Wheel (Årshjul)"
status: archived
superseded_by: docs/domains/year-wheel/
version: 2.0.0
created: 2026-04-12
updated: 2026-05-23
module: year-wheel
route: /dashboard/year-wheel
language: en
tags: [prd, season, planning, cascade, hospitality, ux, hypothesis]
council-reviewed: 2026-04-12
design-rationale-ref: docs/superpowers/specs/2026-04-10-year-wheel-ux-pivot.md
---

> **ARCHIVED 2026-05-23** — Superseded by `docs/domains/year-wheel/`. Content absorbed into domain spine. Read [docs/domains/year-wheel/README.md](../domains/year-wheel/README.md) instead.
> Note: flat files in `docs/modules/*.md` are not scanned by `check-archived-refs.mjs` (only folder-form docs). This frontmatter is present for future-proofing. See GAPS §Debt T7 in year-wheel domain.



# PRD — Year Wheel (Årshjul)

## 1. Summary

The Year Wheel is Smartout's strategic planning module for shift-based businesses (restaurants, bars, hotels). It lets managers visualize, create, and adjust seasons and events directly on a horizontal timeline — instead of filling out forms.

The Year Wheel replaces the former `/dashboard/season` route and is the primary entry point for all season planning in the system.

**Target audience:** General managers, operations managers, and restaurant managers in Norwegian shift-based businesses.

**Design philosophy:** "From Chaos to Cascade" — validated through IntelliJess Console testing against the Restaurant AI Council (7 personas). See Section 3.

---

## 2. Problem Statement

The hospitality industry is intensely cyclical. Managers think in periods ("summer season", "Christmas party season"), special days ("17. mai", "neighborhood concert"), and normal operations — not in day factors and hour factors. The previous season module exposed technical database concepts directly in the UI, creating cognitive overload and low adoption.

### Pain Points This Solves

| Problem | Year Wheel Solution |
|---|---|
| Users don't understand "day factors" | Hidden behind progressive disclosure ("The Machine Room") |
| Creating a season requires many fields | Click on timeline -> prefilled date -> title -> done |
| No spatial understanding of the year's shape | Visual timeline with colored blocks and pins |
| Planning next year starts from scratch | "Copy last year" button clones everything with date shifting |
| Difficult to adjust start/end dates | Drag the edges of a season block directly |
| Fear of "breaking the system" by deleting a season | Canvas fallback: deleting a season reveals normal drift, not a void |

---

## 3. Design Hypothesis — "From Chaos to Cascade"

> Validated through IntelliJess Console against the Restaurant AI Council baseline
> (7 personas: Multi-site Manager, Back-office Admin, External Consultant, Career Professional,
> Fast-food Entry Worker, Low-literacy Worker, Sommelier/Specialist).
> Reference: `docs/engines/industri-inteligence/hospitalety/01-ai-council/restaurant-council.md`

### Background

A restaurant manager doesn't plan in days but in energy levels. They know that "Christmas party season" requires a different gear than "January hibernation." In today's systems, they're forced to set manual factors day by day, which leads to them giving up and "guessing" on the shift lists.

### Hypothesis 1: "Draw, Don't Type" (Interaction)

We believe users will achieve a deeper strategic understanding of operations if they can see and feel the volume on a timeline.

**Hypothesis:** By letting the user draw a "block" (Season) over a period, they define not just a date, but a mode.

**Expected result:** The user spends 80% less time on configuration because they configure the period, not individual days.

**Implementation:** Click-and-drag on empty canvas to create a season block. Ghost preview during drag. Inline name popover on release. (Status: Planned)

### Hypothesis 2: "The Safety Net" (The Cascade)

We assume that the fear of "breaking the system" prevents planning.

**Hypothesis:** By using a layered model (Canvas -> Blocks -> Pins), the user feels safe. They know that if they delete a season (Block), the system simply falls back to standard operations (Canvas). There is no "void" that can crash the budget.

**Expected result:** Increased experimentation with seasonal variations.

**Implementation:** Canvas = `season_id IS NULL` in cascade resolution. Empty timeline space is intentional, not broken. (Status: Implemented)

### Hypothesis 3: "The Exception Proves the Rule" (Pins)

We believe pins (Events) function as visual "alarm clocks."

**Hypothesis:** A restaurant manager uses pins as memory hooks. "Something is happening in the neighborhood tonight that doesn't change the whole season, but requires 2 extra servers tonight."

**Expected result:** Precise staffing on individual days without touching general season settings.

**Implementation:** Planning events as clickable dots on the timeline, with demand_multiplier per date. (Status: Implemented)

### Hypothesis 4: "Mirroring the Past" (Automation)

We assume that 90% of all seasons in hospitality are repetitive, with small date shifts.

**Hypothesis:** The "Copy last year" button is the most important feature for loyalty. By cloning last year's intelligence to this year's calendar (with automatic correction for weekdays/holidays), planning time goes from hours to seconds.

**Expected result:** The user goes from being a "data-input operator" to a "strategic controller."

**Implementation:** `duplicateYear` mutation clones seasons + events with date shifting. (Status: Implemented, budget cloning planned)

### The User Journey in Three Steps

1. **Orientation:** The user opens the wheel, sees the "Today" marker, and gets immediate sense of control or urgency about the coming months.
2. **Manipulation:** The user drags the edges of a block to extend summer season because the weather forecast looks good (or based on last year's data).
3. **Precision:** The user opens the "Machine Room" only when the numbers in the overview (Drawer) don't match their gut feeling, to fine-tune the weighting.

### AI Council Persona Alignment

| Persona | Hypothesis Alignment |
|---|---|
| Multi-site Manager | Year copy + health summary = speed + operational control |
| Back-office Admin | Machine Room + locked budgets = auditability and repeatability |
| Career Professional | Drag-resize = practical workflow during live service |
| Entry Worker | Canvas/Blocks simplicity = low cognitive barrier |
| Low-literacy Worker | Visual timeline = minimal text reliance |
| External Consultant | Year-over-year comparison = measurable ROI |
| Sommelier/Specialist | Machine Room depth = advanced workflow fidelity |

---

## 4. Mental Model — Canvas, Blocks, Pins

The Year Wheel builds on three layers that mirror Smartout's Cascade architecture:

### Layer 1: The Canvas (Normal Drift / Baseline)

Empty canvas = "Business as usual." The user does NOT need to create seasons covering 365 days. All uncovered days fall back to the workspace's default operating hours and staffing needs (`season_id IS NULL` in the Cascade model).

**Cascade mapping:** `default(day_of_week, season_id IS NULL)`

**Visual language:** The empty canvas should NOT feel broken or empty. It should communicate "normal drift" through subtle visual treatment — the absence of a block is intentional, not an error. (Current implementation: plain background. Planned: fractal noise overlay with "NORMAL DRIFT" watermark label.)

**Semantic clarification:** Canvas means "no season entity" — `department_operating_hours.season_id IS NULL` resolves to workspace defaults. This is NOT the same as `season.is_default = true`, which is a governance template fallback for policy-binding (see Section 10 Data Model).

### Layer 2: The Blocks (Seasons / Structural Overrides)

Horizontal colored bars representing structural periods where operations change significantly. Examples: "Summer Season" (patio opens, extended hours), "Christmas Party Season" (extra bookings, higher staffing needs).

Seasons have three states:
- **Draft:** Under setup, can be edited freely (dashed border)
- **Active:** In production, drives staffing calculations (solid emerald border). Maximum one active at a time.
- **Archived:** Historical, read-only (dimmed)

**Cascade mapping:** `season_specific(day_of_week)`

**Activation rule:** Only ONE season may be active at a time per workspace. Activating a new season automatically archives the currently active one. Overlapping date ranges are allowed in draft state for planning purposes. (See ADR-0085.)

### Layer 3: The Pins (Events & Special Days / Volume Spikes)

Point markers on specific dates representing individual events with volume changes. Examples: "17. mai", "Local festival", "Concert in the park." Pins can be placed BOTH on the empty canvas AND inside a season block. They ALWAYS override the underlying layer for that specific date.

**Cascade mapping:** `override(date)`

### Resolution Order

```
override(date)           →  Pins win for that date
season_specific(day)     →  Blocks win for the period
default(season_id=NULL)  →  Canvas is the fallback
```

This matches the canonical cascade resolution in `apps/web/src/lib/cascade/resolve-hours.ts`.

---

## 5. Functional Requirements

### 5.1 Timeline and Navigation

| ID | Description | Status |
|---|---|---|
| FR-NAV-01 | Horizontal timeline with 12 month columns (year view) | Implemented |
| FR-NAV-02 | Month zoom with one column per day | Implemented |
| FR-NAV-03 | Year switching with arrows (previous/next year) | Implemented |
| FR-NAV-04 | Date picker for quick navigation to a specific date | Implemented |
| FR-NAV-05 | "1. juni" quick button (industry-standard summer start) | Implemented |
| FR-NAV-06 | "I dag" (Today) quick button | Implemented |
| FR-NAV-07 | "I dag" marker (orange vertical line on current date) | Implemented |
| FR-NAV-08 | Focused date marker (blue vertical line on selected date) | Implemented |
| FR-NAV-09 | Smooth scroll to focused date on navigation | Implemented |
| FR-NAV-10 | View mode switch between "Full year" and "Month" | Implemented |
| FR-NAV-11 | Seasonal health summary bar above timeline (months planned, budget total, next event countdown) | Planned |
| FR-NAV-12 | Year comparison chip ("3 seasons last year, 0 this year") when target year is empty | Planned |

### 5.2 Seasons (Blocks)

| ID | Description | Status |
|---|---|---|
| FR-SEA-01 | Create season via timeline click (type: "Season start") | Implemented |
| FR-SEA-02 | Create season via dedicated "New season" form (Sheet) | Implemented |
| FR-SEA-03 | End date required when creating a season start | Implemented |
| FR-SEA-04 | Color-coded blocks based on status (draft/active/archived) | Implemented |
| FR-SEA-05 | Click on block opens SeasonDrawer with details | Implemented |
| FR-SEA-06 | Drag left/right edge to change start/end date | Implemented |
| FR-SEA-07 | Validation: start date cannot pass end date during drag | Implemented |
| FR-SEA-08 | Activation requires complete budget + day factors + hour factors | Implemented |
| FR-SEA-09 | Maximum one active season at a time (previous is auto-archived) | Implemented |
| FR-SEA-10 | "Copy last year" clones all seasons and events with date shifting | Implemented |
| FR-SEA-11 | Confirmation dialog if target year already has seasons | Implemented |
| FR-SEA-12 | Draw-to-create gesture: click-and-drag on canvas to paint a new block with ghost preview | Planned |
| FR-SEA-13 | Inline name popover on draw-to-create release (no dialog) | Planned |
| FR-SEA-14 | Smart defaults: auto-generate season_budget + day_factor + hour_factor from restaurant template when creating a new season | Planned |
| FR-SEA-15 | Canvas visual treatment: subtle background pattern + "Normal drift" label for uncovered months | Planned |
| FR-SEA-16 | Empty-year hero CTA: "Copy [last year] as starting point" with mini-timeline preview when the year has no seasons | Planned |
| FR-SEA-17 | Budget/factor cloning in year copy (opt-in toggle: "Copy with budget and factors") | Planned |
| FR-SEA-18 | Block overlap visual warnings when two seasons cover the same dates | Planned |
| FR-SEA-19 | Year-over-year ghost overlay of previous year's blocks after copying | Planned |

### 5.3 Events (Pins)

| ID | Description | Status |
|---|---|---|
| FR-EVT-01 | Create event via click on empty canvas (date prefilled) | Implemented |
| FR-EVT-02 | Edit existing event via click on pin | Implemented |
| FR-EVT-03 | Color coding based on category | Implemented |
| FR-EVT-04 | Smart clustering: 3+ pins in same month collapse to cluster chip in year view | Implemented |
| FR-EVT-05 | Individual pins in month view (no clustering) | Implemented |
| FR-EVT-06 | Editable date in edit dialog | Implemented |
| FR-EVT-07 | Four UI creation types: Training Slot, Season Start, Important Event, Special Day | Implemented |
| FR-EVT-08 | Holiday auto-correction for recurring events during year copy (Norwegian public holidays) | Planned |

**Event type mapping:** The four UI creation types map to the `planning_event_category` DB enum as follows:

| UI Type | DB Category |
|---|---|
| Important Event | `cultural_commercial` |
| Training Slot / Season Start / Special Day | `internal` |

Additional enum values (`external_scraped`, `weather`, `recurring`) are populated by automated sources (scraping, weather API, booking integrations), not the Year Wheel UI.

### 5.4 Lists Below Timeline

| ID | Description | Status |
|---|---|---|
| FR-LST-01 | Season list with sorting (start date asc/desc, name) | Implemented |
| FR-LST-02 | Event list with sorting (date asc/desc, name) | Implemented |
| FR-LST-03 | Click on list item mirrors timeline interaction (season -> drawer, event -> edit) | Implemented |

### 5.5 Season Details (Drawer)

| ID | Description | Status |
|---|---|---|
| FR-DRW-01 | Drawer slides in from right with three tabs: Overview, Goals, Procedures | Implemented |
| FR-DRW-02 | Overview tab: staffing calculation based on budget, day factors, hour factors, and opening hours | Implemented |
| FR-DRW-03 | Goals tab: CRUD for season goals with status tracking (active/completed/cancelled) | Implemented |
| FR-DRW-04 | Procedures tab: per-season HMS policy activation with toggles | Implemented |
| FR-DRW-05 | "Edit weighting" button opens Machine Room (MachineRoomSheet) | Implemented |
| FR-DRW-06 | Summary card before tabs with budget KPIs and factor sparklines | Planned |

### 5.6 Machine Room (Progressive Disclosure)

| ID | Description | Status |
|---|---|---|
| FR-MCR-01 | Nested Sheet with three Accordion sections: Budget, Day Factors, Hour Factors | Implemented |
| FR-MCR-02 | Budget setup: revenue target, labor cost percentage, average hourly wage | Implemented |
| FR-MCR-03 | Day factors: 7 weekdays with weighted factors + templates (restaurant, hotel, event, flat) | Implemented |
| FR-MCR-04 | Hour factors: 24 hours with weighted factors + templates (restaurant, dinner peak, flat) | Implemented |
| FR-MCR-05 | Budget lock prevents editing when status is "locked" | Implemented |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Description | Status |
|---|---|---|
| NFR-PERF-01 | Timeline renders in under 100ms with up to 20 seasons and 100 events | Met |
| NFR-PERF-02 | Drag-resize gives visual feedback without lag (pointer capture, no re-render during drag) | Met |
| NFR-PERF-03 | Stale time on season query is 10 minutes (stable definitions, infrequent change) | Met |

### 6.2 Accessibility (A11y)

| ID | Description | Status |
|---|---|---|
| NFR-A11Y-01 | All interactive elements have `aria-label` and are keyboard-navigable | Met |
| NFR-A11Y-02 | Pin hit-areas are minimum 44x44px (WCAG 2.5.8) | Partially met |
| NFR-A11Y-03 | Focus rings (`focus-visible`) on all clickable elements | Met |
| NFR-A11Y-04 | Drag handles have `role="separator"` with orientation aria | Met |
| NFR-A11Y-05 | `prefers-reduced-motion` media query handling | Not met |

**Note:** Edge drag handles are 12px wide (`w-3`). The visible indicator meets design intent but the hit area should be expanded to 44px invisible touch target for WCAG compliance. Touch target sizes on quick buttons ("1. juni", "I dag") are also below 44px height.

### 6.3 Dark Mode

| ID | Description | Status |
|---|---|---|
| NFR-DRK-01 | All components support dark mode | Met |
| NFR-DRK-02 | Contrast ratios meet WCAG AA for text in both modes | Partially met |

**Known debt:** Dark mode is currently implemented via `isDark` prop drilling from DashboardContext. This is an anti-pattern per the Nordic Split design system, which prescribes CSS variable auto-switching. Migration to CSS variables is tracked as technical debt.

**Known debt:** Hardcoded color utility classes (`bg-zinc-800`, `text-emerald-300`, etc.) are used throughout. Nordic Split mandates CSS variable classes (`bg-card`, `text-foreground`). Migration required.

### 6.4 Internationalization (i18n)

| ID | Description | Status |
|---|---|---|
| NFR-I18N-01 | All user-facing strings via i18n keys (Norwegian Bokmål + English) | Partially met |
| NFR-I18N-02 | Date format follows `nb-NO` locale | Met |

**Known debt:** Approximately 15 hardcoded Norwegian strings exist in `page.tsx` (dialog labels, button text, sort options). These need migration to i18n keys.

### 6.5 Telemetry

| ID | Description | Status |
|---|---|---|
| NFR-TEL-01 | All mutations emit via `emit()` from `@smartout/telemetry` | Met |
| NFR-TEL-02 | Navigation events: `season year_navigated`, `season block_clicked`, `season pin_clicked` | Met |
| NFR-TEL-03 | Mutation events: `season created`, `season updated`, `season activated`, `season archived` | Met |
| NFR-TEL-04 | Goal events: `season_goal created/updated/completed/deleted` | Met |
| NFR-TEL-05 | Policy binding events: `season_policy_binding toggled` | Met |

---

## 7. Information Architecture

```
/dashboard/year-wheel (Årshjul)
├── Toolbar: Year switch · Date picker · "1. juni" · "I dag" · View (year/month) · Month picker
├── [Planned] Health Summary Bar: months planned · budget total · next event
├── Timeline (Canvas)
│   ├── Season Blocks — clickable, draggable edges
│   └── Event Pins — clickable, clustered in year view
├── Action Bar: Copy last year · Activate/Archive season · New season
├── Lists: Seasons (sorted) · Events (sorted)
├── SeasonDrawer (side sheet)
│   ├── [Planned] Summary Card (budget KPIs, factor sparklines)
│   ├── Tab: Overview (staffing calculation)
│   ├── Tab: Goals (CRUD, status tracking)
│   ├── Tab: Procedures & HMS (policy toggles)
│   └── → MachineRoomSheet (budget, day factors, hour factors)
└── Create/Edit Dialog (contextual modal)
```

---

## 8. User Flows

### Flow 1: Plan Next Year (Primary Flow)

1. User navigates to next year's wheel via arrow navigation
2. Canvas is empty — user sees hero CTA "Copy last year as starting point" (planned) or toolbar button (current)
3. User clicks → all seasons and events are cloned with date shifting
4. User drags season block edges to adjust start/end dates
5. User clicks block → Drawer opens → "Edit weighting" → adjusts budget
6. User activates season when setup is complete

### Flow 2: Add an Event

1. User clicks a point on the timeline
2. Dialog opens with prefilled date
3. User selects type (e.g., "Important Event"), writes title
4. Clicks "Create" → pin appears immediately on the timeline

### Flow 3: Adjust Season Period

1. User hovers over edge of a season block (cursor changes to ↔)
2. Drags edge to new position
3. On release: date is calculated from pixel position, validated (start ≤ end), saved
4. Toast confirms "Season dates updated"

### Flow 4: Month Detail View

1. User selects "Month" in view switcher
2. Selects specific month in month picker
3. Timeline zooms in: one column per day, day numbers in header
4. Seasons and events display with day-level resolution
5. User can click to create event on exact day

### Flow 5: Draw-to-Create Season (Planned)

1. User clicks and drags horizontally across empty canvas
2. Ghost block appears during drag with calculated start/end dates
3. On release, inline name popover appears above the new block
4. User types name (pre-suggested based on months, e.g., "Summer Season")
5. Season created as draft with drawn date range
6. Smart defaults auto-generate budget + factors from restaurant template

### Flow 6: Orientation (Planned)

1. User opens Year Wheel and immediately sees:
   - "Today" marker anchoring them in time
   - Health summary bar showing "8/12 months planned", budget total, next event in 3 days
   - Year comparison chip: "Last year had 4 seasons" when current year is empty
2. Within 2 seconds, user has a sense of "control" or "urgency"

---

## 9. Data Model

### Tables

| Table | Cascade Dimension | Key Fields | Relationship |
|---|---|---|---|
| `season` | D4 (Demand) | `season_id`, `workspace_id`, `name`, `slug`, `season_type`, `start_date`, `end_date`, `status`, `is_default`, `color`, `icon`, `description`, `parent_season_id`, `planning_cycle_id`, `opening_hours` (deprecated), `created_by` | Root entity |
| `season_budget` | D4 | `season_budget_id`, `season_id` (unique), `total_target_revenue`, `season_price_factor`, `target_labor_percentage`, `avg_hourly_wage`, `target_margin`, `base_price_per_guest`, `status` | 1:1 with season |
| `day_factor` | D4 | `day_factor_id`, `season_budget_id`, `weekday` (0-6), `factor` | N:1 with season_budget |
| `hour_factor` | D4 | `hour_factor_id`, `season_budget_id`, `hour` (0-23), `factor` | N:1 with season_budget |
| `planning_event` | D4 | `planning_event_id`, `workspace_id`, `planning_cycle_id`, `name`, `event_date`, `end_date`, `category` (enum), `source` (enum), `demand_multiplier`, `expected_covers`, `confidence`, `is_recurring`, `recurrence_rule`, `provenance` (JSON), `external_source_url`, `hours_override_id` | Optional link to planning_cycle |
| `planning_cycle` | D1 (Envelope) | `planning_cycle_id`, `workspace_id`, `name`, `start_date`, `end_date`, `status`, `total_revenue_target` | Container for seasons |
| `season_goal` | Governance | `season_goal_id`, `season_id`, `title`, `description`, `metric_key`, `target_value`, `target_unit`, `status` (enum: active/completed/cancelled), `sort_order` | N:1 with season |
| `season_policy_binding` | Governance | `season_policy_binding_id`, `season_id`, `policy_id`, `is_active`, `notes`, `activated_by` | Junction: season × policy |

### Enums

| Enum | Values |
|---|---|
| `season_status` | `draft`, `active`, `archived` |
| `season_type` | `default`, `calendar`, `focus`, `cycle`, `custom` |
| `budget_status` | `draft`, `active`, `locked` |
| `planning_cycle_status` | `draft`, `active`, `archived` |
| `planning_event_category` | `external_scraped`, `cultural_commercial`, `internal`, `weather`, `recurring` |
| `planning_event_source` | `manual`, `scraped_municipality`, `scraped_cultural`, `weather_api`, `booking_integration`, `historical_import` |
| `season_goal_status` | `active`, `completed`, `cancelled` |

### Field Clarifications

**`season.is_default`** — This is a governance template fallback, NOT the Canvas baseline. When restaurant policy templates (governance.sql, mattilsynet.sql, alcohol-labor.sql) need a season reference during seeding, they fall back to the season with `is_default = true`. Canvas (normal drift) in cascade resolution is `season_id IS NULL`. These are two different concepts.

**`season.opening_hours`** — **DEPRECATED.** Added in migration `20260416200000` but marked as legacy in `20260421210000` (Cascade A1 cleanup). The comment reads: `'LEGACY: deprecated by Cascade A1. Runtime reads must use department_operating_hours.'` This column should be dropped in a future migration. Do not read from or write to it.

**`season.parent_season_id`** — Enables nested seasons (e.g., "Festival Week" inside "Summer Season"). Currently unused in the Year Wheel UI but supported by the schema for future use.

### Status Transitions for `season.status`

```
draft → active → archived
         ↑          │
         └──────────┘  (can be reactivated)
```

Activation requires:
- Budget exists with `total_target_revenue > 0`
- At least one day factor exists
- At least one hour factor exists

On activation, any other active seasons are automatically archived (max 1 active per workspace, per ADR-0085).

### Year Copy Clone Scope

Current `duplicateYear` behavior:

| Entity | Cloned? | Notes |
|---|---|---|
| `season` | Yes | New row as draft, dates shifted, name updated |
| `planning_event` | Yes | Cloned for each source season's planning_cycle |
| `season_budget` | **No** | Fresh configuration needed (current behavior) |
| `day_factor` | **No** | Fresh configuration needed (current behavior) |
| `hour_factor` | **No** | Fresh configuration needed (current behavior) |
| `season_goal` | **No** | Goals are per-year intent |
| `season_policy_binding` | **No** | Policies may change year-to-year |
| `department_operating_hours` | N/A | Not yet wired to seasons (see Section 13) |

Planned enhancement (FR-SEA-17): opt-in toggle to also clone budget + factors with the new season starting as `draft` status regardless of source.

---

## 10. Technical Architecture

### Component Hierarchy

```
page.tsx (YearWheelPage)
├── YearNavigation
├── Toolbar (date picker, quick buttons, view switcher)
├── YearWheelTimeline
│   ├── TimelineBlock (per season)
│   │   ├── Drag-handle left (start_date)
│   │   ├── Clickable center (opens drawer)
│   │   └── Drag-handle right (end_date)
│   ├── TimelinePin (per event, ≤2 per month)
│   └── PinCluster (3+ events in same month)
├── Action Bar (copy, activate, archive, create)
├── Sortable Lists (seasons + events)
├── SeasonDrawer
│   ├── SeasonOverviewTab
│   ├── SeasonGoalsTab
│   ├── SeasonProceduresTab
│   └── MachineRoomSheet
│       ├── BudgetSetupTab
│       ├── DayFactorsTab
│       └── HourFactorsTab
└── Create/Edit Dialog
```

### Hooks

| Hook | Responsibility |
|---|---|
| `useSeasons` | CRUD + status transitions + year duplication + date updates |
| `usePlanningEvents` | CRUD for planning events |
| `useSeasonBudget` | Read/write season budget |
| `useDayFactors` | Read/write day factors per season budget |
| `useHourFactors` | Read/write hour factors per season budget |
| `useSeasonGoals` | CRUD for season goals |
| `useSeasonPolicyBindings` | Read/write policy activation per season |
| `usePlanningCycles` | Read/write planning cycles |

### Helper Functions

| File | Contents |
|---|---|
| `_lib/timeline-date.ts` | `clientXToIsoDateYear()`, `clientXToIsoDateMonth()`, `getDaysInYear()` — pure date-mapping without DOM dependencies |
| `_definitions/season-planning.ts` | Type definitions, templates, validation boundaries, status labels |

---

## 11. File Structure

```
apps/web/src/app/dashboard/year-wheel/
├── page.tsx                     → Main page (client, stateful)
├── loading.tsx                  → Suspense fallback
├── _components/
│   ├── YearWheelTimeline.tsx    → Horizontal canvas (year + month)
│   ├── TimelineBlock.tsx        → Season block with drag handles
│   ├── TimelinePin.tsx          → Event pin + PinCluster
│   ├── YearNavigation.tsx       → Year switching with arrows
│   ├── SeasonDrawer.tsx         → Side sheet with tabs
│   ├── SeasonOverviewTab.tsx    → Staffing calculation
│   ├── SeasonGoalsTab.tsx       → Goals CRUD
│   ├── SeasonProceduresTab.tsx  → HMS policy toggles
│   ├── MachineRoomSheet.tsx     → Budget/factors (progressive disclosure)
│   ├── BudgetSetupTab.tsx       → Budget form
│   ├── DayFactorsTab.tsx        → Day factor editing
│   ├── HourFactorsTab.tsx       → Hour factor editing
│   ├── PlanningEventsTab.tsx    → Event list (legacy tab)
│   ├── SeasonCreateSheet.tsx    → New season (form in Sheet)
│   ├── SeasonSelector.tsx       → Season selector (hidden in new IA)
│   └── PlanningCycleSelector.tsx → Cycle selector (hidden in new IA)
├── _hooks/
│   ├── index.ts                 → Re-exports
│   ├── use-seasons.ts           → Season CRUD + date updates
│   ├── use-planning-events.ts   → Event CRUD
│   ├── use-season-budget.ts     → Budget read/write
│   ├── use-day-factors.ts       → Day factors
│   ├── use-hour-factors.ts      → Hour factors
│   ├── use-season-goals.ts      → Goals CRUD
│   ├── use-season-policy-bindings.ts → HMS bindings
│   └── use-planning-cycles.ts   → Planning cycles
├── _definitions/
│   └── season-planning.ts       → Types, templates, boundaries
└── _lib/
    └── timeline-date.ts         → Date mapping from pixel to ISO
```

---

## 12. Cascade Model Confirmation

### Does the Data Model Support the Hypothesis?

**Yes, with two documented gaps.**

The cascade resolution order is correctly implemented in `resolve-hours.ts`:

```
override(date) > season_specific(day_of_week) > default(season_id IS NULL) > closed
```

This maps 1:1 to Canvas/Blocks/Pins. The schema supports:
- Multiple seasons with overlapping date ranges (no EXCLUDE constraint — intentional)
- Nested seasons via `parent_season_id`
- Per-season budgets and factors (1:1 season_budget, N:1 day_factor/hour_factor)
- Date-specific overrides via `planning_event.demand_multiplier` and `department_hours_override`

### Gap 1: Season → D1 Operating Hours Wiring (P0)

**Status: Not implemented.**

When a season is activated in the Year Wheel, NO `department_operating_hours` rows are created or linked. The cascade resolution function `resolveEffectiveHours()` accepts a `seasonId` parameter, but no code path in the Year Wheel produces the data that makes Blocks different from Canvas at the scheduling layer.

**Impact:** Seasons are currently visual-only labels. They control budgets and factors (D4) but do not modify operating hours (D1). A user can create and "activate" a season, but it has no downstream effect on actual scheduling calculations.

**Resolution needed:** When a season is activated, `department_operating_hours` rows with the season's `season_id` must be created for all relevant departments. This bridges the gap between the Year Wheel UI and the cascade scheduling pipeline.

### Gap 2: Budget Cloning in Year Copy

**Status: Intentionally deferred.**

`duplicateYear` clones seasons and events but explicitly skips budgets and factors. The code comment reads: "Budgets and factors are NOT cloned — those need fresh configuration for the new year." The hypothesis says 90% of seasons repeat — budget cloning should be opt-in to capture this value while preserving intentional reconfiguration.

**Resolution:** FR-SEA-17 (planned) adds an opt-in toggle.

---

## 13. Implementation Roadmap

### Phase 1: Orientation & Visual Clarity

| Feature | Priority | Hypothesis Link |
|---|---|---|
| FR-NAV-11: Health summary bar | P1 | Orientation step |
| FR-SEA-15: Canvas visual treatment | P1 | Safety Net hypothesis |
| FR-SEA-16: Empty-year hero CTA | P1 | Automation hypothesis |
| FR-NAV-12: Year comparison chip | P2 | Orientation step |

### Phase 2: Draw-to-Create

| Feature | Priority | Hypothesis Link |
|---|---|---|
| FR-SEA-12: Draw-to-create gesture | P1 | "Draw, Don't Type" hypothesis |
| FR-SEA-13: Inline name popover | P1 | "Draw, Don't Type" hypothesis |
| FR-SEA-14: Smart defaults for budgets | P1 | Automation hypothesis |

### Phase 3: Precision & Copy Enhancements

| Feature | Priority | Hypothesis Link |
|---|---|---|
| FR-DRW-06: Drawer summary card | P1 | Precision step |
| FR-SEA-17: Budget/factor cloning | P1 | Automation hypothesis |
| FR-EVT-08: Holiday auto-correction | P2 | Automation hypothesis |

### Phase 4: Polish & Delight

| Feature | Priority | Hypothesis Link |
|---|---|---|
| FR-SEA-18: Block overlap warnings | P2 | Safety Net hypothesis |
| FR-SEA-19: Year-over-year ghost overlay | P2 | Automation hypothesis |

### Technical Debt (Cross-Phase)

| Item | Priority | Convention |
|---|---|---|
| D1 Operating Hours wiring (Gap 1) | P0 | Cascade model integrity |
| Replace hardcoded color classes with CSS variables | P0 | Nordic Split design system |
| Remove `isDark` prop drilling, use CSS variable auto-switching | P1 | Nordic Split design system |
| Replace spring constants with Nordic Split tokens | P1 | Design tokens |
| Migrate hardcoded Norwegian strings to i18n keys | P1 | CLAUDE.md i18n rule |
| Implement `prefers-reduced-motion` handling | P1 | WCAG accessibility |
| Fix touch target sizes (buttons, drag handles) to 44px minimum | P1 | WCAG 2.5.8 |
| Extract hooks from `apps/web/` to `packages/` for mobile parity | P1 | CLAUDE.md mobile parity rule |
| Add voice/chat tools following schedule page pattern | P2 | Agent architecture |
| Register season capability in intent classifier | P2 | Agent architecture |
| Add `prefers-reduced-motion` media query | P2 | Accessibility |

---

## 14. Known Limitations

1. **No mobile UI.** All hooks live in `apps/web/src/app/dashboard/year-wheel/_hooks/`, not in `packages/`. Mobile cannot reuse them. [Convention violation: CLAUDE.md mobile parity rule]
2. **No live drag preview.** Drag-resize shows the result only after release (pointerup), not during the drag itself.
3. **No overlap warning.** The system does not visually warn when two seasons cover the same dates.
4. **Events not scoped to season.** All events display workspace-wide, not filtered per season/cycle. (Gap P0-3 from gap closure spec.)
5. **Seasons are visual-only.** Activating a season does not create `department_operating_hours` rows. The cascade pipeline is operationally disconnected from the Year Wheel UI. (See Section 12, Gap 1.)
6. **Design system violations.** Hardcoded color classes, isDark prop drilling, and non-token spring constants throughout all components.
7. **Hardcoded Norwegian strings.** ~15 strings in page.tsx bypass i18n.
8. **No agent integration.** Year Wheel has zero voice/chat tools. Emma cannot assist on this page. Five season tools exist in `packages/ai/src/tools/season/` but are not registered in any capability.

---

## 15. Success Criteria

The module is considered complete when:

1. A general manager can plan next year's seasons in under 5 minutes by copying last year and adjusting
2. Creating events takes maximum 3 clicks from the timeline
3. Technical settings (budget, factors) are accessible but never in the way of daily use
4. All mutations have telemetry coverage for product analytics
5. The module works correctly in both light and dark mode with CSS variable theming
6. E2E tests cover critical flows (create season, activate, copy year)
7. Season activation propagates to `department_operating_hours` (cascade wiring operational)
8. All user-facing strings use i18n keys
9. Touch targets meet WCAG 2.5.8 minimum (44x44px)

---

## 16. Document Consolidation

This PRD v2.0.0 consolidates content from the following documents:

| Document | Status | Disposition |
|---|---|---|
| `docs/superpowers/specs/2026-04-10-year-wheel-ux-pivot.md` | Superseded | Content absorbed into Sections 2, 4. Original kept as design decision origin story. |
| `docs/superpowers/specs/2026-04-10-season-year-wheel-gap-closure-design.md` | Superseded | Remaining gaps moved into Sections 12, 13, 14. Original kept for audit trail. |
| `docs/superpowers/plans/2026-04-10-season-year-wheel-gap-closure.md` | Active (stale paths) | Execution plan retained as agentic task list. WARNING: 44 references to deleted `/dashboard/season/` paths need updating to `/dashboard/year-wheel/`. |
| `docs/decisions/0085-year-wheel-governance-policy.md` | Active | ADR retained in `docs/decisions/`. Referenced by FR-SEA-09. |

### Council Review (2026-04-12)

Reviewed by System Council (system-steward, supervisor, system-agent-coordinator, frontend-designer).
Verdict: **APPROVE WITH CHANGES**. All P0 conditions addressed in this version.
Full council log: `docs/council/COUNCIL-LOG.md`
