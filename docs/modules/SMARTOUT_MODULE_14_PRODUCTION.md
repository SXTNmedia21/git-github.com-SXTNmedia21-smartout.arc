---
title: "Module 14: Production & Menu Management"
id: MODULE_14
version: "1.0"
status: canonical
layer: module
created: 2026-02-24
updated: 2026-03-22
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
tags:
  - production
  - menu
  - recipes
  - ingredients
  - bookings
  - waste-tracking
  - kitchen
  - cascade
tables:
  - ingredient
  - recipe
  - recipe_ingredient
  - dish
  - dish_recipe
  - production_plan_step
  - menu
  - menu_dish
  - booking
  - booking_dish
  - production_session
  - waste_log
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

## Cascade Mapping

> This module's relationship to the Cascade Core Foundation
> (spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)

| Dimension               | Role                                                        |
| ----------------------- | ----------------------------------------------------------- |
| D6 Production & Product | Primary — recipes, production plans, and kitchen operations |
| D4 Demand Signal        | Consumes — bookings and forecasts drive production volumes  |
| D5 Service Concept      | Consumes — menu structure reflects service concept          |

# Module 14: Production & Menu Management

> **Smartout.ai** — Functional documentation for migration
> Version 1.0 | February 2026
>
> **New module.** Introduces the food production data model and calculation engine: ingredients, recipes, dishes, menus, bookings, production plans, and waste tracking. This is the operational kitchen motor that replaces the paper binder.
>
> **Kildeutviklere:** Pontus Lindroth & Martin Lundqvist

---

## 1. The Core Insight

A restaurant's kitchen runs on three things: **what to make**, **how much to make**, and **how to make it**. Today this lives in paper binders, head chef's memory, and improvisation.

Module 14 digitizes the entire production chain: from raw ingredient data through recipes and dishes to menus, and connects it to bookings so the system can automatically calculate exactly what needs to be produced, how long it will take, and what needs to be pulled from storage.

**Paper binder** = recipes, production schedules, ingredient lists.  
**Module 14** = all of that, calculated automatically from bookings, with step-by-step guidance.

---

## 2. Conceptual Model

```
Ingredient (system knowledge — prep time, waste %, cost)
  │
  │  used in...
  │
  Recipe / Sub-recipe (how to prepare a component)
  │  - Ingredients with quantities
  │  - Method (step-by-step)
  │  - Time estimate
  │  - Temperature requirements
  │  - Training material links
  │
  │  composed into...
  │
  Dish (a serveable item)
  │  - 1–n recipes
  │  - Total ingredient per portion (calculated)
  │  - Production plan (operational sequence)
  │  - Production time
  │  - Cost price / sale price (optional)
  │
  │  assembled into...
  │
  Menu (a collection of dishes)
  │  - Courses (starter, main, dessert)
  │  - Portions per guest
  │  - Policy constraints (must include X)
  │
  │  selected by...
  │
  Booking (the trigger)
  │  - Guest count (adults, children)
  │  - Allergies / dietary needs
  │  - Selected menu + optional single dishes
  │  - Date & time
  │
  │  triggers...
  │
  Production Calculation
  │  - Total ingredients needed (across all dishes, all bookings)
  │  - Withdrawal list (what to pull from storage)
  │  - Total prep time (from ingredient metadata)
  │  - Total production time (from dish production plans)
  │  - Recommended start time
  │
  │  guides...
  │
  Production Session (runtime in Department Session)
    - Step-by-step guidance
    - Timer per step
    - Video/manual links per task
    - Progress tracking
```

---

## 3. Four Separate Layers

These MUST NOT be mixed. Each serves a distinct purpose.

| Layer                   | Responsibility                         | Example                                              |
| ----------------------- | -------------------------------------- | ---------------------------------------------------- |
| **Ingredient metadata** | System knowledge about raw materials   | Carrot: 30 sec prep/unit, 12% waste                  |
| **Production logic**    | Operational sequence (production plan) | Fetch → Prep → Cook → Plate                          |
| **Professional method** | How to actually do something (recipe)  | 180°C, 3 min/side, core temp 55°C                    |
| **Training content**    | Learning material linked to tasks      | Video: "How to trim beef", Manual: "Sauce technique" |

---

## 4. Data Model

### 4.1 Ingredient

The atomic unit. Contains system-level knowledge about a raw material.

```
ingredient
  ingredient_id        uuid (PK)
  workspace_id         fk → workspace

  -- Identity
  name                 string
  slug                 string
  description          string | null
  category             string | null (vegetable, meat, dairy, spice, grain, etc.)

  -- Units
  base_unit            gram | kg | liter | ml | piece | bunch
  portion_weight       decimal | null (grams per piece, if applicable)

  -- Prep metadata (system knowledge)
  prep_time_per_unit   decimal | null (seconds per base_unit)
  prep_type            peel | wash | trim | dice | slice | debone | none | other
  waste_percentage     decimal | null (0.0–1.0, e.g. 0.12 = 12% waste)

  -- Cost
  cost_per_unit        decimal | null (NOK per base_unit)
  cost_updated_at      timestamp | null

  -- Storage
  storage_type         fridge | freezer | dry | ambient | other
  shelf_life_days      integer | null

  -- Allergens
  allergens            text[] | null (gluten, dairy, nuts, shellfish, etc.)

  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Design decision:** Prep time lives on INGREDIENT, not on dish or recipe. The system knows "peeling a carrot takes 30 seconds" as a universal fact. When a dish requires 2 kg of carrots, the system calculates total prep time automatically.

### 4.2 Recipe (Sub-recipe / Oppskrift)

A recipe is the method for preparing one component. A dish consists of one or more recipes.

```
recipe
  recipe_id            uuid (PK)
  workspace_id         fk → workspace

  -- Identity
  name                 string (e.g. "Bearnaise sauce", "Grilled vegetables", "Beef trim")
  slug                 string
  description          string | null
  category             string | null (sauce, garnish, protein, base, dessert_component, etc.)

  -- Yield
  yield_amount         decimal (how much this recipe produces)
  yield_unit           gram | kg | liter | ml | piece
  yield_portions       integer | null (how many standard portions)

  -- Time
  active_time_minutes  integer | null (hands-on time)
  passive_time_minutes integer | null (oven, resting, marinating)
  total_time_minutes   integer | null (calculated or manual)

  -- Method
  method_steps         jsonb ([{step_number, instruction, time_minutes, temperature, technique}])

  -- Temperature
  temperature          decimal | null (°C, primary cooking temp)
  core_temperature     decimal | null (°C, target core temp for protein)
  cooking_method       string | null (grill, pan, oven, sous_vide, boil, steam, raw, etc.)

  -- Training links
  training_video_url   string | null
  training_manual_id   fk → procedure | null (Module 4/Governance)

  -- Scalability
  is_scalable          boolean default true (can quantities be multiplied linearly?)
  min_batch_size       decimal | null
  max_batch_size       decimal | null

  is_active            boolean
  created_by           fk → profile | null
  created_at           timestamp
  updated_at           timestamp
```

### 4.3 Recipe Ingredient (junction)

```
recipe_ingredient
  recipe_ingredient_id uuid (PK)
  recipe_id            fk → recipe
  ingredient_id        fk → ingredient
  workspace_id         fk → workspace

  quantity             decimal (amount per recipe yield)
  unit                 gram | kg | liter | ml | piece
  preparation_note     string | null ("finely diced", "room temperature")
  is_optional          boolean default false
  sort_order           integer

  created_at           timestamp
  updated_at           timestamp
```

### 4.4 Dish (Rett)

A dish is a serveable item composed of one or more recipes.

```
dish
  dish_id              uuid (PK)
  workspace_id         fk → workspace

  -- Identity
  name                 string
  slug                 string
  description          string | null
  category             string | null (starter, main, dessert, side, bread, amuse, etc.)

  -- Per-portion totals (calculated from recipes)
  total_ingredient_cost  decimal | null (sum of recipe ingredients × cost)
  total_prep_time        integer | null (minutes, from ingredient metadata)
  total_production_time  integer | null (minutes, from recipes)

  -- Pricing (optional in MVP)
  cost_price           decimal | null
  sale_price           decimal | null
  margin_percentage    decimal | null (calculated)

  -- Production
  production_type      batch | a_la_carte | hybrid
  batch_size_min       integer | null
  batch_size_max       integer | null

  -- Dietary
  allergens            text[] | null (aggregated from recipes → ingredients)
  dietary_tags         text[] | null (vegan, vegetarian, gluten_free, lactose_free, etc.)

  -- Media
  image_url            string | null
  plating_guide        text | null

  is_active            boolean
  created_by           fk → profile | null
  created_at           timestamp
  updated_at           timestamp
```

### 4.5 Dish Recipe (junction)

```
dish_recipe
  dish_recipe_id       uuid (PK)
  dish_id              fk → dish
  recipe_id            fk → recipe
  workspace_id         fk → workspace

  portions_per_dish    decimal default 1.0 (how many recipe portions per dish portion)
  sort_order           integer
  is_required          boolean default true (optional components like garnish)

  created_at           timestamp
  updated_at           timestamp
```

### 4.6 Production Plan (Kjøraplan)

The production plan lives on the DISH, not on the menu. It defines the operational sequence for producing a dish.

```
production_plan_step
  step_id              uuid (PK)
  dish_id              fk → dish
  workspace_id         fk → workspace

  -- Sequence
  step_number          integer
  phase                fetch | prep | cook | rest | assemble | plate | other

  -- Content
  title                string ("Hent råvarer", "Prepp grønnsaker", "Stek kjøtt")
  description          text | null

  -- Linked recipe (optional — step can be recipe-independent)
  recipe_id            fk → recipe | null

  -- Timing
  estimated_minutes    integer | null
  can_parallel         boolean default false (can this run alongside other steps?)
  depends_on_step      fk → production_plan_step | null (sequential dependency)

  -- Training
  training_video_url   string | null
  training_manual_id   fk → procedure | null

  -- Checkpoints
  temperature_check    decimal | null (°C to verify)
  quality_check        string | null ("color should be golden brown")

  sort_order           integer
  created_at           timestamp
  updated_at           timestamp
```

**Design decision:** Production plan is on DISH because a dish can appear in many menus. You never duplicate the plan. The menu just assembles dishes; the plan scales with volume.

### 4.7 Menu

```
menu
  menu_id              uuid (PK)
  workspace_id         fk → workspace
  season_id            fk → season | null (null = permanent)

  name                 string
  slug                 string
  description          string | null
  menu_type            standard | event | buffet | tasting | kids | custom

  -- Policy constraints (optional)
  required_courses     text[] | null (["starter", "main", "dessert"])

  -- Pricing
  price_per_guest      decimal | null

  is_active            boolean
  created_by           fk → profile | null
  created_at           timestamp
  updated_at           timestamp
```

### 4.8 Menu Dish (junction)

```
menu_dish
  menu_dish_id         uuid (PK)
  menu_id              fk → menu
  dish_id              fk → dish
  workspace_id         fk → workspace

  course               string (starter, main, dessert, side, amuse, etc.)
  portions_per_guest   decimal default 1.0
  is_optional          boolean default false (choice dishes within a course)
  sort_order           integer

  created_at           timestamp
  updated_at           timestamp
```

### 4.9 Booking

The trigger for production calculation.

```
booking
  booking_id           uuid (PK)
  workspace_id         fk → workspace
  department_id        fk → department | null
  season_id            fk → season | null

  -- Guest info
  adults               integer
  children             integer default 0
  child_portion_factor decimal default 0.6 (60% of adult portion)
  total_guests         integer (calculated: adults + children)

  -- Dietary
  allergies            text[] | null
  dietary_requirements text[] | null
  special_notes        text | null

  -- Menu selection
  menu_id              fk → menu | null

  -- Timing
  booking_date         date
  booking_time         time | null
  service_duration     integer | null (expected minutes)

  -- Status
  status               draft | confirmed | in_production | completed | cancelled

  created_by           fk → profile | null
  created_at           timestamp
  updated_at           timestamp
```

### 4.10 Booking Dish (single-dish additions or overrides)

```
booking_dish
  booking_dish_id      uuid (PK)
  booking_id           fk → booking
  dish_id              fk → dish
  workspace_id         fk → workspace

  quantity             integer (number of portions)
  notes                string | null

  created_at           timestamp
  updated_at           timestamp
```

---

## 5. Calculation Engine

The core motor. Triggered when a booking is confirmed.

### 5.1 Calculation Flow

```
Booking confirmed
  │
  ├── Get menu → get all dishes → get all recipes → get all ingredients
  │
  ├── Get single-dish additions
  │
  ├── Calculate per dish:
  │     portions = (adults × portions_per_guest) + (children × child_portion_factor × portions_per_guest)
  │
  ├── For each recipe in each dish:
  │     recipe_quantity = recipe.quantity × (dish_portions ÷ recipe.yield_portions)
  │
  ├── For each ingredient across all recipes:
  │     total_ingredient = Σ recipe_quantities
  │     adjusted_for_waste = total_ingredient ÷ (1 - waste_percentage)
  │
  ├── Generate withdrawal list:
  │     Ingredient A: X kg
  │     Ingredient B: Y pieces
  │     ... (aggregated across all bookings for the day)
  │
  ├── Calculate total prep time:
  │     Σ (ingredient.prep_time_per_unit × total_quantity)
  │
  ├── Calculate total production time:
  │     Σ (recipe.total_time_minutes × scale_factor) + assembly time
  │
  └── Generate production plan:
        "Total time: 3h 40min. Recommended start: 13:20."
        Step 1: Fetch ingredients (withdrawal list)
        Step 2: Prep vegetables (estimated 48 min)
        Step 3: Prep protein (estimated 25 min)
        Step 4: Start sauce (recipe link + video)
        ...
```

### 5.2 Multi-Booking Aggregation

Multiple bookings on the same day are aggregated:

```
Day: Friday, November 28
  Booking A: 50 adults, Menu "Julbord"
  Booking B: 30 adults, 10 children, Menu "Julbord"
  Booking C: 12 adults, Menu "À la carte" + 4× Beef Tenderloin

System aggregates:
  → Total per dish across all bookings
  → Single withdrawal list for the day
  → Single production plan with total quantities
  → Prep time reflects total volume, not per-booking
```

### 5.3 AI Role in Calculation

AI is NOT the calculation engine. The engine is deterministic math.

**AI adds value in:**

- Suggesting optimal production sequence (parallel steps)
- Adjusting estimates based on historical actual times
- Predicting waste based on past data
- Flagging unusual bookings ("120 guests with only 3 kitchen staff?")
- Generating suggested ingredient metadata for new items

---

## 6. Production Session (Runtime)

When kitchen staff starts production, a **production_session** is created as a specialized type of Department Session activity (Module 4).

```
production_session
  production_session_id  uuid (PK)
  session_id             fk → department_session
  workspace_id           fk → workspace
  date                   date

  -- Trigger
  booking_ids            uuid[] (which bookings this covers)

  -- Plan
  total_estimated_time   integer (minutes)
  recommended_start      time
  actual_start           timestamp | null
  actual_end             timestamp | null

  -- Withdrawal
  withdrawal_list        jsonb ([{ingredient_id, name, quantity, unit}])
  withdrawal_confirmed   boolean default false
  withdrawal_confirmed_at timestamp | null

  -- Progress
  status                 planned | in_progress | completed | cancelled
  steps_total            integer
  steps_completed        integer

  created_at             timestamp
  updated_at             timestamp
```

**Integration with Module 4:** Each production_plan_step for the day becomes a `session_task` in the Department Session, with `source_type: production`. The cook sees these in their normal task feed. Training videos and manuals are accessible from each task.

---

## 7. Waste Tracking (Matsvinn)

### 7.1 Policy

```json
{
  "policy_type": "operations",
  "name": "Food waste reduction",
  "statement": "Minimize food waste by producing correct quantities based on actual bookings.",
  "rules_json": {
    "max_waste_percentage": 0.05,
    "waste_log_required": true,
    "waste_review_frequency": "weekly"
  }
}
```

### 7.2 Waste Log

```
waste_log
  waste_log_id         uuid (PK)
  workspace_id         fk → workspace
  department_id        fk → department
  session_id           fk → department_session | null
  production_session_id fk → production_session | null

  -- What was wasted
  ingredient_id        fk → ingredient | null
  dish_id              fk → dish | null
  description          string (if not linked to specific ingredient/dish)

  -- Quantity
  quantity             decimal
  unit                 gram | kg | liter | ml | piece
  estimated_cost       decimal | null

  -- Reason
  reason               overproduction | spoilage | preparation_error | customer_return | expired | other
  notes                text | null

  -- Audit
  logged_by            fk → profile
  logged_at            timestamp
  created_at           timestamp
```

### 7.3 Connection to Module 10 (KPIs)

Waste data feeds into Module 10 dashboards:

- Waste % = waste_cost ÷ production_cost
- Waste per booking = waste_cost ÷ total_bookings
- Waste by reason (chart)
- Waste trend over season

---

## 8. Season ↔ Menu Connection

When creating a Season (Core Architecture), admin must select which menu(s) are active:

```
season_menu
  season_menu_id       uuid (PK)
  season_id            fk → season
  menu_id              fk → menu
  workspace_id         fk → workspace

  is_primary           boolean (the default menu for bookings)
  label                string | null ("Lunch", "Dinner", "Event")

  created_at           timestamp
  updated_at           timestamp
```

This means: building a menu is part of "setting up the battlefield" for a season.

---

## 9. Integration Points

| Module                          | Integration                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Core / Governance**           | Policy for waste rules, menu structure requirements. Recipe methods link to Procedures.           |
| **Module 2 (Org Structure)**    | Location (kitchen, storage), Asset (ovens, fridges). Position (kokk, sous chef).                  |
| **Module 4 (Operations)**       | Production steps materialize as session_tasks. Production session runs within Department Session. |
| **Module 5 (HACCP)**            | Temperature checks in recipes link to HACCP control points. Allergen tracking.                    |
| **Module 6 (Training)**         | Recipe videos/manuals are training content. Competency per recipe.                                |
| **Module 10 (Reports)**         | Waste KPIs. Production cost vs revenue. Booking accuracy.                                         |
| **Module 15 (Season Planning)** | Season budget needs menu cost data. Booking triggers connect to revenue targets.                  |

---

## 10. Module Boundary

**This module owns:**

- Ingredient (master data)
- Recipe / Sub-recipe
- Recipe ↔ Ingredient junction
- Dish (with production plan)
- Dish ↔ Recipe junction
- Production plan steps
- Menu
- Menu ↔ Dish junction
- Booking (production trigger)
- Booking ↔ Dish additions
- Production Session (daily production container)
- Calculation Engine (booking → withdrawal list → production plan)
- Waste Log
- Season ↔ Menu junction

**This module does NOT own (but consumes):**

- Department Session (Module 4 — production session runs inside it)
- Session Tasks (Module 4 — production steps become tasks)
- Season (Core Architecture)
- HACCP control points (Module 5)
- Training content (Module 6)
- Payroll / labor cost (Module 8)
- KPI reporting (Module 10)
- Budget targets (Module 15)

---

## 11. Data Entities Summary

| Entity                   | Purpose                                     | Key relationships                       |
| ------------------------ | ------------------------------------------- | --------------------------------------- |
| **ingredient**           | Raw material master data with prep metadata | Standalone                              |
| **recipe**               | Preparation method for a component          | Ingredients (via junction)              |
| **recipe_ingredient**    | Ingredient quantities per recipe            | Recipe, Ingredient                      |
| **dish**                 | Serveable item composed of recipes          | Recipes (via junction), Production Plan |
| **dish_recipe**          | Recipe composition per dish                 | Dish, Recipe                            |
| **production_plan_step** | Operational sequence for producing a dish   | Dish, Recipe                            |
| **menu**                 | Collection of dishes by course              | Dishes (via junction), Season           |
| **menu_dish**            | Dish placement within menu                  | Menu, Dish                              |
| **booking**              | Guest reservation triggering production     | Menu, Department, Season                |
| **booking_dish**         | Single-dish additions to booking            | Booking, Dish                           |
| **production_session**   | Daily production container                  | Department Session, Bookings            |
| **waste_log**            | Food waste tracking                         | Ingredient, Dish, Session               |
| **season_menu**          | Active menus per season                     | Season, Menu                            |

---

## 12. Implementation Sequence

| Phase                         | Scope                                                                                                   | Duration   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| **1. Ingredient master data** | `ingredient` table. Admin CRUD UI. Import from CSV.                                                     | Week 1–2   |
| **2. Recipe builder**         | `recipe` + `recipe_ingredient` tables. Step-by-step method editor.                                      | Week 3–4   |
| **3. Dish composer**          | `dish` + `dish_recipe` + `production_plan_step` tables. Drag recipe composition. Auto-calculate totals. | Week 5–6   |
| **4. Menu builder**           | `menu` + `menu_dish` tables. Course structure. Season linking.                                          | Week 7     |
| **5. Booking**                | `booking` + `booking_dish` tables. Guest info, menu selection.                                          | Week 8     |
| **6. Calculation engine**     | Edge Function: booking → aggregated ingredients → withdrawal list → time estimates.                     | Week 9–10  |
| **7. Production session**     | `production_session`. Integration with Module 4 session_tasks. Step-by-step mobile view.                | Week 11–12 |
| **8. Waste tracking**         | `waste_log`. Quick-entry UI. Reason classification.                                                     | Week 13    |
| **9. Training integration**   | Link recipe videos/manuals. Show in production task view.                                               | Week 14    |
| **10. AI layer**              | Suggested prep times. Production optimization. Historical learning.                                     | Week 15–16 |

---

## 13. MVP vs Phase 2

### MVP

- Ingredient with prep_time, waste%, unit
- Recipe with ingredients and method
- Dish with recipes and production plan
- Menu as dish collection
- Booking → calculation engine → withdrawal list
- Production session with step-by-step guidance
- Waste log (basic)

### Phase 2

- Cost price / sale price / margin
- Stock/inventory integration (auto-deduct on production)
- AI-optimized production sequence (parallel steps)
- Historical time learning
- Automatic allergen alternative suggestions
- Child portion auto-reduction
- Batch production optimization
- Supplier ordering integration
- HACCP auto-documentation from production data

---

## 14. Migration Notes

- `ingredient` is new — no Bubble equivalent. Will need initial data entry or CSV import tool.
- `recipe`, `dish`, `menu` are new data structures. Consider providing template recipes for common items.
- `booking` may integrate with external booking systems (Tablebooker, etc.) via webhook/API — Phase 2.
- Production plan steps can be auto-suggested by AI from recipe method steps — reduces manual setup.
- Allergen aggregation should be a database function that traverses dish → recipe → ingredient → allergens.
- Withdrawal list generation as an Edge Function for performance (may join many tables).
- Mobile production view: integrate with Module 4's task feed, tagged with `source_type: production`.

---

## 15. Design Decisions

| #   | Decision                       | Choice                         | Rationale                                                     |
| --- | ------------------------------ | ------------------------------ | ------------------------------------------------------------- |
| 1   | Prep time location             | On ingredient, not recipe/dish | Universal fact. "Peeling carrot = 30 sec" regardless of dish. |
| 2   | Production plan location       | On dish, not menu              | Dish reused across menus. Plan scales with volume.            |
| 3   | Recipe vs production plan      | Separate concepts              | Recipe = method (how). Plan = sequence (when, in what order). |
| 4   | Booking triggers calculation   | Yes, confirmed booking         | Production is demand-driven, not budget-driven.               |
| 5   | Single dishes on booking       | Yes, beyond menu               | À la carte additions, special requests.                       |
| 6   | AI role                        | Optimization, not engine       | Math is deterministic. AI suggests, predicts, learns.         |
| 7   | Price in MVP                   | Optional fields                | Kitchen doesn't need price. Management does — Phase 2.        |
| 8   | Production session in Module 4 | Steps become session_tasks     | Reuse existing task infrastructure. No duplicate engine.      |

---

_This module replaces the paper binder in every professional kitchen. It connects bookings to ingredients through a deterministic calculation engine, provides step-by-step production guidance via Module 4's task system, and tracks waste to close the food cost loop. Together with Module 15 (Season Planning) it enables budget-aware production planning, and together with Module 10 (Reports) it feeds cost analysis and efficiency dashboards._
