---
title: "Journey — Employee sees only the day-lines for locations they work at today"
feature: timeline-location-awareness
journey: employee-views-own-location
status: draft
created: 2026-05-17
updated: 2026-05-17
module: MODULE_COMMUNICATION
tags: [journey, timeline, employee, read-only, location-scope, rls]
---

# Journey: Employee views their own location's lines

**Role:** employee (`canEdit = false`)

**Precondition:**
- Employee logged in via mobile or web.
- Employee has at least one `schedule_shift` row for the day with non-null `location_id` (and `department_id` or `team_id`).
- RLS policy `day_line_employee_read` filters `day_line` rows where the viewing profile has a shift at that `(location, dept|team)` today.

## Happy Path

1. Employee opens "Min Dag" (mobile) or Dagslinjen (web) → System fetches `day_line` rows joined to today's shifts via RLS → User sees only the strips matching their assignments.
2. If employee has 2 shifts at 2 different locations → System renders 2 stacked strips, each labeled `<location.name> · <dept|team.name> · <open>–<close>` → User can scroll between them.
3. Employee taps a task marker on the strip → System opens the read-only task drawer → User sees `title`, `due_time`, `owner`, completion checkbox if assigned to them.
4. Employee taps a hit-zone in editable area → `canEdit=false` short-circuits `handleSlotClick` → no popover opens; subtle haptic on mobile if applicable.

**Postcondition:** Employee sees only their own scope; no other location/department leaks. Tasks they own are actionable; tasks owned by others are read-only.

## Error Paths

- **No shifts today** → Empty state "Ingen vakter i dag — sjekk planen" + CTA to schedule view.
- **Shift exists but no day_line yet** → Empty state "Dagslinje ikke opprettet — kontakt leder" + manager-contact link.
- **RLS misconfigured (defensive)** → If query returns lines outside the employee's shift scope, client-side filter drops them and emits `"day_line rls_leak_detected"` for audit (defense-in-depth per ADR-0287).

## Verification

- [ ] RLS policy `day_line_employee_read` proves it filters by `(location_id, dept|team_id)` matching the viewer's `schedule_shift` for the day.
- [ ] Mobile and web both honor `canEdit=false` and hide editing affordances completely (no disabled buttons — just hidden).
- [ ] Multi-location employee sees stacked strips with no merge/collapse.
- [ ] E2E with mock RLS: employee at location A sees only line A; employee at locations A+B sees both.

**Mark `status: verified` when implementation lands.**

---

## Related

- Cascade: read-only on **D6** + **D1** + **D2**. C4 authority surface = none for employee.
- ADR ref: ADR-0133 (mobile boundary — employee view is approve/execute, never authoring), ADR-0287 (gate_action mandatory on mutation capability tools — defense-in-depth applies).
- Touches: `day_line` RLS policy,
  `apps/mobile/app/(app)/dag/index.tsx` (mobile day view),
  `apps/web/src/components/day/tabs/TimelineTab.tsx` (skip non-editable hit-zones).
