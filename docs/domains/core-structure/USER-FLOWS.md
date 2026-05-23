---
title: "Core Structure — User Flows"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: core-structure
tags: [domain, core-structure, user-flows, journeys]
---

# Core Structure — User Flows

> Flow index. Links to `docs/journeys/<slug>/`. Does NOT duplicate journey content.

## Flow index

| # | Flow | Role | Status | Journey file |
|---|---|---|---|---|
| F1 | Set up workspace structure at onboarding (I1 bootstrap) | Owner/Admin | ✅ built (I1 auto-seeds) | No dedicated journey yet — covered in onboarding journey |
| F2 | Create / edit a department | Admin | ✅ built | — |
| F3 | Set department operating hours | Admin | ✅ built (DepartmentHoursTab) | — |
| F4 | Create / edit a location (area) | Admin | ✅ built | — |
| F5 | Add a zone within a location | Admin | ✅ built (CreateZoneDialog) | — |
| F6 | Add an asset within a location | Admin | ✅ built (CreateAssetDialog) | — |
| F7 | Manage department ↔ area pairings | Admin | 🔴 no UI yet (schema live, read by governance) | — |
| F8 | Create a planning cycle (year wheel) | Admin | 🟡 partial (year-wheel UI exists; onboarding Step 7 not wired) | — |
| F9 | Set a date-specific hours override | Admin | 🟡 hook exists; no dedicated UI | — |

## Flows in detail

### F1 — Workspace structure bootstrap

- **Actor:** System (I1 bootstrap) + Owner (niche selection)
- **Trigger:** New workspace first login, onboarding wizard starts
- **System behavior:** `packages/ai/src/industry/packages/hospitality.ts` seeds departments + locations + `department_location` pairings + default operating hours via restaurant SQL templates
- **Postcondition:** Workspace has ≥1 department, ≥1 location, ≥1 `department_location` pairing, default `department_operating_hours`

### F2 — Create / edit department

- **Route:** `/dashboard/organization` → Departments tab → "Legg til avdeling" button
- **Code path:** `DepartmentsTab` component → Supabase `.from("department").insert(…)`
- **Telemetry:** `"department created"` / `"department updated"` emitted
- **Gate:** admin+ only; no mobile authoring

### F3 — Set department operating hours

- **Route:** `/dashboard/organization/departments/[id]` → Hours tab
- **Code path:** `DepartmentHoursTab.tsx` → `use-operating-hours.ts:94` (read) + `:161` (write `department_operating_hours`)
- **Telemetry:** `"operating_hours updated"` emitted at `use-operating-hours.ts:169`
- **Gate:** admin+

### F4 — Create / edit location

- **Route:** `/dashboard/organization` → Locations tab → create/edit dialogs
- **Code path:** `LocationsTab` → Supabase `.from("location")`
- **Telemetry:** `"location created"` / `"location updated"` emitted
- **Gate:** admin+

### F5 — Add zone within location

- **Route:** `/dashboard/organization/locations/[id]` → Zones section
- **Code path:** `CreateZoneDialog` → Supabase `.from("zone")` (location detail page `:56`)
- **Telemetry:** no event yet (gap — see GAPS-AND-DEBT.md §G-05)
- **Gate:** admin+

### F6 — Add asset within location

- **Route:** `/dashboard/organization/locations/[id]` → Assets section
- **Code path:** `CreateAssetDialog` → Supabase `.from("asset")` (location detail page `:62`)
- **Telemetry:** no event yet (gap — see GAPS-AND-DEBT.md §G-05)
- **Gate:** admin+

### F7 — Manage department ↔ area pairings

- **Status:** Schema + RLS live (`department_location` table), read by governance create-routine-action
- **UI:** NOT YET BUILT — `/dashboard/organization/departments/[id]/areas` planned
- **Gate:** admin+ via `is_admin_in_workspace`
- **Note:** I1 bootstrap seeds initial pairings. Admin cannot modify them yet via UI.

### F8 — Create / manage planning cycle

- **Route:** `/dashboard/year-wheel`
- **Code path:** Year-wheel page + `SeasonQuickCreateSheet` → creates season linked to planning_cycle
- **Gap:** Onboarding Step 7 (`SeasonSetupStep`) not yet wired to create `planning_cycle` + `department_operating_hours` from bootstrap (spec §595 — see GAPS-AND-DEBT.md §G-03)

### F9 — Set date-specific hours override

- **Status:** `department_hours_override` schema live + `use-hours-overrides.ts` hook exists
- **UI:** Accessible from schedule view (`use-hours-overrides.ts` in `apps/web/src/app/dashboard/schedule/_hooks/`)
- **No dedicated admin flow** — overrides surfaced as part of schedule planning context, not org admin

## Journey stubs needed

| Journey | Priority | Covers |
|---|---|---|
| `JOURNEY-core-structure-admin-setup.md` | HIGH | F1–F6: full admin structural setup |
| `JOURNEY-core-structure-hours.md` | HIGH | F3 + F9: operating hours management |
| `JOURNEY-core-structure-dept-areas.md` | MEDIUM | F7 when UI ships |
