---
title: "SMARTOUT_MODULE_15_SEASON_PLANNING"
status: draft
updated: 2026-04-10
created: 2026-03-01
module: operations
tags: []
---

\*\*---
title: "Module 15: Season Planning & Budget Engine"
id: MODULE_15
version: "1.0"
status: canonical
layer: module
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:

- CORE_ARCH_V2
  tags:
- season-planning
- budget
- revenue-forecasting
- staffing-capacity
- factor-hierarchy
  tables:
- season_budget
- day_factor
- hour_factor
- date_override
- factor_learning
  changelog:
- date: 2026-02-28
  change: "Added YAML frontmatter"

---

# Module 15: Season Planning & Budget Engine

> **Smartout.ai** — Functional documentation for migration
> Version 1.0 | February 2026
>
> **New module.** Extends the Season concept from Core Architecture with budget targets, revenue forecasting, factor hierarchies, and staffing capacity models. This is the strategic planning layer — "setting up the battlefield" with numbers.
>
> **Kildeutviklere:** Pontus Lindroth & Martin Lundqvist

---

## 1. The Core Insight

Core Architecture defines Season as an operational time period — teams, policies, procedures, gamification. But Season doesn't know about _money_.

Module 15 adds the financial and capacity layer: **How much should we earn this season? How does that break down per week, per day, per hour? How many people do we need?**

When you press "Create Season" and define a menu (Module 14), Module 15 asks: _"What's your target revenue? What's the daily distribution? What's the hourly shape?"_

From those three inputs, the system generates a complete revenue target matrix down to the hour — which directly drives the staffing engine.

**Core Season** = what we do (teams, rules, procedures).  
**Module 14** = what we serve (menus, dishes, recipes).  
**Module 15** = what we aim for (budget, targets, capacity).  
**Module 10** = how we actually did (reconciliation, KPIs).

Together they form a complete plan → execute → measure → learn loop.

---

## 2. Conceptual Model

```
Season (Core)
  │
  ├── Season Budget (this module)
  │     ├── Total target revenue
  │     ├── Monthly breakdown (optional refinement)
  │     ├── Day factors (weekly distribution)
  │     ├── Hour factors (intra-day distribution)
  │     ├── Alcohol model (X-factor estimation)
  │     └── Labor budget (target labor %)
  │
  ├── Season Menu (Module 14)
  │     └── Active menus with dish costs
  │
  ├── Department Schedule (Module 4)
  │     └── Opening hours per department
  │
  ╰── Calculation outputs:
        ├── Revenue target per day
        ├── Revenue target per hour
        ├── Staffing need per hour
        ├── Expected guest count per day
        └── Expected production volume
```

---

## 3. Season Setup Flow

When admin creates a season, the setup wizard includes Module 15 steps:

```
Step 1 (Core): Name, dates, type
Step 2 (Module 14): Select menu(s)
Step 3 (Module 15): Budget & targets
  ├── Total revenue target for season
  ├── Monthly breakdown (drag sliders or enter per month)
  ├── Day factors (per weekday)
  ├── Hour factors (per open hour)
  ├── Alcohol standard (units per guest)
  ├── Alcohol season multiplier
  └── Target labor percentage
Step 4 (Module 4): Opening hours per department
Step 5 (Core): Teams, policies, gamification
Step 6: Review → Activate ("Click PLAY")
```

---

## 4. Data Model

### 4.1 Season Budget

```
season_budget
  budget_id            uuid (PK)
  season_id            fk → season
  workspace_id         fk → workspace

  -- Revenue target
  total_target_revenue decimal (NOK for entire season)

  -- Monthly breakdown (optional fine-tuning)
  monthly_targets      jsonb | null ([{month: "2025-11", target: 500000}, ...])

  -- Base pricing
  base_price_per_guest decimal | null (average ticket without alcohol)
  season_price_factor  decimal default 1.0 (multiplier on base price, e.g. 1.2 for Christmas)

  -- Alcohol model
  alcohol_units_per_guest       decimal default 1.2 (standard units/guest)
  alcohol_season_factor         decimal default 1.0 (e.g. 1.7 for Christmas)
  alcohol_avg_price_per_unit    decimal | null (NOK per unit)

  -- Labor target
  target_labor_percentage       decimal default 0.30 (30%)
  avg_hourly_wage               decimal | null (NOK, for staffing calculation)

  -- Status
  status               draft | active | locked

  created_by           fk → profile | null
  created_at           timestamp
  updated_at           timestamp
```

### 4.2 Day Factor (Weekly Distribution)

```
day_factor
  day_factor_id        uuid (PK)
  budget_id            fk → season_budget
  workspace_id         fk → workspace

  weekday              integer (0=Mon, 1=Tue, ... 6=Sun)
  factor               decimal (e.g. 1.0, 1.4, 2.5)

  created_at           timestamp
  updated_at           timestamp
```

**Normalization:** Factors are relative, not percentages. System normalizes:

```
day_revenue = season_daily_average × (day_factor ÷ average_factor)
```

**Example:**

| Day       | Factor | Meaning           |
| --------- | ------ | ----------------- |
| Monday    | 1.0    | Baseline          |
| Tuesday   | 1.1    | 10% above Monday  |
| Wednesday | 1.2    | 20% above Monday  |
| Thursday  | 1.4    | 40% above Monday  |
| Friday    | 2.2    | 120% above Monday |
| Saturday  | 2.5    | 150% above Monday |
| Sunday    | 1.3    | 30% above Monday  |

**Summer vs Christmas:** Different seasons have different profiles. Summer = flat (all weekdays similar). Christmas = spiked (Friday/Saturday dominate).

### 4.3 Hour Factor (Intra-day Distribution)

```
hour_factor
  hour_factor_id       uuid (PK)
  budget_id            fk → season_budget
  workspace_id         fk → workspace

  hour                 integer (0–23, e.g. 10 = 10:00–11:00)
  factor               decimal

  created_at           timestamp
  updated_at           timestamp
```

**Example:**

| Hour  | Factor | Revenue weight |
| ----- | ------ | -------------- |
| 10:00 | 0.4    | Low — opening  |
| 11:00 | 0.7    | Building       |
| 12:00 | 1.3    | Lunch peak     |
| 13:00 | 1.0    | Post-lunch     |
| 14:00 | 0.8    | Quiet          |
| 15:00 | 0.6    | Quiet          |
| 16:00 | 0.9    | Building       |
| 17:00 | 1.5    | Early dinner   |
| 18:00 | 2.0    | Dinner         |
| 19:00 | 2.4    | Peak           |
| 20:00 | 2.2    | Peak           |
| 21:00 | 1.1    | Winding down   |

**Key insight:** "Kl 20:00 is worth more than kl 15:00." This drives staffing.

### 4.4 Date Override (specific date factors)

```
date_override
  override_id          uuid (PK)
  budget_id            fk → season_budget
  workspace_id         fk → workspace

  date                 date
  day_factor_override  decimal | null (replaces weekday factor for this date)
  is_closed            boolean default false (override: no revenue expected)
  label                string | null ("Julaften", "17. mai", "Private event")

  created_at           timestamp
  updated_at           timestamp
```

---

## 5. Calculation Engine

### 5.1 Revenue Target Per Day

```
Input:
  total_season_target
  season_days (from start_date to end_date)
  day_factors (per weekday)
  date_overrides (specific dates)
  monthly_targets (optional refinement)

Calculation:
  base_daily = total_season_target ÷ season_days

  For each date in season:
    if date_override exists AND is_closed:
      day_target = 0
    elif date_override exists AND has day_factor_override:
      day_target = base_daily × date_override.factor ÷ avg_factor
    else:
      day_target = base_daily × weekday_factor ÷ avg_factor

  If monthly_targets provided:
    Scale day targets within each month to sum to monthly target
```

### 5.2 Revenue Target Per Hour

```
For a given date:
  day_target (from 5.1)
  open_hours (from Module 4 department_schedule)
  hour_factors (for each open hour)

  For each open hour:
    hour_target = day_target × (hour_factor ÷ Σ active_hour_factors)
```

### 5.3 Staffing Need Per Hour

```
For a given hour:
  hour_target (from 5.2)
  target_labor_pct (from season_budget)
  avg_hourly_wage (from season_budget)

  max_labor_cost = hour_target × target_labor_pct
  staff_needed = max_labor_cost ÷ avg_hourly_wage

  → "At 19:00 Friday, you need 6.2 staff (round to 6 or 7)"
```

### 5.4 Alcohol Revenue Estimation

```
For a given date:
  expected_guests (from bookings or from day_target ÷ base_price_per_guest)
  alcohol_units = expected_guests × alcohol_units_per_guest × alcohol_season_factor
  alcohol_revenue = alcohol_units × alcohol_avg_price_per_unit
```

Alcohol revenue is **estimation only** — used in budget projection, never in production planning.

### 5.5 Expected Guest Count

```
For a given date:
  day_target (from 5.1)
  base_price_per_guest × season_price_factor = effective_price
  expected_guests = day_target ÷ (effective_price + expected_alcohol_per_guest)
```

---

## 6. Opening Hours → Operational Capacity

Module 15 connects to Module 4's `department_schedule`:

```
Opening hours (Module 4):        10:00 – 22:00 (12 open hours)
Opening routine (from hooks):    1h 30min
Closing routine (from hooks):    1h 00min

Calculated:
  Guest-facing hours:            10:00 – 22:00
  Shift start:                   08:30 (opening - routine)
  Shift end:                     23:00 (closing + routine)
  Total operational hours:       14h 30min
  Revenue-generating hours:      12h
```

This feeds staffing: you need prep staff from 08:30 but revenue-earning staff from 10:00.

---

## 7. Self-Learning (After Data Accumulation)

### 7.1 First Season

Everything is manually defined. Admin sets all factors based on experience.

### 7.2 After 90+ Days

System can suggest adjustments:

- "Your Friday factor was 2.2 but actual averaged 2.6 — suggest updating to 2.5"
- "Hour 19:00–20:00 consistently outperforms 20:00–21:00 — consider swapping factors"
- "Alcohol consumption averages 2.3 units in December, not 2.0"

### 7.3 After 2–3 Seasons

System generates recommended factor sets for new seasons based on historical patterns.

**Self-learning data stored in:**

```
factor_learning
  learning_id          uuid (PK)
  workspace_id         fk → workspace
  season_id            fk → season (which season generated this learning)

  learning_type        day_factor | hour_factor | alcohol | labor | guest_count
  weekday              integer | null
  hour                 integer | null
  planned_value        decimal
  actual_value         decimal
  recommended_value    decimal
  confidence           float (0.0–1.0)

  created_at           timestamp
```

This feeds into Module 10's Season Reconciliation.

---

## 8. Integration Points

| Module                     | Integration                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Core Architecture**      | Season is the parent container. Budget extends Season with financial data.                                 |
| **Module 4 (Operations)**  | Department schedule provides opening hours. Staffing targets feed scheduling suggestions.                  |
| **Module 3 (Scheduling)**  | Staffing needs per hour inform shift planning. Budget hours vs actual hours.                               |
| **Module 8 (Payroll)**     | Avg hourly wage for calculations. Labor cost from approved shifts.                                         |
| **Module 10 (Reports)**    | Day targets feed KPI dashboard. Season reconciliation compares plan vs actual. Factor accuracy evaluation. |
| **Module 14 (Production)** | Menu cost data for margin analysis. Booking volumes for production planning. Guest count estimates.        |

---

## 9. Module Boundary

**This module owns:**

- Season Budget
- Day Factors (weekly distribution)
- Hour Factors (intra-day distribution)
- Date Overrides
- Factor Learning (historical adjustments)
- All calculation engines (day target, hour target, staffing, alcohol, guest count)

**This module does NOT own (but consumes):**

- Season (Core Architecture)
- Department Schedule / Opening hours (Module 4)
- Menu and dish cost data (Module 14)
- Booking data (Module 14)
- Actual revenue (Module 10 — from reconciliation)
- Payroll rates (Module 8)
- Shift scheduling (Module 3)

---

## 10. Data Entities Summary

| Entity              | Purpose                                                | Key relationships |
| ------------------- | ------------------------------------------------------ | ----------------- |
| **season_budget**   | Revenue targets, labor goals, alcohol model per season | Season            |
| **day_factor**      | Per-weekday revenue distribution                       | Season Budget     |
| **hour_factor**     | Per-hour revenue distribution                          | Season Budget     |
| **date_override**   | Specific date adjustments (holidays, events, closures) | Season Budget     |
| **factor_learning** | Historical accuracy data for self-learning             | Season, Workspace |

---

## 11. Implementation Sequence

| Phase                             | Scope                                                                                                 | Duration   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| **1. Season Budget core**         | `season_budget` table. Admin UI: set total target, labor %, base price.                               | Week 1–2   |
| **2. Day factors**                | `day_factor` table. Per-weekday configuration UI. Default templates (flat, weekend-heavy, Christmas). | Week 3     |
| **3. Hour factors**               | `hour_factor` table. Per-hour configuration UI. Visual hour distribution chart.                       | Week 4     |
| **4. Date overrides**             | `date_override` table. Calendar view for specific date adjustments.                                   | Week 5     |
| **5. Calculation engine**         | Edge Functions: day target, hour target, staffing need, alcohol estimation, guest count.              | Week 6–7   |
| **6. Season setup wizard**        | Integrate Module 15 steps into Season creation flow (after Core + Module 14 steps).                   | Week 8     |
| **7. Staffing output**            | Feed hourly staffing needs into Module 3 scheduling suggestions. Dashboard widget.                    | Week 9     |
| **8. Monthly breakdown**          | Optional monthly target refinement within season. UI for dragging monthly sliders.                    | Week 10    |
| **9. Factor learning**            | `factor_learning` table. Post-season analysis. AI-generated recommendations.                          | Week 11–12 |
| **10. Self-learning integration** | After 90 days: suggest factor adjustments in admin dashboard. Pre-fill next season setup.             | Week 13–14 |

---

## 12. MVP vs Phase 2

### MVP

- Season budget (total target, labor %)
- Day factors (7 weekday values)
- Hour factors (per open hour)
- Calculation: day target, hour target, staffing need
- Display in Module 10 KPI dashboard

### Phase 2

- Monthly breakdown with slider UI
- Date overrides for holidays/events
- Alcohol model with seasonal factors
- Factor learning and AI recommendations
- Multi-department budgets (kitchen vs bar vs service)
- Scenario planning ("what if we target 20% more?")
- Integration with external booking systems for demand forecasting

---

## 13. Migration Notes

- `season_budget` is new — extends Season which already exists. 1:1 relationship with Season.
- Day and hour factors need sensible defaults. Provide templates:
  - "Restaurant standard" (weekend-heavy)
  - "Hotel standard" (more even distribution)
  - "Event/banquet" (spike on event days)
  - "Flat" (equal across days/hours)
- Calculation engine as Edge Functions for performance. May need to precompute and cache daily targets when budget is saved.
- Staffing calculation results should be stored or cached — they're queried frequently by scheduling and dashboard.
- `factor_learning` is write-on-season-close, read-on-next-season-create.

---

## 14. Design Decisions

| #   | Decision                               | Choice                                  | Rationale                                                                   |
| --- | -------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Budget on Season                       | 1:1 with Season                         | Season IS the planning period. Budget extends it with finance.              |
| 2   | Factors as relative, not %             | Normalization in calculation            | Easier for admin to think "Friday is 2.5× Monday" than "Friday is 23.8%."   |
| 3   | Hour factors separate from day         | Independent tables                      | Hour shape might be the same across weekdays. Or different. Flexibility.    |
| 4   | Alcohol as estimation                  | Never drives production                 | Can't predict what people drink. Only used in budget projection.            |
| 5   | Manual first, AI later                 | Year 1 manual, year 2+ AI-assisted      | No historical data initially. Can't learn from nothing.                     |
| 6   | Staffing = revenue-driven              | Staff need = f(revenue target, labor %) | Simple, powerful. Phase 2 adds task-load as secondary input.                |
| 7   | Date override trumps weekday           | Priority: override > weekday > default  | Christmas Eve needs its own factor regardless of which weekday it falls on. |
| 8   | Budget status: draft → active → locked | Matches Season lifecycle                | Budget locks when season is archived (reconciled).                          |

---

_This module turns Season setup from "pick teams and rules" into a full strategic planning exercise. By adding revenue targets, factor hierarchies, and staffing calculations, Smartout becomes a predictive capacity engine — not just an operations tool. First season is manual. After that, the system learns and suggests. Together with Module 14 (Production) for menu costs and Module 10 (Reports & Reconciliation) for actuals, this creates a complete plan → execute → measure → learn loop._
\*\*
