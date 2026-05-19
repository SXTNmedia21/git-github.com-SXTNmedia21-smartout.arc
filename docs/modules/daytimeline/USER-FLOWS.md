---
title: Day Timeline — User Flows
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: daytimeline
tags: [module, daytimeline, user-flows, journeys]
---

# Day Timeline — User Flows

> Cross-reference to journey docs. Each row is one user-visible behaviour with role, status, and link.

## 1. Journey Index

| # | Journey | Role | Status | Source |
|---|---|---|---|---|
| J1 | Slot popover anchors at click coordinate | manager+ | shipped 2026-05-17 | [JOURNEY-timeline-slot-popover-anchors-at-click](../../journeys/JOURNEY-timeline-slot-popover-anchors-at-click.md) |
| J2 | Manager click-slot quick-add (booking/note/task/avvik/shift) | manager+ | verified | [JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot](../../journeys/JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot.md) |
| J3 | Manager wires task + avvik dialogs from picker | manager+ | shipped | [JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-task](../../journeys/JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-task.md) + sibling for avvik |
| J4 | Manager filters strip by scope (dept/team/location/shift) | manager+ | shipped | [JOURNEY-dagslinjen-quickadd-manager-filter-timeline](../../journeys/JOURNEY-dagslinjen-quickadd-manager-filter-timeline.md) |
| J5 | Manager sends targeted note from strip | manager+ | shipped | [JOURNEY-dagslinjen-quickadd-manager-target-note-fanout](../../journeys/JOURNEY-dagslinjen-quickadd-manager-target-note-fanout.md) + employee-receives sibling |
| J6 | Manager applies a saved timeline template | manager+ | shipped (ADR-0335) | [JOURNEY-timeline-templates](../../journeys/JOURNEY-timeline-templates.md) |
| J7 | Manager creates new location-anchored day-line | manager+ | **draft** | [JOURNEY-timeline-location-awareness-manager-create-day-line](../../journeys/JOURNEY-timeline-location-awareness-manager-create-day-line.md) |
| J8 | Manager edits opening/closing on a line | manager+ | **draft** | [JOURNEY-timeline-location-awareness-manager-edit-opening-closing](../../journeys/JOURNEY-timeline-location-awareness-manager-edit-opening-closing.md) |
| J9 | Manager adds single task at slot | manager+ | **draft** | [JOURNEY-timeline-location-awareness-manager-add-single-task](../../journeys/JOURNEY-timeline-location-awareness-manager-add-single-task.md) |
| J10 | Manager attaches a routine (hook + children) to line | manager+ | **draft** | [JOURNEY-timeline-location-awareness-manager-attach-routine](../../journeys/JOURNEY-timeline-location-awareness-manager-attach-routine.md) |
| J11 | Employee views only their assigned-location lines | employee | **draft** | [JOURNEY-timeline-location-awareness-employee-views-own-location](../../journeys/JOURNEY-timeline-location-awareness-employee-views-own-location.md) |
| J12 | Admin pivots across all locations on the day | admin+ | **draft** | [JOURNEY-timeline-location-awareness-admin-multi-location-overview](../../journeys/JOURNEY-timeline-location-awareness-admin-multi-location-overview.md) |

`shipped`/`verified` = code matches journey + tests pass. `draft` = aspirational, awaits BLUEPRINT phases.

---

## 2. Role Surfaces

| Role | Read | Write — today | Write — planned (post-blueprint) |
|---|---|---|---|
| **employee** | own-scope strip (mobile + web read-only) | complete tasks assigned to self; report deviations | unchanged |
| **manager** | own-dept strip | task/booking/note/avvik/shift in own dept; deviation resolve/escalate | + create day_line for own dept; edit own-line opening/closing; attach routine to own-line |
| **admin** | all strips | all manager writes, all depts; sign-off; close day | + create day_line for any dept/team/location; edit any opening/closing; bulk-attach routines |
| **owner** | all strips | all admin writes; authority config | unchanged |

---

## 3. Cross-Surface Flows

These flows span Day Timeline + sibling modules:

| Flow | Cross-module path | Journey |
|---|---|---|
| Targeted note → fanout to session channel | Day Timeline → Communication (Komm) | J5 |
| Deviation report → HMS list | Day Timeline → HMS module | (M5 sortie HANDOFFs) |
| Shift clock-in (mobile) → strip marker (web) | Mobile (clock) → Day Timeline | mobile clock journeys |
| Session close → Payroll snapshot | Day Timeline → Payroll module | ADR-0251 |
| Year-wheel planning_event → strip marker | Year-Wheel → Day Timeline | year-wheel journeys |
| Botsson voice "lag oppgave kl 14" → session_task | Voice (LiveKit) → task.create_session → strip | (voice journeys) |

---

## 4. Authoring Sequence — Slot-Click on Editable Strip (canonical)

```
1. Manager hovers HH:MM hit-zone → guide-line shows
2. Manager clicks → onSlotClick(time, rect) → TimelineTab stores rect → opens SlotPicker
3. SlotPicker renders 3 lanes, anchored at click via PopoverAnchor
4. Manager picks action → SlotPicker closes → dispatches to matching dialog
5. Dialog prefilled with slotTime + scope (dept/team/location from strip context)
6. Manager submits → Server Action → gate_action → DB insert → emit telemetry
7. Strip revalidates (queryKey "day-control/timeline-events") → new marker appears
```

This sequence is the same for every L1 mutation entry today and remains the same after the day_line model lands — only the dialogs gain a `day_line_id` prop in step 5.

---

## 5. Read Sequence — Mobile Day Route

```
1. User navigates to /(app)/(calendar)/day/YYYY-MM-DD
2. parseDateParam → Date local-midnight
3. useCalendarItems(date) fetches shifts + bookings + notes for date
4. useDayInfo(date) fetches handover note
5. useMyProfile loads viewer
6. Items absolute-positioned 08:00-24:00 in vertical ScrollView
7. NÅ-indicator (orange) shown for today only, computed from workspace.timezone
8. Tap on shift → drawer with shift details (no edits)
9. emit("calendar item_viewed", { actor_id, workspace_id, item_id }) — ADR-0134 fail-fast
```

Mobile remains read-only per ADR-0133. Multi-line stacking on mobile (J11) requires UI redesign; today the route assumes one cluster of items per date.

---

## 6. Authority Decision Points

Per ADR-0287 + ADR-0099, the gate checks at runtime:

```
gate_action(capability_key, { workspace_id, day_line_id?, department_id?, team_id? }) → {allow|deny, reason}
```

Manager-restriction enforcement order:
1. Server-derive `workspace_id` + `profile_id` via `getServerContext()` (ADR-0151).
2. Look up viewer's role in `(workspace_id, profile_id)` join.
3. Read `engine_authority_config` row for `(workspace_id, capability_key)`.
4. If `min_role` exceeded by viewer → allow. Else deny with reason `role_insufficient`.
5. If manager + `restrict_to_own_dept` flag → verify `department_id` in payload matches viewer's own; else deny `dept_mismatch`.
6. If `allowed_channels` does not include the inbound channel → deny `channel_forbidden` (ADR-0078).

Default-allow on missing row = **CVE class L-0066**. Every new capability gets a seed migration before the tool ships.

---

## 7. Error / Empty States

| Scenario | UI behaviour |
|---|---|
| No session for today | `NoSessionCTA.tsx` — "Start dagens session" button |
| Session reconciled (`status='closed'`) | strip read-only, edit affordances hidden |
| Scope filter yields zero events | `data-testid="timeline-empty-state"` block: "Ingen hendelser for valgt scope" |
| Authority denied at submit | toast with `gate_action.reason` translated to user-facing string |
| Network failure mid-write | dialog keeps state, retry button shown |
| Out-of-window event time | confirmation modal (planned for J9/J10) |
| Concurrent edit (409) | toast "Linjen ble oppdatert av en annen — last på nytt" + auto-refetch |
| Multi-location dept (today) | warning banner "Lokasjonsfilter viser kun vakter — hooks/oppgaver/notater er ikke lokasjons-merket" — explicit acknowledgement that the gap exists |

The last row is the bug we're chartered to close.
