---
title: Journey — Manager Creates Day Line
status: accepted
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [journey, day-line, area-anchored, manager, create, adr-0367, d6]
---

# Journey: Manager Creates Day Line

> Captures the full create flow from DayLineCreateSheet through the capability layer to the query invalidation that renders the new strip on TimelineTab.
>
> Relevant ADRs: ADR-0367 (tri-layer D6 model), ADR-0151 (server-resolved IDs), ADR-0204 (gatedMutation), ADR-0287 (gate_action mandatory).

---

## Journey: Manager Creates Day Line for an Area

**Precondition:**
- Manager is authenticated and has a valid session token.
- A `department_session` exists for the current `(workspace, department, date)`.
- The department is linked to at least one area (location) via `department_location`.
- The target area does NOT yet have a `day_line` row for this session (unique constraint `uq_day_line` on `(department_session_id, location_id)` would block a duplicate).
- `engine_authority_config` has a seed entry for `day_line.create` granting manager+ access.

**Happy path:**

1. Manager navigates to the day view (`/dashboard/day/[date]`), selects a department session, and opens TimelineTab.
2. Manager sees an "Add area line" affordance in the `TimelineTopBar` (planned: `data-testid="day-line-create-trigger"`).
   → System: renders `DayLineCreateSheet` with area selector populated from `department_location` for the current department.
   → Manager sees: a sheet/drawer listing available areas for this department, each with name and current-day status (no existing day_line = available).
3. Manager selects a target area from the list and sets `planned_open` + `planned_close` (or accepts defaults resolved from `department_operating_hours`).
   → System: validates that `planned_open < planned_close`; both fields are required.
4. Manager submits the form.
   → System: calls `createDayLineAction` Server Action.
   → `createDayLineAction` calls the `day-line.create` capability tool.
   → Capability: resolves `workspace_id`, `department_session_id`, `department_id`, and `location_id` server-side (ADR-0151 — no body-supplied IDs trusted without server validation).
   → Capability: calls `gate_action('day_line.create', workspace_id, profile_id)` (ADR-0287 + ADR-0099). Gate returns ALLOW for manager+.
   → Capability: inserts one `day_line` row via `gatedMutation` (ADR-0204):
     ```
     day_line_id = gen_random_uuid()
     department_session_id = resolved from session context
     location_id = selected area
     planned_open / planned_close = form values or D1 defaults
     created_by = server-resolved profile_id
     ```
   → Capability: emits `day_line.created` event via `emit()` from `@smartout/telemetry`. Routes to PostHog + Logger + `activity_trail` + `engine_event` (ADR-0377).
5. `createDayLineAction` returns success.
   → System: TanStack Query mutation calls `invalidateQueries` on the day-timeline query key.
   → TimelineTab re-fetches and renders the new `DayLineStrip` for the selected area.
   → Manager sees: a new strip with the area name in the header, `planned_open`–`planned_close` band rendered on the time axis.

**Postcondition:**
- One new `day_line` row exists with `(department_session_id, location_id)` matching the manager's selection.
- No duplicate: attempting to create a second day_line for the same `(session, area)` pair returns a 409-equivalent (DB UNIQUE violation surfaced as capability error).
- `day_line.created` telemetry event is recorded in `activity_trail` and `engine_event`.
- TimelineTab shows the new strip.

**Error paths:**

| Condition | System behaviour | Manager sees |
|---|---|---|
| Duplicate area selected | Capability returns CONFLICT (23505 from DB UNIQUE); `createDayLineAction` surfaces error | Toast: "Det finnes allerede en dagslinje for dette området." |
| Manager does not have `department_location` membership for the target area | Gate check fails (ADR-0287) | Toast: "Ikke tilgang til dette området." |
| `gate_action` returns DENY | Capability aborts before mutation | Toast: "Mangler tillatelse til å opprette dagslinjer." |
| No `department_location` rows exist | Area selector empty | Sheet renders "Ingen tilgjengelige områder. Kontakt administrator." |
| Session already closed (`daily_reconciliation.status = 'closed'`) | Capability detects lock; mutation blocked | Toast: "Dagsøkten er avsluttet — ingen endringer mulig." |

**E2E coverage pointer:**
- Spec file (planned): `apps/e2e/day-line/day-line-create.spec.ts`
- Key selectors: `data-testid="day-line-create-trigger"`, `data-testid="day-line-area-select"`, `data-testid="day-line-strip-[location_id]"` (planned — testIDs assigned in Phase C UI work).
- Status: NOT YET WRITTEN — gated on Phase B capability code merge + Phase C UI merge.

**ADR refs:** ADR-0367 (Rule 1, Rule 7, Rule 10), ADR-0099, ADR-0114, ADR-0151, ADR-0204, ADR-0287, ADR-0377.
