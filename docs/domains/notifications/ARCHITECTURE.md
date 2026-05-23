---
title: Notifications Domain — Architecture
status: done
updated: 2026-05-23
created: 2026-05-23
domain: notifications
mirror: verified
last_verified: 2026-05-23
tags: [notifications, architecture, edge-functions, outbox, onesignal, pipeline]
---

# Notifications — Architecture

> Code wins. Every claim here is verified against actual code with grep-able anchor + line ±hint.

## L1 → L5 Pipeline

```
L1: Event Sources (DB triggers / engine steps / capability tools / crons)
        ↓  INSERT into notification_outbox
L2: Outbox + Policy
        notification_outbox  (pending → processing → delivered/failed/suppressed)
        notification_preference  (user channel/mode/quiet-hour settings)
        notification_policy  (workspace domain escalation ladders — ADR-0104)
        ↓  fetch_pending_outbox() RPC (FOR UPDATE SKIP LOCKED)
L3: Dispatcher — process-notifications EF
        quiet hours check → defer low-priority to next 7am
        mode gate (training/work/community pref)
        smart grouping (group_key, 3-min window)
        event-config registry resolve (title/body template interpolation)
        in_app INSERT (always)
        ↓  fan-out to effectiveChannels
L4: Channel Adapters
        push    → push-dispatch EF → OneSignal REST (ADR-0394)
        email   → SendGrid REST (or dev SMTP bridge to Inbucket/Mailpit)
        sms     → _shared/twilio.ts → Twilio API  (priority=2 only)
        in_app  → already written in L3 above
L5: Audit + Guardian
        notification table (in-app store, Realtime publication)
        notification_sent_log (rate-limit + effectiveness)
        guardian_signal → guardian_log (critical alerts path, separate from outbox)
```

## L1 — Event Sources

### DB Triggers (outbox INSERT)
| Trigger | Migration | Fires on |
|---------|-----------|---------|
| `trg_outbox_auto_dispatch` | `20260328225650` | Every `notification_outbox` INSERT (calls `process-notifications` via pg_net) |
| `channel_message_notification_trigger` | `20260422310100` | `channel_message` INSERT |
| `missed_call_notification_trigger` | `20260422310200` | Missed call events |
| `incoming_call_notification_trigger` | `20260422310300` | Incoming call events |
| `swap_notification_triggers` | `20260504100005` | Shift swap created/approved/rejected |
| `fix_swap_notification_approval_branch` | `20260417140000` | Swap approval branch fix |
| `contract_event_notify_trigger` | `20260414072300` | Contract lifecycle events |
| `guardian_signal_push_trigger` | `20260406150100` | Guardian signals → push (via outbox) |
| `guardian_log_pg_notify` | `20260422120001` | Guardian log → pg_notify |
| `push_dispatch_triggers` | `20260418120000` | Shift published / task assigned / deviation |
| `fix_push_triggers_profile_id` | `20260324065817` | Push trigger profile_id fix |
| `refactor_push_triggers` | `20260324230000` | All 6 original triggers → outbox |
| `fn_publish_announcement_notifications` | `20260620140300` | Announcement → notification outbox |
| `channel_message_trigger_announcement_guard` | `20260620140500` | Guards announcement channel messages |

### Engine Steps
- `send_notification` action type in `engine-dispatch` handler. `shift_published_notify_v1` process (migrated 20260507100300) uses this step.
- Anchor: `supabase/functions/engine-dispatch/index.ts` handler for `send_notification`.

### Cron / Scheduled
- `session-task-overdue-cron` EF — writes `notification_outbox` when `session_task.due_at` passes. Anchor: `supabase/functions/session-task-overdue-cron/index.ts` (WATCHDOG_CRON_SECRET bearer).
- Task-due cron (`task_due_reminder`) — every 15 min, scans `personal_task` + `emma_task` for upcoming `due_at`. Registered in `supabase/migrations/` on `feat/onesignal-push` (pending merge: L-0042 timestamp fix needed first).
- `send-morning-digest` EF — daily 07:00 UTC digest.

## L2 — Outbox + Policy

### `notification_outbox`
Defined: `supabase/migrations/00006_notification_engine.sql:31`. Columns: `id` (bigserial PK), `workspace_id`, `recipient_id`, `mode` (notification_mode enum), `priority` (smallint 0/1/2), `title`, `body`, `action_url`, `metadata` (jsonb), `allowed_channels` (notification_channel[]), `status` (notification_status), `error_log`, `scheduled_for`, `processed_at`, `created_at`. Added by `20260427200000`: `retry_count` (smallint), `updated_at`.

RLS: `No direct user access to outbox` (FOR ALL USING false) — service_role bypasses. Anchor: `20260427200000_notification_outbox_reliability.sql`.

Auto-dispatch trigger: `trg_outbox_auto_dispatch` fires on every INSERT, calls `process-notifications` via pg_net for local dev (no pg_cron locally). Anchor: `20260328225650_notification_outbox_auto_dispatch.sql`.

### `fetch_pending_outbox` RPC
SECURITY DEFINER function. Fetches `status=pending AND scheduled_for <= now()` OR `status=failed AND retry_count < 3`. Marks rows `status=processing`. Staleness recovery: resets `processing` rows stuck >5 min back to `pending`. Anchor: `20260427200000_notification_outbox_reliability.sql`.

### `notification_preference`
Defined: `supabase/migrations/00006_notification_engine.sql:8`. PK = `user_id` (user-scoped, not workspace-scoped). Columns: `training_enabled`, `work_enabled`, `community_enabled` (mode booleans), `push_enabled`, `sms_enabled`, `email_enabled`, `browser_enabled` (added `20260324220000`), `quiet_hours_start/end/timezone`. Default: push=true, sms=false, email=true.

### `notification_policy` + `notification_sent_log`
Defined: `supabase/migrations/20260415120500_notification_policy_tables.sql`. `notification_policy`: workspace-scoped domain escalation ladders (UNIQUE `workspace_id, domain`). `notification_sent_log`: append-only rate-limit log. RLS: admin JWT + service_role. **Note: these tables exist in schema but the escalation ladder logic is not yet wired into `process-notifications` — see GAPS §G5.**

## L3 — Dispatcher: `process-notifications` EF

File: `supabase/functions/process-notifications/index.ts`. Auth: `PROCESS_NOTIFICATIONS_SECRET` bearer token. `verify_jwt = false` (config.toml:533).

**Invocation pattern:** cron `'30 seconds'` via pg_cron (prod); `trg_outbox_auto_dispatch` pg_net INSERT trigger (dev + low-traffic prod fallback).

Key functions:
- `handleRequest` — fetches batch via `fetch_pending_outbox`, loops rows, stale suppression (>24h old pending rows).
- `processOutboxRow` — quiet hours (defer to next 7am), mode gate, smart grouping, event-config resolve, `notification` INSERT, `deliverToChannels`, mark delivered.
- `checkQuietHours` — pure function, handles overnight ranges (e.g. 22:00–07:00).
- `resolveGrouping` — merges into existing unread notification with same group_key within 3 min. Updates count + body on existing row.
- `deliverToChannels` — push (HTTP to push-dispatch), email (SendGrid or dev SMTP), SMS (Twilio, priority=2 only).
- `sendDevSmtp` — raw TCP SMTP to local Inbucket/Mailpit when `SENDGRID_API_KEY` absent.

**Retry semantics:** `retry_count < 3` eligible for retry. At 3 failures: `status = 'suppressed'`.

## L4 — Channel Adapters

### push-dispatch EF
File: `supabase/functions/push-dispatch/index.ts`. Auth: `PUSH_DISPATCH_SECRET` bearer. `verify_jwt = false` (config.toml:506). **Invocation: HTTP POST by `process-notifications:deliverToChannels`**.

Flow:
1. Validates `PushRequest` body (`event`, `profile_id`, `workspace_id`, `payload`).
2. Fetches `profile.user_id` for SMS fallback lookup.
3. Resolves deep link: `ONESIGNAL_DEEP_LINK_BASE + action_url` → OneSignal `url` field.
4. Calls `sendOneSignalPush()` from `supabase/functions/_shared/onesignal.ts`.
5. If `result.recipients === 0` AND event ∈ `CRITICAL_EVENTS` → `attemptSmsFallback()` → `user_identity.phone` → Twilio SMS.

`CRITICAL_EVENTS` set: `shift_confirmation_reminder`, `deviation_reported`, `contract.signed`, `contract.expired`. Anchor: `push-dispatch/index.ts`, const `CRITICAL_EVENTS`.

### `sendOneSignalPush()` helper
File: `supabase/functions/_shared/onesignal.ts`. POSTs to `https://api.onesignal.com/notifications` (new REST API — `Authorization: Key <ONESIGNAL_REST_API_KEY>`). Targeting: `include_aliases: { external_id: [profile_id] }`. Returns `{ ok, recipients, error? }`. Anchor: `_shared/onesignal.ts`.

### guardian-notify EF
File: `supabase/functions/guardian-notify/index.ts`. Auth: `WATCHDOG_CRON_SECRET` bearer. `verify_jwt = false` (config.toml:474). **Invocation: cron schedule (runs every 30 minutes per EF docstring comment).**

Flow: Finds `guardian_signal WHERE severity='critical' AND status='active'` → groups by workspace → resolves admin/owner profiles → sends SendGrid email (if `SENDGRID_API_KEY` set) or logs (fallback) → marks signals `status='acknowledged'` → inserts `guardian_log` entries.

**Note:** guardian-notify is a SEPARATE path from the outbox pipeline. It works directly on `guardian_signal` + `guardian_log` tables and sends email via SendGrid, bypassing `notification_outbox`. This is intentional: critical guardian signals must not be deferred by quiet hours or preference gates.

## L5 — Audit

### `notification` table
Defined: `supabase/migrations/20260324220000_notification_table.sql:19`. In-app store. Columns: `id` (uuid PK), `workspace_id`, `recipient_id`, `group_key`, `title`, `body`, `action_url`, `icon_type`, `is_read`, `read_at`, `metadata`, `created_at`, `updated_at`. Realtime: published via `supabase_realtime` publication. RLS: users read own notifications via `recipient_id ∈ profiles WHERE workspace_id IN get_workspace_ids_for_user(auth.uid())`.

Web: `apps/web/src/app/dashboard/notifications/` (page + tools bridge). Mobile: `(me)/notifications` screen.

### `notification_sent_log`
Rate-limit append log. Defined: `20260415120500_notification_policy_tables.sql`. Not yet wired into outbox consumer (Gap G5).

## Mobile Integration

**OneSignal Web SDK (`apps/mobile/src/lib/onesignal.ts`):** web-guarded init/login/logout. Platform check (`Platform.OS === 'web'` + dynamic `import('react-onesignal')`). Anchor: `apps/mobile/src/lib/onesignal.ts`. Functions: `initOneSignal`, `loginOneSignal(profileId)`, `logoutOneSignal`, `requestPushPermission`, `isPushEnabled`.

**Deep-link mapper (`apps/mobile/src/lib/deep-link.ts`):** `mobileRouteForActionUrl(actionUrl)` maps web `/dashboard/*` paths → Expo Router mobile routes. Verified: 9 unit tests pass.

**Catch-all route (`apps/mobile/app/dashboard/[...rest].tsx`):** intercepts OneSignal `url` taps that land on web-shaped paths and `router.replace`s to the mapped mobile screen.

**Service Worker:** `apps/mobile/public/OneSignalSDKWorker.js` — shim at site root. Required by OneSignal Web SDK for background push in PWA.

## Operational Bypasses (D2 pattern)

Two push senders bypass `notification_outbox` intentionally (spec decision D2 from 2026-05-21-notification-system-design.md):
- `engine-dispatch/handlers/day-line-push.ts` — day-line push (ADR-0367 §M4), calls OneSignal helper directly.
- `apps/web/src/app/.../platform-admin/communications/push/send/route.ts` — broadcast/godmode push.

These bypass quiet hours + preference gates by design (operational + emergency). Currently still on Expo (dead in PWA); deferred to P1-followup.
