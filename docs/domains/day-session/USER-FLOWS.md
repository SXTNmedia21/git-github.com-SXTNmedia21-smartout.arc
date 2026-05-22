---
title: "Day Session — User Flows"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: day-session
tags: [domain, day-session, user-flows, journeys, index]
---

# Day Session — User Flows

> Index of flows this domain enables. **Links to `docs/journeys/`** — does NOT duplicate flow details here.

## 1. Flow Summary

| # | Flow | Role | Phase | Journey | Status |
|---|---|---|---|---|---|
| F1 | Day opened (session → active) | Manager / first clocker | upcoming → active | [JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot](../../journeys/JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot.md) | shipped |
| F2 | Manager adds task at slot | Manager | active | [JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot](../../journeys/JOURNEY-dagslinjen-quickadd-manager-quickadd-at-slot.md) | shipped |
| F3 | Manager filters timeline by scope | Manager | active | [JOURNEY-dagslinjen-quickadd-manager-filter-timeline](../../journeys/JOURNEY-dagslinjen-quickadd-manager-filter-timeline.md) | shipped |
| F4 | Manager sends targeted note to staff | Manager | active | [JOURNEY-dagslinjen-quickadd-manager-target-note-fanout](../../journeys/JOURNEY-dagslinjen-quickadd-manager-target-note-fanout.md) | shipped |
| F5 | Employee receives targeted note | Employee | active | sibling of F4 | shipped |
| F6 | Manager wires session_task + avvik | Manager | active | [JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-task](../../journeys/JOURNEY-dagslinjen-task-avvik-wire-manager-quickadd-task.md) | shipped |
| F7 | Employee reports deviation (mobile) | Employee | active | sibling of F6 | shipped |
| F8 | Slot picker anchors at click coordinate | Manager | active | [JOURNEY-timeline-slot-popover-anchors-at-click](../../journeys/JOURNEY-timeline-slot-popover-anchors-at-click.md) | shipped |
| F9 | Timeline template save + apply | Manager / Admin | active | [JOURNEY-timeline-templates](../../journeys/JOURNEY-timeline-templates.md) | shipped |
| F10 | Manager creates day_line (area-anchored) | Manager | upcoming/active | [JOURNEY-day-line-create](../../journeys/JOURNEY-day-line-create.md) | shipped (Phase B+C) |
| F11 | Manager edits day_line open/close hours | Manager | upcoming/active | [JOURNEY-day-line-edit-hours](../../journeys/JOURNEY-day-line-edit-hours.md) | shipped (Phase B+C) |
| F12 | Manager attaches timeline_template to day_line | Manager | upcoming/active | [JOURNEY-day-line-attach-routine](../../journeys/JOURNEY-day-line-attach-routine.md) | shipped (Phase B+C) |
| F13 | Employee views own day_line on mobile | Employee | active | [JOURNEY-day-line-employee-view-mobile](../../journeys/JOURNEY-day-line-employee-view-mobile.md) | in progress (Phase D) |
| F14 | Push notification to clocked-in employees | System | active | [JOURNEY-day-line-push](../../journeys/JOURNEY-day-line-push.md) | in progress (Phase E) |
| F15 | Manager closes day (pending_signoff) | Manager | active → pending_signoff | _(no dedicated journey file yet — see GAPS §G11)_ | shipped (code), journey: GAP |
| F16 | Admin approves day (dagsgodkjenning) | Admin | pending_signoff → closed | _(no dedicated journey file yet — see GAPS §G11)_ | shipped (code), journey: GAP |
| F17 | Admin locks week | Admin | closed → locked (reconciliation) | _(no dedicated journey file yet)_ | shipped (code), journey: GAP |
| F18 | Employee mobile home — before/during/after shift | Employee | all | _(no dedicated journey file yet)_ | shipped (code), journey: GAP |
| F19 | Settlement image OCR (omsetning capture) | Manager / Shift leader | pending_signoff | _(no dedicated journey file yet)_ | shipped (code), journey: GAP |

---

## 2. Cross-Surface Flows

| Trigger | From surface | To surface | Effect |
|---|---|---|---|
| Employee clocks in (mobile) | Mobile Home (BeforeShiftView) | Web WebDayControl Bemanning tab | Session may transition upcoming → active if first clock-in |
| Employee completes task (mobile) | Mobile task detail | Web TasksTab | `session_task.status = 'completed'`; hook progress updates on web |
| Manager sends broadcast | Web BroadcastTab | Mobile "Meldinger til teamet" | Fanout via Komm session channel |
| Manager deviates "Avslutt dagen" | Web SignoffTab | Mobile AfterShiftView | `status = 'pending_signoff'`; mobile shows "venter på oppgjør" banner |
| Admin approves dagsgodkjenning | Web `/dashboard/reconciliation` | Any consumer of `daily_reconciliation.status` | `status = 'approved'` → locks edits |
| Employee reports avvik (mobile) | Mobile quick action | Web DeviationsTab + OverviewTab | Deviation visible immediately via TanStack Query invalidation |
| session-hook-executor fires | EF (cron) | Web TasksTab + Botsson voice context | session_task rows materialised; workforce snapshot refreshed |

---

## 3. Authority Decision Points

All write paths gate via `gate_action(capability_key, payload)` (ADR-0204 / ADR-0287). Key decisions:

| Decision | Gate key | Minimum role | Channel |
|---|---|---|---|
| Open day | `operations.session_start` | manager+ | chat |
| Create session_task | `task.create_session` | manager+ | chat (NOT voice V1) |
| Complete session_task | `task.complete` | employee+ | chat + voice |
| Report deviation | `hms.report_deviation` | employee+ | chat |
| Update / escalate deviation | `hms.update_deviation_manual` / `hms.escalate_deviation` | manager+ | chat |
| Create day_line | `day_line.create` | manager+ | chat |
| Edit day_line hours | `day_line.update_hours` | manager+ | chat |
| Instantiate template on day_line | `day_line.instantiate_template` | manager+ | chat |
| Close day (pending_signoff) | via `signoffSessionAction` | manager+ | web Server Action |
| Approve day (closed) | via `overrideReconciliationAction` / `submitReconciliationAction` | admin+ | web Server Action |
| Clock in/out | `shift-lifecycle.clock_in` / `clock_out` | self | mobile |

---

## 4. Draft Journeys (location-awareness roadmap — ADR-0367 Phase D/E)

These journeys were drafted during the daytimeline module phase and supersede the legacy `JOURNEY-timeline-location-awareness-*` naming:

- [JOURNEY-day-line-employee-view-mobile](../../journeys/JOURNEY-day-line-employee-view-mobile.md) — multi-area section list, defensive RLS filter
- [JOURNEY-day-line-push](../../journeys/JOURNEY-day-line-push.md) — engine-dispatch 1-min tick, fan-out via shift_session_day_line

Legacy (superseded by ADR-0367 F journeys, kept for reference):
- `JOURNEY-timeline-location-awareness-manager-create-day-line`
- `JOURNEY-timeline-location-awareness-manager-edit-opening-closing`
- `JOURNEY-timeline-location-awareness-manager-add-single-task`
- `JOURNEY-timeline-location-awareness-manager-attach-routine`
- `JOURNEY-timeline-location-awareness-employee-views-own-location`
- `JOURNEY-timeline-location-awareness-admin-multi-location-overview`

---

## 5. Gaps — Missing Journey Docs

Journey files missing for shipped code (see GAPS §G11):
- Close-day flow (F15) — `JOURNEY-day-session-close-flow.md`
- Admin dagsgodkjenning (F16) — `JOURNEY-day-session-admin-approval.md`
- Admin week lock (F17) — `JOURNEY-day-session-week-lock.md`
- Mobile home phase-aware (F18) — `JOURNEY-mobile-home-phases.md`
- Settlement OCR (F19) — `JOURNEY-day-session-settlement-ocr.md`
