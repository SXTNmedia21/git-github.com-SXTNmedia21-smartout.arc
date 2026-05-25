---
title: Restaurant Week Simulation — Bug Tracker
status: in_progress
created: 2026-05-25
updated: 2026-05-25
module: shift-clock
tags: [mobile, gps, punch, telemetry, simulation]
---

# Restaurant Week Simulation — Bugs

Simulation run: 2026-05-25. Covers mobile punch-clock flow under restaurant-week
operating conditions (high footfall, staff from multiple departments, GPS enforcement active).

## Bug index

| ID | Component | Severity | Status |
|----|-----------|----------|--------|
| BUG-SIM-10 | `use-punch.ts` GPS phantom wire | HIGH | FIXED — see below |

---

## BUG-SIM-10 — GPS phantom wire: `gps_verified` hardcoded false, `useGPSGuard` never invoked

**Component:** `apps/mobile/src/hooks/mutations/use-punch.ts`
**Severity:** HIGH
**Pattern:** Contract-promise-without-fulfillment sub-pattern A (L-0353 / ADR-0421 sub-check A)

### Description

`useGPSGuard` hook existed at `apps/mobile/src/hooks/shift-clock/useGPSGuard.ts` with full
GPS permission request + geofence check implementation. `use-punch.ts` never invoked it.
`gps_verified: false` was hardcoded at two emit sites (punch-in line 88-89, punch-out line 177).

Consequences:
- Telemetry lied: every punch-in emitted `gps_verified: false` even when the employee
  was on-site and GPS was available. Audit trail for GPS-enforced workspaces was corrupt.
- No geofence enforcement: employees could punch in from anywhere, regardless of workspace
  `gps_required` and `gps_radius_meters` config in `shift_clock_config`.
- `gps_distance_meters: null` always — analytics on distance-from-venue useless.

### Root cause

`usePunch` (hook) composed zero GPS logic despite `useGPSGuard` being present in the same
codebase. `ShiftClockView` passed no GPS config to `punchIn()`, which had no `gpsConfig`
parameter and no guard invocation.

### Fix — Sortie C, commit [sha to be filled post-commit]

**Files changed:**

1. `apps/mobile/src/hooks/mutations/use-punch.ts`
   - Import `useGPSGuard` and `calculateGPSDistance` from `@smartout/shift-clock`
   - Compose `useGPSGuard()` inside `usePunch` hook
   - Add `gpsConfig: GPSConfig | null` parameter to `punchIn()`
   - GPS gate runs BEFORE profile resolution + enqueue:
     - `gps_required=true` + permission denied/unavailable → throw Norwegian Bokmål error
     - `gps_required=true` + outside radius → throw Norwegian Bokmål error with over-limit meters
     - `gps_required=false` or `gpsConfig=null` → pass through unconditionally
   - `gps_verified` and `gps_distance_meters` in punch-in emit carry the actual guard verdict
   - punch-out `gps_verified: false` replaced with named constant `GPS_NOT_VERIFIED_AT_PUNCHOUT`
     (punch-out is not a location enforcement point; intent documented in comment)

2. `apps/mobile/src/hooks/queries/use-shift-clock-config.ts` (new)
   - Mobile port of `apps/web/src/hooks/shift-clock/useShiftClockConfig.ts`
   - Accepts `workspaceId`, optional `departmentId`, optional `teamId`
   - Cascading resolution: team > department > workspace
   - 5-minute stale cache (config rarely changes)

3. `apps/mobile/src/components/shift-clock/ShiftClockView.tsx`
   - Import and call `useShiftClockConfig(workspaceId, departmentId, teamId)`
   - Pass `clockConfig?.gpsConfig ?? null` to `punchIn()` in `handlePunchIn`
   - Wrap `punchIn()` call in try/catch — GPS errors surface via `Alert.alert("Stempling avvist", message)`
   - Return `{ allowed: false }` on GPS block (no punch row, no telemetry emit)

### Follow-up (NOT in this sortie)

- GPS columns (`gps_verified`, `gps_lat`, `gps_lng`, `gps_accuracy`) are NOT yet in the
  `time_entry` table or sync-queue `punchInSchema`. The verified lat/lng/accuracy are only
  in telemetry. A migration sortie is needed to persist them in the DB row and extend the
  Zod schema in `apps/mobile/src/lib/sync/schemas.ts`.
- Offline queue: when GPS is required and the device has no GPS hardware (always returns null),
  we currently block the punch. Offline-with-GPS-required is an open UX question.
