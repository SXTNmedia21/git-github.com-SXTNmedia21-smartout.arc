---
title: "Shift Clock — User Flows"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: shift-clock
tags: [shift-clock, journeys, punch, employee, manager, mobile, web]
mirror: verified
last_verified: 2026-05-23
---

# Shift Clock — User Flows

## Journey Sources

| Journey | Path | Status |
|---|---|---|
| ShiftClock fullscreen flow | `docs/journeys/JOURNEY-shift-clock.md` | done |
| Manual time entry (manager correction) | `docs/journeys/JOURNEY-mvp-blockers-manual-time-entry.md` | verified (2026-05-13) |

## Web vs Mobile Parity

| Flow | Web | Mobile |
|---|---|---|
| Employee punch-in | ✅ `ShiftClockView` + `PunchButton` | ✅ `PunchAnimation` + `useShiftClock` (offline-queue) |
| Active shift (break/note/supplement/call) | ✅ `ShiftClockActions` + `ShiftClockTabs` | ✅ `ShiftClockActions` + 4 action hooks |
| Punch-out + summary | ✅ `ShiftClockSummary` | ✅ `ShiftClockSummary` |
| Ad-hoc shift creation | ✅ `ShiftClockView` idle variant B | 🔴 Not built |
| GPS guard | ✅ `useGPSGuard` (navigator.geolocation) | ✅ `useGPSGuard` (expo-location) |
| Compliance pre-punch | ✅ calls `shift-clock-compliance` EF | 🔴 Not wired — mobile skips EF |
| Leader overview | ✅ `LeaderOverview` | 🔴 Not built |
| Manual punch-in (manager) | ✅ `LeaderOverview` card action | 🔴 Not built |
| Shift chat | ✅ `ShiftClockTabs` ChatTab | 🟡 Blocked (ShiftChatUnavailableBanner) |

## Key Role Boundaries

**Employee** (role: employee, trainee):
- Self punch-in/out only
- Register own supplements (pending approval)
- Add own notes
- Call leader (tab switch V1, LiveKit V2)

**Manager/Admin** (role: manager, admin):
- View leader overview with all active shifts
- Manual punch-in for waiting employees
- Review + approve/reject supplement claims
- Manual time entry correction (via `JOURNEY-mvp-blockers-manual-time-entry.md`)

## Summary of Key Flows (from JOURNEY-shift-clock.md)

### Employee Punch In — Planned Shift
Precondition: authenticated employee, `schedule_shift` within punch window (default ±30 min).

Steps: opens ShiftClock → PunchButton scanning sequence (GPS, identity, shift activation, session start) → `shift-clock-compliance` EF validates → `time_entry` INSERT (punch_in=now) + `schedule_shift.status='active'` → success animation → live timer.

### Employee Punch In — Ad-hoc
Precondition: no scheduled shift, `shift_clock_config.adhoc_shifts_enabled=true`.

Options: (A) claim unassigned shift with `is_adhoc=false`, `employee_id IS NULL` → normal punch flow; (B) create new ad-hoc: system inserts `schedule_shift` with `is_adhoc=true` → if `adhoc_requires_approval` → leader push → pending state.

### Employee Break
Steps: tap "Pause" → GPS snapshot → `time_entry.breaks` JSONB updated (open entry) → orange break timer. Tap "Tilbake fra pause" → GPS snapshot → break entry closed.

Break classification (paid/unpaid) runs server-side via `classifyBreak()` from `payroll_break_rule`. Employee never sees the distinction — it affects payroll only.

### Employee Punch Out
Steps: tap "Stemple ut" at bottom → GPS snapshot → `time_entry.punch_out=now, status='completed'` → `trg_push_session_pending_signoff` fires if session transitions to `pending_signoff` → `ShiftClockSummary` shown.

### Manager Manual Punch Correction
Route: `/dashboard/payroll/[periodId]` → employee drawer → "Vakter" tab → "Korriger tid".

Action: `manualTimeEntryAction` server action → UPSERT in `timesheet.time_entry` with reason ≥8 chars → emit `shift.manual_time_entry_created`. Uses `gateAction({ capability: "shift.manual_time_entry" })`.

This is a Decision-layer override path — it writes a new `time_entry` row (for missing punch) or corrects via override artifacts, per ADR-0097 rules.

## GPS Guard Detail

State transitions with GPS involvement:
- `IDLE → CLOCKED_IN`: GPS check — **can block** if `gps_required=true` and distance > `gps_radius_meters`.
- `CLOCKED_IN → ON_BREAK`: GPS snapshot (non-blocking).
- `ON_BREAK → CLOCKED_IN`: GPS snapshot (non-blocking).
- `CLOCKED_IN → SUMMARY`: GPS snapshot at punch-out (non-blocking — employee must be able to leave).

Blocking only applies to punch-in. This is enforced in `shift-clock-compliance` EF server-side; client-side check is UX-only.
