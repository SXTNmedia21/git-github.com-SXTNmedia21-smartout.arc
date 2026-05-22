---
title: "OneSignal as Push Channel"
id: ADR-0389
status: accepted
layer: decision
created: 2026-05-21
updated: 2026-05-21
---

# ADR-0389: OneSignal as the Push Channel

## Context and Problem Statement

The mobile app is built with Expo and exported as a web PWA. Expo push tokens require a native build (APNs/FCM token registration via `expo-notifications`), so `push-dispatch`'s Expo Push API path is dead for PWA users — no token is ever registered, no push is ever delivered. A OneSignal account is already available; OneSignal supports Web Push (PWA) today and native later under the same app, with a single REST API.

## Decision Drivers

- Expo push is dead in PWA — zero push delivery to any current user
- Minimal code surface: one helper, no device-registry DB column
- OneSignal bridges PWA → native under the same subscription model (`external_id = profile_id`)
- Critical-event SMS fallback must be preserved; OneSignal `recipients = 0` is the new trigger

## Considered Options

1. **Keep Expo** — maintain the Expo Push API path
2. **OneSignal REST** — replace Expo with OneSignal, target by `external_id = profile_id`
3. **Custom Web Push + VAPID** — build our own push server with VAPID keys

## Decision Outcome

Chosen option: **"Option 2 — OneSignal REST"**, because it makes the push channel live for all current PWA users with minimal DB impact, and OneSignal's `external_id` targeting means we never store device tokens in our schema.

## Rules & Consequences

- **Good, because** push works immediately in the PWA without schema changes; `external_id = profile_id` is stable across device changes.
- **Good, because** native phase reuses the same OneSignal subscriptions — no migration needed.
- **Bad, because** iOS push only works on home-screen-installed PWA (iOS 16.4+); Safari tab receives nothing — documented limitation.
- **Bad, because** `day-line-push` (operational push from `engine-dispatch`) and godmode broadcast (platform-admin) still call Expo and are dead in PWA — deferred to P1-followup per spec decision D2.
- **Agent Impact:** `push-dispatch` now calls `sendOneSignalPush()` from `_shared/onesignal.ts`. Zero-recipients response (no subscribed device) is the trigger for critical-event SMS fallback — replaces the former "no expo_push_token" check. `process-notifications` passes `action_url` through the push payload for deep-link navigation.
- **Auth header:** OneSignal v1 REST uses `Authorization: Basic <REST_API_KEY>`. If the dashboard app uses the newer `api.onesignal.com` endpoint, update to `Key <REST_API_KEY>` — reconcile in Task 8 of the P1 plan.
- **Scope:** P1 covers the outbox push path only (`process-notifications → push-dispatch`). The two operational Expo senders (`engine-dispatch/handlers/day-line-push.ts`, `platform-admin/.../push/send`) stay on Expo and are deferred.

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
