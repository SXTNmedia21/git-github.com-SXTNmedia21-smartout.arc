---
title: Notifications Domain — User Flows
status: done
updated: 2026-05-23
created: 2026-05-23
domain: notifications
mirror: verified
last_verified: 2026-05-23
tags: [notifications, user-flows, journeys, push, onesignal]
---

# Notifications — User Flows

> This file is a journey INDEX. It links to `docs/journeys/` — it does NOT duplicate journey content.

## Journey Inventory

### Push Permission (OneSignal Web PWA)
**Journey:** `docs/journeys/JOURNEY-onesignal-push-employee-grants-push-permission.md`
- Employee opens mobile PWA → taps "Aktiver varsler" gesture button → browser permission prompt → OneSignal SDK registers → `OneSignal.login(profileId)` → employee is reachable by push.
- Status: `status: verified` (post-merge, pending iPhone device test for full production confirmation).

### Employee Receives Push Notification
**Journey:** `docs/journeys/JOURNEY-onesignal-push-employee-receives-push.md`
- System event → outbox → process-notifications → push-dispatch → OneSignal REST → device receives push → employee taps → deep-link catch-all → mobile screen.
- Status: `status: verified` (pending real-device deep-link confirmation).

### Critical Event SMS Fallback
**Journey:** `docs/journeys/JOURNEY-onesignal-push-critical-sms-fallback.md`
- Critical event (e.g. `shift_confirmation_reminder`) → push-dispatch → OneSignal `recipients=0` (no device subscribed) → `attemptSmsFallback()` → Twilio SMS to `user_identity.phone`.
- Status: `status: verified`.

### Day-Line Push
**Journey:** `docs/journeys/JOURNEY-day-line-push.md`
- Clock-in sets `profile.active_push_topic` → day-line engine step fires → push to subscribed topic.
- **Note:** this is an operational bypass (D2 pattern); routes through OneSignal helper directly, not outbox.
- Status: in `docs/journeys/`.

### Period-Locked Notification
**Journey:** `docs/journeys/JOURNEY-mvp-blockers-period-locked-notification.md`
- Payroll period locked → engine process `payroll_period_locked_notifier` → `send_notification` step → outbox → in-app + email to managers.
- Status: in `docs/journeys/`.

### Notification Fixes (reliability, outbox consumer)
**Journey:** `docs/journeys/JOURNEY-notification-fixes.md`
- Covers the fix flow: outbox reliability hardening (retry_count, RLS, atomic fetch_pending_outbox) + email channel resurrection + event-config template overhaul.
- Status: `status: done`.

### Notification System (original build)
**Journey:** `docs/journeys/JOURNEY-notification-system.md`
- Initial build: outbox consumer, in-app notification table, bell, preferences UI, smart grouping, morning digest, event config registry.
- Status: `status: done`.

### Nyheter Engagement Wave A — Push Arrives with Operational Priority
**Journey:** `docs/journeys/JOURNEY-nyheter-engagement-wave-a-push-arrives-with-operational-priority.md`
- Announcement marked `operational_priority=true` → push routed at elevated priority → `fn_publish_announcement_notifications` → outbox.
- Status: in `docs/journeys/`.

## Flow Grouping by Surface

### Employee (mobile / web)
- Receives push → taps → deep link lands on correct screen (JOURNEY-onesignal-push-employee-receives-push)
- Grants push permission (JOURNEY-onesignal-push-employee-grants-push-permission)
- Receives SMS fallback for critical events (JOURNEY-onesignal-push-critical-sms-fallback)
- Views notification center (web: `/dashboard/notifications/`; mobile: `(me)/notifications`)
- Marks notifications read (telemetry: `notification.marked_read`, `notification.marked_all_read`)

### Manager / Admin
- Period locked → receives in-app + email (JOURNEY-mvp-blockers-period-locked-notification)
- Critical guardian signal → receives email via guardian-notify EF (separate from outbox)
- Views and manages workspace notification policies (`notification_policy` table — UI not yet built, Gap G6)

### System / Cron
- Outbox consumer runs every 30s (prod pg_cron) or on INSERT trigger (dev)
- Morning digest delivered at 07:00 UTC (send-morning-digest EF)
- Task-due reminders scanned every 15 min (task_due_reminder cron — pending feat/onesignal-push merge)
- Guardian notify runs every 30 min (guardian-notify EF)
