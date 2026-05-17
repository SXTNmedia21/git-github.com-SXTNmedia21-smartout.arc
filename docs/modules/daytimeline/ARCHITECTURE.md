---
title: Day Timeline — Architecture
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: daytimeline
tags: [module, daytimeline, architecture, code-map, web, mobile, capabilities]
---

# Day Timeline — Architecture

> Code-level map of every layer the Dagslinjen surface depends on. Read alongside [DATA-MODEL.md](./DATA-MODEL.md).

## 1. Layer Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ L1 — UI surfaces                                                      │
│   Web:    TimelineTab → DayTimelineStrip + SlotPicker + DayEventList │
│   Mobile: (calendar)/day/[date].tsx (read-only)                       │
├──────────────────────────────────────────────────────────────────────┤
│ L2 — BFF + Server Actions                                             │
│   apps/web/src/app/dashboard/_actions/*.ts                            │
│   apps/web/src/app/api/* (where capability tool invoked from mobile)  │
├──────────────────────────────────────────────────────────────────────┤
│ L3 — Stage Engine / Agent Router                                      │
│   services/stage-engine/* (Botsson voice + chat routing)              │
├──────────────────────────────────────────────────────────────────────┤
│ L4 — Capabilities                                                     │
│   packages/ai/src/capabilities/{task,operations,operations-intel}/    │
│     ├─ gate.ts  (gate_action wrapper per ADR-0099/0204)               │
│     ├─ tools.ts (typed mutation tools)                                │
│     └─ index.ts (exported registry entries)                           │
├──────────────────────────────────────────────────────────────────────┤
│ L5 — Persistence                                                      │
│   Postgres: department_session, session_hook, session_task,           │
│             schedule_day_task, schedule_day_booking,                  │
│             schedule_day_info, deviation, timeline_template           │
└──────────────────────────────────────────────────────────────────────┘
```

ADR-0287 + ADR-0099 + ADR-0204 + ADR-0151 + ADR-0298 are load-bearing across L2→L4. ADR-0133 holds the L1 split (web authoring, mobile execution).

---

## 2. Web — TimelineTab

**File:** `apps/web/src/components/day/tabs/TimelineTab.tsx`

Renders the Dagslinjen tab of `WebDayControl`. Composes children, owns selection + popover state.

State owned:
- `selection` (from `useTimelineSelection`) — highlighted event id
- `slotPicker: { open, time }` — popover state
- `anchorRect: DOMRect | null` — popover anchor coordinate (shipped 2026-05-17)
- `draftChips: DraftChip[]` — in-memory free-form chips before template save
- Dialog open states: `bookingOpen`, `noteOpen`, `shiftStartOpen`, `taskDialogOpen`, `avvikDialogOpen`, `freeFormDialogOpen`
- Slot-time strings: `slotTime`, `freeFormTime`

Read hooks called:
- `useDayTimelineEvents` — merged event stream for the day
- `useDayTimelineScope` — `?scope=type:id` URL param
- `useWorkspaceOptional` — workspace_id + role context

Writes invoked:
- `addTaskAction` (via AddTaskDialog)
- `reportDeviationAction` (via DeviationDialog)
- `addBookingAction` (via ReservationSheet)
- `createDayInfoAction` (via DailyNoteSheet)
- `createTargetedNoteAction` (from list inline)
- `toggleSessionTaskAction` / `completeSessionTaskAction` (from event detail)

Authority: `canEdit = role !== null && role !== "employee"`. Manager-restriction: `isRestricted = role !== "admin" && role !== "owner"` → forces own-dept filter via `ownDepartmentId`.

### 2.1 `DayTimelineStrip` (`apps/web/src/components/day/DayTimelineStrip.tsx`)

Pure presentational ribbon. 15-min hit-zones rendered as `<button>` only when `editable=true`. Each button on click calls `onSlotClick(time, rect)` — second arg shipped 2026-05-17 for popover anchoring.

Key constants:
- `SPARSE_THRESHOLD = 4` — events at/below this trigger zoom-near-now
- `ZOOM_HALF_WINDOW = 180` — ±minutes around now in zoom mode
- 15-min slot grid built from `startHHMM` → `endHHMM`

Phase-tint bands (3 bands: prep / service / windDown) computed via `getPhaseBoundaries` from `@smartout/utils` using session bounds.

### 2.2 `SlotPicker` (`apps/web/src/components/day/SlotPicker.tsx`)

Controlled Radix Popover. Uses `PopoverAnchor` (not `PopoverTrigger`) — the anchor is an invisible 1×1 span positioned at the click rect. 3 lanes:

- **PRODUKSJON (D6):** Hook / Oppgave / Notat / Avvik
- **BEMANNING (D2):** Vakt
- **FRI TEKST:** Fri tekst (FreeFormChipDialog)

Location-scope variant: when `isLocationScope=true`, Produksjon + Fri Tekst lanes disabled with tooltip "Lokasjons-malt godtar kun vakter". Keyboard nav: arrow keys within lane, tab between lanes. ARIA: role-grouped lanes.

`align="center" side="bottom" sideOffset={6} collisionPadding={12}` — keeps menu in viewport on edge clicks.

### 2.3 `DayEventList` + `EventDetailPanel`

`DayEventList` — flat ordered list mirror of the strip's markers. Clicking pulses the matching strip marker via `pulseSource="list"`.

`EventDetailPanel` — inline editor for selected event. Opens drawer (`useEntityDrawerOptional`) for `shift` / `cascade_task` / `deviation` types; otherwise renders inline edit form.

### 2.4 `TimelineTopBar` + `ScopeFilterPopover` + `ScopeFilterPill`

`TimelineTopBar` composes scope filter + saved-templates dropdown. `ScopeFilterPopover` has 4 tabs (Avdeling / Team / Lokasjon / Vakt). Today the Lokasjon tab is a **read filter only** — selecting a location filters the strip but does not anchor mutations to that location (the gap this module exists to close).

### 2.5 Hooks

| Hook | Returns | Purpose |
|---|---|---|
| `useDayTimelineEvents` | `DayEvent[]` | merged stream: shifts, hooks, tasks, deviations, bookings, notes |
| `useDayTimelineScope` | `{ scope, setScope }` | URL `?scope=type:id` param |
| `useDayBudget` | day-level KPI projection | budget vs actual |
| `useSessionHooksWithTasks` | hook hierarchy + child tasks | `AddTaskDialog` hook picker |
| `useDrawerSession` | session row for the open drawer | entity drawer |
| `useShiftDayStats` | shift count + role mix | header chip |
| `useTimelineTemplates` (under `_hooks/timeline-template/`) | saved-template CRUD | TimelineTopBar dropdown |

### 2.6 Tools Bridge

`apps/web/src/components/day/_tools/oversikt-tools-bridge.tsx` + `use-oversikt-tools.ts` register page-tools with the Botsson tool registry. Tools include `selectShift`, `selectEvent`, `addTaskAtSlot`, `pickScope` etc. Wired per ADR-0325 (page-tool authority/dedupe).

---

## 3. Mobile — Day Route

**File:** `apps/mobile/app/(app)/(calendar)/day/[date].tsx`

Read-only. Renders vertical timeline 08:00–24:00 with absolute-positioned items.

Constants:
- `TIMELINE_START_H = 8`, `TIMELINE_END_H = 24`
- `ROW_H = 56` (points per hour)
- `TIMELINE_LEFT_OFFSET = 56` (room for time labels)
- `FALLBACK_TZ = "Europe/Oslo"` — workspace timezone respected via `date-fns-tz toZonedTime`

Read hooks:
- `useCalendarItems(date)` — main event stream
- `useDayInfo(date)` — day-level handover note (read)
- `useMyProfile` — viewer identity

Telemetry: emits `calendar view_changed` + `calendar item_viewed` via `getProfileContext()` per ADR-0134 (fail-fast on missing workspace_id / actor_id).

Mobile mutations (NOT on the day route itself but adjacent):
- `apps/mobile/app/(app)/(me)/tasks/[id].tsx` — complete session_task via `/api/mobile/tasks/[id]/complete` BFF route (ADR-0132: mobile mutates only via web BFF)
- Shift clock — separate route, calls BFF
- Day-info read — `apps/mobile/src/hooks/queries/use-day-info.ts`
- Day-info create — `apps/mobile/src/hooks/mutations/use-create-day-info.ts` calls `createDayInfoAction` via BFF

---

## 4. Server Actions (L2)

Folder: `apps/web/src/app/dashboard/_actions/`

| File | Capability tool wrapped | Gate key |
|---|---|---|
| `add-task-action.ts` | `task.create_session` | `task.create_session` |
| `add-booking-action.ts` | (direct table — no capability) | `schedule.add_booking` (TBD migration) |
| `create-day-info-action.ts` | (direct table — gated) | `operations.create_day_info` |
| `create-targeted-note-action.ts` | `communication.create_targeted_note` | `communication.create_targeted_note` |
| `report-deviation-action.ts` | `hms.report_deviation` | `hms.report_deviation` |
| `update-deviation-action.ts` | `hms.update_deviation_manual` + `hms.escalate_deviation` | both |
| `toggle-session-task-action.ts` | `task.complete` | `task.complete` |
| `complete-session-task-action.ts` | `task.complete` | `task.complete` |
| `complete-task-action.ts` | cookie-path wrapper → `completeSessionTaskAction` → `task.complete` | thin wrapper |

Every Server Action above wraps `gate_action(capability_key, payload)` via `gatedMutation` (ADR-0204). `workspace_id` + `profile_id` are derived server-side via `getServerContext()` per ADR-0151 — never trust the body.

---

## 5. Capabilities (L4)

Folder: `packages/ai/src/capabilities/task/`

| File | Purpose |
|---|---|
| `index.ts` | Registry export (`task` capability, 6 tools) |
| `tools.ts` | Tool bodies: `list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal` |
| `gate.ts` | `gateTask()` helper — wraps `gate_action` |
| `__tests__/` | Vitest unit tests |

`task.create_session` is the canonical write for session_task. It:
1. Calls `gate_action("task.create_session", { workspace_id, department_session_id })`
2. On grant, INSERT session_task with `workspace_id` + `department_session_id` resolved server-side
3. Emits `"task.added_manual"` telemetry (canonical creation event under `task.*` namespace per ADR-0298)

Per ADR-0298 this is the ONLY path that writes `session_task` in the new ontology. `addTaskAction` Server Action delegates to it.

Adjacent capabilities:
- `operations` — session lifecycle (open, close, sign off)
- `operations-intelligence` — read-side aggregations (KPI roll-up, day summary)
- `hms` — deviation flow
- `communication` — targeted notes
- `routine` — **(planned)** template attach (does not exist yet)
- `timeline` — **(planned)** day_line CRUD (does not exist yet)

---

## 6. Stage Engine / Agent (L3)

Voice + chat enter through `services/stage-engine/src/routes/agent/dispatch.ts`. Botsson's day-related tool surface is mirrored from L4 capabilities via the BFF chat endpoint `/api/botsson/chat`. Voice (LiveKit, ADR-0135) speaks through `services/voice-agent/src/tools-task.ts` mirroring the 6 `task` tools with thin typed wrappers.

Voice path:
1. User speaks "Lag oppgave til Anna kl 14"
2. LiveKit agent transcribes + routes through Stage Engine
3. Stage Engine selects `task.create_session` tool
4. Tool wraps `gate_action` + writes session_task
5. Tool emits telemetry
6. UI revalidates via TanStack Query invalidation triggered by `engine_event` fanout

Workforce snapshot bootstrap (ADR-0297) ships D2+D6 facts at session start to both chat (stage-engine system-prompt slice) AND voice (LiveKit `agent.updateChatCtx()` developer message). Eliminates query_smartout roundtrips for day-context questions.

---

## 7. Telemetry Pipeline

Single source of truth: `packages/telemetry/src/registry.ts`. Pattern:

```ts
emit({
  event: "task.added_manual",
  actor_id, workspace_id,
  entity_type: "session_task", entity_id,
  // ... event-specific fields
});
```

`emit()` fans out to 4 destinations per `EVENT_ROUTING` map:
- **PostHog** — analytics
- **Logger** — stdout (dev) + Vercel / Sentry breadcrumb
- **`activity_trail`** — append-only audit (RLS-scoped, ADR-0151)
- **`engine_event`** — workflow runtime fanout

Recurrence trap (3rd+ occurrence pattern in MEMORY): every new event MUST be in BOTH the `SmartoutEvent` discriminated union AND the `EVENT_ROUTING` map. Adding only one half lets `emit()` compile but silently drop the route. Guard with grep in PR review.

---

## 8. RLS + Authority

Two-layer gating:

| Layer | Check | Where |
|---|---|---|
| **RLS** | viewer belongs to workspace | every table's `jwt_read_*` policy via `get_workspace_ids_for_user(auth.uid())` |
| **Authority** | capability granted to role/profile/team | `gate_action(capability_key, payload)` RPC → reads `engine_authority_config` |

`gate_action` is SECURITY DEFINER. It reads `engine_authority_config` rows scoped to `(workspace_id, capability_key)` and returns `allow|deny` + `reason`. Default-allow if no row exists is the **L-0066 CVE class** — every new capability MUST be seeded in a migration before the tool ships, or the gate is a no-op.

The pre-m5-mutation-closure sortie (commit `9ef0fbb60`) closed this for `policy.create_manual` + `hms.escalate_deviation`. Future Day Timeline capabilities (`timeline.create_day_line`, `timeline.edit_opening_closing`, `routine.attach_to_line`) need the same seed migration.

---

## 9. Channel Restrictions (ADR-0078)

| Capability | Allowed channels |
|---|---|
| `task.list_mine` | chat + voice |
| `task.complete` | chat + voice |
| `task.create_session` | chat (NOT voice — V1 PII risk per ADR-0298 R6) |
| `task.create_personal` | chat |
| `task.create_day_ad_hoc` | chat |
| `task.cancel_personal` | chat |
| `hms.update_deviation_manual` | chat |
| `hms.escalate_deviation` | chat |
| `timeline.create_day_line` (planned) | chat |
| `routine.attach_to_line` (planned) | chat |

Voice surface mirrors only the `list_mine` + `complete` tools. Adding voice authoring requires ADR-0078 amendment + Lovsen PII review.

---

## 10. Test Surfaces

- **Web E2E:** `apps/e2e/timeline-templates/`, `apps/e2e/dagslinjen-quickadd/` (Playwright)
- **Capability unit:** `packages/ai/src/capabilities/task/__tests__/`
- **Manual:** see [E2E-COVERAGE.md](./E2E-COVERAGE.md) for the test matrix and current holes

---

## 11. Performance Notes

- `useDayTimelineEvents` invalidates via single `queryKey: ["day-control", "timeline-events"]` — broad refresh on any day mutation. Acceptable today (1 strip per dept, ≤200 events typical). Scaling concern when location-multi-line lands → consider scoped key per day_line.
- `DayTimelineStrip` zoom-near-now mode kicks in when ≤4 events fall inside session bounds; expands strip to ±180 min around now. Reduces visual clutter for low-event mornings.
- Mobile day route uses absolute-positioned items in a ScrollView. No virtualization — fine for ≤50 items. Multi-line stack on mobile will require list virtualization (FlashList) if it ships.
- Telemetry `emit()` is fire-and-forget; PostHog batches client-side. `activity_trail` write happens via SECURITY DEFINER RPC, single round-trip per mutation.

---

## 12. Cross-Module Touchpoints

| Module | Where it crosses Day Timeline |
|---|---|
| Communication (Komm) | Session channel auto-created per `department_session`. Targeted notes from strip fan out to session channel. |
| Year-Wheel | D4 planning_event reads — surfaced on the strip as planned-event markers. |
| Payroll | `shift_pay_calculation_event` (immutable per ADR-0251) snapshots the day's shifts after C1 reconciliation. |
| HMS | Deviation flow — every avvik reported from the strip lives in `hms/deviations`. |
| Schedule | `schedule_shift` is the source of truth for shift markers on the strip. Cascade A1 added `department_id` + `location_id` direct FKs to schedule_shift. |
| Botsson Arena | Workforce snapshot (ADR-0297) bootstraps D2+D6 facts into voice + chat at session start. |
