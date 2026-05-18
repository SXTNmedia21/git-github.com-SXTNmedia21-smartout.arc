---
title: Module — Day Timeline (Dagslinjen)
status: in_progress
updated: 2026-05-18
created: 2026-05-17
module: daytimeline
tags: [module, daytimeline, dagslinjen, d6, production, session, timeline, day-line, area-anchored, adr-0367]
---

# Module — Day Timeline (Dagslinjen)

> Authoritative module doc for Smartout's day-of-operations timeline surface. If code contradicts this doc → CODE wins, update this doc.

## 1. Overview

The Day Timeline ("Dagslinjen") is the **D6 Production canonical admin surface** for a single business date. It renders a horizontal time-axis (`planned_open` → `planned_close`) per area and overlays every event that materially affects the day: shifts, hooks, tasks, deviations, notes, bookings.

The 2026-05-18 model (ADR-0367) is a **tri-layer D6 stack**: `department_session` (aggregate, exists) → `day_line` (program per area, NEW) → `shift_session` (per-employee runtime, NEW). Each `day_line` is uniquely identified by `(department_session_id, location_id)` where `location` is treated as **area** per the Core Structure module. Existing `session_hook`, `session_task`, `schedule_day_booking`, `deviation` gain a nullable `day_line_id` FK — when set, the item is area-anchored; when NULL, the item is department-level (e.g. open/close routines not pinned to an area).

Today the surface is **department-anchored** (one `department_session` per department per day, one strip per session). Migration target is **area-anchored** with multi-strip stack per session. See [BLUEPRINT.md](./BLUEPRINT.md) for the phased delivery and `docs/superpowers/specs/2026-05-18-dagslinje-area-anchored-design.md` for the spec.

**Web entry point:** `apps/web/src/components/day/tabs/TimelineTab.tsx`
**Mobile entry point:** `apps/mobile/app/(app)/(calendar)/day/[date].tsx`
**Shell:** `apps/web/src/components/day/WebDayControl.tsx` (per ADR-0156)
**Read hook (web):** `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts`
**Read hook (mobile):** `apps/mobile/src/hooks/queries/use-calendar-items.ts`

---

## 2. Cascade Placement

Day Timeline is **D6 Production** — the runtime, mutable, "what is happening today" layer. Three D6 tables form the tri-layer:

```
department_session  (aggregate, exists)
  ├── day_line       (program per area, NEW per ADR-0367)
  │     └── items (session_hook / session_task / schedule_day_booking / deviation with day_line_id set)
  └── shift_session  (per-employee runtime, NEW per ADR-0367)
        └── shift_session_day_line (M:N join to day_line for push routing)
```

Inputs:

| Dimension | What flows in | Where |
|---|---|---|
| **D1 Envelope** | `department`, `location` (area), `department_operating_hours` (computed → `planned_open`/`planned_close` per day_line on session creation), `department_location` (M:N from ADR-0367) | Read via `useWorkspaceOperatingHours` + `department_operating_hours`; junction read at day_line creation |
| **D2 Resource** | `profile` (owner/assignee), `team` (filter scope), `schedule_absence`, `schedule_shift` | Joined into item rows; `shift_session` derives from shift |
| **D3 Rules** | `regulatory_framework` consulted at C1 reconciliation, not on the strip | indirect |
| **D4 Demand** | `planning_event`, day_factor, booking volume | future surface |
| **D5 Concept** | parameter coefficients (open-band band tinting per niche), `timeline_template` (day_line source) | template via `timeline_template.scope_type='location'` |
| **D6 Production** | **all writes target here:** `department_session` (aggregate, untouched in V1), `day_line` (NEW), `shift_session` (NEW), `session_hook`, `session_task`, `deviation`, `schedule_day_booking`, `schedule_day_info` | this module |
| **C1 Calibration** | `daily_reconciliation` locks the day for edits once `status='closed'`; cascades to day_line + shift_session via parent session FK | read-only lock |
| **C4 Governance** | `engine_authority_config` gates every mutation via `gate_action`; three new capabilities introduced: `day_line.create`, `day_line.add_item`, `day_line.instantiate_template` | enforced |

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
| `task.create_session` | new session_task at slot (accepts optional `day_line_id` post-0367) | manager+ | chat |
| `task.complete` | complete session_task | employee+ | chat + voice |
| `hms.update_deviation_manual` | edit deviation | manager+ | chat |
| `hms.escalate_deviation` | escalate deviation | manager+ | chat |
| `operations.session_start` | open day's session | manager+ | chat |
| `day_line.create` | **(planned ADR-0367)** new day_line for (session, area) | manager+ | chat |
| `day_line.add_item` | **(planned ADR-0367)** delegates to task/booking/note writers with `day_line_id` set | manager+ | chat |
| `day_line.instantiate_template` | **(planned ADR-0367)** expand `timeline_template` rows onto a day_line | manager+ | chat |
| `routine.attach_to_line` | **(planned)** attach hook+children to a day_line (cross-namespace delegation per ADR-0240) | manager+ | chat |
| `org.update_dept_areas` | **(planned ADR-0367)** add/remove `department_location` pairing | admin+ | chat |
| `shift-lifecycle.clock_in` | **(extension ADR-0367)** flip `shift_session.status` + subscribe push topic | self | mobile |
| `shift-lifecycle.clock_out` | **(extension ADR-0367)** flip + unsubscribe | self | mobile |

ADR-0287 + ADR-0204 + ADR-0367 are load-bearing. No Server Action writes outside `gatedMutation`. No body-supplied `workspace_id`, `profile_id`, or `department_id` per ADR-0151. `day_line_id` may be passed in tool input but is validated against parent `department_session_id` server-side.

---

## 6. Invariants

These hold today on the dept-anchored model:

1. **One session per (workspace, department, date)** — DB UNIQUE constraint `uq_dept_session_date`.
2. **All event rows reference `workspace_id`** — RLS gate.
3. **`session_task.session_hook_id = NULL` means single (ad-hoc) task** — children of routines carry the FK.
4. **`session_task` lives under `department_session_id`** — no orphan tasks at the day level.
5. **`planned_open` / `planned_close` are TIME, nullable, populated at session creation** — Cascade A1 (migration `20260421100350`).
6. **C1 reconciliation locks `department_session.status='closed'`** — no edits after.

The planned area-anchored tri-layer model (ADR-0367) adds:

7. **(planned ADR-0367)** Every `day_line` has mandatory `location_id` (area) + `department_id`. Team is NOT an axis V1 (deferred).
8. **(planned ADR-0367)** Every `day_line` row references a parent `department_session_id NOT NULL`. UNIQUE `(department_session_id, location_id)`.
9. **(planned ADR-0367)** Every `session_hook` + `session_task` + `deviation` + `schedule_day_booking` gains a nullable `day_line_id` FK. NULL = department-level (open/close routines), non-NULL = area-anchored.
10. **(planned ADR-0367)** `shift_session` exists per `schedule_shift` (UNIQUE on `schedule_shift_id`) with auto-bind to matching `day_line` rows via `shift_session_day_line` junction.
11. **(planned ADR-0367)** Push routing via `shift_session.push_topic` + `engine_event` idempotency.
12. **(planned ADR-0367)** `department_location` M:N junction is the only source of truth for "which dept staffs which area".

See [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) for the delta between today and target, and [BLUEPRINT.md](./BLUEPRINT.md) for the phased delivery.

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

## 8. Tri-Layer Model — ADR-0367

> This section captures the model introduced by ADR-0367 (accepted 2026-05-18). It supersedes the prior single-strip department-anchored model. All new work on the Day Timeline must conform to this model.

### 8.1 Layer structure

```
department_session  [AGGREGATE — exists, untouched]
  │   One per (workspace, department, date). Owns payroll aggregate +
  │   C1 reconciliation + signoff + lock. NEVER duplicated.
  │
  ├── day_line      [PROGRAM — NEW per ADR-0367]
  │     One per (department_session, location/area). Carries own
  │     planned_open + planned_close. The canonical "what happens at
  │     this area today" object. Children: session_task, deviation,
  │     schedule_day_booking each gain a nullable day_line_id FK.
  │     NULL day_line_id on a child = department-level item (e.g.
  │     open/close routine not pinned to any area).
  │
  └── shift_session [RUNTIME — NEW per ADR-0367]
        One per schedule_shift (UNIQUE on schedule_shift_id). Created
        by trigger on shift insert/update. Lifecycle (scheduled →
        clocked_in → clocked_out) managed by shift-lifecycle capability.
        push_topic field drives Expo push routing.
        │
        └── shift_session_day_line (M:N junction)
              Populates at shift insert by joining on
              (business_date, department_id, location_id).
              Drives mobile read scope + push fan-out.
```

`session_hook` is a **template**, NOT a per-session instance. It does NOT receive `day_line_id` (ADR-0367 Rule 2). The session_tasks created when a hook fires DO inherit `day_line_id` at materialization time.

### 8.2 What changed in ADR-0367

| Area | Before ADR-0367 | After ADR-0367 |
|---|---|---|
| **Schema** | `department_session` is the only D6 anchor per day. No `day_line`, no `shift_session`. | Three new tables: `day_line`, `shift_session`, `shift_session_day_line`. One new junction: `department_location`. Nullable `day_line_id` FK added to `session_task`, `deviation`, `schedule_day_booking`. |
| **Open/close band** | One `planned_open`/`planned_close` per department per day (on `department_session`). | Per-area band on each `day_line`. Manager edits via `day-line.update_hours` capability → emits `day_line.opening_changed` / `day_line.closing_changed`. |
| **Location awareness** | Warning banner on `TimelineTab.tsx:238-249`: "hooks/oppgaver/notater er ikke lokasjons-merket." Filter returned only shift markers. | Items anchored via `day_line_id`. Defensive client-side filter on mobile drops foreign items + emits `shift_session.item_leak_detected` on anomaly. |
| **Mobile employee view** | Single vertical timeline 08:00–24:00 with absolute-positioned items. No area grouping. | Multi-area section list grouped by `day_line` (area). Employee sees only their linked areas via `shift_session_day_line`. |
| **Push notifications** | No time-anchored push for day items. | Engine-dispatch 1-min cron fans out push to clocked-in employees per `shift_session_day_line`. Idempotency via `engine_event.idempotency_key = '<task_id>:<shift_session_id>'`. |
| **Capabilities** | No `day-line.*` capability namespace. | Three new tools: `day-line.create`, `day-line.add_item`, `day-line.instantiate_template`. Two adjacent: `routine.attach_to_line`, `org.update_dept_areas`. |
| **Telemetry events** | No `day_line.*` or `shift_session.*` events in registry. | 9 new events: `day_line.created`, `day_line.opening_changed`, `day_line.closing_changed`, `day_line_item.added`, `day_line_item.notified`, `shift_session.bound`, `shift_session.clocked_in`, `shift_session.clocked_out`, `routine.attached`. |
| **status on day_line** | N/A (no table) | Derived at read time from `(parent department_session.status, daily_reconciliation.locked, day_line.cancelled_at)`. No stored `day_line_status` column — follows ADR-0156 precedent, avoids dual-source-of-truth drift. Helper: `apps/web/src/lib/cascade/derive-day-line-status.ts`. |
| **Core Structure** | `location` table semantically overloaded. No `department_location` junction. | `location` = area (semantic rename in docs only; table name unchanged). `department_location` M:N junction added. Department↔area membership is the source of truth for which depts staff which areas. |

### 8.3 Delivery phases

| Phase | Scope | Status |
|---|---|---|
| A | Schema + RLS + backfill + `department_location` | Shipped |
| B | Capabilities + Server Actions + triggers + telemetry registry | Shipped |
| C | UI rewire (TimelineTab multi-strip, dialogs) | In flight |
| D | Mobile (shift_session read + push topic + multi-area sections) | In flight |
| E | Push pipeline (engine-dispatch extension) | In flight |
| F | Journey docs + E2E + module doc updates | This PR |

See [BLUEPRINT.md](./BLUEPRINT.md) for falsifiable acceptance per phase.

---

## 9. Cross-References

### ADRs
- **Accepted:** [ADR-0156](../../decisions/0156-day-control-panel-canonical-admin-surface.md), [ADR-0069](../../decisions/0069-session-execution-ownership.md), [ADR-0096](../../decisions/0096-schedule-shift-vs-department-session.md), [ADR-0187](../../decisions/0187-session-state-events-single-emit-source.md), [ADR-0273](../../decisions/0273-deviation-day-info-server-action-migration.md), [ADR-0297](../../decisions/0297-workforce-snapshot-session-bootstrap.md), [ADR-0298](../../decisions/0298-task-ontology-five-sources.md), [ADR-0334](../../decisions/0334-ephemeral-presence-supabase-broadcast.md), [ADR-0335](../../decisions/0335-timeline-templates-d6-authoring.md), [ADR-0358](../../decisions/0358-telemetry-registry-requires-emit-wiring.md), [ADR-0366](../../decisions/0366-nordic-split-oklch-literal-ban.md)
- **Adjacent:** ADR-0078 (channel restrictions), ADR-0099 (gate_action), ADR-0114 (Server Actions), ADR-0132 (mobile AI routing), ADR-0133 (mobile boundary), ADR-0134 (mobile telemetry contract), ADR-0151 (server-resolved IDs), ADR-0204 (gatedMutation), ADR-0240 (cross-namespace delegation), ADR-0287 (gate_action mandatory on mutation capability tools)
- **Accepted:** [ADR-0367](../../decisions/0367-day-line-area-anchored-runtime.md) — **authoritative for tri-layer model** (Day Line Area-Anchored Runtime + Core-Structure Clarification). Replaces earlier "location_id XOR team_id" slot reservation. See §8 Tri-Layer Model for full change summary.

### Journeys

**ADR-0367 Phase F journeys (accepted 2026-05-18):**

- [JOURNEY-day-line-create](../../journeys/JOURNEY-day-line-create.md) — Manager creates day_line via DayLineCreateSheet → `day-line.create` capability → emit `day_line.created`
- [JOURNEY-day-line-edit-hours](../../journeys/JOURNEY-day-line-edit-hours.md) — Manager edits planned_open/close → `day-line.update_hours` → emit `day_line.opening_changed` / `day_line.closing_changed`
- [JOURNEY-day-line-attach-routine](../../journeys/JOURNEY-day-line-attach-routine.md) — Manager attaches timeline_template → cross-namespace Pattern B chain → emit `routine.attached`
- [JOURNEY-day-line-employee-view-mobile](../../journeys/JOURNEY-day-line-employee-view-mobile.md) — Employee mobile day route, multi-area sections, defensive client-side filter, leak detection
- [JOURNEY-day-line-push](../../journeys/JOURNEY-day-line-push.md) — Engine-dispatch 1-min tick, shift_session fan-out, idempotency via engine_event, emit `day_line_item.notified`

**Shipped:**

- [JOURNEY-timeline-slot-popover-anchors-at-click](../../journeys/JOURNEY-timeline-slot-popover-anchors-at-click.md) — shipped 2026-05-17

**Draft (legacy location-awareness naming — superseded by ADR-0367 F journeys above):**

- [JOURNEY-timeline-location-awareness-manager-create-day-line](../../journeys/JOURNEY-timeline-location-awareness-manager-create-day-line.md)
- [JOURNEY-timeline-location-awareness-manager-edit-opening-closing](../../journeys/JOURNEY-timeline-location-awareness-manager-edit-opening-closing.md)
- [JOURNEY-timeline-location-awareness-manager-add-single-task](../../journeys/JOURNEY-timeline-location-awareness-manager-add-single-task.md)
- [JOURNEY-timeline-location-awareness-manager-attach-routine](../../journeys/JOURNEY-timeline-location-awareness-manager-attach-routine.md)
- [JOURNEY-timeline-location-awareness-employee-views-own-location](../../journeys/JOURNEY-timeline-location-awareness-employee-views-own-location.md)
- [JOURNEY-timeline-location-awareness-admin-multi-location-overview](../../journeys/JOURNEY-timeline-location-awareness-admin-multi-location-overview.md)

**Adjacent:** `JOURNEY-dagslinjen-quickadd-*` (slot-quickadd flows), `JOURNEY-timeline-templates.md`

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
- **`core-structure/`** — defines `location` (area), `department`, `department_location` junction. **Required reading before any day_line work.**
- `MODULE_COMMUNICATION` — Komm channels (session channel auto-created per `department_session`)
- `MODULE_YEAR_WHEEL_PRD` — D4 planning surface (feeds demand into the day)
- `payroll/MODULE_PAYROLL` — consumes D6 production rows for C3 ledger (untouched by ADR-0367; `department_session` aggregate preserved)

---

## 10. Authoring Rules

- All Day Timeline mutations gate via `gatedMutation` (ADR-0204).
- All mutations emit telemetry through `emit()` from `@smartout/telemetry`; never duplicate the channel registry. Registry entries require matching emit() call-sites (ADR-0358).
- All ID derivation is server-side per ADR-0151 — body-supplied `workspace_id` / `profile_id` / `department_id` is rejected. `day_line_id` accepted as input but validated against parent `department_session_id`.
- Mobile day route is read-only per ADR-0133 — no new authoring affordances. `shift-lifecycle.clock_in/out` is the only mobile write that affects day_line state (via `shift_session.status`).
- New write paths must add a journey doc + e2e test before merge.
- All UI surfaces follow Nordic Split (ADR-0366) — no hardcoded OKLCH literals in `apps/web/src/components/day/`.
- Area-anchored work is council-class — ADR-0367 governs; no merge without council verdict on the ADR.
