---
title: Core Structure — Departments
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: core-structure
tags: [core-structure, department, department-location, position, d1, hvem]
---

# Core Structure — Departments

> The HVEM axis. Departments group people by function and skill. They are orthogonal to the HVOR axis (location/area). This doc defines V1 model + the `department_location` junction introduced in ADR-0367.

## 1. What a Department Is

A **department** is a functional grouping of people who share a purpose, a skillset, and a chain of accountability. Examples in hospitality:

- **Bar-personell** — staff who prepare drinks. May work in bar-area, restaurant-area (when restaurant has bar service), event-area.
- **Kjøkken** — chefs and prep cooks. Work in kitchen-area, may extend to event-area for live cooking.
- **Service** — front-of-house servers. Work in restaurant-area, may extend to event-area for hosting.

A department is **not** a place. A department is **not** a shift type. A department is **not** a role. Place is `location`. Shift type is `schedule_shift.shift_type`. Role is `position`.

## 2. The Orthogonality Rule

Schema enforces it:
- `department` has NO `location_id` column.
- `location` has NO `department_id` column.
- The relationship lives in `department_location` (M:N junction).

UI and capability gates enforce it:
- Manager-of-Bar-dept may author day-lines for areas that appear in `department_location` for Bar-dept.
- A `day_line` is uniquely identified by `(department_session_id, location_id)` — both axes mandatory.

Why orthogonal?
- An event-floor on event-night is staffed by Bar-dept + Kjøkken + Service simultaneously. Three departments, one area. If `department.location_id` was a single column, you could not represent this without duplicating the department row.
- A Bar-dept staff member may work bar-area Tuesday and event-area Saturday. One department, two areas. If `location.department_id` was a single column, you could not represent this either.

## 3. Schema

### `department`

Defined in `supabase/migrations/00002_structure_tables.sql:32`:

| Column | Type | Notes |
|---|---|---|
| `department_id` | UUID PK | gen_random_uuid |
| `workspace_id` | UUID NOT NULL FK → workspace | RLS root |
| `name` | text NOT NULL | "Bar", "Kjøkken", "Service" |
| `slug` | text NOT NULL | URL-safe identifier |
| `description` | text | free-form |
| `color` | text | UI color (Nordic Split tokens via CSS variable resolution, not hex) |
| `icon` | text | Lucide icon name |
| `sort_order` | integer | UI ordering |
| `is_active` | bool | soft-toggle |
| `created_at` / `updated_at` | timestamptz | audit |

### `department_location` (NEW in ADR-0367)

| Column | Type | Notes |
|---|---|---|
| `department_id` | UUID NOT NULL FK → department | |
| `location_id` | UUID NOT NULL FK → location | |
| `created_at` | timestamptz DEFAULT now() | audit |
| `created_by` | UUID FK → profile | admin who added the pairing (nullable for I1 bootstrap rows) |
| PRIMARY KEY | `(department_id, location_id)` | |

Indexes:
- `idx_department_location_department` on `(department_id)` — for "which areas does this dept staff?"
- `idx_department_location_location` on `(location_id)` — for "which depts staff this area?"

RLS:
- SELECT: workspace member
- INSERT / DELETE: admin+ via gate_action `org.update_dept_areas`

### `position` (lives under department)

Defined in `supabase/migrations/00002_structure_tables.sql:104`:

| Column | Type | Notes |
|---|---|---|
| `position_id` | UUID PK | |
| `workspace_id` | UUID NOT NULL FK | |
| `department_id` | UUID NOT NULL FK → department | parent dept |
| `name`, `slug`, `description` | text | "Bartender", "Hovmester", "Sushi-kokk" |
| `skill_requirements` | jsonb | D2 readiness requirements: `{"protocols": ["proto-uuid"], "minimum_hours": 80}` |
| `minimum_role` | enum `profile_role` | default 'employee' |
| `is_active` | bool | soft-toggle |

A `position` is a role inside a department. `schedule_shift.position_id` pins the shift to a specific role; the department is derived from the position.

## 4. Resolving "Which Department Owns This Shift?"

```
schedule_shift.position_id → position.department_id → department.department_id
```

`schedule_shift` does NOT carry `department_id` directly — derived via `position`. (Verify in migration `supabase/migrations/20260301600002_schedule_shift.sql` and successors.)

For the Dagslinje surface:
- `day_line` directly references `department_id` (denormalized for filter perf and RLS clarity).
- On `day_line` insert: server-side resolve from `department_session.department_id`. ADR-0151 forbids client-supplied.

## 5. Invariants

1. **No department.location_id.** Schema enforces by absence.
2. **`department_location` is the only source of truth for HVEM × HVOR.**
3. **Every position belongs to exactly one department.** No cross-department positions.
4. **Department names are unique per workspace.** UNIQUE `(workspace_id, slug)` enforced.
5. **Seasonal departments use the `season` link** (see `MODULE_YEAR_WHEEL_PRD.md`) — not a separate `seasonal` flag on the department row.
6. **Admin gates department mutations.** Manager+ can read; admin+ can write.

## 6. I1 Bootstrap

`packages/ai/src/industry/hospitality.ts` seeds default departments + `department_location` pairings per vertical. See `LOCATIONS-AND-AREAS.md` §9 for the restaurant example.

I1 is the ONLY non-admin path that creates department rows. Admin UI mutations require `gate_action`.

## 7. Capability Touchpoints

| Capability | Reads / Writes | Notes |
|---|---|---|
| `day_line.create` (ADR-0367) | reads `department_location` to verify dept staffs target area | manager+ |
| `task.create_session` (existing) | reads `schedule_shift` for assignee, joins position → department | unchanged in V1 |
| `routine.attach_to_line` (planned per ADR-0367) | reads `department_location` for scope | manager+ |
| `org.update_dept_areas` (planned admin tool) | writes `department_location` | admin+ |
| `org.create_department` (existing) | writes `department` | admin+ |

## 8. Frontend Surfaces

Web admin:
- `/dashboard/organization/departments` — CRUD departments (existing surface)
- `/dashboard/organization/departments/[id]/areas` — manage `department_location` pairings (planned for ADR-0367 follow-up)

Mobile:
- Read-only. Department label appears on shift cards, day-line headers, deviation forms. No mobile authoring (ADR-0133).

## 9. Cross-References

- **[ADR-0367](../../decisions/0367-day-line-area-anchored-runtime.md)** — authoritative
- [LOCATIONS-AND-AREAS.md](./LOCATIONS-AND-AREAS.md) — HVOR side
- [MODULE_CORE_STRUCTURE.md](./MODULE_CORE_STRUCTURE.md) — module overview
- Schema: `supabase/migrations/00002_structure_tables.sql:32` (department), to-be-added migration `<TS>_department_location.sql`
- I1 bootstrap: `packages/ai/src/industry/hospitality.ts`
