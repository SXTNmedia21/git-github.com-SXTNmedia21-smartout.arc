---
title: Module — Notifications
status: archived
updated: 2026-05-23
created: 2026-05-22
module: notifications
superseded_by: docs/domains/notifications/
tags: [module, notifications, push, email, sms, in-app, onesignal, preferences, outbox]
---

> ⚠️ ARCHIVED — Superseded by `docs/domains/notifications/`. Do not update this file.

# Module — Notifications

> Authoritative module doc for Smartout's notification system. If code contradicts this doc → CODE wins, update this doc.

## 1. Overview

The Notifications module is the **unified delivery pipeline** for all user-facing alerts in Smartout. Every event in the system — shift published, task assigned, contract signed, deviation reported, announcement broadcast — flows through a single outbox table and fans out to whichever channels the recipient has enabled.

The module answers one question: *how does the system reach a person reliably, respecting their preferences and quiet hours, across 4 delivery channels?*

**Four channels:**

| Channel | Delivery mechanism | Always-on? |
|---------|-------------------|-----------|
| `in_app` | `notification` table + Realtime bell, web + mobile | Yes (cannot be disabled) |
| `email`  | SendGrid via `process-notifications` | User-controlled |
| `sms`    | Twilio via `process-notifications` (priority=2 only) | User-controlled, off by default |
| `push`   | OneSignal REST via `push-dispatch` EF (ADR-0394) | User-controlled |

**Before P1 (this branch):** the push channel was dead — the Expo Push API path requires a native build, so PWA users received zero pushes. Three of four channels worked. P1 swaps Expo for OneSignal Web Push (ADR-0394), making all four channels functional.

---

## 2. Cascade Role

Notifications are **cross-cutting infrastructure**, not a cascade dimension. They are not D1–D6 or C1–C4. They are the output pipe for events emitted by every layer of the cascade.

| Layer | Relationship |
|-------|-------------|
| D1–D6 | Producers — shift events, session hooks, deviation reports write notification_outbox |
| C1–C3 | Producers — reconciliation feedback, KPI alerts write notification_outbox |
| C4 Governance | No direct gate. The `notify` AI capability (P3 planned) will use `callGateAction`. Direct system writes bypass C4 by design (they are system events, not user-initiated mutations). |
| K1a/K1b | Not involved |
| Agent / C2 | Planned consumer (P3). `set_reminder` in the personal capability today wires engine state but does NOT write notification_outbox — the handler is absent. |

---

## 3. The Four Channels — Detail

### 3.1 in_app

- Stored in `notification` table (`supabase/migrations/20260324220000_notification_table.sql`).
- Realtime subscription via `supabase_realtime` publication — bell component subscribes on mount.
- Web: `/dashboard/notifications` page + bell icon in DashboardShell header.
- Mobile: `(me)/notifications` screen.
- Always-on. `in_app` is always in `allowed_channels` for events that reach `in_app`; `browser_enabled` column exists on `notification_preference` but is not used to gate in-app delivery.
- Groups within 3-minute window using `group_key` — `resolveGrouping()` in `process-notifications`.

### 3.2 email

- Delivered by `process-notifications` when `channels.includes("email") && pref?.email_enabled`.
- Sends via SendGrid REST (`https://api.sendgrid.com/v3/mail/send`).
- From address: `varsler@smartout.ai` (name: "Smartout").
- Resolves recipient email from `user_identity.email` via `user_id`.
- Known bug: `morning-digest` EF ignores `email_enabled` preference (see GAPS-AND-DEBT.md).

### 3.3 sms

- Delivered by `process-notifications` when `channels.includes("sms") && pref?.sms_enabled && row.priority === 2`.
- Uses `sendSms()` from `supabase/functions/_shared/twilio.ts`.
- Phone number resolved from `profile.phone` (passed in `processOutboxRow`).
- **Critical SMS fallback**: `push-dispatch` also calls `attemptSmsFallback()` when OneSignal returns `recipients=0` for an event in `CRITICAL_EVENTS` set. This fallback resolves phone from `user_identity.phone`.
- `CRITICAL_EVENTS` (push-dispatch): `shift_confirmation_reminder`, `deviation_reported`, `contract.signed`, `contract.expired`.

### 3.4 push (OneSignal — ADR-0394)

- Delivered by `push-dispatch` EF, called by `process-notifications`.
- Uses `sendOneSignalPush()` from `supabase/functions/_shared/onesignal.ts`.
- **Targeting**: External ID = `profile_id`. No device token stored in DB. Client calls `OneSignal.login(profile_id)` when profile resolves.
- **Deep links**: `action_url` from the outbox row → `ONESIGNAL_DEEP_LINK_BASE + action_url` → OneSignal `url` field → PWA navigates to that URL on tap.
- **Mobile catch-all**: `apps/mobile/app/dashboard/[...rest].tsx` intercepts web-shaped paths, maps via `mobileRouteForActionUrl()`, redirects to the correct mobile screen.
- **iOS constraint**: push only works on home-screen-installed PWA (iOS 16.4+). In-browser Safari tab receives nothing.
- **Permission UX**: `loginOneSignal()` does NOT call `requestPermission()` automatically. User must tap "Aktiver varsler" button (iOS gesture requirement). `requestPushPermission()` is the gesture-bound entrypoint.

---

## 4. Event Taxonomy (40 events, `packages/notifications/src/event-config.ts`)

### Mode distribution

| Mode | Count | Description |
|------|-------|-------------|
| `work` | 27 | Operational events: shifts, deviations, contracts, sessions, approvals |
| `training` | 5 | Protocol assigned, deadline, onboarding welcome/complete, session hook task (training mode) |
| `community` | 4 | Chat messages, incoming/missed calls, (community-mode events) |

### Priority distribution

| Priority | Value | Behaviour |
|----------|-------|-----------|
| Normal | `0` | Standard delivery; quiet-hours applies |
| High | `1` | Standard delivery; quiet-hours applies |
| Urgent | `2` | Bypasses quiet hours. Triggers immediate DB trigger dispatch. Also triggers SMS fallback if push fails. |

### Events by category

**Shift lifecycle (work):** `shift.published` (p1), `shift.updated` (p1), `shift.punched_in` (p0, in_app only), `shift.punched_out` (p0, in_app only), `shift.late` (p2), `shift.no_show` (p2), `shift.adhoc_pending` (p1)

**Shift reminders (work):** `shift.confirmation_reminder` (p1), `shift.reminder_24h` (p0), `shift.reminder_4h` (p1), `shift.reminder_2h` (p1)

**Shift swap (work):** `shift.swap_initiated` (p1), `shift.swap_approved` (p1), `shift.swap_rejected` (p0), `shift.swap_cancelled` (p0, in_app only)

**Contract lifecycle (work):** `contract.created` (p1), `contract.sent` (p1), `contract.viewed` (p1, in_app only), `contract.signed` (p1), `contract.declined` (p1), `contract.expired` (p1), `contract.intake_completed` (p1), `contract.reminder_due` (p1)

**Operations (work):** `deviation.reported` (p2, all channels), `task.assigned` (p0), `approval.pending` (p1), `join.request` (p1), `session.hook` (p0), `engine.reconciliation_feedback` (p0), `engine.day_closed` (p0, in_app only)

**Onboarding/engine (work/training):** `engine.workspace_ready` (p1), `engine.onboarding_welcome` (p0, training), `engine.onboarding_complete` (p1, training), `engine.session_hook_task` (p0)

**Community:** `chat.message` (p0), `call.incoming` (p2), `call.missed` (p1)

**Training:** `protocol.assigned` (p0), `training.deadline` (p1)

---

## 5. Notification Preferences (`notification_preference`)

- PK: `user_id` — cross-workspace. One row per user across all workspaces.
- **Mode toggles**: `work_enabled`, `training_enabled`, `community_enabled` (all default true).
- **Channel toggles**: `push_enabled` (default true), `email_enabled` (default true), `sms_enabled` (default false), `browser_enabled` (default false — unused in current delivery logic).
- **Quiet hours**: `quiet_hours_start` (time), `quiet_hours_end` (time), `quiet_hours_timezone` (default `'Europe/Oslo'`). Overnight ranges supported (e.g. 22:00–07:00). Priority=2 events bypass quiet hours.
- Deferred notifications are rescheduled to next 07:00 in the user's timezone.
- Missing preference row: treated as all-defaults (push+email on, sms off, no quiet hours).

**Gap**: No per-mode×channel matrix. Today the control is: 3 mode toggles (work/training/community) + 4 global channel toggles. P2 adds a 3×3 matrix (each mode can have push/email/sms individually toggled).

---

## 6. AI Integration

**Current state (gap):** Botsson has no `notify` capability tool. The personal capability has `set_reminder` which writes `engine_state` but there is no engine-dispatch handler that translates that engine state into a `notification_outbox` insert. AI-triggered reminders produce no notification.

**P3 target:** A `notify` capability tool that calls `insertOutboxNotification()` directly through the outbox helper, routing to all 4 channels per user preferences. ADR-0390 will define the capability boundary and any C4 gate requirements.

---

## 7. Architecture Contract

1. **All system-generated notifications go through `notification_outbox`.** No direct inserts into `notification` by application code (except `process-notifications` itself as the authorized consumer).
2. **`in_app` is always written** by `process-notifications` — regardless of channel preferences, every processed outbox row creates a `notification` row. Channel preferences only control push/email/sms fan-out.
3. **OneSignal targeting = External ID = profile_id.** No device-token column in any DB table. OneSignal owns the device registry.
4. **Critical SMS fallback** is triggered by `push-dispatch` on `recipients=0`, not by the outbox row's `sms` channel. This is intentional: SMS for critical events fires even when sms is disabled in user prefs.
5. **`process-notifications` runs every 30 seconds** via pg_cron. Priority=2 rows also get an immediate trigger via `dispatch_critical_notification()` DB trigger.
6. **Stale rows (>24h pending) are suppressed** automatically by `process-notifications`.
7. **Grouping is hardcoded at 3 minutes** (`resolveGrouping()` uses `now() - 3 * 60 * 1000`), ignoring `grouping_window_sec` from event config. This is a known bug (see GAPS-AND-DEBT.md).

---

## 8. Gaps Summary

See [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) for full detail. Key items:

- **P2**: per-mode×channel preference matrix (today: coarse 3-mode + global channel)
- **P3**: no AI `notify` capability; `set_reminder` dead-ends
- **P4**: mobile has no preferences UI (hook exists, unused on mobile)
- **2 Expo senders bypass push-dispatch**: `engine-dispatch/handlers/day-line-push.ts` + platform-admin broadcast — dead in PWA, deferred
- `morning-digest` EF ignores `email_enabled`
- `grouping_window_sec` ignored (hardcoded 3-min)
- Single OneSignal app for dev+prod (isolate at first key rotation)
- Device delivery, deep-link at runtime, 3 journeys: UNVERIFIED (0 subscribers; awaiting deploy + iPhone test)

---

## 9. Module Status Summary

- **Schema:** complete. `notification_preference` + `notification_outbox` (migration 00006) + `notification` table (migration 20260324220000).
- **in_app channel:** shipped. Realtime, bell, web + mobile.
- **email channel:** shipped. Missing `email_enabled` gate in morning-digest EF.
- **sms channel:** shipped. Priority=2 only. Critical fallback in push-dispatch.
- **push channel (OneSignal):** shipped (this branch). Server-side verified live (HTTP 200, recipients, SMS fallback). Device delivery unverified (0 subscribers).
- **40-event registry:** shipped. Templates, i18n keys, action_url_templates, grouping.
- **Preferences hook:** shipped (`useNotificationPreferences` + `useUpdateNotificationPreferences`), web-only — mobile has no UI.
- **Deep links:** shipped (this branch). Mapper + catch-all route.
- **AI capability:** absent (P3).
