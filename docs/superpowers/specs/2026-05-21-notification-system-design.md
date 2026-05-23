---
title: Notification System — Unified 4-Channel Design
status: draft
updated: 2026-05-21
created: 2026-05-21
module: notifications
tags: [notifications, push, email, sms, in-app, onesignal, preferences, ai-tools]
---

# Notification System — Unified 4-Channel Design

> Supersedes the narrower `2026-05-21-onesignal-pwa-push-design.md` (folded in as Phase 1).

## Goal

One funnel, four channels, user-controlled. Every notification — system-generated
or AI-generated — flows through `notification_outbox`, fans out to the channels the
recipient has opted into, and is reachable by Botsson as a tool.

## The model (one funnel)

```
emit() / insertOutboxNotification() / AI notify tool
        ↓
notification_outbox
        ↓
process-notifications  (cron 30s; quiet hours + grouping + per-user prefs)
        ↓  effectiveChannels = event.allowed_channels ∩ user prefs
   ┌─────────┬─────────┬─────────┬──────────┐
 in_app     email     sms       push
 (DB+bell) (SendGrid) (Twilio)  (OneSignal)
```

## Channel status (the key fact)

| Channel | Provider | Status today |
|---------|----------|--------------|
| in_app  | none — `notification` table + bell (web+mobile, Realtime) | ✅ works |
| email   | SendGrid | ✅ works |
| sms     | Twilio   | ✅ works |
| push    | OneSignal (was Expo) | ❌ dead leg — Expo tokens need native; PWA gets none |

**Only push is broken. 3 of 4 channels already work.** This is a build-OUT of an
existing pipeline, not a greenfield build.

## What exists (do not rebuild)

- `notification_preference` (`00006`): work/training/community toggles + push/email/sms/browser toggles + timezone-aware quiet hours.
- `notification_outbox` + `process-notifications` cron fan-out (`:346` push, `:369` email, `:409` sms).
- `notification` in-app table + bell + center (web `dashboard/notifications`, mobile `(me)/notifications`).
- 40-event registry `packages/notifications/src/event-config.ts` (modes: work 27, training 5, community 4) with `allowed_channels`, `action_url_template`, priority, grouping.
- Shared hooks `useNotificationPreferences` (packages/, mobile-usable but only consumed on web today).
- `push-dispatch` EF with critical-event SMS fallback (`CRITICAL_EVENTS`).

## What's missing

1. push leg dead (Expo) → swap to OneSignal.
2. coarse prefs — only 3 modes globally, channels global on/off; no per-mode channel control.
3. AI cannot send (no `notify` tool; `set_reminder` wires engine state but dead-ends — no handler writes to outbox).
4. mobile has no preferences UI (hook exists, unused).
5. bugs: morning-digest ignores `email_enabled`; `grouping_window_sec` config ignored.

## Phasing (build small, prove, layer)

| Phase | Scope | Why this order |
|-------|-------|----------------|
| **P1** | OneSignal push leg alive + deep links + device-test | the ONLY unproven risk (Expo-web client subscribe). Foundation for everything. |
| **P2** | 3×3 matrix prefs (work/training/community × push/email/sms; in_app always-on) + runtime resolve | the "control" |
| **P3** | AI `notify` tool (send via any of 4 channels through outbox) + fix `set_reminder` → outbox handler | AI access |
| **P4** | mobile prefs UI + digest/grouping bug fixes | parity + correctness |

## Design decisions (locked)

- **D1 — Unified outbox funnel** is the control surface. User-facing notifications all flow through it.
- **D2 — Operational pushes bypass prefs intentionally.** `day-line-push` (clocked-in task pushes, ADR-0367) and godmode broadcast call the shared OneSignal helper DIRECTLY, push-only. Reason: a clocked-in employee's "your task now" must not be muted by a work-push toggle; broadcast is emergency. They are NOT re-routed through push-dispatch (no chokepoint plumbing) — they just share the send helper. **Deferred to a P1-followup; P1 itself only swaps the outbox push path.**
- **D3 — OneSignal External ID = profile_id.** No device-registry DB column. `OneSignal.login(profile_id)` client-side; server targets `include_aliases.external_id`.
- **D4 — Critical SMS fallback preserved.** OneSignal zero-recipients for a `CRITICAL_EVENTS` event maps to the existing `attemptSmsFallback()` (replaces the old `!pushToken` trigger).
- **D5 — Deep links via the `url` field.** OneSignal web-push `url` = the event's resolved `action_url`. Tap opens the PWA at that route. Events already carry `action_url_template`.
- **D6 — in_app is always-on for users** (it is the audit/read surface), but a valid AI send target.
- **D7 — Client integration is Platform-guarded dynamic import** (`Platform.OS === 'web'` + `await import('react-onesignal')`), NOT a metro `webAliases` entry — avoids touching `metro.config.js` and keeps `react-onesignal` out of the native bundle.

## Risk

The single real risk is **OneSignal Web SDK inside Expo-web**: service worker served at
site root, iOS push only on home-screen-installed PWA (16.4+), subscribe flow firing in
the RN-web runtime. Server-side swap is trivial. **P1 must device-test on Android (no
install gate) before declaring done.**

## ADRs

- ADR-0394 — OneSignal as the push channel (Expo path retired). Written in P1.
- ADR-0390 — Notification preference matrix + AI notify capability. Written in P2/P3.
