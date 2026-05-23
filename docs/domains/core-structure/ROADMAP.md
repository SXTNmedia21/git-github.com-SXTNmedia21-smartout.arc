---
title: "Core Structure — Roadmap"
status: in_progress
mirror: aspirational
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: core-structure
tags: [domain, core-structure, roadmap, aspirational]
---

# Core Structure — Roadmap

> Forward plan + design intent. **This document is aspirational** — describes planned work, not built reality. Built reality lives in [ARCHITECTURE.md](./ARCHITECTURE.md) and [DATA-MODEL.md](./DATA-MODEL.md). Built-vs-planned delta lives in [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md).

## Governing ADRs

| ADR | Title | Impact on core-structure |
|---|---|---|
| [ADR-0367](../../decisions/0367-day-line-area-anchored-runtime.md) | Day Line Area-Anchored Runtime | Authoritative for V1 model — HVOR/HVEM orthogonality, `department_location` M:N junction, `day_line` anchors on `location`. **Delivered.** |
| [ADR-0075](../../decisions/0075-knowledge-system-consolidation.md) | Knowledge System Consolidation | Doc structure baseline |
| [ADR-0133](../../decisions/0133-mobile-surface-boundary.md) | Mobile Surface Boundary | Mobile read-only on structure — authoring is web-only |
| [ADR-0151](../../decisions/0151-server-resolved-ids.md) | Server-Resolved IDs | All workspace_id + structural IDs resolved server-side |
| [ADR-0204](../../decisions/0204-gated-mutation-pattern.md) | Gated Mutation Pattern | All structural mutations via `gatedMutation` |

## Planned phases

### Phase V1 — Structural foundation (largely delivered)

- [x] `department` + `location` + `zone` + `asset` + `position` schema + UI
- [x] `department_location` M:N junction schema + RLS
- [x] `department_operating_hours` canonical schema + DepartmentHoursTab UI
- [x] `department_hours_override` schema + hook
- [x] `workspace_operating_hours` Cascade B base layer
- [x] `planning_cycle` schema
- [x] I1 bootstrap seeding pipe (hospitality vertical)
- [x] Season-activation D1 fanout trigger
- [ ] `department_location` admin UI (`/dashboard/organization/departments/[id]/areas`)
- [ ] Planning cycle creation wired from onboarding Step 7 (`SeasonSetupStep`)
- [ ] Onboarding wizard conversion: `company_opening_hours` → `department_operating_hours` post-finalize

### Phase V2 — Structural depth

- [ ] Property layer: `location.location_kind enum('property','area')` + `parent_location_id` self-FK — requires ADR
- [ ] Zone shift-assignment wiring: `schedule_shift.zone_id` nullable FK + shift assignment UI zone picker
- [ ] `asset.requires_training` integration with D2 readiness checks
- [ ] `asset.requires_routine` integration with D6 day-line routine binding (`day_line_item.asset_id`)
- [ ] `location_operating_hours` if event-areas need independent schedules (V2 candidate)
- [ ] Seasonal positions and zones full lifecycle management

### Phase V3 — Multi-site

- [ ] Multi-site chain support: property → area → zone hierarchy
- [ ] Cross-workspace department templates
- [ ] Central standards + local overrides (K1a/K1b pattern for structural templates)

## Planned journeys

| Journey slug | When | Covers |
|---|---|---|
| `JOURNEY-core-structure-admin-setup` | With F7 dept-areas UI | Full admin structural setup F1–F7 |
| `JOURNEY-core-structure-hours` | Now | Operating hours management F3 + F9 |
| `JOURNEY-core-structure-dept-areas` | When F7 ships | Dept ↔ area pairing management |

## Drop candidate

`operating_hours` table (migration `20260302152749_add_dashboard_evolution_tables.sql:69`) — legacy table, no app reads it. Safe to `DROP TABLE operating_hours CASCADE` once confirmed via `pg_depend` check. Requires migration + no E2E failures. Recommend: dedicate a cleanup sortie.
