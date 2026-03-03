---
title: "Module 19: Menu & Production System"
status: draft
updated: 2026-03-11
created: 2026-03-01
module: production
tags: [menu, production, recipe, kitchen]
---

# Module 19: Menu & Production System

> **Smartout.ai** — Functional documentation for migration
> Version 1.0 | March 2026
>
> **Origin:** Brainstorm session between Pontus & Martin on dynamic menu creation, production planning, and AI-driven kitchen operations.
>
> **Scope:** This module elevates Smartout's existing Inventory placeholder into a full **Production OS for the kitchen** — covering ingredients, methods, recipes, dishes, production planning, food cost calculation, prep lists, purchase orders, and AI-driven optimization. It is NOT a recipe database. It is an **operative production engine**.

---

## 1. The Core Insight

A restaurant doesn't think in "recipes." It thinks in **production**.

Every day, the kitchen must answer: _What do we need to prep? How much? Who does it? When? And did yesterday's production match what we actually sold?_

This module introduces a **layered object model** where ingredients, methods, recipes, and dishes are independent, reusable building blocks. When combined with sales data, shelf-life tracking, and station capacity, the system generates dynamic prep lists, purchase orders, and food cost reports — automatically.

**The goal is not to store recipes.**
**The goal is to steer the kitchen's operative capacity.**

---

## 2. Conceptual Model

```
LAYER 1: Ingredient (atom)
  │
  │  combined via...
  │
LAYER 2: Method (transformation)
  │
  │  assembled into...
  │
LAYER 3: Recipe (component)
  │
  │  composed into...
  │
LAYER 4: Dish (plate composition)
  │
  │  organized via...
  │
LAYER 5: DishTemplate (modular menu slot)
  │
  │  drives...
  │
LAYER 6: ProductionPlan (daily ops)
  │
  │  fed by...
  │
LAYER 7: AI Optimization (self-healing loop)
```

### How It Connects to Smartout Core

```
Season ─────────────── Menu (which dishes are active this season)
Department ─────────── Station (Kitchen department has stations)
Department Session ──── ProductionPlan (daily production = session scope)
Session Hook ────────── Prep triggers (PRE_OPEN hook → start prep)
Session Task ────────── Prep tasks (individual production work items)
Policy/Protocol ─────── HACCP on methods (temperature, hygiene)
Asset ───────────────── Equipment (oven, sous vide, blast chiller)
Profile ─────────────── Station assignment (who works where)
```

---

## 3. Data Model — Layer by Layer

### 3.1 Layer 1: Ingredient (Atom Level)

The ingredient is the fundamental object. Everything builds on this.

```
ingredient
  ingredient_id        uuid (PK)
  workspace_id         fk → workspace
  season_id            fk → season | null (null = permanent)

  -- Identity
  name                 string
  display_name         string | null (localized name)
  slug                 string (unique per workspace)
  category             ingredient_category enum
  subcategory          string | null
  description          string | null
  image_url            string | null

  -- Units & Measurement
  base_unit            unit_type enum (g, ml, stk, kg, l, dl, cl)
  purchase_unit        string (e.g., "1 kg bag", "6-pack", "10 L box")
  purchase_unit_amount number (how many base_units per purchase_unit)
  conversion_factors   jsonb | null (alternative unit mappings)

  -- Economics
  cost_per_base_unit   decimal(10,4) (NOK per g/ml/stk)
  purchase_price       decimal(10,2) (price per purchase_unit)
  supplier_id          fk → supplier | null
  supplier_code        string | null

  -- Waste & Yield
  waste_pct_raw        decimal(5,2) (% lost in prep: peeling, trimming)
  waste_pct_cooked     decimal(5,2) (% lost in cooking: evaporation, drip)
  yield_factor         decimal(5,4) computed (1 - waste_pct_raw/100)

  -- Nutrition (per 100 base_units)
  kcal                 decimal(8,2) | null
  protein_g            decimal(8,2) | null
  fat_g                decimal(8,2) | null
  carbs_g              decimal(8,2) | null
  fiber_g              decimal(8,2) | null
  salt_g               decimal(8,2) | null
  sugar_g              decimal(8,2) | null

  -- Allergens
  allergens            text[] (array of allergen codes: gluten, dairy, nuts, etc.)

  -- Shelf Life
  shelf_life_raw_days      integer (days, unopened/raw)
  shelf_life_raw_opened_days integer | null (days, after opening)
  shelf_life_cooked_days   integer | null (baseline, adjusted by method)
  storage_method_raw       storage_method enum
  storage_temp_min_c       decimal(4,1) | null
  storage_temp_max_c       decimal(4,1) | null

  -- Production Defaults
  default_batch_size       decimal(10,2) | null
  default_batch_unit       unit_type | null
  default_prep_time_min    integer | null (active time in minutes)

  -- Sustainability
  co2_per_kg           decimal(8,2) | null (kg CO2e per kg ingredient)
  origin_country       string | null
  organic              boolean default false

  -- System
  is_active            boolean default true
  created_by           fk → profile
  created_at           timestamp
  updated_at           timestamp
```

**Enums:**

```typescript
type IngredientCategory =
  | "protein" // kjøtt, fisk, sjømat, egg
  | "dairy" // melk, ost, smør, fløte
  | "vegetable" // grønnsaker
  | "fruit" // frukt, bær
  | "grain" // mel, ris, pasta, brød
  | "legume" // bønner, linser, kikerter
  | "herb_spice" // urter, krydder
  | "oil_fat" // oljer, smør, fett
  | "sauce_base" // fond, kraft, basis-sauser
  | "condiment" // sennep, ketchup, soya
  | "sweetener" // sukker, honning, sirup
  | "beverage" // drikke-ingredienser
  | "other";

type UnitType = "g" | "kg" | "ml" | "l" | "dl" | "cl" | "stk" | "ss" | "ts";

type StorageMethod =
  | "ambient" // romtemperatur
  | "refrigerated" // kjøleskap (0-4°C)
  | "frozen" // fryser (-18°C)
  | "dry_storage" // tørt lager
  | "vacuum"; // vakuumpakket
```

**Design Decisions:**

- Nutrition is per 100 base_units (industry standard: per 100g or 100ml)
- `waste_pct_raw` vs `waste_pct_cooked` are separate — raw waste (peeling) happens regardless, cooked waste depends on method
- `shelf_life_cooked_days` is a **baseline** that gets adjusted by the Method's `shelf_life_adjustment_factor`
- Season-aware: seasonal ingredients (e.g., "jordbær") can be linked to a Season
- `purchase_unit` is human-readable ("1 kg bag") while `purchase_unit_amount` is machine-readable (1000 in base_unit g)

---

### 3.2 Layer 2: Method (Production Technique)

Methods are **reusable transformation objects**. They are NOT embedded in recipes — they are referenced.

```
method
  method_id            uuid (PK)
  workspace_id         fk → workspace

  -- Identity
  name                 string (e.g., "Sous vide", "Blansjere & sjokkjøle")
  slug                 string (unique per workspace)
  description          string | null
  category             method_category enum

  -- Time Profile
  active_time_min      integer (hands-on minutes)
  passive_time_min     integer (waiting/cooking minutes)
  total_time_min       integer computed (active + passive)

  -- Temperature
  target_temp_c        decimal(5,1) | null
  temp_range_min_c     decimal(5,1) | null
  temp_range_max_c     decimal(5,1) | null

  -- Equipment
  required_equipment   text[] (asset names or types: "oven", "sous_vide", "blast_chiller")
  station_type         station_type enum | null

  -- Impact Factors (the magic — AI can adjust these over time)
  nutrition_factor     decimal(5,4) default 1.0 (multiplier: 0.85 = 15% nutrient loss)
  shelf_life_factor    decimal(5,4) default 1.0 (multiplier on ingredient's cooked shelf life)
  waste_factor         decimal(5,4) default 1.0 (additional waste from this method)

  -- HACCP Integration
  haccp_risk_level     risk_level enum
  haccp_ccp            boolean default false (is this a Critical Control Point?)
  haccp_notes          string | null
  protocol_id          fk → protocol | null (linked HACCP protocol)

  -- Energy (optional, for sustainability)
  energy_kwh_estimate  decimal(8,2) | null

  -- System
  is_active            boolean default true
  created_by           fk → profile
  created_at           timestamp
  updated_at           timestamp
```

**Enums:**

```typescript
type MethodCategory =
  | "heat_dry" // steke, grille, bake
  | "heat_wet" // koke, dampe, posjere
  | "heat_combo" // braisere, sous vide → sear
  | "cold" // kjøle, fryse, sjokkjøle
  | "preserve" // sylte, fermentere, røyke, vakuumere
  | "mechanical" // kutte, blende, hakke, presse
  | "chemical" // marinere, cure
  | "assemble" // montere, anrette
  | "other";

type StationType =
  | "hot_kitchen" // varmkjøkken
  | "cold_kitchen" // kallskjæring/kaldt kjøkken
  | "pastry" // konditori
  | "grill" // grillstasjon
  | "prep" // preppstasjon
  | "plating" // anretning
  | "bar" // bar
  | "other";

type RiskLevel = "none" | "low" | "medium" | "high" | "critical";
```

**Key Insight (from Pontus's hypothesis):** Methods **transform** ingredients. When you sous vide a carrot, its shelf life changes, its nutrition profile changes, its waste factor changes. These `_factor` fields are multipliers applied to the ingredient's base values. AI learns and adjusts these factors over time based on actual measured outcomes.

---

### 3.3 Layer 3: Recipe (Production Component)

A recipe is NOT a dish. A recipe is a **reusable production component** — like "rødvinssaus", "konfitert potatis", or "fermentert chili-emulsjon".

```
recipe
  recipe_id            uuid (PK)
  workspace_id         fk → workspace
  season_id            fk → season | null

  -- Identity
  name                 string
  slug                 string (unique per workspace)
  description          string | null
  category             recipe_category enum
  image_url            string | null

  -- Batch Production
  batch_yield_amount   decimal(10,2) (output amount after production)
  batch_yield_unit     unit_type
  batch_prep_time_min  integer | null computed (sum of active step times)
  batch_total_time_min integer | null computed (sum of all step times)

  -- Computed Aggregates (auto-calculated)
  batch_cost           decimal(10,2) computed
  batch_nutrition      jsonb computed (kcal, protein, fat, carbs per batch)

  -- Shelf Life (computed from ingredients + methods)
  shelf_life_days      integer computed (minimum of adjusted ingredient shelf lives)
  storage_method       storage_method enum
  storage_temp_c       decimal(4,1) | null

  -- Station
  primary_station      station_type enum | null

  -- System
  is_active            boolean default true
  is_template          boolean default false (system-provided templates)
  source_recipe_id     fk → recipe | null (cloned from)
  created_by           fk → profile
  created_at           timestamp
  updated_at           timestamp
```

#### Recipe Ingredient Lines

```
recipe_ingredient
  recipe_ingredient_id uuid (PK)
  recipe_id            fk → recipe
  ingredient_id        fk → ingredient
  amount               decimal(10,3)
  unit                 unit_type
  sort_order           integer
  notes                string | null (e.g., "finely diced", "room temp")
  is_optional          boolean default false
  created_at           timestamp
```

#### Recipe Method Steps

This is the step-by-step production sequence. Each step references a method and can reference specific ingredients.

```
recipe_step
  recipe_step_id       uuid (PK)
  recipe_id            fk → recipe
  step_number          integer

  -- What to do
  method_id            fk → method | null (null for text-only steps)
  instruction          text (human-readable instruction)

  -- Which ingredients are involved in this step
  ingredient_refs      uuid[] (references to recipe_ingredient_ids)

  -- Time Override (if different from method defaults)
  active_time_min      integer | null
  passive_time_min     integer | null

  -- Temperature Override
  target_temp_c        decimal(5,1) | null

  -- HACCP
  is_ccp               boolean default false
  ccp_notes            string | null

  -- Equipment needed for this step specifically
  equipment_needed     text[] | null

  sort_order           integer
  created_at           timestamp
```

**Enums:**

```typescript
type RecipeCategory =
  | "sauce" // sauser
  | "protein" // tilberedt protein
  | "starch" // karbohydrat-komponenter
  | "vegetable" // grønnsakstilberedning
  | "garnish" // garnityr
  | "base" // fond, kraft, baser
  | "dressing" // dressinger, vinaigretter
  | "dessert" // dessertkomponenter
  | "bread" // brød, deiger
  | "marinade" // marinader, cures
  | "pickle" // syltede elementer
  | "compound" // sammensatte smakstilsetninger
  | "other";
```

**Example — Pickled Red Onion:**

```
Recipe: "Syltet rødløk"
  Category: pickle
  Batch yield: 1800g (1.8 kg)

  Ingredients:
    1. Rødløk — 2000g
    2. Eddik (12%) — 300ml
    3. Sukker — 150g
    4. Salt — 30g
    5. Svartpepperkorn — 5 stk

  Steps:
    1. [Method: mechanical/slice] Skjær rødløk i tynne ringer → ingredient_refs: [1]
    2. [Method: heat_wet/boil] Kok opp eddik, sukker, salt, pepper → ingredient_refs: [2,3,4,5]
    3. [Method: preserve/pickle] Hell over løk, la avkjøles → ingredient_refs: [1]
    4. [Method: cold/refrigerate] Oppbevar kaldt minimum 2 timer

  Computed:
    Batch cost: 45 NOK
    Prep time: 15 min (active), 120 min (passive)
    Shelf life: 14 days (refrigerated)
    Waste: 10% (rødløk raw waste)
    Effective yield: 1800g from 2000g input
```

---

### 3.4 Layer 4: Dish (Plate Composition)

A dish is the final product — what the customer orders. It combines recipes and raw ingredients into a plated composition.

```
dish
  dish_id              uuid (PK)
  workspace_id         fk → workspace
  season_id            fk → season | null

  -- Identity
  name                 string
  slug                 string
  description          string | null
  category             dish_category enum
  image_url            string | null

  -- Portion
  portion_size_g       decimal(10,2) | null (total plate weight)
  servings             integer default 1

  -- Plating
  plating_time_min     decimal(5,1) | null (time to assemble one plate)
  plating_instructions text | null
  serving_temp_c       decimal(4,1) | null

  -- Pricing
  menu_price           decimal(10,2) | null (selling price excl. MVA)

  -- Computed Aggregates
  food_cost            decimal(10,2) computed (sum of component costs per portion)
  food_cost_pct        decimal(5,2) computed (food_cost / menu_price * 100)
  total_nutrition      jsonb computed
  total_prep_time_min  integer computed (sum across components)
  production_complexity_score decimal(5,2) computed (weighted score)

  -- Menu Status
  is_on_menu           boolean default true
  menu_position        integer | null (sort order on menu)

  -- System
  is_active            boolean default true
  created_by           fk → profile
  created_at           timestamp
  updated_at           timestamp
```

#### Dish Components

```
dish_component
  dish_component_id    uuid (PK)
  dish_id              fk → dish

  -- Source: either a recipe OR a raw ingredient (one must be set)
  recipe_id            fk → recipe | null
  ingredient_id        fk → ingredient | null

  -- Amount per portion
  amount_per_portion   decimal(10,3)
  unit                 unit_type

  -- Role on the plate
  component_role       component_role enum

  -- Overrides
  notes                string | null
  is_optional          boolean default false
  is_substitutable     boolean default false

  sort_order           integer
  created_at           timestamp

  CHECK (recipe_id IS NOT NULL OR ingredient_id IS NOT NULL)
  CHECK (NOT (recipe_id IS NOT NULL AND ingredient_id IS NOT NULL))
```

**Enums:**

```typescript
type DishCategory =
  | "appetizer" // forrett
  | "main_course" // hovedrett
  | "dessert" // dessert
  | "side" // tilbehør
  | "bread" // brød
  | "amuse" // amuse bouche
  | "snack" // snacks
  | "kids" // barnemeny
  | "beverage" // drikke
  | "other";

type ComponentRole =
  | "protein" // hovedprotein
  | "sauce" // saus
  | "starch" // karbohydrat
  | "vegetable" // grønnsak
  | "garnish" // garnityr
  | "bread" // brød
  | "condiment" // tilbehør
  | "base" // base/bunn
  | "topping" // topping
  | "other";
```

---

### 3.5 Layer 5: DishTemplate (Modular Menu Slot)

For dishes where the customer chooses components (e.g., "Velg protein + saus + grønnsak"):

```
dish_template
  dish_template_id     uuid (PK)
  workspace_id         fk → workspace
  season_id            fk → season | null
  name                 string
  description          string | null
  category             dish_category enum
  base_price           decimal(10,2) | null
  is_active            boolean default true
  created_at           timestamp
  updated_at           timestamp
```

#### Template Slots

```
dish_template_slot
  slot_id              uuid (PK)
  dish_template_id     fk → dish_template
  slot_name            string (e.g., "Protein", "Saus", "Grønnsak")
  component_role       component_role enum
  is_required          boolean default true
  default_recipe_id    fk → recipe | null
  max_selections       integer default 1
  sort_order           integer
  created_at           timestamp
```

#### Slot Options

```
dish_template_slot_option
  option_id            uuid (PK)
  slot_id              fk → dish_template_slot
  recipe_id            fk → recipe | null
  ingredient_id        fk → ingredient | null
  amount_per_portion   decimal(10,3)
  unit                 unit_type
  price_adjustment     decimal(10,2) default 0 (supplement/reduction)
  is_default           boolean default false
  sort_order           integer
  created_at           timestamp
```

---

### 3.6 Supplier

```
supplier
  supplier_id          uuid (PK)
  workspace_id         fk → workspace
  name                 string
  contact_email        string | null
  contact_phone        string | null
  delivery_days        text[] (e.g., ['monday', 'wednesday', 'friday'])
  order_deadline_hours integer | null (hours before delivery day to order)
  minimum_order_amount decimal(10,2) | null
  notes                string | null
  is_active            boolean default true
  created_at           timestamp
  updated_at           timestamp
```

---

### 3.7 Station

Stations represent physical work positions in the kitchen. They connect to the Department/Location model from Module 2.

```
station
  station_id           uuid (PK)
  workspace_id         fk → workspace
  department_id        fk → department
  location_id          fk → location | null
  season_id            fk → season | null

  name                 string (e.g., "Varmkjøkken", "Kallskjæring", "Grill")
  station_type         station_type enum

  -- Capacity
  max_concurrent_tasks integer | null
  max_staff            integer | null

  -- Equipment at this station
  equipment            text[] (e.g., ["oven_1", "oven_2", "sous_vide_bath"])

  sort_order           integer
  is_active            boolean default true
  created_at           timestamp
  updated_at           timestamp
```

---

### 3.8 Layer 6: Production Plan

The daily production plan connects to the **Department Session** (Module 4). One production plan per kitchen department session.

```
production_plan
  plan_id              uuid (PK)
  workspace_id         fk → workspace
  session_id           fk → department_session
  department_id        fk → department
  plan_date            date

  -- Status
  status               production_plan_status enum

  -- Inputs (what drives the plan)
  sales_forecast       jsonb | null (predicted sales per dish)
  actual_sales         jsonb | null (populated end-of-day)

  -- Outputs (generated)
  prep_list            jsonb | null (generated prep tasks)
  purchase_order       jsonb | null (generated purchase needs)

  -- Metrics (computed end-of-day)
  total_food_cost      decimal(10,2) | null
  food_cost_pct        decimal(5,2) | null
  waste_amount_kg      decimal(10,2) | null
  waste_cost           decimal(10,2) | null

  -- AI
  ai_adjustments       jsonb | null (what AI changed and why)

  generated_at         timestamp | null
  approved_by          fk → profile | null
  approved_at          timestamp | null
  created_at           timestamp
  updated_at           timestamp
```

```typescript
type ProductionPlanStatus =
  | "draft" // being generated
  | "pending" // awaiting approval
  | "approved" // locked for execution
  | "in_progress" // active production
  | "completed" // end-of-day closed
  | "cancelled";
```

#### Prep Task (ties to Session Task)

Production generates prep tasks that feed into the Operations module's task system:

```
prep_task
  prep_task_id         uuid (PK)
  plan_id              fk → production_plan
  session_task_id      fk → session_task | null (linked when created as session task)

  -- What to prep
  recipe_id            fk → recipe | null
  ingredient_id        fk → ingredient | null (for raw-prep items)

  -- How much
  target_amount        decimal(10,2)
  target_unit          unit_type
  batches_needed       decimal(5,2) (e.g., 2.5 batches of the recipe)

  -- When
  station_id           fk → station | null
  scheduled_start      timestamp | null
  estimated_duration_min integer | null

  -- Assignment
  assigned_to          fk → profile | null

  -- Tracking
  actual_amount        decimal(10,2) | null
  actual_waste         decimal(10,2) | null
  completed_at         timestamp | null

  -- Priority
  priority             task_priority enum

  sort_order           integer
  created_at           timestamp
  updated_at           timestamp
```

---

### 3.9 Inventory Tracking

```
inventory_stock
  stock_id             uuid (PK)
  workspace_id         fk → workspace
  ingredient_id        fk → ingredient
  location_id          fk → location | null (which storage location)

  -- Current State
  quantity             decimal(10,2)
  unit                 unit_type

  -- Batch Info
  batch_label          string | null
  received_at          timestamp
  opened_at            timestamp | null
  expires_at           timestamp | null (calculated from shelf life)

  -- Source
  supplier_id          fk → supplier | null
  purchase_price       decimal(10,2) | null

  status               stock_status enum
  created_at           timestamp
  updated_at           timestamp
```

```
inventory_movement
  movement_id          uuid (PK)
  workspace_id         fk → workspace
  ingredient_id        fk → ingredient
  stock_id             fk → inventory_stock | null

  movement_type        movement_type enum
  quantity             decimal(10,2) (positive = in, negative = out)
  unit                 unit_type

  -- Context
  reason               string | null
  recipe_id            fk → recipe | null (used in production)
  plan_id              fk → production_plan | null
  session_id           fk → department_session | null

  recorded_by          fk → profile
  recorded_at          timestamp
  created_at           timestamp
```

```typescript
type StockStatus = "available" | "reserved" | "expired" | "waste" | "returned";

type MovementType =
  | "received" // varemottak
  | "used" // brukt i produksjon
  | "waste" // svinn
  | "adjustment" // manuell justering
  | "transfer" // flytt mellom lokasjoner
  | "returned" // returnert til leverandør
  | "counted"; // varetelling
```

---

### 3.10 Waste Logging

```
waste_log
  waste_id             uuid (PK)
  workspace_id         fk → workspace
  session_id           fk → department_session | null
  plan_id              fk → production_plan | null

  -- What was wasted
  ingredient_id        fk → ingredient | null
  recipe_id            fk → recipe | null

  amount               decimal(10,2)
  unit                 unit_type
  cost_estimate        decimal(10,2) | null (computed)

  -- Why
  waste_reason         waste_reason enum
  notes                string | null
  photo_url            string | null

  recorded_by          fk → profile
  recorded_at          timestamp
  created_at           timestamp
```

```typescript
type WasteReason =
  | "expired" // utgått holdbarhet
  | "overproduction" // laget for mye
  | "quality" // kvalitetsavvik
  | "damaged" // skadet
  | "customer_return" // retur fra kunde
  | "prep_waste" // normalt preppsvinn
  | "spillage" // søl
  | "other";
```

---

## 4. Data Flow — From Sales to Production

### 4.1 The Daily Loop

```
                    ┌─────────────────────────────┐
                    │    PREVIOUS DAY CLOSE        │
                    │                              │
                    │  Actual sales registered     │
                    │  Waste logged                │
                    │  Inventory updated           │
                    │  Food cost % calculated      │
                    └─────────────┬───────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │    AI FORECAST ENGINE        │
                    │                              │
                    │  Historical sales data       │
                    │  Day of week patterns        │
                    │  Season/event context        │
                    │  Weather (optional)          │
                    │  Reservations                │
                    │  → Predicted covers          │
                    │  → Predicted dish mix        │
                    └─────────────┬───────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │    DEMAND CALCULATION        │
                    │                              │
                    │  For each dish on menu:      │
                    │    forecast × components     │
                    │    = raw ingredient need     │
                    │    + waste factor             │
                    │    + safety margin            │
                    │    − current valid stock      │
                    │    − valid prepped items      │
                    │    = NET NEED                 │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ PREP LIST│ │ PURCHASE │ │ FOOD COST│
              │          │ │  ORDER   │ │ FORECAST │
              │ What to  │ │ What to  │ │ Expected │
              │ produce  │ │ buy      │ │ % for    │
              │ today    │ │ today    │ │ tomorrow │
              └──────────┘ └──────────┘ └──────────┘
```

### 4.2 The Calculation Formula

```
For each recipe component needed:

  GROSS NEED = (forecasted_sales × amount_per_portion)

  ADJUSTED NEED = GROSS NEED × (1 + waste_factor) × (1 + safety_margin)

  VALID STOCK = Σ inventory_stock WHERE:
    ingredient matches
    AND status = 'available'
    AND expires_at > tomorrow

  VALID PREP = Σ prepped_batches WHERE:
    recipe matches
    AND produced_at + shelf_life_days > tomorrow

  NET NEED = ADJUSTED NEED − VALID STOCK − VALID PREP

  IF NET NEED > 0:
    BATCHES = CEIL(NET NEED / batch_yield_amount)
    → Add to PREP LIST

  RAW INGREDIENT NEED = Σ (recipe_ingredient.amount × BATCHES)
    − current ingredient stock
    → If deficit → Add to PURCHASE ORDER
```

### 4.3 Multipliers & Reduction Factors

| Factor              | Symbol | Effect                              | Source                   |
| ------------------- | ------ | ----------------------------------- | ------------------------ |
| Sales volume        | X      | Scales need up/down                 | POS/forecast             |
| Raw waste           | Yr     | Reduces effective yield at prep     | Ingredient data          |
| Cooked waste        | Yc     | Reduces effective yield at cooking  | Method × Ingredient      |
| Method adjustment   | Z      | Changes nutrition, shelf life, time | Method factors           |
| Shelf life validity | H      | Reduces need if valid prep exists   | Production history       |
| Station capacity    | C      | Caps production per time unit       | Station config           |
| Safety margin       | S      | Buffer for demand uncertainty       | AI-learned or configured |

---

## 5. AI Role — Self-Healing Production Engine

The AI layer is critical. It connects to Mr. Botsson's **Operation Engine** (Module 12).

### 5.1 What AI Does

| Function                   | Input                                                    | Output                                    | Frequency                   |
| -------------------------- | -------------------------------------------------------- | ----------------------------------------- | --------------------------- |
| **Forecast sales**         | Historical POS data, reservations, day patterns, weather | Predicted covers + dish mix               | Daily, pre-session          |
| **Optimize batches**       | Net need, batch sizes, shelf life                        | Optimal batch quantities (minimize waste) | Daily, with plan generation |
| **Adjust waste factors**   | Actual waste logs vs predicted                           | Updated waste_pct per ingredient/method   | Weekly learning cycle       |
| **Adjust shelf life**      | Actual expiry observations                               | Updated shelf_life_factor per method      | Monthly learning cycle      |
| **Detect overproduction**  | Prep amounts vs actual usage                             | Alerts + adjusted future forecasts        | Daily, post-session         |
| **Station load balancing** | Prep tasks, station capacity, staff                      | Optimized schedule per station            | Daily, with plan generation |
| **Food cost monitoring**   | Real-time sales vs ingredient cost                       | Live food cost % dashboard                | Continuous                  |
| **Smart reorder**          | Stock levels, supplier lead times, usage velocity        | Purchase order suggestions                | Daily + threshold alerts    |

### 5.2 Self-Healing Loop

```
MEASURE → COMPARE → ADJUST → LEARN

  MEASURE: Actual waste, actual sales, actual production times
  COMPARE: Against predicted/configured values
  ADJUST:  Update factors (waste_pct, shelf_life, prep_time)
  LEARN:   Improve forecast model over time
```

**Concrete Example:**

```
Config says: Rødløk raw waste = 10%
AI measures: Last 30 days average actual waste = 14%

→ AI proposes adjustment: waste_pct_raw = 14%
→ Surfaces in admin dashboard: "Foreslått justering: Rødløk svinn 10% → 14%"
→ Admin approves or overrides
→ All future calculations use updated factor
```

### 5.3 Runtime Factors (AI-adjustable)

```
ai_production_factor
  factor_id            uuid (PK)
  workspace_id         fk → workspace

  -- What it adjusts
  entity_type          'ingredient' | 'method' | 'recipe'
  entity_id            uuid
  factor_type          'waste' | 'shelf_life' | 'prep_time' | 'demand'

  -- Values
  configured_value     decimal(10,4) (admin-set)
  ai_suggested_value   decimal(10,4) | null
  active_value         decimal(10,4) (currently used)

  -- Audit
  confidence           decimal(3,2) | null (0-1, AI confidence)
  sample_size          integer | null (data points used)
  last_calculated_at   timestamp | null
  approved_by          fk → profile | null
  approved_at          timestamp | null

  created_at           timestamp
  updated_at           timestamp
```

---

## 6. UX — The Menu Creator

### 6.1 Design Principle

**Complexity in the backend. Simplicity in the frontend.**

The user should:

1. Pick or create ingredients (with AI-suggested defaults)
2. Pick or create methods (visual step builder)
3. Combine into recipes (drag-and-drop)
4. Compose dishes (visual plate builder)
5. See live metrics updating as they build

The user should NOT:

- Manually calculate food cost
- Manually figure out shelf life adjustments
- Think about batch optimization
- Understand the underlying data model

### 6.2 Screen Inventory

| Screen                    | Role          | Description                                                                   |
| ------------------------- | ------------- | ----------------------------------------------------------------------------- |
| **Ingredient Library**    | Admin/Manager | Browse, search, create, edit ingredients. Bulk import from supplier catalogs. |
| **Method Library**        | Admin/Manager | Browse, create methods. HACCP integration.                                    |
| **Recipe Builder**        | Admin/Manager | Step-by-step recipe creation with live cost/time/nutrition preview.           |
| **Dish Composer**         | Admin/Manager | Drag recipe components onto a plate. Live food cost %.                        |
| **Menu Manager**          | Admin/Manager | Active menu overview. Season assignment. Price management.                    |
| **Production Dashboard**  | Manager/Chef  | Daily production plan. Prep list. Station assignment. Load meter.             |
| **Prep List (Mobile)**    | Kitchen staff | Today's prep tasks. Check-off. Quantity confirmation.                         |
| **Waste Logger (Mobile)** | Kitchen staff | Quick waste registration with reason and optional photo.                      |
| **Purchase Orders**       | Manager       | Generated purchase needs. Review and send to suppliers.                       |
| **Food Cost Report**      | Admin/Manager | Daily/weekly/monthly food cost analysis. Trend graphs.                        |
| **Inventory Count**       | Staff         | Periodic stock count interface. Barcode scanning.                             |

### 6.3 Live Production Load Meter

The **killer UX feature**: when building a menu or modifying dishes, show a real-time production load indicator.

```
┌─────────────────────────────────────────┐
│  PRODUKSJONSBELASTNING                  │
│                                         │
│  Varmkjøkken  ████████████░░░░  75%  🟢 │
│  Kallskjæring ██████████████░░  88%  🟡 │
│  Grill        ████████░░░░░░░░  50%  🟢 │
│  Prep         █████████████████ 102% 🔴 │
│  Anretning    ██████░░░░░░░░░░  38%  🟢 │
│                                         │
│  Total food cost: 28.5%  🟢             │
│  Est. prep time: 4.2 hrs                │
│  Active staff needed: 6                 │
└─────────────────────────────────────────┘

🟢 Stabil (< 80%)
🟡 Risiko (80-95%)
🔴 Flaskhals (> 95%)
```

This updates live as the user adds/removes/modifies dishes on the menu.

---

## 7. Integration Points

| Module                      | Integration                                                                     |
| --------------------------- | ------------------------------------------------------------------------------- |
| **Core: Season**            | Menu and dishes are season-scoped. Season activation changes active menu.       |
| **Core: Policy/Protocol**   | HACCP protocols attach to methods. Food safety policies govern production.      |
| **Module 2: Org Structure** | Stations map to Locations/Zones. Equipment = Assets.                            |
| **Module 3: Scheduling**    | Staff scheduling feeds into station capacity calculation.                       |
| **Module 4: Operations**    | Production plan generates session_tasks. Prep = session task.                   |
| **Module 5: HACCP**         | Methods with CCP flag trigger HACCP procedures. Temperature logging on storage. |
| **Module 6: Training**      | Recipe procedures serve as training material. Staff must be trained on methods. |
| **Module 8: Payroll**       | Production time contributes to labor cost analysis alongside food cost.         |
| **Module 9: Communication** | Prep list pushed to kitchen team channel. Purchase orders sent to suppliers.    |
| **Module 12: AI**           | Forecast engine, optimization engine, self-healing factor adjustment.           |
| **Module 14: Gamification** | Points for production efficiency (low waste, on-time prep completion).          |

---

## 8. Module Boundary

**This module owns:**

- Ingredient (library, CRUD)
- Method (library, CRUD)
- Recipe (builder, CRUD, ingredient lines, method steps)
- Dish (composer, CRUD, components)
- DishTemplate (modular menu slots)
- Supplier (basic management)
- Station (kitchen work positions)
- Production Plan (daily generation, approval)
- Prep Task (generated from plan, links to session_task)
- Inventory Stock (tracking, receiving, counting)
- Inventory Movement (audit trail)
- Waste Log (daily waste registration)
- AI Production Factors (learning factors)
- Purchase Order generation
- Food Cost calculation and reporting

**This module does NOT own (but consumes):**

- Department Session (Module 4 — but production plan attaches to it)
- Session Task (Module 4 — but prep tasks create them)
- HACCP Protocol (Module 5 — but methods reference them)
- Scheduling / Shifts (Module 3 — but uses staff data for capacity)
- POS / Sales data (external integration — consumed for forecasting)
- Supplier ordering transmission (external — generated here, sent via integration)

---

## 9. Success Criteria

| Metric                    | Target                                             | How Measured                 |
| ------------------------- | -------------------------------------------------- | ---------------------------- |
| Food cost accuracy        | ±2% of actual vs predicted                         | Daily comparison             |
| Prep list accuracy        | >90% of prep tasks match actual need               | Prep completion vs waste log |
| Waste reduction           | 15% reduction within 3 months                      | Waste log trend analysis     |
| Overproduction            | <10% daily overproduction rate                     | Prep amount vs actual usage  |
| Recipe creation time      | <5 minutes per recipe (using existing ingredients) | UX analytics                 |
| Dish composition time     | <3 minutes per dish (using existing recipes)       | UX analytics                 |
| Purchase order automation | 80% of orders auto-generated                       | Manual vs auto order count   |
| Shelf life utilization    | >85% of prepped items used before expiry           | Inventory tracking           |

---

## 10. Implementation Sequence

| Phase                       | Scope                                                                     | Duration   | Dependencies          |
| --------------------------- | ------------------------------------------------------------------------- | ---------- | --------------------- |
| **10.1 Data layer**         | Ingredient, Method, Recipe, Dish, Supplier tables. Migrations. Types.     | Week 1-2   | Core tables (Phase 0) |
| **10.2 Ingredient library** | CRUD UI. Bulk import. Search/filter. Nutrition input.                     | Week 3-4   | 10.1                  |
| **10.3 Method library**     | CRUD UI. HACCP linking. Equipment mapping.                                | Week 3-4   | 10.1, Module 5        |
| **10.4 Recipe builder**     | Step-by-step creation. Ingredient lines. Method steps. Live calculations. | Week 5-7   | 10.2, 10.3            |
| **10.5 Dish composer**      | Component assembly. Food cost %. Template system. Menu manager.           | Week 7-9   | 10.4                  |
| **10.6 Station setup**      | Station CRUD. Equipment mapping. Capacity config.                         | Week 8     | Module 2              |
| **10.7 Inventory basics**   | Stock tracking. Receiving. Counting. Movement log.                        | Week 9-10  | 10.1                  |
| **10.8 Waste logging**      | Mobile waste registration. Reason tracking. Photo upload.                 | Week 10    | 10.7                  |
| **10.9 Production plan**    | Daily plan generation. Prep list. Purchase orders. Session integration.   | Week 11-13 | 10.5, 10.7, Module 4  |
| **10.10 AI layer**          | Forecasting. Factor adjustment. Self-healing loop. Load balancing.        | Week 14-16 | 10.9, Module 12       |
| **10.11 Reporting**         | Food cost reports. Waste analysis. Production efficiency dashboards.      | Week 16-17 | 10.9, 10.10           |

---

## 11. Risks & Mitigations

| Risk                           | Impact                                        | Mitigation                                                                                                                     |
| ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Data entry burden**          | Admins won't fill in all ingredient fields    | AI auto-fill from ingredient databases (Matvaretabellen.no). Pre-populated templates. Gradual enrichment.                      |
| **Inaccurate nutrition data**  | Wrong allergen/nutrition info = liability     | Source from official Norwegian food database. Allow manual override. Flag unchecked items.                                     |
| **POS integration dependency** | No sales data = no forecasting                | Support manual sales input. CSV import. Start with manual → automate later.                                                    |
| **Over-engineering**           | Too complex for small restaurants             | Tiered features: Basic (recipes + food cost) → Pro (production planning) → Enterprise (AI optimization).                       |
| **Adoption resistance**        | Chefs prefer their own systems                | Mobile-first prep list. Voice input for waste. Show immediate value (food cost savings).                                       |
| **Shelf life accuracy**        | Legal risk if system says "safe" but it isn't | Always use MINIMUM shelf life. Conservative defaults. AI can only reduce, not extend configured limits without admin approval. |

---

## 12. Decisions Log

| #   | Decision                       | Choice                                                  | Rationale                                                                                         |
| --- | ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Architecture                   | Layered objects (ingredient → method → recipe → dish)   | Reusability. Same recipe in multiple dishes. Same method in multiple recipes.                     |
| 2   | Method as separate entity      | Not embedded in recipe                                  | Enables HACCP linking, equipment tracking, factor adjustment per method                           |
| 3   | Recipe ≠ Dish                  | Recipe is component, Dish is composition                | A dish can use 5 recipes. A recipe can appear in 10 dishes.                                       |
| 4   | Shelf life calculation         | Dynamic (ingredient baseline × method factor)           | More accurate than static values. AI can learn and adjust.                                        |
| 5   | Waste tracking                 | Separate waste_log table, not just inventory adjustment | Need reason codes, photos, and reporting. Waste is a first-class metric.                          |
| 6   | Station model                  | Separate table linked to department/location            | Enables capacity planning, load balancing, staff assignment                                       |
| 7   | Production plan scope          | One per department session per day                      | Aligns with Module 4's session model. Same audit/sign-off flow.                                   |
| 8   | AI factors                     | Separate table with configured vs suggested vs active   | Admin stays in control. AI suggests, human approves. Audit trail.                                 |
| 9   | Nutrition factors on method    | Multiplier (e.g., 0.85 = 15% loss)                      | Simple, composable, AI-adjustable. Better than lookup tables.                                     |
| 10  | DishTemplate for modular menus | Slot-based with approved options                        | Supports "choose your protein" style menus without creating 50 dish variants                      |
| 11  | Inventory scope                | Basic tracking with movements, not full ERP             | Stay focused. Integrate with external inventory systems later if needed.                          |
| 12  | Purchase order generation      | Generated, not transmitted                              | V1 generates lists. V2 integrates with supplier ordering systems.                                 |
| 13  | Module number                  | Module 10                                               | Fills the gap between Communication (9) and QA/Audit (11). Inventory was listed but undocumented. |

---

## 13. Glossary

| Norwegian                  | English            | In Smartout                             |
| -------------------------- | ------------------ | --------------------------------------- |
| Ingrediens                 | Ingredient         | `ingredient` table                      |
| Metode / Tilberedningsmåte | Method / Technique | `method` table                          |
| Oppskrift                  | Recipe             | `recipe` table — a production component |
| Rett                       | Dish               | `dish` table — the plated composition   |
| Preppliste                 | Prep list          | Generated from `production_plan`        |
| Innkjøpsliste              | Purchase order     | Generated from `production_plan`        |
| Råvarekost                 | Food cost          | `food_cost_pct` on dish and plan        |
| Svinn                      | Waste/shrinkage    | `waste_log` + `waste_pct_*` fields      |
| Holdbarhet                 | Shelf life         | `shelf_life_*` fields                   |
| Stasjon                    | Station            | `station` table                         |
| Varemottak                 | Receiving goods    | `inventory_movement` type: received     |
| Varetelling                | Stock count        | `inventory_movement` type: counted      |

---

_This module transforms Smartout from an employee readiness system into a complete restaurant operations platform. The kitchen doesn't just know WHO is ready — it knows WHAT to produce, HOW MUCH, and WHEN._
