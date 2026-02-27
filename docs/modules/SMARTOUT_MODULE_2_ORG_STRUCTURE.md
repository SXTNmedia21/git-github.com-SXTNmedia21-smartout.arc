# Module 2: Organisasjonsstruktur (Organization Structure)

> **Smartout.io** — Functional documentation for migration  
> Version 1.0 | February 2026

---

## 1. Module Overview

The Organization Structure module defines the physical and logical map of a business. It provides the building blocks that every other module references but no single module owns.

**What Org Structure defines:**
- **WHO works here** → Profiles (people, roles)
- **WHAT divisions exist** → Departments (Kitchen, Service, Bar)
- **WHERE things happen** → Locations → Zones → Assets
- **WHO works together** → Teams (dynamic groups)
- **WHAT roles exist** → Positions (Servitør, Kokk, Bartender)
- **WHEN** → Season (which operational period)

Org Structure is the **stage** before any action happens. Scheduling, Payroll, Training, HACCP, and Operations all build on top of it.

---

## 2. Core Types (Defined in Core Architecture)

The following entities are Core types with full schemas in SMARTOUT_CORE_ARCHITECTURE_v2.md:

| Core Type | Purpose | Season-aware |
|-----------|---------|-------------|
| **Workspace** | Physical workplace, operational unit | Owns seasons |
| **Department** | Fixed organizational division (Kitchen, Service, Bar) | Never |
| **Location** | Physical place (Main Restaurant, Terrace, Kitchen) | Never |
| **Team** | Dynamic access group | Yes |
| **Season** | Operational time period | Is the season |
| **Policy** | Rules that govern behavior | Yes |
| **Protocol** | Enforcement container for policies | Via Policy |

See Core Architecture v2 for full schemas and design decisions.

---

## 3. Extension Types

Extensions are tables that enrich Core types without adding to the Core type count. They follow the pattern: `extension_table.core_type_id → core_type`.

### 3.1 Zone (extends Location)

A service section within a Location. Used by Scheduling for shift assignment, by Operations for coverage tracking.

```
zone
  zone_id              uuid (PK)
  location_id          fk → location
  workspace_id         fk → workspace
  season_id            fk → season | null (null = permanent/default)
  name                 string (Zone 1, Seaside, Penthouse, Top Floor)
  slug                 string
  description          string | null
  color                string | null (UI marking for scheduling grid)
  capacity             integer | null (seats/covers in this zone)
  sort_order           integer
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**
- Zone is season-aware. Summer opens "Seaside" and "Penthouse", winter adds "Julbord Zone."
- A Zone belongs to exactly ONE Location.
- Shifts are assigned to one or more Zones, with time-splitting possible (Zone 1+2 from 07:00–15:00, Zone 1 only from 15:00–19:00). Time-splitting is handled by the Scheduling module via shift-zone assignment records.
- `is_active` controls dropdown visibility. Inactive zones are hidden but data is preserved.
- Zone with `season_id = null` = permanent. Zone with `season_id` = only active during that season.

**Examples:**
```
Location: Inside Restaurant
  ├── Zone: Section 1 (permanent)
  ├── Zone: Section 2 (permanent)
  ├── Zone: Section 3 (permanent)
  └── Zone: Julbord Zone (season: Christmas)

Location: Outside Restaurant
  ├── Zone: Top Floor (season: Summer)
  ├── Zone: Bottom Floor (season: Summer)
  ├── Zone: Seaside (season: Summer)
  └── Zone: Penthouse (season: Summer)
```

### 3.2 Asset (extends Location)

Physical equipment or control point at a Location. Connects to the Governance model — assets can have policies, routines, training requirements, and safety certifications.

```
asset
  asset_id             uuid (PK)
  location_id          fk → location
  workspace_id         fk → workspace
  season_id            fk → season | null (null = permanent)
  name                 string (Register 1, Walk-in Fridge, Oven 3)
  slug                 string
  description          string | null
  asset_type           equipment | safety | storage | station | other
  icon                 string | null
  requires_training    boolean (must be trained/certified to operate)
  requires_routine     boolean (has scheduled maintenance/checks)
  sort_order           integer
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**
- Asset connects to Governance via Policy/Protocol. E.g. a fridge has a Policy ("temperature must be logged twice daily") with a Protocol containing a Routine (scheduled checks) and a Control List (verification).
- `requires_training = true` means employees must complete a certification procedure before operating this asset.
- `requires_routine = true` means there are scheduled maintenance/check procedures (cleaning, settlement, temperature logging).
- Asset is season-aware. E.g. outdoor grill only exists in summer season.
- Training and certification on assets is tracked per Profile in the Training module.

**Examples:**
```
Location: Inside Restaurant
  ├── Asset: Register 1 (equipment)
  │   → Policy: "Register settlement must be done at shift end"
  │   → Protocol: settlement procedure + training + certification
  │
  ├── Asset: Walk-in Fridge (safety)
  │   → Policy: "Temperature must be logged at shift start and end"
  │   → Protocol: temperature check routine (2x daily) + control list
  │
  └── Asset: Dishwasher (equipment)
      → Policy: "Dishwasher must be cleaned and descaled weekly"
      → Protocol: cleaning procedure + weekly routine

Location: Outside Restaurant
  └── Asset: Outdoor Grill (equipment, season: Summer)
      → Policy: "Grill must be cleaned after each service"
      → Protocol: cleaning procedure + post-service routine
```

### 3.3 Position (extends Department)

A position/role type within a Department. Defines what kinds of work exist. Used by Scheduling (shift assignment), Payroll (pay rates), Training (required certifications), and Onboarding (position-specific flows).

```
position
  position_id          uuid (PK)
  department_id        fk → department
  workspace_id         fk → workspace
  season_id            fk → season | null (null = permanent)
  name                 string (Servitør, Kokk, Bartender, Oppvaskhjelp)
  slug                 string
  description          string | null
  color                string | null (UI marking in scheduling grid)
  icon                 string | null
  skill_requirements   jsonb | null (skills/certifications needed for this position)
  min_role_level       string | null (minimum role level: employee, manager, etc.)
  sort_order           integer
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**
- Position is season-aware. Some positions are permanent (Kokk, Servitør), some are seasonal (Grill Chef in summer, Julbord Servitør at Christmas).
- Position belongs to exactly ONE Department.
- `skill_requirements` links to the Training/Governance model — what Protocols must be completed before you can work this position.
- A Profile doesn't have a fixed Position — Positions are assigned per shift in the Scheduling module. A person can work as Servitør on Monday and Bartender on Friday.
- `min_role_level` can restrict certain positions to experienced employees (e.g. "Shift Lead" requires manager level).

**Examples:**
```
Department: Kitchen
  ├── Position: Kokk (permanent)
  ├── Position: Sous Chef (permanent)
  ├── Position: Oppvaskhjelp (permanent)
  ├── Position: Grill Chef (season: Summer)
  └── Position: Julbord Kokk (season: Christmas)

Department: Service
  ├── Position: Servitør (permanent)
  ├── Position: Bartender (permanent)
  ├── Position: Hovmester (permanent)
  └── Position: Uteservering (season: Summer)

Department: Bar
  ├── Position: Bartender (permanent)
  └── Position: Barback (permanent)
```

---

## 4. Workspace Administration

### 4.1 Workspace Settings

Managed by Admin/Owner. Controls the operational parameters of the workspace.

| Setting | Description | Where |
|---------|-------------|-------|
| Company info | Name, logo, branding | Workspace table |
| Timezone | Operational timezone | Workspace table |
| Currency | NOK, SEK, etc. | Workspace table |
| Language | Default language | Workspace table |
| Active modules | Which modules are enabled | Workspace table (`active_modules[]`) |
| Subscription | Plan, billing, limits | Company table + Stripe |
| Default values | Shift lengths, break rules, etc. | Policy (`policy_type: scheduling`) |

### 4.2 Department Management

Admin creates and manages departments. Departments are fixed and rarely change.

**Admin flows:**
- Create department (name, color, icon)
- Assign department manager (Profile)
- Reorder departments (sort_order)
- Deactivate department (is_active = false, data preserved)

### 4.3 Location Management

Admin creates and manages physical locations within the workspace.

**Admin flows:**
- Create location (name, type, address, GPS coordinates)
- Add zones within a location (permanent or seasonal)
- Add assets within a location (with training/routine requirements)
- Set capacity per location/zone
- Deactivate location (seasonal closure)

### 4.4 Team Management

Admin/managers create and manage teams. Teams are dynamic and can be seasonal.

**Admin flows:**
- Create team (name, type, department link)
- Assign team leader (Profile)
- Add/remove team members
- Create seasonal teams (linked to a Season)
- Create cross-departmental teams (no department link)

### 4.5 Position Management

Admin creates and manages position types per department.

**Admin flows:**
- Create position (name, department, skill requirements)
- Create seasonal positions (linked to a Season)
- Define skill/certification requirements per position
- Set minimum role level for restricted positions

---

## 5. Relationships Map

```
Workspace
  │
  ├── Department (fixed, permanent)
  │     ├── Position (permanent or seasonal)
  │     └── Team (can belong to department)
  │
  ├── Location (fixed, permanent)
  │     ├── Zone (permanent or seasonal)
  │     └── Asset (permanent or seasonal)
  │           └── Policy → Protocol (governance)
  │
  ├── Team (can also be cross-departmental)
  │     └── leader_profile_id → Profile
  │
  ├── Season
  │     ├── seasonal Teams
  │     ├── seasonal Positions
  │     ├── seasonal Zones
  │     ├── seasonal Assets
  │     └── seasonal Policies
  │
  └── Profile (people)
        ├── department_id (primary)
        ├── departments[] (additional)
        ├── location_id (primary)
        ├── locations[] (additional)
        └── teams[] (memberships)
```

---

## 6. Season Impact on Org Structure

| Entity | Season behavior |
|--------|----------------|
| **Workspace** | Owns seasons. Always has default. |
| **Department** | NEVER seasonal. Permanent structure. |
| **Location** | NEVER seasonal. Place always exists. |
| **Team** | CAN be seasonal. Winter crew, event team. |
| **Position** | CAN be seasonal. Grill Chef (summer only). |
| **Zone** | CAN be seasonal. Terrace zones (summer only). |
| **Asset** | CAN be seasonal. Outdoor grill (summer only). |
| **Policy** | CAN be seasonal. Summer opening hours. |

**Pattern:** Departments and Locations are permanent infrastructure. Teams, Positions, Zones, and Assets can be specialized per season.

---

## 7. Integration Points

| Module | Uses from Org Structure |
|--------|------------------------|
| **Scheduling** | Department, Location, Zone, Team, Position — shift assignment |
| **Payroll** | Department, Position — pay rates, supplements |
| **Training** | Position (skill requirements), Asset (certifications) |
| **HACCP** | Location, Zone, Asset — safety checks |
| **Operations** | Location, Zone, Asset — daily routines |
| **Onboarding** | Department, Team, Position — role-specific flows |
| **Reporting** | Department, Location, Team — aggregation |

---

## 8. Data Entities Summary

### Core Types (in Core Architecture v2)
| Entity | Fields | Details |
|--------|--------|---------|
| Workspace | 20+ fields | See Core Architecture |
| Department | 9 fields | See Core Architecture |
| Location | 13 fields | See Core Architecture |
| Team | 13 fields | See Core Architecture |

### Extension Types (this module)
| Entity | Extends | Season-aware | Key fields |
|--------|---------|-------------|------------|
| **Zone** | Location | Yes | name, capacity, color, location_id, season_id |
| **Asset** | Location | Yes | name, asset_type, requires_training, requires_routine, location_id, season_id |
| **Position** | Department | Yes | name, skill_requirements, min_role_level, department_id, season_id |

---

## 9. Migration Notes

Specific considerations for migration from Bubble to Next.js/Supabase:

- Zone, Asset, and Position tables need `workspace_id` for RLS scoping
- Season-aware entities need composite queries: "show permanent + current season items"
- Asset → Policy/Protocol linking needs a junction table or `asset_id` on Policy's `scope_ref_id`
- Position is NOT stored on Profile — it's assigned per shift. No `position_id` on the profile table.
- Zone time-splitting on shifts handled by a `shift_zone_assignment` table in the Scheduling module with `start_time`, `end_time`, `zone_id`
- Department and Location sort_order should be drag-and-drop reorderable in the admin UI
- Deactivation (is_active = false) never deletes data — historical references remain valid

---

*This document covers the organizational structure that all modules build upon. For Core type schemas, see SMARTOUT_CORE_ARCHITECTURE_v2.md.*
