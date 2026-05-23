---
title: "Core Structure — Gaps and Debt"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: core-structure
tags: [domain, core-structure, gaps, debt, delta]
---

# Core Structure — Gaps and Debt

> Bridge between built and planned. Every gap cites code or roadmap. Every deviation cites spec claim vs actual code.

## §Gaps

### G-01 — `department_location` admin UI not built

- **Spec:** ADR-0367 §4.4 mentions "manager may extend via admin UI" + `org.update_dept_areas` capability stub.
- **Code reality:** Schema + RLS live (`20260620120500_department_location_junction.sql`). Read by governance create-routine-action (`apps/web/src/app/dashboard/governance/_actions/create-routine-action.ts:215`). No admin UI for managing pairings. I1 bootstrap seeds initial pairings — admin cannot modify via UI.
- **Impact:** Admin cannot add/remove which departments staff which areas post-setup. Must be done via direct DB or re-running bootstrap.
- **Roadmap:** Phase V1 tail — `/dashboard/organization/departments/[id]/areas` route.
- **Priority:** HIGH (blocks procedure-engine scope UX and future D6 planning UX)

### G-02 — Onboarding wizard `company_opening_hours` → `department_operating_hours` conversion not implemented

- **Spec:** Cascade spec §540: *"company_opening_hours remain as transitional inputs until migration is complete, but are not runtime sources of truth for cascade once department_operating_hours is active."* Spec §595: Step 7 (`SeasonSetupStep`) should create `planning_cycle`, `season`, `department_operating_hours` from bootstrap.
- **Code reality:** `apps/web/src/app/join/_lib/setupActions.ts` exists and reads `operating_hours` table (confirmed by grep). `company_opening_hours` is captured in onboarding wizard but the post-finalize conversion to `department_operating_hours` is not implemented.
- **Impact:** New workspaces may not have `department_operating_hours` rows populated from their wizard intake. The settings `use-operating-hours.ts` hook creates them on first save from DepartmentHoursTab, but wizard-to-runtime conversion is incomplete.
- **Roadmap:** Phase V1 tail — onboarding finalize action must call convert function.
- **Priority:** HIGH

### G-03 — `planning_cycle` not wired from onboarding

- **Spec:** Cascade spec §595 — onboarding Step 7 creates `planning_cycle` + `season`.
- **Code reality:** Year-wheel UI (`/dashboard/year-wheel`) allows manual creation. `SeasonQuickCreateSheet` allows creating seasons. However, the automated bootstrap service (onboarding Step 7 → `planning_cycle`) has not been implemented.
- **Impact:** New workspaces have no `planning_cycle` row unless admin manually creates one in year-wheel.
- **Roadmap:** Phase V1 tail.
- **Priority:** MEDIUM

### G-04 — `department_location` admin — no telemetry events

- **Code reality:** Zero `emit()` call sites for `department_location` mutations in app code (confirmed by grep — only `create-routine-action.ts:215` reads it). No `"department_location created"` or `"department_area pairing removed"` events in registry.
- **Impact:** Silent mutations. Audit trail gap.
- **Priority:** MEDIUM

### G-05 — No telemetry events for zone, asset, hours override, planning_cycle CRUD

- **Code reality:** `packages/telemetry/src/registry.ts` has no events for zone CRUD, asset CRUD, `department_hours_override` writes, or `planning_cycle` mutations.
- **Impact:** Operations on these entities leave no audit trail.
- **Priority:** LOW (zone/asset are low-frequency admin ops)

### G-06 — No E2E test coverage for zone, asset, department_location, hours_override

- **Code reality:** `apps/e2e/tests/season-activation.spec.ts` covers partial `department_operating_hours` path. `governance-harness-e2e.spec.ts` touches governance side. No spec files directly exercise zone/asset CRUD, department_location, or hours overrides.
- **Priority:** MEDIUM

### G-07 — Journey stubs not written

- Journey `JOURNEY-core-structure-admin-setup.md` — not written.
- Journey `JOURNEY-core-structure-hours.md` — not written.
- **Priority:** MEDIUM (required before `/close-feature` on any core-structure sortie)

### G-08 — `operating_hours` legacy table — no drop migration

- **Code reality:** `operating_hours` table exists in DB (migration `20260302152749_add_dashboard_evolution_tables.sql:69`). No app code queries it. `HourFactorsTab.tsx:179` has a comment mentioning it but does not read it.
- **Action needed:** `DROP TABLE operating_hours CASCADE` migration + verification.
- **Priority:** LOW (cleanup chore)

### G-09 — `position` has no dedicated admin UI in org settings

- **Code reality:** `position` table live. Used via `schedule_shift.position_id`. No `/dashboard/organization/positions` route. Position management may be embedded in department detail but no dedicated CRUD surface confirmed.
- **Priority:** LOW (positions seeded by I1 bootstrap; direct management low-frequency)

## §Deviations

### D-01 — Zones and assets ARE surfaced in V1 (module docs claimed schema-only)

- **Old claim** (`docs/modules/core-structure/MODULE_CORE_STRUCTURE.md` and `LOCATIONS-AND-AREAS.md`): *"zone — EXISTS IN SCHEMA, V2 SURFACE"*, *"asset — EXISTS IN SCHEMA, PHASE 2 SURFACE"*
- **Code reality:** `apps/web/src/app/dashboard/organization/locations/[id]/page.tsx:56` reads `.from("zone")` and `:62` reads `.from("asset")`. `CreateZoneDialog`, `EditZoneDialog`, `CreateAssetDialog`, `EditAssetDialog` all exist and are mounted.
- **Resolution:** Domain docs corrected — zone and asset ARE surfaced in V1. "Schema-only" claim was aspirational debt in the old module docs.

### D-02 — Cascade provenance pattern uses JSONB, not discrete `source_type`/`source_id` columns

- **Spec claim** (`smartout-cascade-developer` skill): *"Cascade provenance: every record carries `source_type` + `source_id`"*
- **Code reality:** `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:81, :151, :270` — D1 tables carry `provenance JSONB NOT NULL DEFAULT '{}'`, not discrete columns. The source information is encoded as JSON content within that field.
- **Resolution:** Code wins. The spec's "source_type + source_id" refers to JSON keys that should be populated within `provenance`. Document correctly in DATA-MODEL.md.

### D-03 — `department_location` junction has `workspace_id` column (module doc omitted this)

- **Old claim** (`docs/modules/core-structure/DEPARTMENTS.md` §3): listed only `department_id`, `location_id`, `created_at`, `created_by` without `workspace_id`.
- **Code reality:** `20260620120500_department_location_junction.sql` — table has `workspace_id UUID NOT NULL FK → workspace`, denormalized for RLS performance, populated by trigger `trg_set_department_location_workspace_id`.
- **Resolution:** Domain DATA-MODEL.md corrected.

## §Overlap

### O-01 — `department` shared between core-structure and day-session

- **core-structure** owns the `department` table definition, schema, RLS, admin UI.
- **day-session** owns `department_session` which anchors on `department.department_id`.
- **Seam:** core-structure provides the department; day-session creates sessions against it. Clear author/consumer split.
- **Recommendation:** keep — no consolidation needed.

### O-02 — `location` shared between core-structure and day-session (ADR-0367)

- **core-structure** owns `location` table definition.
- **day-session** owns `day_line` which anchors on `location_id` (ADR-0367 area-anchored runtime).
- **Seam:** same as O-01. Core-structure provides the area; day-session creates day-lines against it.
- **Recommendation:** keep — clear boundary per ADR-0367.

### O-03 — `routine.location_id` FK (procedure-engine reads core-structure)

- **core-structure** owns `location` table.
- **procedure-engine** owns `routine` table, which has `routine.location_id FK → location` (added by `20260622100000_routine_location_team_scope.sql`).
- **Seam:** procedure-engine scopes routines to a location; it reads `department_location` to validate scope (`create-routine-action.ts:215`). Core-structure provides the data; procedure-engine uses it. FK lives in procedure-engine, target lives here.
- **Recommendation:** keep — FK ownership follows the owning table. Seam documented in both domains.

### O-04 — Planning cycle vs season (year-wheel domain boundary)

- **core-structure** owns `planning_cycle` (D1 periodization envelope).
- **Year-wheel / scheduling** domain (not yet a named domain) owns `season` table, `planning_event` (D4), and the year-wheel UI.
- **Seam:** `season.planning_cycle_id` FK links season to planning_cycle. `planning_cycle` is structural/temporal; `season` is operational/D4-5. The boundary is fuzzy because no "scheduling" domain exists yet.
- **Recommendation:** core-structure keeps `planning_cycle`. When a scheduling/year-wheel domain is defined, `planning_event` (D4) should move there. `planning_cycle` may split out then too — flag for that future domain's `pre` run.
