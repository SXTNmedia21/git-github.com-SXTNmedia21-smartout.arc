---
title: "Shift Clock — Roadmap"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: shift-clock
tags: [shift-clock, roadmap, phase-2, gamification, geofence, mobile-bff]
mirror: aspirational
last_verified: 2026-05-23
---

# Shift Clock — Roadmap

> This file is aspirational. All confirmed shipped work lives in ARCHITECTURE.md + DATA-MODEL.md. See GAPS-AND-DEBT.md for known gaps.

## Completed (V1)

- Core state machine: IDLE → CLOCKED_IN → ON_BREAK → SUMMARY (web + mobile)
- `timesheet.time_entry` schema + GPS columns
- `public.shift_clock_config` (cascading: team > department > workspace)
- `public.shift_note`
- `shift-clock-compliance` Edge Function (GPS block + 11h rest + weekly hours)
- 10 web components + leader overview
- 9 mobile components + 6 offline-queue hooks
- `@smartout/shift-clock` pure-logic package (state machine, types, schemas, utils)
- Payroll punch rounding trigger (`trg_punch_rounding`)
- Clockout push dispatch trigger (`trg_push_session_pending_signoff`)
- Manual time entry correction flow (manager) — `JOURNEY-mvp-blockers-manual-time-entry.md`
- `clock_in_check` capability tool in `shift-lifecycle` (ADR-0243 obligation gate)
- E2E spec `journey-shift-clock.spec.ts` (admin creates shift → employee punches in/breaks/out)

## Phase 2: Gamification

Points, streaks, and achievements gated behind feature flag. All calculation logic is already shipped in `packages/shift-clock/src/utils/points-calculator.ts` — graceful degradation active in V1.

- `points_event` table migration
- Points UI in `PunchButton` success animation ("+7 poeng — Tidlig fugl!" badge)
- Points + streak display in `ShiftClockSummary`
- Achievement triggers: `first_punch` (10 pts), `early_bird` (5 pts), `perfect_week` (25 pts)

Reference: spec `2026-03-24-shift-clock-design.md:586-604`

## Phase 3: Mobile BFF (ADR-0277)

Mobile punch writes currently bypass every server-side concern (authority gate, audit reason, source attribution). ADR-0277 proposes routing mobile mutations through the web BFF.

When accepted:
- Remove direct `fromOtherSchema("timesheet", "time_entry").insert()` from `action-map.ts:67`
- Add BFF route `/api/mobile/shift-clock/punch` with authority gate + audit reason
- Align with `shift-clock-compliance` EF pre-punch validation (currently mobile skips this)
- Add source attribution `source='mobile_punch'` to activity_trail

Reference: `docs/decisions/0277-mobile-shift-authoring-via-bff.md` (status: proposed)

## Phase 4: Geofence Policy

Currently GPS coordinates are stored on `time_entry` but enforcement (block/allow) lives in the EF. Geofence validation against `department_operating_hours` (location-based) is not implemented.

- Wire `shift_clock_config.gps_reference_lat/lng` to department/location seed data
- Scheduling domain gap: `punch_in_location` captured but never validated against `department_operating_hours` (flagged in scheduling GAPS §G2)
- Automatic geofence punch-in (optional feature, not in V1 scope)

## Phase 5: Leader Handoff Polish

- `LeaderOverview` manual punch-in currently a UI stub — full implementation pending
- Mobile leader-overview surface (ADR-0133 prohibits authoring on mobile, but read-only leader view is permitted)
- `CallLeaderButton` V2: LiveKit WalkieTalkie voice call to all duty leaders on shift

Reference: spec `2026-03-24-shift-clock-design.md:397-420` (WalkieTalkie integration)

## Phase 6: Interpretation Layer (L3)

The `shift_hour_interpretation` table (ADR-0095 Interpretation layer) is not built. Until it exists:
- `derive_shift_hours(shift_id)` RPC derives from `time_entry` + D3 rules
- After L3 is built, `time_entry` becomes fully immutable (currently mutable while `clocked_in`)

Owner: scheduling domain (not shift-clock — L3 is Interpretation, not Reality).

## ADR References

| ADR | Topic |
|---|---|
| ADR-0095 | Five-layer lifecycle architecture |
| ADR-0097 | `time_entry` as L2 Reality source (immutable after Interpretation consumes) |
| ADR-0133 | Mobile surface boundary — clock is the permitted write verb |
| ADR-0187 | `trg_session_pending_signoff` sole emitter — do not merge with clockout push trigger |
| ADR-0243 | `is_employee_blocked` RPC + obligation gate pre-clock |
| ADR-0277 | Mobile shift authoring via BFF (proposed) |
