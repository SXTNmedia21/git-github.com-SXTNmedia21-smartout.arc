---
title: "Shift Clock — Architecture"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: shift-clock
tags: [shift-clock, architecture, components, mobile, web, bff, edge-function]
mirror: verified
last_verified: 2026-05-23
---

# Shift Clock — Architecture

## Layer Overview

```
L1  Web UI (10 components)          apps/web/src/app/dashboard/shift-clock/
L2  Mobile UI (9 components)        apps/mobile/src/components/shift-clock/
L3  Shared package (pure logic)     packages/shift-clock/src/
L4  Data layer (time_entry, config) timesheet.time_entry + public.shift_clock_config
L5  Cross-domain triggers           trg_punch_rounding (payroll) + trg_push_session_pending_signoff (notifications)
```

## L1 — Web UI (10 components)

All in `apps/web/src/app/dashboard/shift-clock/`.

| Component | Path:line | Purpose |
|---|---|---|
| `page.tsx` | `page.tsx:1` | Route entry. Role-gates: employee → ShiftClockView; manager → LeaderOverview. Mounts ShiftClockToolsBridge for Botsson integration. |
| `PunchButton.tsx` | `PunchButton.tsx:1` | Full-screen punch-in animation. Phases: idle → scanning (4 verification steps) → success (confetti) → complete. CSS keyframes, no framer-motion. |
| `ShiftClockView.tsx` | `ShiftClockView.tsx:1` | Primary employee-facing component. Fullscreen layout. Renders based on phase: idle/clocked_in/on_break/summary. |
| `ShiftClockHeader.tsx` | `ShiftClockHeader.tsx:1` | Live elapsed timer (Geist Mono, updates every second), status badge (green "PA VAKT" / orange "PAUSE"), department + zone. |
| `ShiftClockActions.tsx` | `ShiftClockActions.tsx:1` | 2x2 action grid: BreakToggle, NoteInput trigger, SupplementSheet trigger, CallLeaderButton. |
| `BreakToggle.tsx` | `BreakToggle.tsx:1` | Start/end break button. Shows elapsed break time when on break. GPS snapshot at start/end. |
| `NoteInput.tsx` | `NoteInput.tsx:1` | Textarea + submit for shift notes. Calls `useShiftNotes.addNote()`. |
| `SupplementSheet.tsx` | `SupplementSheet.tsx:1` | Side drawer (shadcn Sheet) for claiming manual wage supplements. Zod-validated. |
| `CallLeaderButton.tsx` | `CallLeaderButton.tsx:1` | V1: switches active tab to Chat/shift-thread. V2 (planned): LiveKit WalkieTalkie voice call to duty leaders. |
| `ShiftClockSummary.tsx` | `ShiftClockSummary.tsx:1` | Post-punch-out summary: stats grid (work time, breaks, points placeholder, streak placeholder), supplements list, comment textarea, "Ferdig" button. |
| `LeaderOverview.tsx` | `LeaderOverview.tsx:1` | Manager view: card grid of every employee scheduled today. Grouped by status (clocked_in/on_break/waiting). Realtime `timesheet.time_entry` subscription (`LeaderOverview.tsx:221`). Manual punch-in from card. Queries: `schedule_shift` + `timesheet.time_entry` (`LeaderOverview.tsx:197-210`). |
| `ShiftClockTabs.tsx` | `ShiftClockTabs.tsx:1` | Three-tab section: Oppgaver (tasks placeholder), Chat (session + shift-thread), Notater (notes). |

**Hooks** (in `apps/web/src/hooks/shift-clock/`):

| Hook | Purpose |
|---|---|
| `useShiftClock.ts` | Main state machine. TanStack Query + Supabase mutations. Context + punch_in/out/break operations. |
| `useGPSGuard.ts` | `navigator.geolocation` wrapper. GPS snapshot + distance check via `calculateGPSDistance`. |
| `useShiftChat.ts` | Session chat + shift-thread via Supabase Realtime (`chat_conversation/chat_message`). |
| `useShiftNotes.ts` | CRUD for `public.shift_note` via Supabase. |
| `useSupplements.ts` | List `payroll_supplement_rule` rows + insert `payroll_manual_supplement` for claims. |
| `useShiftClockConfig.ts` | Fetches cascading `shift_clock_config` (team > department > workspace). |
| `useBreakRules.ts` | Fetches `payroll_break_rule` rows for break classification. |

**Botsson bridge** (in `apps/web/src/app/dashboard/shift-clock/_tools/`):
- `shift-clock-tools-bridge.tsx` — mounts at page level. Exposes shift state to Botsson voice + chat tools.
- `use-shift-clock-tools.ts` — defines `ShiftClockUiActions` interface (line 66: "Current shift clock state derived from the active time_entry").

### LeaderOverview ownership note

`LeaderOverview.tsx` lives in `apps/web/src/app/dashboard/shift-clock/` and queries `timesheet.time_entry` directly (`LeaderOverview.tsx:197`). It is **shift-clock-domain owned** — it displays reality data for manager oversight. It does NOT invoke day-session leader-actions. It provides manual punch-in (writes `time_entry`), which is a shift-clock operation.

`CallLeaderButton.tsx` is also **shift-clock-domain owned** — V1 is a UI-only tab switch. V2 will invoke LiveKit from within the shift-clock surface. It does not invoke day-session capabilities.

## L2 — Mobile UI (9 components)

All in `apps/mobile/src/components/shift-clock/`.

| Component | Path:line | Purpose |
|---|---|---|
| `ShiftClockView.tsx` | `ShiftClockView.tsx:1` | Main layout orchestrator. Phases: idle/before_shift → PunchAnimation; clocked_in → Header+Actions+content; on_break → break timer; summary → ShiftClockSummary; after_shift → AfterShiftView (handoff form). |
| `PunchAnimation.tsx` | `PunchAnimation.tsx:1` | Flagship punch-in animation. react-native-reanimated + expo-haptics. Mirrors web phases without framer-motion. |
| `ShiftClockHeader.tsx` | `ShiftClockHeader.tsx:1` | Live timer (monospace), status badge, shift details. Uses reanimated pulse on badge. |
| `ShiftClockActions.tsx` | `ShiftClockActions.tsx:1` | 2x2 action grid (Break, Note, Supplements, Call leader). lucide-react-native icons. |
| `BreakToggle.tsx` | `BreakToggle.tsx:1` | Break start/end with haptic feedback. Elapsed break timer. |
| `ShiftClockSummary.tsx` | `ShiftClockSummary.tsx:1` | Post-punch-out summary. React Native primitives, mirroring web layout. |
| `SupplementSheet.tsx` | `SupplementSheet.tsx:1` | `@gorhom/bottom-sheet` slide-up panel for supplement claims. Mirrors web SupplementSheet. |
| `NoteSheet.tsx` | `NoteSheet.tsx:1` | Bottom drawer for adding shift notes. BottomSheet + multiline TextInput. |
| `ShiftChatUnavailableBanner.tsx` | `ShiftChatUnavailableBanner.tsx:1` | Temporary — replaces chat input while mobile-shift-chat-bff-migration is pending. Chat list stays visible; send is blocked. |

**Hooks** (in `apps/mobile/src/hooks/shift-clock/`):

| Hook | Purpose |
|---|---|
| `useShiftClock.ts` | Offline-first state machine. All mutations via SQLite sync queue. |
| `useGPSGuard.ts` | `expo-location` wrapper. GPS snapshot at state transitions. |
| `useBreakRules.ts` | Fetches `payroll_break_rule` from DB/cache. |
| `useShiftChat.ts` | Chat with offline queue. Currently broken (channel_id schema mismatch — ShiftChatUnavailableBanner active). |
| `useShiftNotes.ts` | CRUD with offline queue. |
| `useSupplements.ts` | Supplement claims with offline queue. |

## L3 — Shared Package

`packages/shift-clock/src/` — zero platform or DB dependencies. Exported from `packages/shift-clock/src/index.ts`.

| File | Purpose |
|---|---|
| `types.ts` | `ShiftClockPhase`, `ShiftClockState`, `GPSSnapshot`, `GPSConfig`, `BreakEntry`, `BreakClassification`, `SupplementOption`, `SupplementClaim`, `PunchResult`, `ComplianceWarning` |
| `schemas.ts` | Zod: `gpsSnapshotSchema`, `punchInPayloadSchema`, `punchOutPayloadSchema`, `breakStartPayloadSchema`, `breakEndPayloadSchema`, `supplementClaimSchema`, `shiftNoteSchema` |
| `state-machine.ts` | `canTransition()`, `getNextPhase()`, `ShiftClockTransition` |
| `utils/gps-distance.ts` | `calculateGPSDistance()` — Haversine formula |
| `utils/break-classifier.ts` | `classifyBreak()` — pure fn: (workMinutes, breakDuration, rules) → paid/unpaid |
| `utils/points-calculator.ts` | `calculatePunchPoints()` — Phase 2 gamification (wired in package, no UI yet) |

## L4 — Data Layer

Tables: see DATA-MODEL.md.

Schema placement decision (from spec `2026-03-24-shift-clock-design.md:538-540`): `shift_clock_config` and `shift_note` in `public` schema. `time_entry` stays in `timesheet` schema (pre-existing). Too few new tables (2) to justify a dedicated schema.

## L5 — Cross-Domain Triggers

| Trigger | Migration | Who fires | What it does | Owner |
|---|---|---|---|---|
| `trg_punch_rounding` | `20260527101600` | `BEFORE INSERT OR UPDATE OF punch_in, punch_out ON timesheet.time_entry` | Reads `payroll.workspace_settings.punch_rounding_*` and rounds timestamps | Payroll domain (logic), timesheet schema (location) |
| `trg_push_session_pending_signoff` | `20260516150000` | `AFTER UPDATE OF status ON public.department_session` | Fires when session transitions `active→pending_signoff`; dispatches clockout deep-link push to duty leader | Notifications domain (dispatch), shift-clock domain (semantic ownership of the event) |

## Server-Side Compliance

`supabase/functions/shift-clock-compliance/index.ts` — JWT-only EF. Called by web client before confirming punch-in. Returns `{allowed, warnings, block_reason}`.

- GPS distance: Haversine vs `shift_clock_config.gps_reference_lat/lng` and `gps_radius_meters`.
- Rest period: queries last `time_entry.punch_out` for `profile_id`, checks ≥11h gap.
- Weekly hours: queries `payroll_calculation` sum for the current week.

## Mobile Sync Architecture

Mobile punch writes go through `apps/mobile/src/lib/sync/queue.ts` → SQLite → SyncWorker → `action-map.ts`.

Relevant action handlers in `apps/mobile/src/lib/sync/action-map.ts`:
- `punch_in` (line 67): `fromOtherSchema("timesheet", "time_entry").insert(p)`
- `punch_out` (line 69): `timesheet.time_entry` update via `.eq("time_entry_id", p.time_entry_id)`
- `break_start` (line 191): JSONB update to `time_entry.breaks`
- `break_end` (line 232): JSONB update to `time_entry.breaks`

All mobile punches go direct to Supabase — no BFF. ADR-0277 (proposed) mandates BFF routing. **CURRENT STATE: direct Supabase. DEBT.**
