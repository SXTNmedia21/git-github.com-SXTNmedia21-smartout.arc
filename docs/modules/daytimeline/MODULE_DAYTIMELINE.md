---
title: Module — Day Timeline (Dagslinjen)
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: daytimeline
tags: [module, daytimeline, dagslinjen, d6, production, session, timeline, day-line]
---

# Module — Day Timeline (Dagslinjen)

> Authoritative module doc for Smartout's day-of-operations timeline surface. If code contradicts this doc → CODE wins, update this doc.

## 1. Overview

The Day Timeline ("Dagslinjen") is the **D6 Production canonical admin surface** for a single business date. It renders a horizontal time-axis (`planned_open` → `planned_close`) and overlays every event that materially affects the day: shifts, hooks, tasks, deviations, notes, bookings.

Today the surface is **department-anchored**: one `department_session` per department per day, one strip per session. The 2026-05-17 design directive expands this to **location-anchored** day-lines: each line owns its `(location, department|team)` pair, its own opening/closing, and its own slot picker. This module is the home for that evolution.

**Web entry point:** `apps/web/src/components/day/tabs/TimelineTab.tsx`
**Mobile entry point:** `apps/mobile/app/(app)/(calendar)/day/[date].tsx`
**Shell:** `apps/web/src/components/day/WebDayControl.tsx` (per ADR-0156)
**Read hook (web):** `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts`
**Read hook (mobile):** `apps/mobile/src/hooks/queries/use-calendar-items.ts`

---

## 2. Cascade Placement

Day Timeline is **D6 Production** — the runtime, mutable, "what is happening today" layer. It consumes data from:

| Dimension | What flows in | Where |
|---|---|---|
| **D1 Envelope** | `department`, `location`, `department_operating_hours` (computed → `planned_open`/`planned_close` on session creation) | Read via `useWorkspaceOperatingHours` + `department_operating_hours` |
| **D2 Resource** | `profile` (owner/assignee), `team` (filter scope), `schedule_absence`, `schedule_shift` | Joined into event rows |
| **D3 Rules** | `regulatory_framework` consulted at C1 reconciliation, not on the strip | indirect |
| **D4 Demand** | `planning_event`, day_factor, booking volume | future surface |
| **D5 Concept** | parameter coefficients (open-band band tinting per niche) | future |
| **D6 Production** | **all writes target here:** `department_session`, `session_hook`, `session_task`, `deviation`, `schedule_day_booking`, `schedule_day_info` | this module |
| **C1 Calibration** | `daily_reconciliation` locks the day for edits once `status='closed'` | read-only lock |
| **C4 Governance** | `engine_authority_config` gates every mutation via `gate_action` | enforced |

---

## 3. Surface Contract — Web

| Tab | Component | Role | Status |
|---|---|---|---|
| Oversikt | `OverviewTab.tsx` | day summary | shipped |
| Bemanning (Roster) | `RosterTab.tsx` | shifts | shipped |
| **Dagslinjen** | **`TimelineTab.tsx`** | **this module's primary surface** | shipped (dept-anchored) |
| Oppgaver | `TasksTab.tsx` | session_task management | shipped |
| Avvik | `DeviationsTab.tsx` | deviation review | shipped |
| Signoff | `SignoffTab.tsx` | end-of-day | shipped |
| Broadcast | `BroadcastTab.tsx` | message fanout | shipped |

`TimelineTab` composes:
- `TimelineTopBar` — scope filter (department / team / location / shift) + saved-templates dropdown
- `DayTimelineStrip` — the time-axis ribbon with hover/click hit-zones (15-min slots)
- `SlotPicker` — 3-lane popover (PRODUKSJON / BEMANNING / FRI TEKST) anchored at click point per `JOURNEY-timeline-slot-popover-anchors-at-click`
- `DayEventList` — flat-list mirror of strip markers
- `EventDetailPanel` — inline editor for selected event
- Dialogs: `AddTaskDialog`, `ShiftStartDialog`, `DeviationDialog`, `ReservationSheet`, `DailyNoteSheet`, `FreeFormChipDialog`

---

## 4. Surface Contract — Mobile

| Route | File | Role | Status |
|---|---|---|---|
| `(app)/(calendar)/day/[date]` | `app/(app)/(calendar)/day/[date].tsx` | day view | shipped (read-only) |
| `(app)/(me)/tasks/[id]` | `app/(app)/(me)/tasks/[id].tsx` | task detail / complete | shipped (server-action wired) |

Mobile is **read-only per ADR-0133** (mobile = Approve/Execute surface, not Author/Compose). The day route renders an 08:00–24:00 vertical timeline with absolute-positioned items from `useCalendarItems`. There is no slot-click affordance on mobile; authoring stays web.

What mobile DOES do on the day:
- Witness shifts (clock-in / clock-out via shift-clock surface)
- Complete `session_task` rows assigned to the viewer
- Report deviations
- View day-info / handover notes

---

## 5. Authority Surface — C4

Every mutation on the Day Timeline gates via `gate_action`:

| Capability key | Mutation | Required role | Channel |
|---|---|---|---|
| `task.create_session` | new session_task at slot | manager+ | chat |
| `task.complete` | complete session_task | employee+ | chat + voice |
| `hms.update_deviation_manual` | edit deviation | manager+ | chat |
| `hms.escalate_deviation` | escalate deviation | manager+ | chat |
| `operations.session_start` | open day's session | manager+ | chat |
| `timeline.create_day_line` | **(planned)** new day_line | manager+ | chat |
| `timeline.edit_opening_closing` | **(planned)** adjust hours | manager+ | chat |
| `routine.attach_to_line` | **(planned)** attach hook+children template | manager+ | chat |

ADR-0287 + ADR-0204 are load-bearing. No Server Action writes outside `gatedMutation`. No body-supplied `workspace_id` or `profile_id` per ADR-0151.

---

## 6. Invariants

These hold today on the dept-anchored model:

1. **One session per (workspace, department, date)** — DB UNIQUE constraint `uq_dept_session_date`.
2. **All event rows reference `workspace_id`** — RLS gate.
3. **`session_task.session_hook_id = NULL` means single (ad-hoc) task** — children of routines carry the FK.
4. **`session_task` lives under `department_session_id`** — no orphan tasks at the day level.
5. **`planned_open` / `planned_close` are TIME, nullable, populated at session creation** — Cascade A1 (migration `20260421100350`).
6. **C1 reconciliation locks `department_session.status='closed'`** — no edits after.

The planned location-anchored model adds:

7. **(planned)** Every `day_line` has mandatory `location_id` + `(department_id XOR team_id)`.
8. **(planned)** Every `session_hook` + `session_task` + `deviation` inherits `(location_id, dept_id|team_id)` from `day_line` server-side (per ADR-0151).
9. **(planned)** UNIQUE `(workspace_id, business_date, location_id, department_id, team_id)` on `day_line`.

See [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) for the delta between today and target.

---

## 7. Reading Order

| # | Doc | Purpose |
|---|---|---|
| 1 | [MODULE_DAYTIMELINE.md](./MODULE_DAYTIMELINE.md) | This file — overview, placement, invariants |
| 2 | [DATA-MODEL.md](./DATA-MODEL.md) | All tables the surface touches + FK map |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Code map: web + mobile + capabilities + telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | The 7 journeys (anchored + 6 location-awareness flows) |
| 5 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | Verified-working vs aspirational + concrete code gaps |
| 6 | [BLUEPRINT.md](./BLUEPRINT.md) | Target state, 6 phases, falsifiable acceptance |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | Web + mobile test coverage + holes |

---

## 8. Cross-References

### ADRs
- **Accepted:** [ADR-0156](../../decisions/0156-day-control-panel-canonical-admin-surface.md), [ADR-0069](../../decisions/0069-session-execution-ownership.md), [ADR-0096](../../decisions/0096-schedule-shift-vs-department-session.md), [ADR-0187](../../decisions/0187-session-state-events-single-emit-source.md), [ADR-0273](../../decisions/0273-deviation-day-info-server-action-migration.md), [ADR-0297](../../decisions/0297-workforce-snapshot-session-bootstrap.md), [ADR-0298](../../decisions/0298-task-ontology-five-sources.md), [ADR-0334](../../decisions/0334-ephemeral-presence-supabase-broadcast.md), [ADR-0335](../../decisions/0335-timeline-templates-d6-authoring.md)
- **Adjacent:** ADR-0078 (channel restrictions), ADR-0099 (gate_action), ADR-0114 (Server Actions), ADR-0132 (mobile AI routing), ADR-0133 (mobile boundary), ADR-0151 (server-resolved IDs), ADR-0204 (gatedMutation), ADR-0287 (gate_action mandatory on mutation capability tools)
- **Proposed (this module):** TBD — council-class change for location-anchored day_line model. Slot reserved post-council 2026-05-17 timeline-location-awareness session.

### Journeys
- [JOURNEY-timeline-slot-popover-anchors-at-click](../../journeys/JOURNEY-timeline-slot-popover-anchors-at-click.md) — shipped 2026-05-17
- [JOURNEY-timeline-location-awareness-manager-create-day-line](../../journeys/JOURNEY-timeline-location-awareness-manager-create-day-line.md) — draft
- [JOURNEY-timeline-location-awareness-manager-edit-opening-closing](../../journeys/JOURNEY-timeline-location-awareness-manager-edit-opening-closing.md) — draft
- [JOURNEY-timeline-location-awareness-manager-add-single-task](../../journeys/JOURNEY-timeline-location-awareness-manager-add-single-task.md) — draft
- [JOURNEY-timeline-location-awareness-manager-attach-routine](../../journeys/JOURNEY-timeline-location-awareness-manager-attach-routine.md) — draft
- [JOURNEY-timeline-location-awareness-employee-views-own-location](../../journeys/JOURNEY-timeline-location-awareness-employee-views-own-location.md) — draft
- [JOURNEY-timeline-location-awareness-admin-multi-location-overview](../../journeys/JOURNEY-timeline-location-awareness-admin-multi-location-overview.md) — draft
- Adjacent: `JOURNEY-dagslinjen-quickadd-*` (slot-quickadd flows), `JOURNEY-timeline-templates.md`

### Code locations
- Web TimelineTab: `apps/web/src/components/day/tabs/TimelineTab.tsx`
- Web strip: `apps/web/src/components/day/DayTimelineStrip.tsx`
- Web picker: `apps/web/src/components/day/SlotPicker.tsx`
- Web tools-bridge: `apps/web/src/components/day/_tools/oversikt-tools-bridge.tsx`
- Web actions: `apps/web/src/app/dashboard/_actions/{add-task,add-booking,create-day-info,create-targeted-note,report-deviation,update-deviation,toggle-session-task,complete-session-task}-action.ts`
- Mobile day route: `apps/mobile/app/(app)/(calendar)/day/[date].tsx`
- Mobile day-info hook: `apps/mobile/src/hooks/queries/use-day-info.ts`
- Capabilities: `packages/ai/src/capabilities/{task,operations,operations-intelligence}/`
- Telemetry: `packages/telemetry/src/registry.ts` (search `"session_task "`, `"session_hook "`, `"day_line"`)
- Schema: `supabase/migrations/20260304200000_department_session.sql`, `20260412100300_session_infrastructure.sql`, `20260421100350_cascade_a1_alter_existing.sql`

### Sibling modules
- `MODULE_COMMUNICATION` — Komm channels (session channel auto-created per `department_session`)
- `MODULE_YEAR_WHEEL_PRD` — D4 planning surface (feeds demand into the day)
- `payroll/MODULE_PAYROLL` — consumes D6 production rows for C3 ledger

---

## 9. Authoring Rules

- All Day Timeline mutations gate via `gatedMutation` (ADR-0204).
- All mutations emit telemetry through `emit()` from `@smartout/telemetry`; never duplicate the channel registry.
- All ID derivation is server-side per ADR-0151 — body-supplied `workspace_id` / `profile_id` is rejected.
- Mobile day route is read-only per ADR-0133 — no new authoring affordances.
- New write paths must add a journey doc + e2e test before merge.
- Location-awareness work is council-class — no merge without an accepted ADR for the day_line model.
