---
title: "Journey Harness PoC — Journey 03 (Sjekke vakter)"
status: done
updated: 2026-04-07
created: 2026-04-07
module: ai-agent
tags: [journey, harness, poc, journey-03]
---

# Journey Harness PoC — User Journeys

> End-to-end chain proven: web emit → engine_event → engine_state advance → stuck detection → guardian_signal → push notification rescue. Verified against Supabase Local (commits `3eb82228`–`ee2d2bb0`).

---

## Journey: Employee checks their shifts (happy path)

**Precondition:** Employee is authenticated, has an active `profile` in a workspace, and the Journey 03 `engine_process` is seeded (`journey_03_check_shifts`).

1. Employee opens `/dashboard/my-schedule` on web
   → `MyWeekView` mounts, `useEffect([weekStart])` calls `markShiftListViewed()` Server Action
   → Server Action calls `emit({ event: "shift list_viewed", properties: { entity_type: "profile", entity_id, week_start } })` **server-side** (bypasses the client-side dev short-circuit in `engine-event.ts`)
   → `emit()` routes to four destinations: PostHog, logger, activity_trail, engine_event
   → `engine-dispatch` Edge Function receives the event, finds `engine_trigger` for `shift.list_viewed`, creates `engine_state` row for this profile + Journey 03, and advances past step 1 in the same call
   → Employee sees the week view of their shifts

   **System state after step 1:** `engine_state` row exists with `current_step=2, status=waiting, entity_type=profile, entity_id=<profile_id>`

2. Employee taps a shift card
   → `MyWeekView` onClick handler calls `markShiftDetailViewed(shiftId)` Server Action
   → Server Action calls `emit({ event: "shift detail_viewed", properties: { entity_type: "profile", entity_id, shift_id } })` server-side
   → `engine-dispatch` receives the event, finds the existing `engine_state` in `waiting` status at step 2, and advances it to `complete`
   → No new `engine_state` row is created (the unique-active index `idx_engine_state_unique_active` holds because flat `entity_type`/`entity_id` survive the payload spread)
   → Employee sees the shift detail view

   **System state after step 2:** Same `engine_state` row, `current_step=2, status=complete, completed_at=NOW()`

**Postcondition:** The journey completed successfully. No rescue signal was created. One `engine_state` row per profile per process (dedupe invariant).

**Runtime verification (recorded in HANDOFF, 2026-04-07):**
- First dispatch: `{triggers_matched:1, action:"started", state_id:bde6981b..., waiting_resumed:1}`
- State after first dispatch: `current_step=2, status=waiting`
- Second dispatch: `{triggers_matched:0, waiting_resumed:1}`
- Final state: `current_step=2, status=complete, completed_at SET`
- Dedupe check: `SELECT COUNT(*) FROM engine_state WHERE entity_id=<test> AND process_id='journey_03_check_shifts'` → `1`

---

## Journey: Employee opens shifts but never taps (rescue path)

**Precondition:** Employee has started Journey 03 by emitting `shift.list_viewed` (see journey above), which left `engine_state` at `current_step=2, status=waiting`. More than 24 hours have passed without a `shift.detail_viewed` event.

1. Cron fires (hourly in production, manual in Supabase Local) → invokes `journey-stuck-detector` Edge Function
   → Edge Function queries `engine_state` for rows where `process_id='journey_03_check_shifts' AND current_step=2 AND status='waiting' AND updated_at < NOW() - 24h`
   → Finds our stuck row
   → Runs idempotency check: does a `guardian_signal` with `domain='journey_health'` for this `entity_id` already exist within the last 24h? If yes, skip (prevents repeated pushes to the same user).
   → If no, INSERT a new `guardian_signal` row: `domain='journey_health', signal_type='journey_stalled', severity='info', title='Journey 03 stalled', entity_type='profile', entity_id=<profile_id>, status='active'`
   → Returns `{checked:1, signals_created:1}`

2. Database AFTER INSERT trigger fires on the new `guardian_signal` row
   → Trigger `guardian_signal_journey_health_push` matches `domain='journey_health'`
   → Calls `dispatch_push_notification('journey_rescue', NEW.entity_id, NEW.workspace_id, 'Du har ikke sett vaktene dine ennå', '...', '{}'::jsonb)`
   → In production: `dispatch_push_notification` invokes the `push-dispatch` Edge Function via `pg_net` with `app.push_dispatch_secret`, which sends the actual push via APNs/FCM
   → In Supabase Local: early-returns with `NOTICE: push-dispatch: missing config, skipping (event=journey_rescue, profile=<uuid>)` because the local dev has no `app.push_dispatch_secret`

3. Employee receives the push notification on their mobile device (production only)
   → Push body references RESCUE-PROMPTS.md Gate 2 content: nudges the employee to open the shift details

**Postcondition:** A `guardian_signal` of type `journey_stalled` exists for this employee. Push has been attempted. If the employee taps through to a shift detail within the next hour, the journey advances normally and the signal is resolved via a separate workflow (not covered in this PoC).

**Runtime verification (recorded in HANDOFF, commit `ee2d2bb0`):**
- Pre-fix: detector query was `.eq("current_step", 1)` — never matched real-flow states (off-by-one). Returned `{checked:0, signals_created:0}`.
- Post-fix: detector query corrected to `.eq("current_step", 2)`. Returned `{checked:1, signals_created:1}`.
- Signal row verified: `b2e69cf6-1f6e-4fa0-bd9a-9b331c1a315a, domain=journey_health, signal_type=journey_stalled, severity=info, title='Journey 03 stalled', status=active`
- Idempotency re-run: `{checked:1, signals_created:0}` (24h window held, no duplicate signal created)
- Push trigger fires (separate INSERT in ROLLBACK transaction): `NOTICE: push-dispatch: missing config, skipping (event=journey_rescue, profile=c1373ed4...)` — proves the AFTER INSERT trigger called `dispatch_push_notification()` with `journey_rescue` event and correct profile.

---

## Error paths

### The emit originates client-side (violates C6)

**Symptom:** Employee opens `/dashboard/my-schedule` in development, but `engine_event` table stays empty. No `engine_state` row is created.

**Root cause:** A developer writes `import { emit } from "@smartout/telemetry"` and calls it directly inside a `"use client"` component instead of going through the Server Action. The client-side code path in `packages/telemetry/src/providers/engine-event.ts:78` has `if (process.env.NODE_ENV === "development") return;` — it silently no-ops in development.

**Fix:** Always emit from Server Actions (`actions.ts`) in `apps/web/src/app/dashboard/my-schedule/`. Never call `emit()` directly from a client component for events that must reach `engine_event`.

**Guard:** Council constraint C6 in the spec. Prerequisite Step 0.5 verifies the short-circuit exists. Reviewers should reject any PR that imports `@smartout/telemetry` `emit` directly into a `"use client"` file for journey-relevant events.

### Entity payload is nested instead of flat (violates C2)

**Symptom:** Journey 03 starts for two different employees who open the shifts page simultaneously, and the second one's state row doesn't get created. Or, on second emission for the same user, a duplicate row is created.

**Root cause:** Developer uses the nested `properties.entity: EntityRef` shape (like `ShiftCreated/Updated/Deleted` do) instead of flat `properties.entity_type + entity_id`. `engine-event.ts` spreads `event.properties` flat into `payload`, and `engine-dispatch/index.ts:399` reads `payload.entity_id` from the top. With nested shape, `payload.entity_id === undefined`, so `engine_state.entity_id` is NULL, and `idx_engine_state_unique_active` cannot dedupe per user.

**Fix:** `ShiftListViewed` and `ShiftDetailViewed` interfaces in `packages/telemetry/src/registry.ts` use flat `properties.entity_type` + `properties.entity_id` (see comment in `registry.ts`).

**Guard:** Council constraint C2. Runtime test in HANDOFF verifies dedupe count is 1, not 2, after two emissions.

### Stuck detector never matches (the bug that shipped)

**Symptom:** `journey-stuck-detector` returns `{checked:0, signals_created:0}` forever even when employees are clearly stuck. No rescue pushes ever fire.

**Root cause:** Detector query was `.eq("current_step", 1)` but `engine-dispatch` advances `current_step` past step 1 during the same call that creates the state. Real-flow states always sit at `current_step=2, status=waiting`. The filter never matched anything.

**Fix:** One-line change in `supabase/functions/journey-stuck-detector/index.ts:72` — `.eq("current_step", 2)`. Plus corrected the misleading file-header comment. Commit `ee2d2bb0`.

**Guard:** End-to-end test with a real-flow state (not a hand-crafted row) before claiming the detector works. This bug was caught during a fresh verification round after the original build agent mis-reported DoD #5. Process lesson: runtime verification by headless agents must include raw curl output and raw SELECT rows, not paraphrased summaries.

### pg_cron not available in Supabase Local

**Symptom:** `npx supabase start` works but the `pg_cron` schedule for `journey-stuck-detector` cannot be installed.

**Root cause:** `pg_cron` is not bundled with Supabase Local by default.

**Fix (automatic):** The migration `20260406150100_guardian_signal_push_trigger.sql` wraps its `cron.schedule` call in `IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN ... ELSE RAISE NOTICE ...`. Local dev gets a NOTICE instead of a failure, and the detector must be invoked manually via `curl POST .../journey-stuck-detector` for testing.

**Guard:** Prerequisite Step 0.4 in the plan verifies this graceful degradation pattern.

---

## What this PoC does NOT cover

Out of scope (deliberately parked for follow-up):

- **Mobile emit path.** The Server Actions approach is web-only. React Native needs its own telemetry adapter. Phase 2 with its own ADR.
- **Signal resolution when user recovers.** If the employee finally taps a shift after receiving the rescue push, the journey advances normally, but the active `guardian_signal` is not automatically marked `resolved`. A separate workflow is needed to close out signals.
- **i18n of rescue copy.** `trigger_journey_health_push()` uses hardcoded Norwegian title/body. Needs a translatable lookup table before production rollout.
- **`shift_id` UUID validation.** `markShiftDetailViewed` currently accepts any string. Consider `z.string().uuid()` at the action boundary for production.
- **Rescue push deduplication across channels.** The 24h idempotency window is at the signal level, not the delivery level. If both email and push are enabled, both fire.
- **Manual UI smoke test.** The full chain was verified via `curl POST engine-dispatch` and direct database queries, not by clicking through the dashboard in a browser. Recommend a human runs `pnpm dev` and clicks a shift before production rollout.

---

## Artifacts produced by this PoC

| File | Purpose |
|---|---|
| `supabase/migrations/20260406150000_journey_03_poc_seed.sql` | Seeds `engine_process`, `engine_step` (×2), `engine_trigger` for Journey 03 |
| `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql` | DB trigger on `guardian_signal` INSERT where `domain='journey_health'` → calls `dispatch_push_notification('journey_rescue', ...)` |
| `supabase/functions/journey-stuck-detector/index.ts` | Edge Function: finds stuck states, inserts signals, runs hourly in production |
| `apps/web/src/app/dashboard/my-schedule/actions.ts` | Server Actions `markShiftListViewed` + `markShiftDetailViewed` with server-side `emit()` |
| `apps/web/src/app/dashboard/my-schedule/_components/MyWeekView.tsx` | Client component wired to call the Server Actions on mount + click |
| `packages/telemetry/src/registry.ts` | New `list_viewed`/`detail_viewed` ActionVerbs, `ShiftListViewed`/`ShiftDetailViewed` interfaces with flat entity payload, EVENT_ROUTING entries |
| `packages/ai/src/capabilities/guardian/tools.ts` | Added `journey_health` to the `domain` Zod enum |
| `apps/mobile/store-listing/journeys/03-check-shifts/EVENT-SEQUENCE.md` | Updated to reference the new event names |
| `apps/e2e/HANDOFF-journey-harness-poc.md` | Full audit trail: prerequisite findings, DoD verification table, post-verification correction |
