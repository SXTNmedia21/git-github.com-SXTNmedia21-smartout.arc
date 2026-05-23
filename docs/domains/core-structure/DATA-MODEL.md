---
title: "Core Structure — Data Model"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: core-structure
tags: [domain, core-structure, data-model, schema, d1, identity, rls]
---

# Core Structure — Data Model

> Actual schema. **Code wins** — verified against migrations + `database.types.ts`. All tables verified against code.

## Identity layer (pre-workspace)

Core-structure DOES NOT own these tables — they live below the workspace boundary. They are documented here for orientation because every D1 table is scoped to `workspace_id`, which is defined in the identity layer.

| Table | Migration | Notes |
|---|---|---|
| `user_identity` | `00001_identity_tables.sql:23` | Global user record. `is_godmode boolean` = platform admin bypass (renamed from `is_super_admin` in `20260301120000_rename_is_super_admin_to_is_godmode.sql`). No `workspace_id`. |
| `company` | `00001_identity_tables.sql:46` | Legal entity. `company_id PK`, `org_number`, `industry`, `country`. No `workspace_id`. |
| `company_member` | `00001_identity_tables.sql:146` | Bridge `user_id ↔ company_id`. `role company_member_role ('owner','admin','member')`. No `workspace_id`. |
| `workspace` | `00001_identity_tables.sql:74` | Tenant root. `workspace_id PK`, `company_id FK`, `active_modules text[]`, `max_profiles integer`. D1 tables all carry `workspace_id NOT NULL FK → workspace`. |
| `profile` | `00001_identity_tables.sql:107` | D2 resource (operational; no PII). `workspace_id FK`, `company_id FK`, `user_id FK → user_identity`. `role profile_role`, `status profile_status`. One per user per workspace. |

### Scoping hierarchy

```
Company (legal entity — company_member bridges user ↔ company)
  └── Workspace (tenant root — workspace_id on every D1–D6 row)
        └── Profile (one per user per workspace — the RLS anchor)
```

Tables without `workspace_id` (the only 3): `user_identity`, `company`, `company_member`. Everything else is strictly workspace-scoped.

### Godmode (platform admin)

`user_identity.is_godmode boolean DEFAULT false` — bypasses all workspace-scoped RLS. Used by Smartout internal team for support/debugging. Pattern: `EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)`. Verified: `20260301120000_rename_is_super_admin_to_is_godmode.sql` + `packages/supabase/src/database.types.ts:20372`.

---

## D1 tables (domain-owned)

| Table | Migration | workspace-scoped | Notes |
|---|---|---|---|
| `department` | `00002_structure_tables.sql:32` | yes | HVEM axis — functional group |
| `location` | `00002_structure_tables.sql:49` | yes | HVOR axis — area (V1 = every row is an area) |
| `zone` | `00002_structure_tables.sql:70` | yes | Sub-area; surfaced in location detail UI |
| `asset` | `00002_structure_tables.sql:87` | yes | Equipment at location; surfaced in location detail UI |
| `position` | `00002_structure_tables.sql:104` | yes | Role type under department |
| `department_location` | `20260620120500_department_location_junction.sql` | yes | M:N HVEM×HVOR junction |
| `department_operating_hours` | `20260421100200_cascade_a1_domain_tables.sql:68` | yes | **CANONICAL operating hours** — D1 runtime truth |
| `department_hours_override` | `20260421100200_cascade_a1_domain_tables.sql:194` | yes | Per-date exceptions |
| `workspace_operating_hours` | `20260422400000_cascade_b_schema.sql:12` | yes | Workspace-base hours (Cascade B) |
| `planning_cycle` | `20260421100200_cascade_a1_domain_tables.sql:14` | yes | Year-wheel container — D1 envelope |
| `operating_hours` | `20260302152749_add_dashboard_evolution_tables.sql:69` | yes | **LEGACY DEAD** — no app reads it |
| `company_opening_hours` | `20260310140000_signup_tables.sql` (or similar) | yes | Wizard-only input — NOT runtime |

## Detailed schemas

### `department` (`00002_structure_tables.sql:32`)

| Column | Type | Notes |
|---|---|---|
| `department_id` | UUID PK | `gen_random_uuid()` |
| `workspace_id` | UUID NOT NULL FK → workspace | RLS root |
| `name` | text NOT NULL | "Bar", "Kjøkken", "Service" |
| `slug` | text NOT NULL | URL-safe; UNIQUE `(workspace_id, slug)` |
| `description` | text | free-form |
| `color` | text | CSS variable reference — NOT hex |
| `icon` | text | Lucide icon name |
| `sort_order` | integer DEFAULT 0 | UI ordering |
| `is_active` | boolean NOT NULL DEFAULT true | soft-toggle |
| `created_at` / `updated_at` | timestamptz | audit |

### `location` (`00002_structure_tables.sql:49`)

| Column | Type | Notes |
|---|---|---|
| `location_id` | UUID PK | `gen_random_uuid()` |
| `workspace_id` | UUID NOT NULL FK → workspace | RLS root |
| `name` | text NOT NULL | "Bar", "Restaurant", "Kjøkken" |
| `slug` | text NOT NULL | |
| `description` | text | |
| `address` | text | optional geo address |
| `latitude` / `longitude` | float | optional |
| `floor` | text | optional |
| `capacity` | integer | optional seats/covers |
| `location_type` | enum `location_type` NOT NULL DEFAULT `'main'` | category metadata |
| `sort_order` | integer DEFAULT 0 | |
| `is_active` | boolean NOT NULL DEFAULT true | soft-toggle |
| `created_at` / `updated_at` | timestamptz | audit |

### `zone` (`00002_structure_tables.sql:70`)

| Column | Type | Notes |
|---|---|---|
| `zone_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | RLS root |
| `location_id` | UUID NOT NULL FK → location | parent area |
| `name`, `slug`, `description` | text | |
| `capacity` | integer | |
| `is_active` | boolean | |
| `created_at` / `updated_at` | timestamptz | |

**Status:** Surfaced in V1 — `CreateZoneDialog` + `EditZoneDialog` in `organization/locations/[id]/page.tsx:56`. **Not schema-only contrary to older docs.**

### `asset` (`00002_structure_tables.sql:87`)

| Column | Type | Notes |
|---|---|---|
| `asset_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | |
| `location_id` | UUID NOT NULL FK → location | |
| `name`, `description` | text | |
| `requires_training` | bool | D2 readiness gate — employee must complete training before operating |
| `requires_routine` | bool | D6 daily routine check gate |
| `is_active` | bool | |
| `created_at` / `updated_at` | timestamptz | |

**Status:** Surfaced in V1 — `CreateAssetDialog` + `EditAssetDialog` in `organization/locations/[id]/page.tsx:62`.

### `position` (`00002_structure_tables.sql:104`)

| Column | Type | Notes |
|---|---|---|
| `position_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | |
| `department_id` | UUID NOT NULL FK → department | parent department |
| `name`, `slug`, `description` | text | "Bartender", "Hovmester" |
| `skill_requirements` | jsonb | `{"protocols": ["uuid…"], "minimum_hours": 80}` — D2 readiness targets |
| `minimum_role` | enum `profile_role` DEFAULT `'employee'` | role gate |
| `is_active` | bool | |

`schedule_shift.position_id → position.department_id` — department resolved via position, not directly on shift.

### `department_location` (`20260620120500_department_location_junction.sql`)

| Column | Type | Notes |
|---|---|---|
| `department_id` | UUID NOT NULL FK → department | CASCADE delete |
| `location_id` | UUID NOT NULL FK → location | CASCADE delete |
| `workspace_id` | UUID NOT NULL FK → workspace | denormalized for RLS; populated by trigger `trg_set_department_location_workspace_id` |
| `created_by` | UUID FK → profile | nullable (I1 bootstrap rows = null) |
| `created_at` | timestamptz DEFAULT now() | |
| PRIMARY KEY | `(department_id, location_id)` | natural composite |

Indexes: `idx_department_location_department`, `idx_department_location_location`, `idx_department_location_workspace`.

### `department_operating_hours` (`20260421100200_cascade_a1_domain_tables.sql:68`)

**The canonical D1 operating hours table.** Comment: *"Replaces company_opening_hours for runtime."*

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK → workspace | |
| `department_id` | UUID NOT NULL FK → department | |
| `location_id` | UUID FK → location | nullable — NULL = all locations for this dept |
| `season_id` | UUID FK → season | nullable — NULL = workspace default (non-seasonal) |
| `day_of_week` | INT NOT NULL CHECK 0–6 | 0=Mon … 6=Sun (ISO) |
| `open_time` / `close_time` | TIME | null when `is_closed=true` |
| `is_closed` | boolean NOT NULL DEFAULT false | full-day close flag |
| `provenance` | JSONB NOT NULL DEFAULT `'{}'` | cascade source tracking (I1 bootstrap, migration, admin) |
| `created_at` / `updated_at` | timestamptz | |

Uniqueness: `UNIQUE NULLS NOT DISTINCT (department_id, location_id, season_id, day_of_week)`.

### `department_hours_override` (`20260421100200_cascade_a1_domain_tables.sql:194`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK → workspace | |
| `department_id` | UUID NOT NULL FK → department | |
| `location_id` | UUID FK → location | nullable |
| `season_id` | UUID FK → season | nullable |
| `override_date` | DATE NOT NULL | the specific date |
| `open_time` / `close_time` | TIME | null when `is_closed=true` |
| `is_closed` | boolean NOT NULL DEFAULT false | full-day close flag |
| `reason` | text | human-readable (e.g. "Nasjonaldag") |
| `planning_event_id` | UUID FK → planning_event | optional link to demand event |
| `created_at` / `updated_at` | timestamptz | |

Uniqueness: `UNIQUE NULLS NOT DISTINCT (department_id, location_id, override_date)`.

### `workspace_operating_hours` (`20260422400000_cascade_b_schema.sql:12`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK → workspace | |
| `day_of_week` | INT NOT NULL CHECK 0–6 | 0=Mon … 6=Sun (ISO) |
| `open_time` / `close_time` | TIME | |
| `is_closed` | boolean DEFAULT false | |
| `created_at` / `updated_at` | timestamptz | |

UNIQUE `(workspace_id, day_of_week)`. Comment: *"Workspace base operating hours. Departments derive hours from these via offsets."*

### `planning_cycle` (`20260421100200_cascade_a1_domain_tables.sql:14`)

| Column | Type | Notes |
|---|---|---|
| `planning_cycle_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK → workspace | |
| `name` | TEXT NOT NULL | |
| `start_date` / `end_date` | DATE NOT NULL | `CHECK (end_date > start_date)` |
| `total_revenue_target` | NUMERIC(12,2) | optional D4 link |
| `status` | enum `planning_cycle_status` NOT NULL DEFAULT `'draft'` | |
| `created_by` | UUID FK → profile | nullable |
| `created_at` / `updated_at` | timestamptz | |

EXCLUDE constraint: `USING gist (workspace_id WITH =, daterange(start_date, end_date, '[]') WITH &&)` — no overlapping cycles per workspace. Comment: *"Cascade D1: Year wheel container. One per planning period per workspace."*

## Enums

| Enum | Values | Migration |
|---|---|---|
| `location_type` | `main`, `outdoor`, `kitchen`, `event`, `storage`, `other` | `00002_structure_tables.sql:2` |
| `planning_cycle_status` | `draft`, `active`, `archived` | `20260421100100_cascade_a1_enums.sql:52` |
| `planning_event_category` | `external_scraped`, `cultural_commercial`, `internal`, `weather`, `recurring` | `20260421100100_cascade_a1_enums.sql:38` |
| `planning_event_source` | `manual`, `scraped_municipality`, `scraped_cultural`, `weather_api`, `booking_integration`, `historical_import` | `20260421100100_cascade_a1_enums.sql:45` |
| `cascade_initiator` | `cascade_engine`, `admin_manual`, `c1_calibration`, `bootstrap` | `20260421100100_cascade_a1_enums.sql:59` |

Note: `location_type` adding new values (`bar`, `lounge`, `terrace`) is allowed via `ALTER TYPE` migration without ADR. Introducing hierarchy (`property` parent) requires ADR.

## FK map (core-structure → outbound)

```
department_location.department_id  → department.department_id
department_location.location_id    → location.location_id
department_location.workspace_id   → workspace.workspace_id (denormalized)
zone.location_id                   → location.location_id
asset.location_id                  → location.location_id
position.department_id             → department.department_id
department_operating_hours.department_id → department.department_id
department_operating_hours.location_id  → location.location_id (nullable)
department_operating_hours.season_id    → season.season_id (nullable)
department_hours_override.department_id → department.department_id
department_hours_override.location_id   → location.location_id (nullable)
department_hours_override.planning_event_id → planning_event.planning_event_id (nullable)
planning_cycle   → workspace.workspace_id
```

## Inbound FKs (other domains referencing core-structure)

| Table | FK column | Points to | Domain |
|---|---|---|---|
| `department_session` | `department_id` | `department` | day-session (D6) |
| `schedule_shift` | `position_id` | `position` | scheduling (D6) |
| `routine` | `location_id` | `location` | procedure-engine |
| `team` | `department_id` (nullable) | `department` | HR/teams |
| `employee_payroll_profile` | — | `department` via profile | payroll |

## RLS posture

All D1 tables use the standard dual-policy pattern:

- **JWT read**: `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))`
- **JWT write** (INSERT/UPDATE/DELETE): same workspace check; `department`, `location`, `department_location` require `is_admin_in_workspace(auth.uid(), workspace_id)` for mutations.
- **API key read**: `workspace_id = get_api_workspace_id()`
- **Service role**: full access for I1 bootstrap and migration scripts.

`department_location` RLS verified: `20260620120500_department_location_junction.sql` — INSERT `WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id))`, DELETE same.

### Implemented RLS helper functions (`00004_rls_policies.sql`)

Two helper functions are implemented and in production use. MODULE_13 proposed additional `auth.*` schema helpers — those are NOT implemented (see GAPS §G-10).

```sql
-- Returns workspace IDs where user has an active profile
CREATE OR REPLACE FUNCTION public.get_workspace_ids_for_user(uid uuid)
RETURNS SETOF uuid AS $$
  SELECT workspace_id FROM public.profile WHERE user_id = uid AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns true if user has admin or owner role in workspace
CREATE OR REPLACE FUNCTION public.is_admin_in_workspace(uid uuid, wid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = uid AND workspace_id = wid
      AND role IN ('admin', 'owner') AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

Both functions: `SECURITY DEFINER STABLE` — PostgreSQL caches within a transaction, critical for RLS performance.

### Identity-layer RLS policies (informational)

The identity tables have their own simpler RLS patterns (not owned by core-structure, documented for reference):

- `user_identity`: users read/update own row — `auth.uid() = user_id`
- `company`: users read companies where they have a `company_member` row
- `company_member`: users read own membership row — `user_id = auth.uid()`
- `workspace`: users read workspaces via `get_workspace_ids_for_user(auth.uid())`

All of these are in `00004_rls_policies.sql`.

## Telemetry events

| Event | Registry line | Emitted at |
|---|---|---|
| `"department created"` | `packages/telemetry/src/registry.ts:404` | Admin creates department |
| `"department updated"` | `packages/telemetry/src/registry.ts:412` | Admin mutates department |
| `"department archived"` | `packages/telemetry/src/registry.ts:420` | Admin deactivates department |
| `"location created"` | `packages/telemetry/src/registry.ts:497` | Admin creates location |
| `"location updated"` | `packages/telemetry/src/registry.ts:505` | Admin mutates location |
| `"operating_hours updated"` | `packages/telemetry/src/registry.ts:1974` | `department_operating_hours` written (hook `:169`) |
| `"workspace_operating_hours updated"` | `packages/telemetry/src/registry.ts:1981` | Workspace base hours written |

Emit call site for `"operating_hours updated"`: `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts:169` (confirmed in code — grep: `event: "operating_hours updated"`).

**Gap:** No telemetry events for `department_location` mutations, zone/asset CRUD, `planning_cycle` CRUD, or `department_hours_override` writes. See [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) §Gaps.
