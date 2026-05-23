---
title: Notifications — Blueprint (Phased Target)
status: in_progress
updated: 2026-05-22
created: 2026-05-22
module: notifications
tags: [blueprint, notifications, phases, roadmap, push, ai, preferences]
---

# Notifications — Blueprint (Phased Target)

> Phased implementation plan. P1 is in-flight on `feat/onesignal-push`. P2–P4 are planned. Each phase leaves the system in a coherent state.

## Current State (pre-P1)

- 3 of 4 channels work: in_app, email, sms
- Push channel dead: Expo tokens never registred in PWA → 0 push deliveries ever
- 40-event registry in place, outbox funnel complete
- No AI notify capability, no mobile preferences UI

---

## P1 — OneSignal Push Leg Alive

**Goal:** Push channel delivers to the mobile PWA via OneSignal. Deep links navigate to the correct mobile screen. Verified on a real device.

**Branch:** `feat/onesignal-push` (in-flight)
**ADR:** ADR-0394

**What ships:**
- `supabase/functions/_shared/onesignal.ts` — OneSignal REST send helper (Deno)
- `supabase/functions/push-dispatch/index.ts` — rewritten to use OneSignal, preserve critical SMS fallback
- `supabase/functions/process-notifications/index.ts` — passes `action_url` in push payload
- `apps/mobile/src/lib/onesignal.ts` — web SDK init/login/logout/permission
- `apps/mobile/public/OneSignalSDKWorker.js` — service worker shim
- `apps/mobile/app/dashboard/[...rest].tsx` — catch-all deep-link route
- `apps/mobile/src/lib/deep-link.ts` — shared web→mobile route mapper
- Unit tests: onesignal.test.ts (3 Deno tests), deep-link.test.ts (8 vitest tests)

**Done criteria:**
1. Server-side: push-dispatch reaches OneSignal (HTTP 200, recipients returned) ✅ verified
2. Device: Android Chrome receives push and deep link navigates to correct screen ❌ pending
3. Device: iOS 16.4+ home-screen PWA receives push ❌ pending
4. 3 journey docs flipped to `status: verified`

**Out of scope (P1-followup):**
- `day-line-push` and godmode broadcast migration from Expo → OneSignal (spec D2)

---

## P2 — 3×3 Preference Matrix

**Goal:** Users can control which channels receive which type of notification (work × push, training × email, etc.).

**ADR:** ADR-0390 (to be written)

**What ships:**
- Schema migration: expand `notification_preference` with 9 boolean columns (or single jsonb matrix — TBD in ADR-0390)
- `process-notifications` update: resolve effective channels using per-mode×channel matrix instead of global toggles
- Web preferences UI update: expose the matrix as a 3×3 grid
- `packages/notifications/src/hooks/use-notification-preferences.ts` update: typed updates for matrix

**Design constraints:**
- `in_app` remains always-on — not part of the matrix (per spec D6)
- Existing mode toggles (`work_enabled`, etc.) remain as master on/off per mode; matrix adds channel granularity within each mode
- Default matrix should match current defaults (push on, email on, sms off)

**Done criteria:**
1. User can enable email for training events but not work events
2. process-notifications resolves the matrix correctly per mode
3. Web settings page shows the matrix

---

## P3 — AI `notify` Capability + Fix `set_reminder`

**Goal:** Botsson can send notifications through the outbox pipeline. AI-triggered reminders actually deliver.

**ADR:** ADR-0390 (shared with P2 or separate)

**What ships:**
- `packages/ai/src/capabilities/notifications/` — new `notify` capability
  - `send` tool: `insertOutboxNotification()` wrapper with recipient resolution
  - Voice/chat channel: chat-only V1 (no autonomous sending without user confirmation in voice)
- Fix `engine-dispatch` handler for `set_reminder` engine step → writes to `notification_outbox`
- `send` tool gates via `callGateAction` (ADR-0204) for user-facing sends
- Intent classifier enum entry for `notifications` capability (L-0112 recurring trap)
- System prompt update for stage-engine

**Design constraints:**
- AI cannot send to all-workspace recipients without C4 gate (same as `broadcast.send`)
- Personal reminders (`set_reminder`) → `personal_task` + outbox insert, no C4 gate required
- Voice path: confirm before send (ADR-0078 requires explicit user intent for notification sends)

**Done criteria:**
1. "Set a reminder at 17:00 to check fridge temp" → push/in-app notification fires at 17:00
2. AI can send a targeted notification to one recipient (self or named profile)
3. engine-dispatch `set_reminder` step handler writes to outbox

---

## P4 — Mobile Preferences UI + Digest/Grouping Bug Fixes

**Goal:** Mobile parity on preferences. Fix the two known bugs in process-notifications.

**What ships:**
- `apps/mobile/src/app/(me)/notification-settings.tsx` (or similar) — preference matrix UI on mobile
- Fix `send-morning-digest` EF: check `email_enabled` before sending
- Fix `process-notifications` `resolveGrouping()`: use `grouping_window_sec` from event config instead of hardcoded 3 minutes
- Migrate 2 Expo senders (day-line-push, godmode broadcast) to `sendOneSignalPush()` (P1-followup)

**Design constraints:**
- Mobile prefs UI reuses `useNotificationPreferences` + `useUpdateNotificationPreferences` hooks — already mobile-compatible
- P2 preference matrix must be designed with mobile UI in mind before P4 build starts

**Done criteria:**
1. Employee on mobile can toggle push/email per mode from settings
2. Morning digest respects email_enabled
3. Events with `grouping_window_sec: 0` (e.g. deviation.reported) no longer grouped
4. Day-line task pushes and godmode broadcasts deliver via OneSignal

---

## Invariants That Must Hold Through All Phases

1. **`in_app` is always-on.** Every processed outbox row creates a `notification` row. Never gated.
2. **Outbox is the single entry point.** No direct inserts to `notification` except `process-notifications`.
3. **OneSignal targeting = External ID = profile_id.** No device tokens in DB at any phase.
4. **Critical SMS fallback preserved.** `push-dispatch` fires it on recipients=0. Not controlled by sms_enabled.
5. **Deep link mapper is the single source of truth.** Both `NotificationScreen` and `app/dashboard/[...rest].tsx` use `mobileRouteForActionUrl()`.
