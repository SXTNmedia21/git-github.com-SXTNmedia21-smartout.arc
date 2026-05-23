---
title: "Shift Clock — Gaps and Debt"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: shift-clock
tags: [shift-clock, gaps, debt, adr-0277, mobile-bff, gamification]
mirror: verified
last_verified: 2026-05-23
---

# Shift Clock — Gaps and Debt

## Deviations (spec says X, code does Y)

### D1 — Spec: `apps/web/src/hooks/shift-clock/` contains 6 hooks; Code: 8 hooks (2 extra)

Spec (`2026-03-24-shift-clock-design.md:118-123`) listed 6 web hooks: `useShiftClock`, `useGPSGuard`, `useBreakRules`, `useShiftChat`, `useShiftNotes`, `useSupplements`. Code has 8: the 6 above plus `useShiftClockConfig.ts` (fetches cascading config) and `shift-clock-tools-bridge.tsx`/`use-shift-clock-tools.ts` (Botsson bridge, lives in `_tools/`). Not a bug — additions are justified by Botsson integration and config fetch needs. Acceptable deviation.

### D2 — Spec: LeaderOverview is Task 11 placeholder; Code: fully built

`page.tsx` comment says "LeaderOverview placeholder — will be implemented in Task 11" but `LeaderOverview.tsx` is fully implemented with Realtime subscription, card grid, and manual punch-in. The page.tsx placeholder function `LeaderOverviewPlaceholder()` coexists with the real import. The real `LeaderOverview` is imported and used. Minor naming confusion — can be cleaned up by removing the placeholder stub function from `page.tsx`.

### D3 — Spec: ChatTab ships session chat + shift thread; Code: `ShiftChatUnavailableBanner` blocks send

`ShiftClockTabs.tsx` renders `ShiftChatUnavailableBanner` instead of the full chat input because `useShiftChat.sendMessage` throws a Zod error (channel_id schema mismatch from ADR-0132 migration). Chat LIST is visible; send is blocked. Forward fix: `mobile-shift-chat-bff-migration` sortie.

### D4 — Spec: Voice call via LiveKit WalkieTalkie; Code: V1 is tab switch

`CallLeaderButton.tsx:1` docstring confirms V1 = tab switch (no LiveKit). V2 planned. Not a bug — documented graceful degradation.

## Gaps (not built, not in spec as excluded)

### G1 — Mobile pre-punch compliance (CRITICAL)

Mobile does not call `shift-clock-compliance` EF before punch-in. The `useShiftClock` mobile hook (`apps/mobile/src/hooks/shift-clock/useShiftClock.ts:65`: "this hook does not fetch auth context to stay lightweight") goes directly to the sync queue. Consequence: 11h rest check, weekly hours check, and GPS enforcement skip on mobile. Web calls the EF, mobile does not.

**Severity:** Medium-High. Compliance audit trail gap. GPS block only enforced on web.

### G2 — Mobile sync goes direct to Supabase (ADR-0277 gap)

`action-map.ts:67` does `fromOtherSchema("timesheet", "time_entry").insert(p)` directly — no authority gate, no BFF routing. ADR-0277 is proposed but not accepted. Until BFF route `/api/mobile/shift-clock/punch` exists, this gap remains.

**Severity:** Medium. Authority gate, audit reason, and source attribution missing on mobile punches.

### G3 — Gamification UI not built (Phase 2 deferred)

`packages/shift-clock/src/utils/points-calculator.ts` is built. Gamification tables (`points_event`) are NOT migrated. `PunchButton` success animation shows "Du er stemplet inn!" without points badge. `ShiftClockSummary` shows stats without points/streak. Feature flag gating is in place — graceful degradation works per spec.

### G4 — Ad-hoc shift on mobile not built

`ShiftClockView` web idle variant B shows open shifts + "Start ny ad-hoc vakt". Mobile has no equivalent ad-hoc flow.

### G5 — Leader overview on mobile not built

ADR-0133 permits read-only leader views on mobile. No mobile leader-overview component exists.

### G6 — Geofence policy not wired to department locations

GPS coordinates stored on `time_entry` but `shift_clock_config.gps_reference_lat/lng` are not seeded from department location data. Geofence validation against `department_operating_hours` is not implemented (scheduling domain GAPS §G2).

### G7 — `shift_hour_interpretation` (L3) not built

The L3 Interpretation table is missing (ADR-0095). While it doesn't exist, `time_entry` rows cannot technically be made fully immutable. `derive_shift_hours()` RPC runs on demand for payroll. Owner: scheduling domain.

## Overlap Edges

See `docs/domains/_DASHBOARD.md` for the master overlap table. Key edges for shift-clock:

| Other domain | Shared surface | Status |
|---|---|---|
| **scheduling** | `schedule_shift` — clock reads plan, writes `is_adhoc` columns. L1/L2 seam (ADR-0095). | resolved (keep — clear author/consumer) |
| **payroll** | `trg_punch_rounding` on `timesheet.time_entry` reads `payroll.workspace_settings`. Payroll reads `time_entry` for calc. | resolved (keep — trigger location vs logic owner documented) |
| **day-session** | Clock-out → `department_session.status` transition → `trg_push_session_pending_signoff` fires. Clock-in opens active session window. | resolved (keep — separate triggers per ADR-0187) |
| **notifications** | `trg_push_session_pending_signoff` calls `dispatch_push_notification()`. `20260516150000` migration in shift-clock group but dispatch is notifications domain. | resolved (keep — shift-clock owns semantic event; notifications owns dispatch) |
| **core-structure** | `shift_clock_config.department_id` FK → `department`. `shift_clock_config.team_id` FK → `team`. D1 envelope consumed. | resolved (keep — core-structure provides; shift-clock consumes) |
| **shift-lifecycle capability** | `clock_in_check` tool in `packages/ai/src/capabilities/shift-lifecycle/tools.ts:636`. Capability is scheduling-domain-owned; shift-clock domain provides the semantic context. | resolved (keep — no dedicated shift-clock capability; borrowed check tool from scheduling-owned shift-lifecycle capability) |
| **daytimeline (day-session)** | Clock events appear on the day-line view (`shift_session.clocked_in/out` events, ADR-0367). `shift_session` bridges scheduling plan ↔ clock reality. | resolved (keep — day-session owns daytimeline; shift-clock events are inputs) |

## Debt

### DEBT-1 — Duplicate WORKLOG paths

Two WORKLOG files exist for shift-clock:
- `docs/reports/worklogs/WORKLOG-shift-clock.md`
- `docs/worklogs/WORKLOG-shift-clock.md`

One path is the canonical reports location; the other is a legacy path. Should be reconciled: delete one, keep the other. Low priority.

### DEBT-2 — `supplement_claim_status` ENUM and `shift_note` created in `20260324100001`

The first mobile-fixes migration (`20260324100001`) created `shift_clock_config` and `shift_note` WITHOUT `ON DELETE CASCADE`. This was fixed by `20260424200000_shift_clock_cascade_fixes.sql`. The constraint repair migration is a consequence of the original omission. Migration history is now correct.

### DEBT-3 — `time_entry_status` enum value `edited` deprecated but not removed

ADR-0097 deprecates the `edited` status value. Migration to remove it pending caller migration. Tracked in ADR-0097 body: "Migration to remove the value happens after callers are migrated."

### DEBT-4 — `shift_note` has no API key write policy

`shift_clock_config` has both JWT and API key policies. `shift_note` has JWT read + JWT insert but no API key write policy. Consistent with "workspace members only" intent but inconsistent with the dual-policy pattern used elsewhere. Low risk; note for next audit.

### DEBT-5 — LeaderOverview placeholder stub in page.tsx

`page.tsx:30-44` contains `LeaderOverviewPlaceholder()` function that is never used (real `LeaderOverview` is imported below it). Dead code. Clean up in any page.tsx touch.

## No Dedicated AI Capability — Design Choice

There is no `packages/ai/src/capabilities/shift-clock/` directory. Clock-in/out are real-time employee actions not mediated by AI capability tools. The `shift-lifecycle` capability (scheduling domain) provides `clock_in_check` (obligation pre-gate, ADR-0243). Actual punch mutations are client-side (web/mobile) → Supabase direct (or BFF when ADR-0277 is accepted). This is the correct design for a high-frequency, latency-sensitive D6 Reality write path.

If AI assistance around clocking is needed (e.g., Botsson asking "Er du på vakt?"), it goes through the Botsson bridge tools (`_tools/shift-clock-tools-bridge.tsx`) which read state only — they do not invoke mutations.
