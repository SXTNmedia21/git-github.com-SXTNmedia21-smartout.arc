---
title: OneSignal Web Push for Mobile PWA
status: draft
updated: 2026-05-21
created: 2026-05-21
module: notifications
tags: [push, onesignal, pwa, mobile, notification-outbox, web-push]
---

# OneSignal Web Push for Mobile PWA — Design Spec

## Problem

Smartout needs to deliver push notifications to employees on mobile. The mobile
surface is currently an **Expo app exported as a web PWA** (served at
m.smartout.ai), not a native build. Native iOS/Android apps come later.

The existing push channel targets the **Expo Push API** using
`profile.expo_push_token`. That token is only issued in a **native** Expo build —
`getExpoPushTokenAsync()` does not work in a browser/PWA context. So the current
push path is effectively **dead for the PWA**: nothing pushes today.

We have a OneSignal account. OneSignal does Web Push (PWA) now and native
(FCM/APNs) later under the same app — so it bridges the PWA-now → native-later
transition without throwaway work.

## Goal

Deliver push to employees on the mobile PWA by **reusing the entire existing
outbox pipeline** and swapping only the final delivery hop from Expo Push API to
OneSignal REST.

## Non-Goals (out of scope)

- Web dashboard (`apps/web`) push — deferred.
- Native iOS/Android push — later phase (same OneSignal account, additive).
- Multi-device per user — V1 is single logical user via OneSignal External ID.
- Changing the outbox schema, event registry, cron consumer, or `emit()` flow.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Scope = **mobile PWA only** | True one-shot, smallest surface. Dashboard push is a separate sortie. |
| D2 | Targeting = **OneSignal External ID = `profile_id`** | No new DB column. OneSignal owns the device registry. Leanest wiring. Client calls `OneSignal.login(profile_id)`; EF targets by `external_id`. |
| D3 | **Reuse outbox pipeline**, swap only `push-dispatch` last hop | Outbox + cron + 40 event keys + `emit()` are channel-agnostic; only the sender changes. |
| D4 | Expo path **retained as dormant native stub**, not deleted | Reversible. Native phase re-activates an Expo or OneSignal-native path behind the platform-resolved module. |
| D5 | OneSignal-owned **service worker** (`OneSignalSDKWorker.js`) | No service worker exists today; OneSignal registers its own. Fills the gap without bespoke SW code. |

## Architecture

Existing spine is unchanged. Only the last hop (the box marked SWAP) changes.

```
emit() / insertOutboxNotification()
        ↓
notification_outbox  (allowed_channels includes "push")
        ↓
process-notifications  (cron, every 30s; quiet hours + grouping + fan-out)
        ↓  channel === "push"
push-dispatch EF   ←──────── SWAP: Expo Push API → OneSignal REST
        ↓
OneSignal REST  POST /api/v1/notifications
   include_aliases: { external_id: [recipient_id] }
        ↓
OneSignal-managed device  →  PWA push notification
```

## Components

### 1. Client — `apps/mobile`

Platform-resolved module so the **native build never imports the web SDK**:

- `src/lib/onesignal.web.ts` — real implementation (`react-onesignal`).
- `src/lib/onesignal.native.ts` — no-op stub (until native push phase).
  Expo/Metro resolves `.web` / `.native` by platform automatically.

Behaviour (web only):

1. Init OneSignal with `EXPO_PUBLIC_ONESIGNAL_APP_ID` on app boot.
2. When auth resolves a profile: `OneSignal.login(profileId)` → sets
   `external_id = profile_id`.
3. On logout: `OneSignal.logout()`.
4. Request notification permission after login (OneSignal slide/native prompt).

Service worker asset:

- Place `OneSignalSDKWorker.js` in `apps/mobile/public/` (same directory as the
  existing `manifest.json`). The Expo web export copies `public/` to site root,
  satisfying OneSignal's root-hosted SW requirement. No change needed to
  `inject-pwa-meta.sh`.

### 2. Server — `supabase/functions/push-dispatch/index.ts`

Swap point is the Expo POST at **lines 150–157**, plus the token read at
**line 116**.

- Remove the `profile.expo_push_token` read (line 116) — `recipient_id` is
  already available on the outbox row passed in by `process-notifications`.
- Replace the Expo `POST https://exp.host/--/api/v2/push/send` with:

```
POST https://onesignal.com/api/v1/notifications
Authorization: Basic ${ONESIGNAL_REST_API_KEY}
Content-Type: application/json

{
  "app_id": "<app id>",
  "target_channel": "push",
  "include_aliases": { "external_id": ["<recipient_id>"] },
  "headings":  { "en": "<title>" },
  "contents":  { "en": "<body>" },
  "url":       "<action_url | optional>",
  "data":      { "event_key": "<event_key>", ... }
}
```

> Auth-header form (`Basic` vs newer `Key`) and exact field names verified
> against the live OneSignal REST docs during implementation (use context7).

`process-notifications` (`index.ts:346-366`) is unchanged — it still calls
`push-dispatch` with the recipient profile + title/body/data.

### 3. Secrets & Env

| Key | Visibility | Location |
|-----|-----------|----------|
| `ONESIGNAL_REST_API_KEY` | secret | 1Password `op://` (Pontus adds value; code references only) |
| `EXPO_PUBLIC_ONESIGNAL_APP_ID` | public | Expo public env (`EXPO_PUBLIC_` prefix — apps/mobile is Expo, not Next) |

Register both per `ENV_PROTOCOL.md`: `.env.template` + Edge Function secret +
client env. The REST key is consumed only inside the `push-dispatch` Edge
Function.

## Data Flow (push, end to end)

1. A workspace mutation `emit()`s a registered event (or a caller invokes
   `insertOutboxNotification()` directly).
2. Row lands in `notification_outbox` with `allowed_channels` including `push`.
3. `process-notifications` cron picks it up within ≤30s, applies quiet hours +
   grouping, and for the push channel calls `push-dispatch` with the recipient
   `profile_id`, title, body, and data.
4. `push-dispatch` POSTs OneSignal targeting `external_id = profile_id`.
5. OneSignal delivers to the user's subscribed PWA device(s).

## Error Handling

- **No recipient** (user never granted permission, or PWA not installed):
  OneSignal returns a 200 with an `errors` payload / zero recipients. Treat as
  **non-fatal** — mark the outbox row delivered-with-no-target, log, do not block
  the queue.
- **Critical events** retain the existing **SMS fallback** (Twilio) when push has
  no target — preserve current `push-dispatch` fallback semantics.
- **OneSignal API error (non-2xx)**: log + leave row for retry per existing
  outbox retry policy. Do not crash the consumer.
- No token cleanup logic needed — OneSignal manages device lifecycle (no
  `DeviceNotRegistered` bookkeeping like the Expo path required).

## iOS Limitation (documented constraint, not a bug)

Web push on iOS works **only** when:

- iOS 16.4 or newer, AND
- the PWA is **installed to the home screen** (standalone display mode).

In a Safari tab, iOS silently does not deliver web push. Android and desktop
browsers deliver in-browser without install. The future native iOS app removes
this limit; the OneSignal subscription model carries over.

This must be surfaced in onboarding/UX copy ("Add to Home Screen to receive
notifications") — copy task tracked separately, not in this spec's code scope.

## Testing

- **Unit:** mock the OneSignal REST response in `push-dispatch` — assert correct
  `include_aliases`, headings/contents mapping, and non-fatal handling of a
  zero-recipient response.
- **Manual (fastest loop = Android):** install the PWA on an Android device,
  grant permission, trigger a `shift.published` event, confirm the push lands.
  Android has no install-gate, so it is the fastest verification path.
- **iOS manual:** install PWA to home screen on iOS 16.4+, repeat, confirm.

## ADR

New external integration → **ADR-0394** (slot confirmed free 2026-05-21; re-grep
before claiming per L-ADR-squatting). Title: "OneSignal Web Push as PWA push
channel (Expo path dormant until native)."

## Effort & Reversibility

- ~½ day: one Edge Function edit, one client module (+native stub), one SW asset,
  two env keys, one ADR.
- Reversible: the Expo delivery code stays dormant behind the platform-resolved
  module; reverting = restore the Expo POST and read.
