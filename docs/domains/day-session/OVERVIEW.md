---
title: "Day Session — Overview"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-22
domain: day-session
tags: [domain, day-session, d6, overview, cascade, orchestration]
---

# Day Session — Overview

> What this domain is and why it exists. **Code wins** — if this contradicts code, update here.

## 1. What it is

The **day-session domain** is the orchestrating layer that runs one `department_session` per department per day through its complete lifecycle — from opening to sign-off to lock. It is the product's operational heartbeat.

Every shift-based business day flows through a state machine with six phases (`upcoming → active → pending_signoff → closed → missed` and the reconciliation-layer concept of `locked`). Phase drives everything: what staff see on mobile, what managers see on the timeline (Dagslinjen), and what admin must approve before the day is committed to payroll.

Three roles consume this domain at different depth:

| Role | Entry point | What they do |
|---|---|---|
| **Employee** | Mobile Home (`/home/index.tsx`) | Clock in/out, view tasks, report deviations, see next shift |
| **Manager / shift-leader** | Web `WebDayControl` → 7 tabs | Open day, add tasks/hooks/bookings, close day, sign off |
| **Admin** | Web `/dashboard/reconciliation` | Approve day-by-day (omsetning + labor%), lock weeks |

The domain also owns the day's **content layer** — the hooks (pre_open, open, scheduled, pre_close, close) that fire `session_task` rows at configured offsets, the deviation register, broadcast messages, and the `daily_reconciliation` record that captures turnover (omsetning) and links to `settlement_image` (POS/terminal OCR).

## 2. Cascade placement

| Layer | Role | Key tables |
|---|---|---|
| **D6 Production** | Primary home — what is happening today | `department_session` (aggregate), `day_line` (program/area, ADR-0367), `shift_session` (per-employee runtime, ADR-0367), `session_hook`, `session_task`, `deviation`, `schedule_day_booking`, `schedule_day_info` |
| **D1 Envelope** | Input — opening/closing hours resolved at session creation | `department_operating_hours` → populates `planned_open`/`planned_close` on `department_session` and `day_line` |
| **D2 Resource** | Input — who is available, which shifts, absences | `schedule_shift`, `profile`, `schedule_absence` — shift markers on the timeline |
| **C1 Calibration** | Output / lock — `daily_reconciliation` (revenue vs plan), `settlement_image` (OCR) | Locks the day for edits once approved/locked |
| **C3 Commercial** | Output — `shift_cost_snapshot` joins `daily_reconciliation` for labor % | Consumed by payroll domain after close |

The domain sits at the **D6 → C1 handoff boundary**. D6 produces; `daily_reconciliation` calibrates and seals. The payroll domain consumes the C1-sealed record. The procedure-engine domain authors the hooks and routines that day-session fires at runtime.

## 3. Boundaries

**Owns:**
- `department_session` lifecycle: 6 phases, state transitions (auto + manual). Anchor: `supabase/migrations/20260304200000_department_session.sql`.
- `day_line` (area-anchored program layer, ADR-0367): one per `(department_session, location)`. Contains own `planned_open`/`planned_close`.
- `shift_session` (per-employee runtime layer, ADR-0367): one per `schedule_shift`. Drives clock-in/out lifecycle + push routing.
- `session_hook` + `session_task` — runtime hooks fired by `session-hook-executor` EF, materialised into tasks.
- `deviation` — the D6 deviation register. Reports, escalations, resolutions.
- The **close flow**: shift-leader/last-out triggers `pending_signoff` → `SignoffTab` → optional tips approval → `signoffSessionAction`. Manager notes + handoff stored on `department_session.signoff_notes`/`handoff_notes`.
- **Omsetning capture**: `daily_reconciliation` (revenue + labor aggregate) + `settlement_image` (POS/terminal OCR input) + `settlement_validation` (POS vs terminal cross-check). Edge functions: `process-settlement-image`, `validate-settlement`.
- **Admin day-approval**: `/dashboard/reconciliation` route — week-level table, day-detail view with tabs (Oversikt, Oppgaver, Deviations, Revisjonslogg, Shift approvals), approve → `reconciliation_status = 'approved'` → lock.
- **Customizable close tolerances**: `financial_close_config` table — per-workspace tolerance type (fixed/%), cash threshold, approval_required flag, deadline hours. Anchor: `supabase/migrations/20260328120100_financial_close_config.sql`.
- **Timeline (Dagslinjen)**: the web horizontal-time-axis view of the `active` phase — `TimelineTab.tsx` + `DayTimelineStrip.tsx` + `SlotPicker` + all day-item dialogs. The daytimeline module docs are absorbed here.
- `timeline_template` (ADR-0335): saved day-line programs that can be applied at session creation.
- `schedule_day_booking`, `schedule_day_info` — bookings on the timeline, day-level handover notes.
- **Mobile Home** phase-aware screen (no_shift / before / during / after) — `apps/mobile/app/(app)/(home)/index.tsx`.
- Session cron infrastructure: `daily-session-replenish` (creates sessions T-7), `session-lifecycle` (auto-transitions every 15 min), `session-hook-executor` (fires hooks every 5 min), `session-task-overdue-cron`, `session-watchdog-demoter`, `ops-day-brief`.

**Does NOT own (seams):**
- **Payroll calc** — overtime/supplements are *confirmed* at close, then fed to the payroll domain. Seam: payroll reads `daily_reconciliation` + `shift_cost_snapshot` after C1 approval.
- **Procedure authoring** — hooks and routines are *authored* by the procedure-engine domain; day-session *consumes* them at runtime via `session_hook.linked_procedure_id` / `linked_routine_id`.
- **Billing / accountant reconciliation** — `billing.settlement_run`, `billing.settlement_period` are accountant-facing B2B billing artifacts (see billing domain). The word "avstemming" in sidebar-config refers to THIS domain's operational day-approval; the billing domain uses the same word for a different object. See GAPS §6 for the naming-collision gap.
- **Communication channels** — Komm session channel auto-created per `department_session` (owned by the communication domain). `BroadcastComposer` sends through that channel; day-session creates the container, communication owns the routing.

## 4. Key invariants

1. **One session per (workspace, department, date)** — `CONSTRAINT uq_dept_session_date UNIQUE (workspace_id, department_id, session_date)` on `department_session`. Verified: `supabase/migrations/20260304200000_department_session.sql:47`.
2. **`planned_open` / `planned_close` resolved at creation from D1** — populated by Cascade A1 (`supabase/migrations/20260421100350_cascade_a1_alter_existing.sql`). Never hardcoded.
3. **All D6 mutations gate via `gate_action`** — ADR-0204 / ADR-0287. No direct browser writes.
4. **`session_hook` is a template, not a per-session row** — has `UNIQUE (workspace_id, department_id, hook_type)` constraint (`supabase/migrations/20260620120100_day_line_session_enums.sql`). Binding to a single `day_line` would break lifecycle-fire semantics.
5. **`day_line_status` is derived, never stored** — `apps/web/src/lib/cascade/derive-day-line-status.ts`. Precedence: locked > cancelled > draft > closed > active.
6. **One `day_line` per `(department_session_id, location_id)`** — `CONSTRAINT uq_day_line UNIQUE (department_session_id, location_id)`. Verified: `supabase/migrations/20260620120200_day_line_table.sql:21`.
7. **Mobile is read-only** — ADR-0133. Only `shift-lifecycle.clock_in/out` writes from mobile.
8. **Telemetry every mutation** — `emit()` from `@smartout/telemetry`. Every new event in BOTH `SmartoutEvent` union AND `EVENT_ROUTING` map or it silently drops.
