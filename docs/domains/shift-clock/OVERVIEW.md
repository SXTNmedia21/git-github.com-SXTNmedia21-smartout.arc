---
title: "Shift Clock — Overview"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: shift-clock
tags: [shift-clock, punch, time_entry, L2, reality-source, D6]
mirror: mixed
last_verified: 2026-05-23
---

# Shift Clock — Overview

## What and Why

The Shift Clock domain is the **L2 Reality layer** of the 5-layer shift lifecycle (ADR-0095). It answers one question: *what actually happened on this shift?*

When an employee presses "Stemple inn", reality begins. The clock produces `timesheet.time_entry` rows — immutable observations of punch-in time, GPS coordinates, break entries, and punch-out time. These rows are the atomic source of truth that every downstream layer (Interpretation, Derivation, Decision) must derive from — never modify.

**Why a dedicated domain?** Scheduling (L1) owns the plan (`schedule_shift`). Payroll (L4) owns the cost derivation (`shift_cost_snapshot`). Without a clearly bounded Reality layer, managers edit punch records directly to "fix" hours, breaking reproducibility and audit trails. ADR-0097 formalizes `time_entry` as the immutable source. This domain governs the surface that writes it.

## Cascade Placement

```
D6 Production layer — two roles:
  L1 Execution (Plan)   → scheduling domain  → schedule_shift
  L2 Reality            → shift-clock domain → time_entry     ← THIS DOMAIN
  L3 Interpretation     → scheduling domain  → shift_hour_interpretation (NOT BUILT)
  L4 Derivation         → payroll domain     → shift_cost_snapshot
  L5 Decision           → scheduling/payroll → shift_approval, daily_reconciliation
```

Shift-clock sits precisely at the L1→L2 seam: it consumes `schedule_shift` (reads the plan) and produces `time_entry` (writes the reality).

## Plan vs Execution Split with Scheduling

| Concern | Owner | Table |
|---|---|---|
| Which shifts exist, who is assigned | scheduling | `schedule_shift` |
| When employee actually clocked in/out | shift-clock | `timesheet.time_entry` |
| Session lifecycle (department active/closed) | day-session | `department_session` |
| Derived hours from rules | scheduling (L3, not built) | `shift_hour_interpretation` |

Shift-clock reads `schedule_shift` to know what shift the employee is about to start. It never writes `schedule_shift` (exception: `is_adhoc`, `adhoc_approved_by`, `adhoc_approved_at` columns — ad-hoc shifts are created here but still belong to the scheduling plan layer, consistent with the existing `schedule_shift` table ownership).

## Surfaces

### Web (`/dashboard/shift-clock`)

Two views on the same route, role-gated (`page.tsx:44-50`):

- **Employee view** (`ShiftClockView`) — fullscreen punch clock. IDLE → CLOCKED_IN → ON_BREAK → SUMMARY state machine. Fills the viewport.
- **Manager view** (`LeaderOverview`) — live grid of all active shifts for today. Manual punch-in capability. Realtime via Supabase subscription on `timesheet.time_entry`.

### Mobile (`/(app)/(home)/punch-clock`)

React Native equivalent of the employee view. Uses `expo-location` for GPS, `expo-haptics` for tactile feedback, `react-native-reanimated` for animations. All mutations go through the SQLite offline sync queue — punch-in is instant regardless of network state.

### Shared Package (`@smartout/shift-clock`)

Pure logic with zero platform or DB dependencies:
- State machine (`IDLE → CLOCKED_IN → ON_BREAK → SUMMARY`)
- Zod validation schemas for punch payloads
- GPS distance calculation (Haversine)
- Break classification (paid vs unpaid from `payroll_break_rule`)
- Points calculation (Phase 2, graceful degradation)

### Edge Function (`shift-clock-compliance`)

Server authority for punch-in decisions. Validates:
- GPS distance vs `shift_clock_config.gps_radius_meters` (can block)
- 11-hour rest period (advisory warning)
- Weekly hours limit (advisory warning)

Client-side checks are UX-only. The EF is the canonical gate.

## Key Design Decisions

| Decision | ADR |
|---|---|
| `time_entry` is append-only after Interpretation consumes it | ADR-0097 |
| Five-layer handoff architecture (L1–L5 ontology) | ADR-0095 |
| Mobile should route writes through web BFF (proposed, not yet accepted) | ADR-0277 |
| Mobile clock-in is the permitted write from mobile (ADR-0133 boundary) | ADR-0133 |
| Clock-out push dispatch is a separate trigger from engine_event emitter | ADR-0187 |
| Obligation check via `is_employee_blocked` RPC before clock-in | ADR-0243 |
