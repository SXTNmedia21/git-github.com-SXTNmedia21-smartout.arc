---
title: Module — Smartout Core Structure (Overview)
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: core-structure
tags: [module, core-structure, foundation, d1, location, area, department]
---

# Module — Smartout Core Structure (Overview)

> Authoritative module doc for Smartout's structural layer. Defines what a workspace contains and how the pieces relate. If code contradicts this doc → CODE wins, update this doc.

## 1. Mental Model

A Smartout workspace has two orthogonal axes plus a thin tenant boundary:

```
workspace (tenant boundary)
│
├── HVOR axis (D1 Operational Envelope, physical/structural)
│     property      — physical address. NOT MODELLED IN V1.
│     area          — operational space (bar, restaurant, event-floor). STORED AS `location` IN V1.
│     zone          — sub-area shift-assignment unit (bar 1, dish station). EXISTS IN SCHEMA, V2 SURFACE.
│     asset         — equipment (POS, fridge, oven). EXISTS IN SCHEMA, PHASE 2 SURFACE.
│
└── HVEM axis (D2 Resource grouping, people)
      department    — functional group of people with shared purpose, skills, capabilities.
      position      — role inside a department (bartender, chef, server).
      profile       — individual person (covered by other modules).

      department_location   — M:N junction (HVEM × HVOR). NEW IN ADR-0367.
```

**The orthogonality rule:** HVOR and HVEM are independent. A department can staff multiple areas. An area can host multiple departments. Never collapse the two into one entity — the Dagslinje surface and the C1 reconciliation both depend on the separation.

## 2. V1 Decisions (ADR-0367)

The following are settled for V1:

| Question | Decision | Why |
|---|---|---|
| Should "location" be split into property + area + zone? | NO for V1 — keep `location` table semantically as "area". Property + zone surface deferred. | Property only needed for multi-site chains; zone only needed for shift-assignment granularity. Existing schema already supports both — surface them when product needs. |
| How should department relate to area? | New `department_location` M:N junction. | One dept staffs many areas; one area hosts many depts. |
| Should `location_type` enum drive hierarchy? | NO. It is **category metadata** for an area, not a hierarchy level. | Existing values (`main`, `outdoor`, `kitchen`, `event`, `storage`, `other`) describe what kind of operational space, not where in a tree it sits. |
| What anchors a Dagslinje? | `location` (area) + `department` via `department_session`. | See `docs/domains/day-session/` + ADR-0367. |

## 3. Schema Snapshot

All defined in `supabase/migrations/00002_structure_tables.sql` unless noted.

### `location` (the area table)

| Column | Type | Notes |
|---|---|---|
| `location_id` | UUID PK | gen_random_uuid |
| `workspace_id` | UUID NOT NULL FK → workspace | RLS root |
| `name` | text NOT NULL | "Bar", "Restaurant", "Event-etasje" |
| `slug` | text NOT NULL | URL-safe identifier |
| `description` | text | free-form |
| `address` | text | physical address (may be null if area inherits from property — V1: each location carries its own) |
| `latitude` / `longitude` | float | optional geo |
| `floor` | text | optional |
| `capacity` | integer | optional |
| `location_type` | enum `location_type` | category: `main` \| `outdoor` \| `kitchen` \| `event` \| `storage` \| `other` |
| `sort_order` | integer | UI ordering |
| `is_active` | bool | soft-toggle |
| `created_at` / `updated_at` | timestamptz | audit |

Semantic: V1 every `location` row IS an area. There is no parent-location reference today. If V2 introduces property, add `parent_location_id` self-FK + `location_kind` enum (`property` \| `area`) and migrate existing rows to `area`.

### `zone` (sub-area, deferred surface)

| Column | Type | Notes |
|---|---|---|
| `zone_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | RLS root |
| `location_id` | UUID NOT NULL FK → location | parent area |
| `name`, `slug`, `description`, `capacity` | text/integer | basic identity |
| `is_active` | bool | soft-toggle |

Status: schema exists, no UI surfaces yet, no FK from `schedule_shift`. Will gain shift-anchor binding in V2 (`schedule_shift.zone_id` nullable).

### `asset` (equipment, deferred surface)

| Column | Type | Notes |
|---|---|---|
| `asset_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | RLS root |
| `location_id` | UUID NOT NULL FK → location | placement |
| `name`, `description` | text | |
| `requires_training` | bool | gate flag for D2 readiness |
| `requires_routine` | bool | gate flag for D6 routines |
| `is_active` | bool | soft-toggle |

Status: schema exists, no surfaces yet. Phase 2 use: bind assets to `day_line_item` for "rengjør POS-3 før kveld".

### `department`

| Column | Type | Notes |
|---|---|---|
| `department_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | RLS root |
| `name`, `slug`, `description`, `color`, `icon` | text | identity + display |
| `sort_order` | integer | UI ordering |
| `is_active` | bool | soft-toggle |

No `location_id` column — orthogonality preserved. Department-to-area relationship lives in `department_location`.

### `department_location` (NEW in ADR-0367)

| Column | Type | Notes |
|---|---|---|
| `department_id` | UUID NOT NULL FK → department | |
| `location_id` | UUID NOT NULL FK → location | |
| `created_at` | timestamptz DEFAULT now() | audit |
| PRIMARY KEY | `(department_id, location_id)` | natural composite |

Seeding: I1 bootstrap (`packages/ai/src/industry/`) populates default pairings per vertical (e.g. hospitality template seeds Bar-dept → Bar-area). Manager may extend via admin UI.

### `position`

| Column | Type | Notes |
|---|---|---|
| `position_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | |
| `department_id` | UUID NOT NULL FK → department | parent dept |
| `name`, `slug`, `description` | text | |
| `skill_requirements` | jsonb | D2 readiness requirements |
| `minimum_role` | enum `profile_role` | default 'employee' |
| `is_active` | bool | |

Position lives under department, not area. A position is a function (bartender), not a place.

## 4. Invariants

1. **Every structural row carries `workspace_id`.** RLS root.
2. **HVOR and HVEM never merge into one table.** Department.location_id is **NOT** a column. Use `department_location` junction.
3. **Each `location` row IS an area in V1.** No parent-location reference. Property layer deferred.
4. **`location_type` enum is category, not hierarchy.** Adding new values is allowed; introducing hierarchy requires an ADR.
5. **`zone` and `asset` exist but are not surfaced.** Touching them in UI requires an ADR.
6. **`department_location` is the single source of truth for "which dept staffs which area".** Capability gates and scope filters read here.
7. **No empty workspaces.** I1 bootstrap (`packages/ai/src/industry/`) always seeds at least 1 location + 1 department + 1 `department_location` row.

## 5. Cascade Placement

| Entity | Dimension | Role |
|---|---|---|
| `workspace` | tenant | identity |
| `location` (area) | D1 | structural envelope (HVOR) |
| `zone` | D1 | sub-envelope (HVOR — finer) |
| `asset` | D1 | equipment endpoint (HVOR — leaf) |
| `department` | D1 + D2 | structural axis (HVEM) — provides resources |
| `department_location` | D1 | structural link |
| `position` | D1 + D2 | role definition + readiness target |

D1 is permanent, slow-moving. Changes here cascade to D6 production via ADR-0367 anchors.

## 6. Authoring Rules

- All structural mutations gate via `gatedMutation` (ADR-0204).
- All IDs derived server-side per ADR-0151 — body-supplied `workspace_id` rejected.
- I1 bootstrap is the only path that creates an empty workspace's structural baseline.
- Mobile is read-only on structural surfaces (ADR-0133). Admin-of-structure is web-only.
- Adding a new `location_type` enum value: ALTER TYPE migration + no ADR needed.
- Introducing `property` layer or surfacing `zone`/`asset`: requires ADR.
- New `department_location` rows added by admin via gate `org.update_dept_areas` (capability stub in V1; surfaces in admin UI later).

## 7. Cross-References

### ADRs
- **[ADR-0367](../../decisions/0367-day-line-area-anchored-runtime.md)** — authoritative for V1 model
- [ADR-0075](../../decisions/0075-knowledge-system-consolidation.md) — doc structure baseline
- [ADR-0133](../../decisions/0133-mobile-surface-boundary.md) — mobile read-only on structure
- [ADR-0151](../../decisions/0151-server-resolved-ids.md) — ID derivation
- [ADR-0204](../../decisions/0204-gated-mutation-pattern.md) — gatedMutation
- [ADR-0287](../../decisions/0287-gate-action-mandatory-on-mutation-capability-tools.md) — gate_action

### Modules
- `docs/domains/day-session/` — direct consumer of `(location, department)` pair
- `docs/modules/payroll/` — consumes `department_session` (untouched)
- `docs/modules/MODULE_YEAR_WHEEL_PRD.md` — D4 planning per area+dept

### Code locations
- Schema: `supabase/migrations/00002_structure_tables.sql`
- Types: `packages/supabase/src/database.types.ts`
- Cascade: `apps/web/src/lib/cascade/`
- I1 bootstrap: `packages/ai/src/industry/`
- RLS templates: `supabase/templates/restaurant/`

### Adjacent docs
- [LOCATIONS-AND-AREAS.md](./LOCATIONS-AND-AREAS.md) — area-specific details
- [DEPARTMENTS.md](./DEPARTMENTS.md) — department + junction details
