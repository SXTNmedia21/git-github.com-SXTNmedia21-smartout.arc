---
title: Notifications — Architecture
status: in_progress
updated: 2026-05-22
created: 2026-05-22
module: notifications
tags: [architecture, notifications, push, email, sms, in-app, onesignal, cron, quiet-hours, grouping]
---

# Notifications — Architecture

> Code-first architecture doc. Every claim is traceable to a file + line.

## The Unified Funnel

```
Producers (any module)
  emit() / insertOutboxNotification() / DB trigger
              ↓
  notification_outbox  (table, migration 00006)
              ↓
  process-notifications  (EF, cron every 30s + immediate trigger on priority=2)
    ├── quiet hours check  → reschedule to 07:00 if low priority + in quiet window
    ├── mode pref check    → suppress if user disabled this mode (work/training/community)
    ├── smart grouping     → merge into existing notification if same group_key within 3min
    ├── resolve title/body from event-config registry (with template interpolation)
    ├── INSERT notification (in_app — always)
    └── fan-out:
          ├── push   → push-dispatch EF (if push_enabled + channels includes push)
          ├── email  → SendGrid REST (if email_enabled + channels includes email)
          └── sms    → Twilio (_shared/twilio.ts) (if sms_enabled + priority=2 + phone)
```

## Layer Map

### L1 — Producers

Any code that needs to notify a user calls one of two entry points:

**Package helper** (`packages/notifications/src/outbox.ts:24`):
```ts
insertOutboxNotification(supabase, {
  workspace_id, recipient_id, event_key, metadata, priority_override?
})
```
Resolves event config from the 40-event registry, interpolates all templates, writes a fully-formed `notification_outbox` row.

**DB trigger path**: `dispatch_critical_notification()` fires on `notification_outbox INSERT WHERE priority=2` and immediately calls `process-notifications` via `net.http_post` (`migration 20260324220000_notification_table.sql:83-98`). This provides sub-30s delivery for urgent events without waiting for the cron cycle.

**Platform-admin broadcast** (`apps/web/src/app/api/platform-admin/communications/push/send/route.ts`): calls Expo directly — **BYPASSES outbox + push-dispatch**. Dead in PWA. Deferred (spec D2).

**Day-line push** (`supabase/functions/engine-dispatch/handlers/day-line-push.ts`): calls Expo directly — **BYPASSES outbox + push-dispatch**. Dead in PWA. Deferred (spec D2).

### L2 — Outbox Table

`notification_outbox` (migration `00006_notification_engine.sql`):
- `bigserial` PK (not UUID — designed for high-throughput polling)
- `status` enum: `pending → processing → delivered | failed | suppressed`
- `retry_count`: after 3 failures → auto-suppressed
- `scheduled_for`: used for deferred quiet-hour delivery
- `allowed_channels notification_channel[]`: intersection with user prefs = effective channels
- `metadata jsonb`: carries `event_key`, `group_key`, `icon_type` + producer-specific fields

### L3 — process-notifications Edge Function

**File:** `supabase/functions/process-notifications/index.ts`
**Auth:** `PROCESS_NOTIFICATIONS_SECRET` bearer token (cron-only, `verify_jwt=false`)
**Batch:** `fetch_pending_outbox` RPC, batch_size=100, ordered by `scheduled_for ASC`

**Processing pipeline per row** (`processOutboxRow`, line ~130):

1. **Preference fetch** (lines ~134-149): `profile.user_id` → `notification_preference`
2. **Quiet hours** (lines ~152-159): `checkQuietHours()` → reschedule to `getNext7am(tz)` if priority < 2
3. **Mode gate** (lines ~163-169): skip + mark delivered if mode disabled
4. **Smart grouping** (lines ~172-181): `resolveGrouping()` — finds unread `notification` with same `group_key` created within 3 min, increments count, merges
5. **Template resolution** (lines ~184-201): re-interpolates from event-config if `event_key` present in metadata
6. **in_app insert** (lines ~204-213): always — regardless of channel prefs
7. **Fan-out** (lines ~215-224): `deliverToChannels()`
8. **Mark delivered** (lines ~226-230)

**Stale suppression** (lines ~119-125): rows pending > 24h are auto-suppressed.

**email delivery** (lines ~372-410): `channels.includes("email") && pref?.email_enabled`. Resolves `user_identity.email` by `user_id`. Sends via SendGrid `v3/mail/send`.

**sms delivery** (lines ~412-422): `channels.includes("sms") && pref?.sms_enabled && row.priority === 2`. Uses `profile.phone`.

**push delivery** (lines ~346-370): `channels.includes("push") && pref?.push_enabled`. Calls `push-dispatch` EF via `SUPABASE_URL/functions/v1/push-dispatch` with `PUSH_DISPATCH_SECRET` bearer. Passes `action_url` in `data` field for deep linking.

### L4 — push-dispatch Edge Function

**File:** `supabase/functions/push-dispatch/index.ts`
**Auth:** `PUSH_DISPATCH_SECRET` bearer (service-to-service, `verify_jwt=false`)
**Provider:** OneSignal REST API (`https://api.onesignal.com/notifications`)

**Flow:**
1. Parse `PushRequest` body (`event`, `profile_id`, `workspace_id`, `payload.{title,body,data}`)
2. Fetch `profile.user_id` (for SMS fallback)
3. Build deep link: `ONESIGNAL_DEEP_LINK_BASE + payload.data.action_url` (e.g. `https://mobile.smartout.ai/dashboard/my-schedule`)
4. Call `sendOneSignalPush()` with `externalIds: [profile_id]`
5. If `!ok || recipients=0` AND event in `CRITICAL_EVENTS` → `attemptSmsFallback(userId, body)`
6. Return `{sent, recipients, sms_fallback, error}`

**CRITICAL_EVENTS** (line 16-21): `shift_confirmation_reminder`, `deviation_reported`, `contract.signed`, `contract.expired`

### L5 — OneSignal Shared Helper

**File:** `supabase/functions/_shared/onesignal.ts`
**Endpoint:** `https://api.onesignal.com/notifications`
**Auth header:** `Authorization: Key <ONESIGNAL_REST_API_KEY>`

POST body structure:
```json
{
  "app_id": "<ONESIGNAL_APP_ID>",
  "target_channel": "push",
  "include_aliases": { "external_id": ["<profile_id>"] },
  "headings": { "en": "<title>" },
  "contents": { "en": "<body>" },
  "url": "https://mobile.smartout.ai/dashboard/<section>",
  "data": { "event": "<event_key>", "action_url": "..." }
}
```
Returns: `{ ok: boolean, recipients: number, error?: string }`

Note: `recipients=0` means no subscribed device (user not opted in, or not yet subscribed). Not an error — triggers SMS fallback for critical events.

### L6 — Mobile Client

**OneSignal SDK** (`apps/mobile/src/lib/onesignal.ts`):
- `initOneSignal()` — called once in `_layout.tsx`. Dynamically imports `react-onesignal` (web-only, Platform guard).
- `loginOneSignal(profileId)` — called in `use-push-token.ts` when profile resolves. Links the browser to `profile_id` as External ID. Does NOT call `requestPermission()` — permission must be a user gesture.
- `requestPushPermission()` — called from "Aktiver varsler" button. User gesture entry point. Returns `true` if granted.
- `isPushEnabled()` — reads `OneSignal.Notifications.permission` synchronously.
- `logoutOneSignal()` — called before `supabase.auth.signOut()` in both settings screens.

**Deep-link mapper** (`apps/mobile/src/lib/deep-link.ts`):
- `mobileRouteForActionUrl(actionUrl: string): string | null`
- Maps web-shaped `action_url` (e.g. `/dashboard/my-schedule`) to mobile Expo Router path.
- Returns `null` for unknown or generic `/dashboard` — callers decide fallback.
- Single source of truth: used by `NotificationScreen` (in-app bell tap) AND `app/dashboard/[...rest].tsx` (OneSignal web-push tap).

**Catch-all route** (`apps/mobile/app/dashboard/[...rest].tsx`):
- Expo Router catch-all for any `/dashboard/*` path.
- On mount: calls `mobileRouteForActionUrl(pathname + query)`, calls `router.replace(target ?? "/(app)/(home)")`.
- Never dead-ends on `+not-found`.

### L7 — Cron / Scheduling

| Job | Schedule | Trigger mechanism |
|-----|----------|-------------------|
| `process-notifications` | every 30 seconds | `pg_cron` (if enabled) + `dispatch_critical_notification()` DB trigger on priority=2 insert |
| `morning-digest` | daily 07:00 | `pg_cron` calling `send-morning-digest` EF |

**pg_cron warning:** pg_cron was not enabled in production as of ADR-0388 (2026-05-21). All 27 cron jobs silently never ran. Fix shipped to development (migration re-register + `fn_cron_jobs_health()` RPC). Gate before main: confirm prod pg_cron ≥1.5.

## Env Variables Required

| Variable | Where used | Notes |
|----------|-----------|-------|
| `ONESIGNAL_APP_ID` | `push-dispatch` EF | OneSignal app identifier |
| `ONESIGNAL_REST_API_KEY` | `push-dispatch` EF | REST API key for `Authorization: Key ...` |
| `ONESIGNAL_DEEP_LINK_BASE` | `push-dispatch` EF | `https://mobile.smartout.ai` |
| `EXPO_PUBLIC_ONESIGNAL_APP_ID` | `apps/mobile` web | Client-side SDK init (Expo public prefix) |
| `PUSH_DISPATCH_SECRET` | `push-dispatch` + `process-notifications` | Service-to-service bearer |
| `PROCESS_NOTIFICATIONS_SECRET` | `process-notifications` + DB trigger | Cron bearer token |
| `SENDGRID_API_KEY` | `process-notifications` | Email delivery |

All secrets via `op://` in `.env.template`, never raw values in code.
