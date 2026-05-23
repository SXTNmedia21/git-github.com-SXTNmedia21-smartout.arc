---
title: "Shift Clock — Domain README"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: shift-clock
tags: [shift-clock, punch, time_entry, reality-source, L2, D6, mobile]
mirror: mixed
last_verified: 2026-05-23
---

# Shift Clock Domain

> **L2 Reality of the 5-layer lifecycle.** This domain owns everything from the moment an employee presses "Stemple inn" to the moment their `time_entry` row is consumed by the Interpretation layer. Scheduling (L1 Execution) produces `schedule_shift`. Shift-clock produces `time_entry`. Payroll (L4 Derivation) reads `time_entry` + `shift_hour_interpretation` to build `payroll.calculation`.

## Build state

| Surface | Status |
|---|---|
| Web punch UI (10 components) | Built |
| Mobile punch UI (9 components) | Built |
| Shared package `@smartout/shift-clock` | Built (pure logic — state machine, types, schemas, utils) |
| `timesheet.time_entry` schema | Built |
| `public.shift_clock_config` | Built |
| `public.shift_note` | Built |
| GPS columns on `time_entry` | Built |
| `shift-clock-compliance` Edge Function | Built |
| Mobile sync queue (punch_in / punch_out / breaks) | Built |
| Leader-overview (manager view) | Built (web only) |
| `shift_hour_interpretation` (L3) | **NOT BUILT** — belongs to scheduling Interpretation layer |
| Gamification points/streaks UI | **NOT BUILT** — Phase 2, graceful degradation in V1 |
| Mobile clock via BFF | **NOT BUILT** — ADR-0277 proposed, not accepted; direct Supabase still active |
| `shift-clock-compliance` on mobile (pre-punch gate) | Gap — mobile bypasses EF |

## Key files

| Path | Role |
|---|---|
| `apps/web/src/app/dashboard/shift-clock/` | 10 web components + page.tsx |
| `apps/mobile/src/components/shift-clock/` | 9 mobile components |
| `apps/mobile/src/hooks/shift-clock/` | 6 mobile hooks (offline-queue backed) |
| `apps/web/src/hooks/shift-clock/` | 8 web hooks (TanStack Query + Supabase) |
| `packages/shift-clock/src/` | Pure logic: state-machine, types, schemas, utils |
| `supabase/functions/shift-clock-compliance/` | Server-side GPS + compliance EF |

## Agent Guardrails

1. **Shift-clock owns L2 Reality only.** Never modify `schedule_shift` (scheduling owns L1 Execution). Never write `shift_hour_interpretation` (scheduling Interpretation layer, not built yet). Never write `shift_cost_snapshot` (payroll owns L4 Derivation).

2. **ADR-0097 time_entry immutability.** `time_entry` is append-only after the Interpretation layer has consumed the row (`status='completed'` + `shift_hour_interpretation` exists). Active punch sessions may UPDATE (breaks JSONB, punch_out). Manager corrections NEVER edit `time_entry` — they produce Decision-layer override artifacts in `shift_approval.edit_justification + approved_hours`.

3. **Rounding is payroll-side.** The `trg_punch_rounding` trigger (`20260527101600`) fires on `timesheet.time_entry` INSERT/UPDATE but it reads from `payroll.workspace_settings`. The trigger physically lives in the timesheet schema but encodes a payroll policy. Shift-clock does not own the rounding logic — payroll owns it. Do not move or modify the trigger without payroll-domain consent.

4. **GPS columns are storage, not policy.** Shift-clock stores `punch_in_location`, `punch_out_location`, `break_locations` JSONB on `time_entry`. Geofence enforcement (block/allow) runs in the `shift-clock-compliance` Edge Function. Policy enforcement is in the EF, not in the DB columns. Do not add blocking logic to DB triggers.

5. **Mobile clock-in MUST go through BFF per ADR-0277.** Currently mobile uses direct Supabase via the SQLite sync queue. ADR-0277 (proposed) mandates a web BFF as the proper path (authority gate, audit reason, source attribution). Until ADR-0277 is accepted and implemented, direct Supabase is the live path — document as DEBT, never add new direct-Supabase mutations without flagging the ADR.

6. **Clock-out triggers downstream events.** Punch-out → `trg_push_session_pending_signoff` fires when `department_session` transitions to `pending_signoff`. This is a separate trigger from ADR-0187 (`trg_session_pending_signoff`). Both triggers coexist — do not merge them. Clock-out also closes the department session handoff window (day-session domain).

7. **`shift-clock-compliance` EF is the server authority for punch decisions.** Client-side GPS checks are UX-only (fast feedback). The EF is the canonical gate. Never let client code block a punch without EF confirmation.

8. **No dedicated capability tool for clock-in/out.** The `shift-lifecycle` capability (`packages/ai/src/capabilities/shift-lifecycle/`) provides `clock_in_check` (ADR-0243 obligation gate). Actual punch mutations are client-side (web/mobile) or via sync queue — not through AI capability tools. This is by design (D6 execution is real-time, not agent-mediated).
