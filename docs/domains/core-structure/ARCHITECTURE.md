---
title: "Core Structure — Architecture"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: core-structure
tags: [domain, core-structure, architecture, d1]
---

# Core Structure — Architecture

> L1–L5 code map. **Code wins.** Every component cited with grep-able anchor + path.

## L1 — Surface (UI)

### Web (admin-only, `apps/web/src/app/dashboard/organization/`)

| Route | Component | Purpose |
|---|---|---|
| `/dashboard/organization` | `apps/web/src/app/dashboard/organization/page.tsx` (`OrgTabNav`) | Tabbed shell: Departments · Locations · Teams · Overview |
| `/dashboard/organization/departments` | `DepartmentsTab` component | Department list, CRUD |
| `/dashboard/organization/departments/[id]` | `apps/web/src/app/dashboard/organization/departments/[id]/page.tsx` | Department detail — reads `.from("department")` at line `:76` + `:175` |
| `/dashboard/organization/departments/[id]` → Hours tab | `DepartmentHoursTab.tsx` | Reads/writes `department_operating_hours` (`.from("department_operating_hours")` at `:39` hook, `:156` write) |
| `/dashboard/organization/locations` | `LocationsTab` component | Location list, CRUD |
| `/dashboard/organization/locations/[id]` | `apps/web/src/app/dashboard/organization/locations/[id]/page.tsx` | Location detail — reads `location`, `zone`, `asset` via `Promise.all` at `:48` |
| `/dashboard/organization/locations/[id]` → Zones | `CreateZoneDialog`, `EditZoneDialog` | Zone CRUD (`.from("zone")` at `:56`) — **zones ARE surfaced in V1** |
| `/dashboard/organization/locations/[id]` → Assets | `CreateAssetDialog`, `EditAssetDialog` | Asset CRUD (`.from("asset")` at `:62`) — **assets ARE surfaced in V1** |
| `/dashboard/year-wheel` | `apps/web/src/app/dashboard/year-wheel/page.tsx` | Year-wheel / planning-cycle UI |

All organization routes are web-only (ADR-0133). Mobile reads location/department names from context but has no authoring UI.

### Org AI tools bridge

`apps/web/src/app/dashboard/organization/_tools/organization-tools-bridge.tsx` — AI tools for querying org structure in chat/voice context.

`apps/web/src/app/dashboard/organization/locations/[id]/_tools/locations-tools-bridge.tsx` — Location-specific AI tool bridge.

### Mobile

Read-only. Department/location names appear on:
- Shift cards (department label)
- Day timeline headers (department_session header, location label)
- Deviation forms (location context)
- Push notification payloads

No mobile authoring of structural entities (ADR-0133).

## L2 — BFF / API

### Server actions

| Action | File | Purpose |
|---|---|---|
| `activate-season-action.ts` | `apps/web/src/app/dashboard/_actions/activate-season-action.ts` | Writes `department_operating_hours` rows as part of season activation D1 fanout (`supabase/migrations/20260518010001_season_activation_trigger_d1.sql`) |

### Hooks (client-side data layer)

| Hook | File | Reads |
|---|---|---|
| `use-operating-hours.ts` | `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts` | `department_operating_hours` (read at `:94`, write at `:161`) |
| `use-workspace-operating-hours.ts` | `apps/web/src/app/dashboard/settings/_hooks/use-workspace-operating-hours.ts` | `workspace_operating_hours` (Cascade B base layer) |
| `use-hours-overrides.ts` | `apps/web/src/app/dashboard/schedule/_hooks/use-hours-overrides.ts` | `department_hours_override` |
| `use-drawer-department.ts` | `apps/web/src/app/dashboard/_hooks/use-drawer-department.ts` | `department_operating_hours` (department drawer context) |

### Governance cross-domain read

`apps/web/src/app/dashboard/governance/_actions/create-routine-action.ts:215` — reads `department_location` junction to validate department→location scope when attaching a routine. This is the procedure-engine domain **reading** core-structure data, not owning it.

## L3 — Engine / orchestration

### Cascade season-activation D1 fanout

`supabase/migrations/20260518010001_season_activation_trigger_d1.sql` — DB trigger that fans out `department_operating_hours` rows when a season is activated. The year-wheel `SeasonQuickCreateSheet` and `activate-season-action.ts` trigger this path.

`supabase/tests/season-activation-d1-fanout.sql` — pgTAP test for the fanout. Covers `department_operating_hours` correctness.

`apps/e2e/tests/season-activation.spec.ts` — E2E test (partial coverage of D1 hours path).

### I1 bootstrap seeding

`packages/ai/src/industry/packages/hospitality.ts` — seeds departments, locations, position templates, default operating hours, and shift patterns for new hospitality workspaces. Lines `:138` (default dept hours 09:00–17:00 Mon–Fri) + `:570–574` (shift templates referencing department names).

`packages/ai/src/industry/loader.ts` + `packages/ai/src/industry/index.ts` — loader and index.

`supabase/templates/restaurant/` — 13 SQL templates + `_apply.sql` for restaurant vertical seed.

## L4 — Capability / domain logic

### Cascade pure functions

`apps/web/src/lib/cascade/types.ts` — TypeScript types for cascade dimensions including D1. References `operating_hours` in a comment context.

`apps/web/src/lib/cascade/` — pure functions (Phase B partial: 4/6 done per cascade skill).

### AI capabilities

`packages/ai/src/capabilities/` — `org.update_dept_areas` capability (gated write for `department_location`) is a V1 stub. No full capability tool shipping yet for department/location mutations.

### Telemetry

Events in `packages/telemetry/src/registry.ts`:

| Event | Line | Fired when |
|---|---|---|
| `"department created"` | `:404` | Department created |
| `"department updated"` | `:412` | Department mutated |
| `"department archived"` | `:420` | Department archived/deactivated |
| `"location created"` | `:497` | Location created |
| `"location updated"` | `:505` | Location mutated |
| `"operating_hours updated"` | `:1974` | `department_operating_hours` written (settings hook at `:169`) |
| `"workspace_operating_hours updated"` | `:1981` | Workspace base hours written |

## L5 — Persistence

→ See [DATA-MODEL.md](./DATA-MODEL.md) for full schema.

Primary migrations:

| Migration | Creates |
|---|---|
| `supabase/migrations/00002_structure_tables.sql` | `location_type` enum, `department`, `location`, `zone`, `asset`, `position`, `team`, `team_member` |
| `supabase/migrations/00010_org_structure_updates.sql` | Org structure patches |
| `supabase/migrations/20260421100100_cascade_a1_enums.sql` | D1 enums: `planning_cycle_status`, `planning_event_category`, `planning_event_source`, `cascade_initiator`, `tariff_source` |
| `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql` | `planning_cycle`, `department_operating_hours`, `department_hours_override` (D1) + `planning_event` (D4) |
| `supabase/migrations/20260422400000_cascade_b_schema.sql` | `workspace_operating_hours` (D1 base layer) |
| `supabase/migrations/20260620120500_department_location_junction.sql` | `department_location` M:N junction |
| `supabase/migrations/20260518010001_season_activation_trigger_d1.sql` | D1 season-activation trigger |

Types: `packages/supabase/src/database.types.ts`

## Data flow

### Structural setup (I1 bootstrap path)

```
1. New workspace created (company_member confirmed)
2. Admin selects niche (restaurant/hotel/…)
3. I1 bootstrap loads packages/ai/src/industry/packages/hospitality.ts
4. SQL templates in supabase/templates/restaurant/ seed:
   - location rows (Bar, Restaurant, Kjøkken, Lager)
   - department rows (Service, Bar, Kjøkken)
   - department_location pairings (Service↔Restaurant, Bar↔Bar+Restaurant, Kjøkken↔Kjøkken+Lager)
   - default department_operating_hours (Mon-Fri 09:00-17:00 → overridden by wizard)
5. Onboarding wizard Step 7 (SeasonSetupStep) creates planning_cycle + season
   → triggers season_activation_trigger_d1 → fans out department_operating_hours per dept/location
```

### Runtime operating hours resolution (D6 anchor)

```
department_session (D6) anchors on:
  - department_id → department (D1 core-structure)
  - planned_open / planned_close resolved from:
      1. department_hours_override WHERE override_date = session.date  (check first)
      2. department_operating_hours WHERE department_id + day_of_week = session.day (canonical)
      3. workspace_operating_hours WHERE day_of_week = session.day    (fallback base)
```
