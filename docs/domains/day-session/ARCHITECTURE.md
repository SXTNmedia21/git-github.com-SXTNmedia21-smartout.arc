---
title: "Day Session — Architecture"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: day-session
tags: [domain, day-session, architecture, code-map, web, mobile, edge-functions]
---

# Day Session — Architecture

> Code-level map of every layer the day-session domain depends on. **Code wins.**

## 1. Layer Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ L1 — UI surfaces                                                          │
│  Web:     WebDayControl (7 tabs) · /dashboard/reconciliation              │
│  Mobile:  (home)/index.tsx (4 phase views) · (calendar)/day/[date].tsx   │
├──────────────────────────────────────────────────────────────────────────┤
│ L2 — BFF + Server Actions                                                 │
│  apps/web/src/app/dashboard/_actions/*.ts                                 │
│  apps/web/src/app/dashboard/reconciliation/_actions/*.ts                  │
│  apps/web/src/app/api/mobile/* (mobile BFF)                               │
├──────────────────────────────────────────────────────────────────────────┤
│ L3 — Stage Engine / Agent (Botsson)                                       │
│  services/stage-engine/* · services/voice-agent/src/tools-task.ts        │
├──────────────────────────────────────────────────────────────────────────┤
│ L4 — Capabilities                                                         │
│  packages/ai/src/capabilities/{task,operations,operations-intelligence,   │
│    hms,communication,day-line}/                                           │
├──────────────────────────────────────────────────────────────────────────┤
│ L5 — Persistence (tables + Edge Functions)                                │
│  Postgres: department_session, day_line, shift_session,                   │
│            session_hook, session_task, deviation, daily_reconciliation,   │
│            settlement_image, settlement_validation,                       │
│            timeline_template, schedule_day_booking, schedule_day_info,    │
│            financial_close_config, shift_session_day_line                 │
│  EF (Supabase Functions):                                                 │
│    session-lifecycle, session-hook-executor, session-watchdog-demoter,    │
│    daily-session-replenish, session-task-overdue-cron,                    │
│    process-settlement-image, validate-settlement, ops-day-brief           │
└──────────────────────────────────────────────────────────────────────────┘
```

ADR-0204 + ADR-0287 + ADR-0151 + ADR-0133 are load-bearing across all layers.

---

## 2. Web — WebDayControl (L1)

**Shell:** `apps/web/src/components/day/WebDayControl.tsx` — ADR-0156 canonical admin surface.

Renders `SessionHeader` (full variant) + 7 sub-navigation tabs. Phase is read from `department_session.status` + `daily_reconciliation`-derived lock state. Each tab is a separate Client Component:

| Tab | Component | Status |
|---|---|---|
| Oversikt | `tabs/OverviewTab.tsx` | shipped |
| Bemanning (Roster) | `tabs/RosterTab.tsx` | shipped |
| Dagslinjen | `tabs/TimelineTab.tsx` | shipped (dept-anchored; area-anchored UI in flight) |
| Oppgaver | `tabs/TasksTab.tsx` | shipped |
| Avvik | `tabs/DeviationsTab.tsx` | shipped |
| Oppgjør / Signoff | `tabs/SignoffTab.tsx` | shipped |
| Melding (Broadcast) | `tabs/BroadcastTab.tsx` | shipped |

### 2.1 TimelineTab + Dagslinjen (the active-phase surface)

**Primary entry:** `apps/web/src/components/day/tabs/TimelineTab.tsx`

Composes:
- `TimelineTopBar` — scope filter (dept / team / location / shift) + saved-templates dropdown
- `DayTimelineStrip` (`DayTimelineStrip.tsx`) — dept-anchored, 15-min hit-zones, `onSlotClick(time, rect)`. Anchor grep: `SPARSE_THRESHOLD = 4`.
- `DayLineStrip` (`DayLineStrip.tsx`) — NEW area-anchored strip (ADR-0367 Phase C). Composes `DayLineStripHeader` + `OpenCloseEditPopover` + `SlotPicker`. Status derived via `deriveDayLineStatus`. testID: `day-line-strip-{day_line_id}`.
- `SlotPicker` (`SlotPicker.tsx`) — 3-lane Radix Popover anchored at click rect. Lanes: PRODUKSJON (D6) / BEMANNING (D2) / FRI TEKST. Anchor grep: `D6_ITEMS`.
- `DayEventList` + `EventDetailPanel` — flat-list mirror + inline editor.
- `AggregatedDayLineList` — NEW: renders `day_line` rows stacked per session (Phase C).

Read hooks:
- `useDayTimelineEvents` — merged `DayEvent[]` for the dept-anchored strip. Anchor: `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts`.
- `use-day-lines.ts` — NEW: loads `day_line` rows for multi-strip stack.
- `useDayTimelineScope` — `?scope=type:id` URL persistence.

Write actions (L2):
- `addTaskAction` → `task.create_session` capability
- `reportDeviationAction` / `updateDeviationAction`
- `addBookingAction` → `schedule_day_booking` insert
- `createDayInfoAction` / `createTargetedNoteAction`
- `toggleSessionTaskAction` / `completeSessionTaskAction` → `task.complete` capability

### 2.2 SignoffTab (close flow)

**File:** `apps/web/src/components/day/tabs/SignoffTab.tsx`

Close phases:
1. Manager clicks "Avslutt dagen" → `signoffSessionAction({ confirm: "pending" })` → `status = 'pending_signoff'`, `closed_at` set, notifies admin.
2. Admin views via reconciliation route → clicks "Godkjenn" → `signoffSessionAction({ confirm: "close" })` → `status = 'closed'`.
3. Admin locks week → `daily_reconciliation.status = 'approved'` → eventually `'locked'`.

Tips integration (ADR-0228): `useTipsEnabled` + `useTipsPool` — tips card injected when `tips_enabled = true`.

---

## 3. Web — Reconciliation Route (Admin Dagsgodkjenning)

**Route:** `/dashboard/reconciliation` → `apps/web/src/app/dashboard/reconciliation/page.tsx`

Layout (two modes):
- **Mode 1 (DayList):** week/period table, status badges, CSV export. Filter chips. Columns: date · dept · omsetning · Labor% · status. Click row → Mode 2.
- **Mode 2 (DayDetail):** 6-tab detail + `ReconciliationRightRail` (sticky approve panel). Tabs: Oversikt · Oppgaver · Avvik · Revisjonslogg · Shift approvals · (Revenue section).

Key components:
- `DayList` → `apps/web/src/app/dashboard/reconciliation/_components/DayList.tsx`
- `DayDetail` → `DayDetail.tsx` — reads `useReconciliationDetail`, `useApproveReconciliation`, `useRejectReconciliation`.
- `RevenueSection` — omsetning input + `settlement_image` upload trigger.
- `DayApproval` — approve button + override flow.
- `AdminOverrideDialog` — admin override path (role: admin+).
- `PreflightGate` — blocks approval if open deviations or unfinished required tasks.

Server Actions:
- `submitReconciliationAction` — sets `daily_reconciliation.status = 'submitted'` (by shift leader) or `'awaiting_approval'` after OCR.
- `overrideReconciliationAction` — admin force-approve.
- `saveWizardStepAction` — persists `wizard_state` JSONB for mobile clockout-wizard resumability (ADR-0134).

**Sidebar label:** `sidebar.item_avstemming` → Norwegian: "Avstemming" / English: "Reconciliation". This is a naming-collision — see GAPS §6.

---

## 4. Mobile — Home Screen (L1)

**File:** `apps/mobile/app/(app)/(home)/index.tsx`

Phase-aware via `useShiftPhase()`. Four views:

| Phase | Component | Key elements |
|---|---|---|
| `no_shift` | `NoShiftView` | Community, growth, news |
| `before_shift` | `BeforeShiftView` | Upcoming shift details, clock-in CTA, receives `shiftSessionId` (ADR-0367) |
| `during_shift` | `DuringShiftView` (v1) or `DuringShiftViewV2` (v2, feature flag `EXPO_PUBLIC_DURING_SHIFT_V2`) | Live timer, tasks, colleagues, quick actions |
| `after_shift` | `AfterShiftView` | Shift summary, hours confirm, handoff, "venter på oppgjør" banner |

Read hooks: `useShiftPhase`, `useMyProfile`, `useMyTasks`, `useShiftColleagues`, `useDayInfo`, `useDutyLeader`, `useShiftSession` (ADR-0367 — loads `shift_session` row for today).

Action bar (always visible): Oppgaver · Opplæring · Sikkerhet · Lønn.

### 4.1 Mobile Calendar Day Route

**File:** `apps/mobile/app/(app)/(calendar)/day/[date].tsx`

Read-only vertical timeline (08:00–24:00). Absolute-positioned items. Constants: `TIMELINE_START_H = 8`, `TIMELINE_END_H = 24`, `ROW_H = 56`, `TIMELINE_LEFT_OFFSET = 56`. No slot-click affordance (ADR-0133). `FALLBACK_TZ = "Europe/Oslo"`.

Telemetry: emits `calendar view_changed` + `calendar item_viewed` via `getProfileContext()` per ADR-0134 (fail-fast on missing workspace_id / actor_id). Anchor: `apps/mobile/app/(app)/(calendar)/day/[date].tsx`.

---

## 5. Server Actions (L2)

All Server Actions are in `apps/web/src/app/dashboard/_actions/`. Each wraps `gate_action(capability_key, payload)` via `gatedMutation` (ADR-0204). `workspace_id` + `profile_id` derived via `getServerContext()` (ADR-0151).

| File | Capability / Gate | Notes |
|---|---|---|
| `add-task-action.ts` | `task.create_session` | session_task creation |
| `add-booking-action.ts` | `schedule.add_booking` | schedule_day_booking |
| `create-day-info-action.ts` | `operations.create_day_info` | schedule_day_info |
| `create-targeted-note-action.ts` | `communication.create_targeted_note` | fanout via Komm channel |
| `report-deviation-action.ts` | `hms.report_deviation` | deviation INSERT |
| `update-deviation-action.ts` | `hms.update_deviation_manual` + `hms.escalate_deviation` | |
| `toggle-session-task-action.ts` | `task.complete` | toggle done |
| `complete-session-task-action.ts` | `task.complete` | complete + evidence |
| `signoff-session-action.ts` | `operations.session_signoff` | pending/close transitions |

Reconciliation actions in `apps/web/src/app/dashboard/reconciliation/_actions/`:
- `submit-reconciliation-action.ts`, `override-reconciliation-action.ts`, `override-wizard-blocker-action.ts`, `save-wizard-step-action.ts`.

---

## 6. Capabilities (L4)

| Namespace | Folder | Key tools | Status |
|---|---|---|---|
| `task` | `packages/ai/src/capabilities/task/` | `list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal` | shipped |
| `operations` | `packages/ai/src/capabilities/operations/` | `session_start`, session open/close lifecycle tools | shipped |
| `operations-intelligence` | `packages/ai/src/capabilities/operations-intelligence/` | read-side KPI aggregations | shipped |
| `hms` | (under operations namespace today) | `report_deviation`, `update_deviation_manual`, `escalate_deviation` | shipped (own namespace: GAP — see `docs/modules/daytimeline/GAPS-AND-DEBT.md:4.11`) |
| `communication` | `packages/ai/src/capabilities/communication/` | `create_targeted_note` | shipped |
| `day-line` | `packages/ai/src/capabilities/day-line/` | `create`, `add_item`, `instantiate_template` | shipped Phase B (ADR-0367) |
| `routine` | (planned) | `attach_to_line` | gap — see GAPS §G3 |

Capability authority seeded in `engine_authority_config` via migrations `20260620120800_day_line_capability_authority_seed.sql` + `20260620120900_day_line_update_hours_authority_seed.sql`.

---

## 7. Edge Functions (L5)

| Function | Trigger | Role | Auth |
|---|---|---|---|
| `session-lifecycle` | cron every 15 min | Auto-transitions: upcoming→active (NOW ≥ planned_open), active→pending_signoff (NOW ≥ planned_close), upcoming→missed (grace exceeded) | WATCHDOG_CRON_SECRET |
| `session-hook-executor` | cron every 5 min | Fires `session_hook` rows at offset time, materialises `session_task` rows, anchors via `fn_resolve_single_day_line` | WATCHDOG_CRON_SECRET |
| `daily-session-replenish` | cron 02:00 UTC | Creates `department_session` rows for active seasons, 7-day window, idempotent upsert | WATCHDOG_CRON_SECRET |
| `session-task-overdue-cron` | cron periodic | Transitions `session_task` → overdue when `due_at` passed; inserts `notification_outbox` rows | WATCHDOG_CRON_SECRET |
| `session-watchdog-demoter` | cron | Demotes stale sessions | WATCHDOG_CRON_SECRET |
| `process-settlement-image` | triggered by Storage upload | OCR parsing of POS/terminal images → populates `settlement_image.ocr_parsed` + `ocr_confidence` | internal-auth |
| `validate-settlement` | triggered after OCR | Cross-checks POS total vs terminal total → writes `settlement_validation` | internal-auth |
| `ops-day-brief` | on-demand | Day summary brief for Botsson voice context | internal-auth |

---

## 8. Stage Engine / Voice (L3)

Botsson chat enters through `services/stage-engine/src/routes/agent/dispatch.ts`. Voice (LiveKit, ADR-0135) uses `services/voice-agent/src/tools-task.ts` — mirrors `task.{list_mine, complete}` as thin typed wrappers.

Workforce snapshot (ADR-0297): D2+D6 facts shipped at session start to both chat (stage-engine system-prompt slice) AND voice (`agent.updateChatCtx()` developer message). After ADR-0367 migration, snapshot slice must include `day_line` rows.

Channel restrictions (ADR-0078): `task.complete` + `task.list_mine` on chat+voice. All create paths chat-only V1.

---

## 9. Key Helpers

| File | Purpose |
|---|---|
| `apps/web/src/lib/cascade/derive-day-line-status.ts` | Derives `DayLineStatus` from `(cancelled_at, sessionStatus, reconciliationLocked)`. Precedence: locked > cancelled > draft > closed > active. |
| `apps/web/src/components/day/_hooks/use-day-lines.ts` | Loads `day_line` rows for multi-strip stack. |
| `supabase/migrations/20260621200103_fn_resolve_single_day_line.sql` | RPC `fn_resolve_single_day_line(session_id, dept_id)` — returns single `day_line_id` for a session. Used by `session-hook-executor`. |
| `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` | Merges all event types (shifts, hooks, tasks, deviations, bookings, notes) into `DayEvent[]` for the strip. |
