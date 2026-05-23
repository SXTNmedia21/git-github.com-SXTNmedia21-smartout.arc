---
title: "Core Structure — Overview"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: core-structure
tags: [domain, core-structure, d1, overview, cascade, operating-hours, identity, rls, multi-workspace]
---

# Core Structure — Overview

> What this domain is and why it exists. **Code wins** — if this contradicts code, update here.

## 1. What it is

Core Structure is the **D1 Operational Envelope** of the Smartout cascade model. It defines the permanent, slow-moving scaffolding that every other domain operates inside: *where* work happens (locations/areas), *what functional groups exist* (departments), *which groups staff which areas* (department_location junction), *when they operate* (operating hours and overrides), and *over what time horizon* (planning_cycle).

Think of it as the stage before any action: before a shift is scheduled, before a session is created, before a routine runs — the structural envelope must exist and be correct. Every D2–D6 record traces back to something core-structure owns.

Core structure is **tenant-scoped** but **not person-scoped**. The workspace is the tenant root. Profiles (people) are D2 resources that are assigned to departments — they do not define the department. Position belongs here because it defines role types within departments, not individuals.

## 2. Cascade placement

| Entity | Dimension | Role |
|---|---|---|
| `workspace` | Tenant root | Identity boundary — NOT owned by this domain (owned by tenancy/identity layer) |
| `location` (product: "area") | **D1** | Structural envelope — HVOR axis |
| `zone` | **D1** | Sub-area shift unit (schema-only V1; surfaced in location detail UI) |
| `asset` | **D1** | Equipment/equipment endpoint (surfaced in location detail UI) |
| `department` | **D1** | Structural axis — HVEM (functional grouping of people) |
| `department_location` | **D1** | M:N HVEM×HVOR junction |
| `position` | **D1 + D2 boundary** | Role definition per department; D2 uses it for readiness targets + shift assignment |
| `department_operating_hours` | **D1** | When each department runs — runtime truth |
| `department_hours_override` | **D1** | Per-date exceptions to operating hours |
| `workspace_operating_hours` | **D1 (Cascade B)** | Workspace-level base hours; departments derive via offsets |
| `planning_cycle` | **D1** | Year-wheel container — periodization envelope |

Core structure is the most stable dimension: records change rarely, cascade down to D6 production via ADR-0367 anchors.

## 3. Boundaries

**Owns:**
- `department` table — functional groups, not people
- `location` (area) — physical operational space
- `zone` — sub-area (surfaced, not schema-only as older docs claimed)
- `asset` — equipment at location (surfaced)
- `department_location` — M:N junction
- `position` — role type under department
- `department_operating_hours` — runtime hours per dept/location/season/weekday
- `department_hours_override` — date-specific exceptions
- `workspace_operating_hours` — workspace-level base
- `planning_cycle` — year-wheel container
- I1 seeding pipe for all of the above
- Admin UI surfaces for all of the above

**Does NOT own:**
- **Identity layer** (`user_identity`, `company`, `company_member`, `workspace`, `profile`) — these are pre-workspace tenant identity. Core structure starts AT workspace, not below it.
- **`department_session` lifecycle** — owned by **day-session** domain (D6). Core structure provides the `department` that `department_session` anchors on.
- **D2 resources** (`employment_contract`, `schedule_absence`) — owned by HR/people domain.
- **D3 rules** (`regulatory_framework`, `framework_rule`, `tariff_rate_table`) — owned by rules domain (K1a/K1b).
- **`routine.location_id` authoring** — the FK lives on `routine` (procedure-engine domain). Core structure owns the `location` row the FK points at. Procedure-engine reads `department_location` for scope resolution (`apps/web/src/app/dashboard/governance/_actions/create-routine-action.ts:215`).
- **Season** (`season` table, `planning_event` D4 — demand-signal concern) — season anchors to `planning_cycle` but the season concept itself is a D4/D5 concept owned by the scheduling/year-wheel domain.

## 4. The Two Axes (HVOR vs HVEM)

Core structure enforces orthogonality between two axes:

```
workspace (tenant boundary)
│
├── HVOR axis (D1 — physical/structural)
│     location  — operational area (Bar, Restaurant, Event-floor, Kjøkken, Lager)
│     zone      — sub-area shift assignment unit (Bar 1, Dish Station) [surfaced]
│     asset     — equipment (POS, Fridge, Oven) [surfaced]
│
└── HVEM axis (D1/D2 boundary — people grouping)
      department       — functional group (Bar-personell, Kjøkken, Service)
      position         — role inside dept (Bartender, Chef, Server)
      department_location — M:N link: which departments staff which areas
```

**The orthogonality rule:** `department` has NO `location_id` column. `location` has NO `department_id` column. The relationship lives exclusively in `department_location`. Violation of this rule breaks Dagslinje scoping (day-session domain) and C1 reconciliation.

Verified: `supabase/migrations/00002_structure_tables.sql:32` — no `location_id` on `department`. `supabase/migrations/20260620120500_department_location_junction.sql` — `department_location` M:N table.

## 5. Operating hours triple trap

**STOP before writing any operating hours code.** Three (actually four) tables exist:

| Table | Status | Runtime use |
|---|---|---|
| `department_operating_hours` | **CANONICAL** | Per (dept, location?, season?, day_of_week). `provenance JSONB`. |
| `department_hours_override` | **CANONICAL** | Per-date exceptions on canonical. |
| `workspace_operating_hours` | **Cascade B intermediate** | Workspace-level weekly base; read by `use-workspace-operating-hours.ts`. |
| `company_opening_hours` | **Wizard-only** | Onboarding capture → converts to `department_operating_hours` post-finalize. Not runtime. |
| `operating_hours` | **LEGACY DEAD** | Created in `20260302152749_add_dashboard_evolution_tables.sql:69`. No app code reads it. Drop candidate. |

The settings hook `use-operating-hours.ts:94` reads `department_operating_hours`. The `DepartmentHoursTab.tsx:156` writes `department_operating_hours`. Both confirmed correct. The `workspace_operating_hours` fallback in `use-workspace-operating-hours.ts` exists as a workspace-default layer; `department_operating_hours` with `NULL season_id` is the authoritative record for the runtime cycle per cascade spec §4.1.

## 6. Key invariants

1. **Every structural row carries `workspace_id`** — RLS root. Verified: `supabase/migrations/00002_structure_tables.sql:35` (`department.workspace_id NOT NULL`), `:52` (`location.workspace_id NOT NULL`).
2. **HVOR and HVEM never merge** — `department.location_id` must never exist. `location.department_id` must never exist. Use `department_location` junction. Verified: schema has no such columns.
3. **Each `location` row IS an area in V1** — no `parent_location_id` self-FK. Property layer deferred.
4. **`location_type` enum is category, not hierarchy** — values: `main`, `outdoor`, `kitchen`, `event`, `storage`, `other`. Adding new values via `ALTER TYPE` is allowed; adding hierarchy requires ADR.
5. **No empty workspaces** — I1 bootstrap always seeds ≥1 location + ≥1 department + ≥1 `department_location`. Source: `packages/ai/src/industry/packages/hospitality.ts:138` (dept hours seed) + shift templates at `:570–574`.
6. **Provenance is always JSONB, not discrete columns** — `department_operating_hours.provenance` and `planning_event.provenance` are `JSONB NOT NULL DEFAULT '{}'`. The cascade spec's "source_type + source_id" maps to JSON keys within that JSONB, not separate table columns.
7. **Runtime hours = `department_operating_hours`** — never read `operating_hours` table.
8. **Structural mutations require `gatedMutation`** (ADR-0204) and admin role.
9. **Mobile is read-only on structure** (ADR-0133) — no authoring UIs on mobile.

## 7. Identity layer boundary and multi-workspace patterns

Core structure starts AT the workspace. The identity layer below it is a prerequisite:

```
user_identity (global user — no workspace_id)
  └── company_member (user ↔ company bridge — no workspace_id)
        └── company (legal entity — no workspace_id)
              └── workspace (tenant root — workspace_id PK)
                    └── profile (one per user per workspace — RLS anchor for all D1–D6 queries)
```

**Multi-workspace user pattern:** A user (one `user_identity` row) can have profiles in multiple workspaces. This is the standard pattern for regional managers and employees who work at multiple locations. Each profile is independent — separate training status, separate schedule, separate tasks.

```
user: Ole (regional manager)
  ├── profile in workspace "Sentrum" (role: admin)
  ├── profile in workspace "Vest" (role: admin)
  └── profile in workspace "Øst" (role: admin)
```

`get_workspace_ids_for_user(auth.uid())` returns all active workspace IDs for the current user. This is the universal RLS gate — every D1–D6 table uses it.

**Multi-workspace employee:** Same user, different role per workspace. Profile, schedule, training, and tasks are completely isolated per workspace.

**Workspace plan gates:** `workspace.active_modules text[]` gates which features are enabled. `workspace.max_profiles integer` is a nullable profile count ceiling. These columns exist in schema (`00001_identity_tables.sql:91-92`) but the enforcement mechanism (billing domain's `stripe_invoice`, `billing_integration_type`) is in the billing domain — NOT core-structure. Billing reads workspace columns; core-structure does not enforce billing logic.

**Godmode:** `user_identity.is_godmode boolean` is the platform-admin bypass. Smartout internal use only. All significant RLS policies have a godmode bypass branch. Verified: `packages/supabase/src/database.types.ts:20372` + rename migration `20260301120000_rename_is_super_admin_to_is_godmode.sql`.
