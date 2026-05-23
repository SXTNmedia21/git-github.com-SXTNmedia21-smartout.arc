---
title: "Notifications — Module Roadmap"
status: draft
updated: 2026-05-22
created: 2026-05-22
module: notifications
tags: [roadmap, notifications, push, channels, onesignal]
language: en
---

## Cascade Mapping

> This module's relationship to the Cascade Core Foundation
> (spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)

| Dimension | Role |
| --------- | ---- |
| **C2 Agent-Utility / cross-cutting** | Delivery surface — not a cascade dimension. Every layer (D1–D6, C1–C3, AI capabilities) emits into this pipe. |
| D1–D6 | Producers. Shift events, session hooks, deviation reports, reconciliation feedback all write `notification_outbox`. |
| C1–C3 | Producers. KPI alerts and approval events enter the same outbox funnel. |
| C4 Governance | No direct gate for system-generated events (they are system writes, not user-initiated mutations). The planned AI `notify` tool will use `callGateAction` for wide-recipient sends. |
| Agent / C2 | Planned consumer (P3). Today `set_reminder` dead-ends; P3 connects it to the outbox. |

Notifications are the output pipe every cascade dimension emits into. They are not a dimension themselves.

# Notifications — Module Roadmap

**One funnel. Four channels. User-controlled. From a dead push leg to AI-driven delivery.**

---

## Value Propositions

### 1. Reach the Worker on the Right Channel (P1)

Four channels, one funnel. In-app, email, SMS, and push all flow through the same outbox pipeline. The push leg was the broken one — it delivered nothing in PWA because it was wired to Expo device tokens that never registered. P1 closes that gap. An employee who has installed the mobile PWA receives every relevant notification on their phone, and the tap lands on the right screen.

### 2. User Controls How, When, and Where (P2)

Global on/off toggles are coarse. A manager may want push for shift updates but email for training reminders. P2 adds a 3×3 preference matrix (work × push, training × email, community × push, etc.), giving workers meaningful control without overloading them. Quiet hours already exist — P2 makes channel choice per-context.

### 3. AI Speaks Through the Same Pipe (P3)

Botsson has no delivery channel today. `set_reminder` accepts the intent but produces zero notifications — the engine-dispatch handler that would write to `notification_outbox` is missing. P3 wires the `notify` capability: AI can reach any user through all four channels, with the same preference resolution and quiet-hours logic as system-generated notifications. The AI assistant stops being a session-only tool.

---

## Current State

### Production-Ready

- ✅ **Outbox pipeline** — `notification_outbox` + `process-notifications` cron (30s) fan-out with quiet hours, grouping, stale-row suppression.
- ✅ **in_app channel** — `notification` table + Realtime bell, web dashboard + mobile screen.
- ✅ **email channel** — SendGrid delivery in `process-notifications` (gated on `email_enabled`). From: `varsler@smartout.ai`.
- ✅ **sms channel** — Twilio delivery (priority=2 only). Critical SMS fallback in `push-dispatch` for zero-recipient push on `CRITICAL_EVENTS`.
- ✅ **push channel server-side** — OneSignal REST send helper live (HTTP 200, recipients returned, verified 2026-05-22). Targeting via External ID = `profile_id`.
- ✅ **40-event registry** — `packages/notifications/src/event-config.ts`. 27 work events, 5 training, 4 community. Per-event: `allowed_channels`, `action_url_template`, priority, `grouping_window_sec`.
- ✅ **Web preferences UI** — mode toggles + global channel toggles. `useNotificationPreferences` + `useUpdateNotificationPreferences` hooks (also mobile-compatible at the hook layer).
- ✅ **Deep-link architecture** — `mobileRouteForActionUrl()` mapper + `app/dashboard/[...rest].tsx` catch-all route in the mobile PWA (this branch).

### Foundation Ready (exists, not complete)

- ⚠️ **Device delivery** — push server-side verified, but 0 subscribers exist. Branch not deployed; no Android/iOS device has gone through `loginOneSignal` → permission → subscription. 3 journey docs are not yet flipped to `status: verified`. (G1)
- ⚠️ **Preferences are coarse** — 3 mode toggles + 4 global channel toggles. No per-mode × channel matrix. A user cannot say "push for work, email for training". (G2 / P2)
- ⚠️ **AI delivery absent** — No `notify` capability in `packages/ai/src/capabilities/`. `set_reminder` writes engine state but there is no engine-dispatch handler that writes to `notification_outbox`. AI-triggered reminders are silently never delivered. (G3 / P3)
- ⚠️ **Mobile preferences UI absent** — hooks exist and are mobile-compatible; no settings screen on mobile. (G4 / P4)
- ⚠️ **2 Expo senders still dead** — `engine-dispatch/handlers/day-line-push.ts` and the godmode broadcast route call Expo Push API directly; both are dead in PWA. Deferred P1-followup (G5).
- ⚠️ **morning-digest ignores `email_enabled`** — users who opt out of email still receive digest emails. (G6 / P4)
- ⚠️ **`grouping_window_sec` ignored** — `resolveGrouping()` hardcodes 3 minutes regardless of per-event config. Events with `grouping_window_sec: 0` are still grouped. (G7 / P4)
- ⚠️ **Single OneSignal app for dev + prod** — same app ID and REST key shared. Low risk today (0 subscribers); must isolate at first key rotation. (G8)

---

## The Phases

---

### P1 — OneSignal Push Leg Alive

_"A real device receives a push. The tap lands on the right screen."_

**Status:** In-flight (`feat/onesignal-push`, ADR-0394). Server-side verified.

**What ships:**
- `supabase/functions/_shared/onesignal.ts` — OneSignal REST send helper (Deno)
- `supabase/functions/push-dispatch/index.ts` — rewritten to OneSignal, critical SMS fallback preserved
- `supabase/functions/process-notifications/index.ts` — passes `action_url` in push payload
- `apps/mobile/src/lib/onesignal.ts` — web SDK init, login, logout, permission
- `apps/mobile/public/OneSignalSDKWorker.js` — service worker shim
- `apps/mobile/app/dashboard/[...rest].tsx` — catch-all deep-link route
- `apps/mobile/src/lib/deep-link.ts` — shared web→mobile route mapper
- Unit tests: `onesignal.test.ts` (3 Deno tests), `deep-link.test.ts` (8 vitest tests)

**Invariants:**
- `in_app` always written regardless of push outcome
- Critical SMS fallback fires when OneSignal returns `recipients=0` for `CRITICAL_EVENTS`
- OneSignal External ID = `profile_id`; no device token columns added to DB
- Deep-link mapper is the single source of truth for both `NotificationScreen` and the catch-all route

**Done criteria (falsifiable):**
1. ✅ push-dispatch reaches OneSignal (HTTP 200, recipients returned) — verified 2026-05-22
2. ❌ An Android Chrome user who installed the PWA receives a push notification from a real system event
3. ❌ Tap on that notification opens the mobile app at the correct screen (e.g. `/shifts`)
4. ❌ iOS 16.4+ home-screen PWA receives a push
5. ❌ All 3 journey docs (`JOURNEY-onesignal-push-*.md`) flipped to `status: verified`

---

### P2 — 3×3 Preference Matrix

_"Push for work. Email for training. Nothing for community at 23:00."_

**Status:** Planned. ADR-0390 to be written.

**What ships:**
- Schema migration: expand `notification_preference` with per-mode × channel controls (9 boolean columns or single JSONB matrix — TBD in ADR-0390)
- `process-notifications` update: resolve effective channels using the matrix (mode-channel intersection) instead of global channel toggles
- Web preferences UI update: expose matrix as a 3×3 grid (work/training/community rows × push/email/sms columns)
- `useNotificationPreferences` hook update: typed mutation for matrix fields
- `in_app` column absent from the matrix — it is always-on per spec D6

**Design constraints:**
- Existing mode master-toggles (`work_enabled`, etc.) remain as on/off per mode; the matrix adds channel granularity within each enabled mode
- Default matrix must match current defaults (push on, email on, sms off) — no regression for existing users
- Matrix schema must be designed with mobile UI (P4) in mind before P2 merges

**Done criteria (falsifiable):**
1. A user can enable email for training events while push is off for training; a training notification delivers only via email
2. `process-notifications` log shows `effectiveChannels` resolving per mode × channel matrix, not global toggles
3. Web settings page shows the 3×3 grid and persists changes correctly

---

### P3 — AI `notify` Capability + Fix `set_reminder`

_"Remind me at 17:00 to check the fridge. Done — push fires at 17:00."_

**Status:** Planned. ADR-0390 (shared with P2 or separate).

**What ships:**
- `packages/ai/src/capabilities/notifications/` — new `notify` capability with a `send` tool
  - `send` tool: `insertOutboxNotification()` wrapper with recipient resolution
  - Chat-only V1 (no autonomous voice-sends without user confirmation — ADR-0078)
  - `callGateAction` gate (ADR-0204) for user-facing sends
- Fix `engine-dispatch` handler for `set_reminder` engine step — writes to `notification_outbox` on trigger
- Intent classifier enum entry for `notifications` capability (recurring trap L-0112 — must ship same commit as capability)
- System prompt update for stage-engine

**Design constraints:**
- AI cannot send to all-workspace recipients without C4 gate (same class as `broadcast.send`)
- Personal reminders (`set_reminder` → engine step handler) → `personal_task` + outbox insert; no C4 gate required
- Voice path: user must confirm before send (ADR-0078 explicit-intent rule)

**Done criteria (falsifiable):**
1. "Set a reminder at 17:00 to check fridge temp" → a push notification (and in-app) fires at 17:00 on the user's device
2. AI can send a targeted notification to one named recipient (self or named profile) from the chat surface
3. `engine-dispatch` test log shows `set_reminder` step handler writing to `notification_outbox`

---

### P4 — Mobile Preferences UI + Digest/Grouping Bug Fixes

_"Mobile parity. No silent misdeliveries. No stale Expo dead-ends."_

**Status:** Planned.

**What ships:**
- `apps/mobile/src/app/(me)/notification-settings.tsx` — preference matrix UI (reuses `useNotificationPreferences` + `useUpdateNotificationPreferences`)
- Fix `send-morning-digest` EF: gate on `notification_preference.email_enabled` before sending
- Fix `process-notifications` `resolveGrouping()`: use `config.grouping_window_sec` instead of hardcoded `3 * 60 * 1000`
- Migrate `engine-dispatch/handlers/day-line-push.ts` to `sendOneSignalPush()` (G5 P1-followup)
- Migrate platform-admin godmode broadcast route to `sendOneSignalPush()` (G5 P1-followup)
- Verify `retry_count` column exists in `notification_outbox` DDL; add migration if absent (G9)

**Design constraints:**
- Mobile prefs UI must render the P2 matrix (P2 must be designed with mobile in mind)
- Day-line pushes and godmode broadcasts intentionally bypass the outbox per spec D2 — they call `sendOneSignalPush()` directly; they are NOT re-routed through `push-dispatch`

**Done criteria (falsifiable):**
1. An employee on mobile can toggle push and email per mode (work/training/community) from the settings screen
2. A user who has `email_enabled: false` does NOT receive a morning digest email
3. An event with `grouping_window_sec: 0` (e.g. `deviation.reported`) creates a separate notification row even when a recent one with the same `group_key` exists
4. Day-line task pushes and godmode broadcasts deliver to a real device via OneSignal

---

## Summary

| Phase | Core Unlock | Primary Gate |
| ----- | ----------- | ------------ |
| **P1** | Push channel alive — all 4 channels functional | Real device receives push + deep link verified |
| **P2** | Per-context channel control — matrix prefs | Web UI persists matrix; `process-notifications` resolves it |
| **P3** | AI delivery — Botsson can reach users outside the session | `set_reminder` → outbox; `notify` tool live |
| **P4** | Mobile parity + bug fixes — no silent misdeliveries | Mobile prefs UI; digest + grouping bugs closed; Expo senders retired |

The module is structurally complete: the outbox, the fan-out cron, 40 events, three working channels, and preferences hooks all exist. The remaining work closes four distinct gaps: the one dead channel (P1), the coarse preference model (P2), AI access (P3), and mobile parity + correctness (P4). Each phase leaves the system in a coherent, shippable state.

**One invariant holds through all phases:** `in_app` is always-on. Every processed outbox row writes a `notification` row. Nothing gates it.
