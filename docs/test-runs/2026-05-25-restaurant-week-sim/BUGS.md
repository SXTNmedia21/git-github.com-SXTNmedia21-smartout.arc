---
title: Restaurant Week Sim 2026-05-25 — Bug Tracker
status: in_progress
created: 2026-05-25
updated: 2026-05-25
module: communication
tags: [sim, audience-resolver, cross-tenant, workspace-scope, schedule, helpdesk, mobile, gps]
---

# Restaurant Week Sim — Bug Tracker

## BUG-SIM-11

| Field | Value |
|-------|-------|
| ID | BUG-SIM-11 |
| Severity | P0 (cross-tenant audience leak risk) |
| Status | FIXED |
| Component | `packages/ai/src/capabilities/communication/audience-resolver.ts` + `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts` |
| Introduced | Wave A, commit `3854f3513` |
| Fixed in | See commit below |

### Description

`on_duty` branch in both `audience-resolver.ts` (server-side capability) and
`use-audience-resolver.ts` (client-side hook) queried `timesheet.time_entry`
without a `workspace_id` filter. Every other branch (`all`, `department`, `role`)
scoped the query to the requesting workspace.

A workspace A announcement targeted at `on_duty` audience would include
currently-clocked-in employees from ALL workspaces sharing the Supabase tenant —
cross-tenant audience leak.

### Root Cause

Asymmetric filter application. The `on_duty` query pattern was ported from
`use-broadcast-recipients.ts` but the workspace scoping was omitted in both the
server-side port (Sortie D reference: `audience-resolver.ts:63-68`) and the
client-side hook (`use-audience-resolver.ts:51-56`).

### Fix

Added `.eq("workspace_id", workspaceId)` / `.eq("workspace_id", wsId)` to the
`on_duty` branch in both files, between `.select("profile_id")` and
`.is("punch_out", null)`.

Aligns with ADR-0151 (server-derived workspace_id) and L-0177 (no silent
cross-tenant fallback).

**Fixed in commit:** `809ad0c94`

### Verification

- `pnpm --filter @smartout/ai typecheck` passes
- Mental scenario: workspace A `on_duty` query now returns only workspace A
  time-entries with open punch_out. Workspace B employees excluded.
- No `audience-resolver.test.ts` exists — noted for follow-up (separate test
  sortie needed per BUG-SIM-11 follow-up).

---

## BUG-SIM-08 — schedule: shift lookup silently returns empty (get_colleagues_on_shift)

| Field | Value |
|-------|-------|
| Status | FIXED in commit (see Sortie E) |
| Capability | `schedule` |
| Tool | `get_colleagues_on_shift` |
| File | `packages/ai/src/capabilities/schedule/tools.ts` line 136 |
| Severity | High — silent empty result, no error surfaced to user |

**Root cause:** `.eq("id", params.shift_id)` filtered against the `schedule_shift` table whose PK column is `schedule_shift_id`, not `id`. Every lookup returned 0 rows. The select at line 146 also named the column `id` instead of `schedule_shift_id`.

**Fix:** `feat/schedule-pk-fix` — Sortie E. Replaced `.eq("id", ...)` with `.eq("schedule_shift_id", ...)` and updated the select string to name `schedule_shift_id` correctly.

---

## BUG-SIM-09 — schedule: shift detail lookup silently returns not_found (get_shift_detail)

| Field | Value |
|-------|-------|
| Status | FIXED in commit (see Sortie E) |
| Capability | `schedule` |
| Tool | `get_shift_detail` |
| File | `packages/ai/src/capabilities/schedule/tools.ts` lines 241 + 243 |
| Severity | High — every `get_shift_detail` call returns `{ error: "shift_not_found" }` |

**Root cause:** Same PK column mismatch. `.select("id, ...")` named a non-existent column; `.eq("id", params.shift_id)` matched nothing.

**Fix:** Same Sortie E commit. Select now uses `schedule_shift_id`; filter now uses `.eq("schedule_shift_id", ...)`.

---

## Additional fix (same commit) — get_today_schedule select column

| Field | Value |
|-------|-------|
| Status | FIXED in commit (see Sortie E) |
| Tool | `get_today_schedule` |
| File | `packages/ai/src/capabilities/schedule/tools.ts` line 208 |

Select string listed `id` instead of `schedule_shift_id`. Not in the original sim bug list but identified during the fix sweep — same class of error.

---

## PRODUCT bugs

### BUG-SIM-05 — HelpDesk UI bypasses capability, writes directly to deprecated `help_request` table 🔴 CRITICAL — **FIXED**

- **Where:**
  - `apps/web/src/app/dashboard/komm/_components/HelpDesk.tsx`
  - `apps/web/src/app/dashboard/komm/_hooks/use-help-requests.ts:49-60`
- **Baseline cross-ref:** BUG-20 (helpdesk SLA: 0/4 PASS, 2026-05-23 sweep)
- **ADR violated:** ADR-0173 frozen-4 capability boundary. Direct `supabase.from('help_request').insert(...)` from `use-help-requests.ts` bypassed the `helpdesk_query` capability entirely, leaving:
  - No `gate_action` audit row
  - No `helpdesk.query.opened` telemetry emit
  - No `engine_state` ticket (SLA trigger never fired — root cause of BUG-20's 0/4 PASS)
  - Writes to deprecated `help_request` table instead of canonical `engine_state`
- **Schema mapping gap documented:**
  - `title` → `summary` (maps cleanly, 3-200 chars)
  - `description` has no direct counterpart in `openPrivateTicket` — concatenated to summary (truncated to 200 chars) to preserve information, not silently dropped
  - `desk_channel_id` was not collected by the form — now required via `HelpDesk` `deskChannelId` prop; submit disabled when missing (orphan-component guard)
- **Fix:** `feat/helpdesk-rewire-openticket` — commit `<sha>` (see git log)
  - `use-help-requests.ts`: replaced `help_request` direct write with `openPrivateTicket` Server Action call; replaced `help_request` read with `engine_state` query (process_id='helpdesk_query_lifecycle', requester_profile_id filter via JSONB path)
  - `HelpDesk.tsx`: added `deskChannelId?: string` prop; updated `useHelpRequests(profileId)` + `useCreateHelpRequest(profileId, deskChannelId)` signatures; submit disabled when `!deskChannelId`
  - Telemetry + gate_action now owned by `openPrivateTicket` Server Action (no double-emit in `onSuccess`)
  - Read shape preserved: `HelpRequest` type unchanged for display compatibility; `status` mapped from engine_state values via `mapEngineStatus()`
- **Remaining gap:** `HelpDesk` component is currently orphaned (not rendered in any page). A parent page that mounts it must supply `deskChannelId` — this requires a workspace-level helpdesk channel lookup at the mount site. Tracked as follow-up (Phase F0 G5 family — workspace config surface).

---

## BUG-SIM-10 — GPS phantom wire: `gps_verified` hardcoded false, `useGPSGuard` never invoked

**Component:** `apps/mobile/src/hooks/mutations/use-punch.ts`
**Severity:** HIGH
**Pattern:** Contract-promise-without-fulfillment sub-pattern A (L-0353 / ADR-0421 sub-check A)
**Status:** FIXED — Sortie C, commit `d9f0f5712`

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

### Fix — Sortie C, commit d9f0f5712

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
