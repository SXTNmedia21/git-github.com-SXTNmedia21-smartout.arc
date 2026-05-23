---
title: "Core Structure — Domain Index"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: core-structure
tags: [domain, core-structure, d1, department, location, operating-hours, source-of-truth]
---

# Core Structure — Source of Truth

> Authoritative folder for the **core-structure** domain. If code contradicts this folder → **CODE wins**, update these docs.
> Absorbed from: `docs/modules/core-structure/` (4 files, 2026-05-18) + `docs/architecture/modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md` (2026-02-24).

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| `location` (area) CRUD | ✅ | 🟡 | `/dashboard/organization/locations/*` — list + detail + zone/asset sub-pages live |
| `zone` sub-area surface | ✅ | 🔴 | Surfaced in location detail (`CreateZoneDialog`, `EditZoneDialog`). No E2E tests. |
| `asset` surface | ✅ | 🔴 | Surfaced in location detail (`CreateAssetDialog`, `EditAssetDialog`). No E2E tests. |
| `department` CRUD | ✅ | 🟡 | `/dashboard/organization/departments/*` + `[id]` detail page. DepartmentHoursTab live. |
| `department_location` junction | ✅ | 🔴 | Schema + RLS live (migration `20260620120500_department_location_junction.sql`). Used by `create-routine-action.ts`. No admin UI yet, no E2E. |
| `department_operating_hours` | ✅ | 🟡 | `DepartmentHoursTab` reads/writes. `use-operating-hours.ts` hook. Season-activation E2E covers partial path. |
| `department_hours_override` | ✅ | 🔴 | Schema + RLS live. `use-hours-overrides.ts` hook. No dedicated E2E. |
| `planning_cycle` | 🟡 | 🟡 | Schema live. Year-wheel UI exists (`/dashboard/year-wheel`). Bootstrap service (onboarding Step 7) not yet wired. |
| `position` | ✅ | 🔴 | Schema live. Used via `schedule_shift.position_id → position.department_id`. No dedicated E2E. |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix across all domains: [../\_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement + operating-hours triple trap |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, FKs, enums, RLS, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | Flow index → journeys |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + ADR/journey refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test = proof of built |

## Agent Guardrails

> Read before touching core-structure code. Truth lives in this folder.

### TRIPLE operating-hours trap — HIGH RISK

Three tables exist. Only TWO are canonical. One is dead:

| Table | Status | Use |
|---|---|---|
| `department_operating_hours` | **CANONICAL** | Runtime truth. Read/write this one. `provenance JSONB`. |
| `department_hours_override` | **CANONICAL** | Per-date exceptions on top of `department_operating_hours`. |
| `workspace_operating_hours` | **Cascade B intermediate** | Workspace-level base; `use-workspace-operating-hours.ts` reads it as fallback. Superseded by department-level hours for runtime. |
| `company_opening_hours` | **Wizard-only input** | Onboarding wizard capture. NOT a runtime source. Post-finalize converts to `department_operating_hours`. |
| `operating_hours` | **LEGACY — NEVER USE** | Lives in migration `20260302152749_add_dashboard_evolution_tables.sql:69`. Table still exists in DB. No app code reads it; `HourFactorsTab.tsx:179` has a comment referencing it in comment only. Drop candidate. |

**Never read or write `operating_hours` table. Never read `company_opening_hours` as runtime truth.**

### Other hard rules

- **Never add `department.location_id`** — orthogonality rule. Use `department_location` junction (ADR-0367).
- **Never create empty workspaces** — I1 bootstrap (`packages/ai/src/industry/`) must seed at least 1 location + 1 department + 1 `department_location` row.
- **All structural mutations go through `gatedMutation`** (ADR-0204). No direct Supabase client writes from unguarded client components.
- **Mobile is read-only on structure** (ADR-0133). No authoring UIs on mobile.
- **Provenance on D1 tables**: `department_operating_hours` and `planning_event` carry `provenance JSONB NOT NULL DEFAULT '{}'`. Always populate when writing from I1 bootstrap or migration tools. Provenance identifies origin; cascade spec §2 requires it.
- **Cascade provenance pattern**: schema uses `provenance JSONB` (not discrete `source_type`/`source_id` columns). The cascade skill's "every record carries source_type + source_id" refers to the JSON content, not separate columns.

### Owning surfaces

- Tables: `department`, `location`, `zone`, `asset`, `department_location`, `position`, `department_operating_hours`, `department_hours_override`, `planning_cycle`, `workspace_operating_hours`
- Migrations: `supabase/migrations/00002_structure_tables.sql`, `20260421100200_cascade_a1_domain_tables.sql`, `20260422400000_cascade_b_schema.sql`, `20260620120500_department_location_junction.sql`
- Web routes: `apps/web/src/app/dashboard/organization/`, `apps/web/src/app/dashboard/year-wheel/`
- Hooks: `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts`, `use-workspace-operating-hours.ts`, `apps/web/src/app/dashboard/schedule/_hooks/use-hours-overrides.ts`
- I1 bootstrap: `packages/ai/src/industry/packages/hospitality.ts`
