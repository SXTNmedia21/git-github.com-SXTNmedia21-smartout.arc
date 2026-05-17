---
title: "Journey — Manager adds a single ad-hoc task to a slot, scoped to the line's location + dept/team"
feature: timeline-location-awareness
journey: manager-add-single-task
status: draft
created: 2026-05-17
updated: 2026-05-17
module: MODULE_COMMUNICATION
tags: [journey, timeline, task, single-task, slot-picker, location-scope]
---

# Journey: Manager adds a single task at a slot

**Role:** manager | admin | owner

**Precondition:**
- A `day_line` exists for the day, bound to `(location, department|team)`.
- Authority gate `task.create_session` granted.
- User hovering the strip belonging to that line.

## Happy Path

1. Manager clicks a hit-zone at `14:15` → System fires `onSlotClick("14:15", DOMRect)` from `DayTimelineStrip` → opens `SlotPicker` anchored at the click (see [JOURNEY-timeline-slot-popover-anchors-at-click](JOURNEY-timeline-slot-popover-anchors-at-click.md)).
2. Manager picks "Oppgave" in the PRODUKSJON lane → System closes `SlotPicker` and opens `AddTaskDialog` with two-tab header "Enkeltoppgave | Rutine" → "Enkeltoppgave" tab is active by default → fields prefilled: `due_time=14:15`, `day_line_id=<current>`, `location_id` + `(dept|team)_id` inherited from the line.
3. Manager fills `title`, optional `owner`, optional `is_compliance_required`, mandatory `reason ≥ 8 chars` → System validates each blur.
4. Manager clicks "Opprett oppgave" → System calls Server Action `addTaskAction` → calls capability tool `task.create_session` with `{ day_line_id, location_id, department_id|team_id, due_time, title, owner_id, is_compliance_required, reason }` → wraps `gate_action("task.create_session", ...)`.
5. System emits `"task.added_manual"` telemetry (canonical creation event under `task.*` namespace per ADR-0298) with `day_line_id`, `location_id`, `department_id|team_id` in metadata → revalidates `useDayTimelineEvents` → User sees a new task marker at `14:15` on the strip, inheriting the line's location color.

**Postcondition:** `session_task` row created with `location_id` + `(department_id OR team_id)` mandatory-non-null, and `session_hook_id = NULL` (= single, not part of routine). The task appears in the line's strip and in the line's `DayEventList`.

## Error Paths

- **No day_line for the day** → SlotPicker shows tooltip "Opprett dagslinje først" on the Oppgave button + button disabled.
- **Reason < 8 chars** → Submit disabled, helper "Begrunnelse må være minst 8 tegn".
- **gate_action denies** → toast "Mangler tilgang til denne lokasjonen" + emit `"session_task create_denied"`.
- **Task time outside line's open/close window** → Confirmation "Tidspunkt er utenfor åpningstid — bekrefte?" → User confirms or cancels.
- **Owner not in this dept/team** → Owner select pre-filters to line's resource scope so this never appears; admin override visible only to admin/owner.
- **Network failure mid-submit** → Dialog keeps state; retry button; no double-emit.

## Verification

- [ ] `session_task` schema has mandatory `location_id` + `CHECK (department_id IS NOT NULL OR team_id IS NOT NULL)`.
- [ ] `task.create_session` capability tool resolves `location_id` server-side from `day_line_id` (ADR-0151: never trust body).
- [ ] AddTaskDialog defaults to "Enkeltoppgave" tab, prefills from clicked slot.
- [ ] Out-of-window confirmation modal renders + can be dismissed without losing form state.
- [ ] E2E happy path + each error path.

**Mark `status: verified` when implementation lands.**

---

## Related

- Sibling: [manager-attach-routine](JOURNEY-timeline-location-awareness-manager-attach-routine.md) — the other branch of the same slot-picker entry.
- Cascade: **D6** (production task), inherits **D1** (location) + **D2** (dept|team).
- ADR ref: ADR-0151 (server-resolved IDs), ADR-0204 (gatedMutation), ADR-0298 (Task Ontology — task.create_session is the canonical write).
- Touches: `apps/web/src/components/day/AddTaskDialog.tsx` (new tab),
  `apps/web/src/app/dashboard/_actions/add-task-action.ts` (location/team plumbing),
  `packages/ai/src/capabilities/task/tools.ts` (`create_session` body).
