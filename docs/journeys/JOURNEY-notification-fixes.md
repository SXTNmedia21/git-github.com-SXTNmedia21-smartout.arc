---
title: "User Journey — Notification System Fixes"
status: done
updated: 2026-03-27
created: 2026-03-27
module: notifications
tags: [notifications, journey]
---

# User Journey — Notification System Fixes

## Journey: Employee receives shift notification (end-to-end)

**Precondition:** Employee has a profile. Admin publishes a shift.

1. Admin publishes shift → DB trigger fires `trigger_push_shift_published()` → INSERTs into `notification_outbox` with `event_key: "shift.published"` in metadata
2. pg_cron fires `process-notifications` EF every 30s → EF calls `fetch_pending_outbox(100)` RPC
3. RPC atomically locks rows with `FOR UPDATE SKIP LOCKED`, marks as `processing`, returns batch
4. Consumer fetches employee's `notification_preference` via profile → user_id join
5. Consumer checks quiet hours — if active and non-critical, defers to next 07:00 in recipient's timezone
6. Consumer checks mode preference (work/training/community) — skips if disabled
7. Consumer checks smart grouping — if same `group_key` within 3 min, merges with count text
8. Consumer looks up `getEventConfig("shift.published")` → gets `title_template: "Ny vakt {date} kl {start_time}"` → interpolates with metadata
9. Consumer INSERTs into `notification` table with resolved title, body, icon_type, action_url
10. Realtime subscription fires → NotificationBell badge updates, browser notification if tab hidden
11. Consumer calls `push-dispatch` EF for push notification
12. Consumer calls SendGrid API for email (if email_enabled)
13. Consumer marks outbox row as `delivered`

**Postcondition:** Employee sees notification in bell popover, receives push + email. Badge shows unread count.

**Error paths:**

- Delivery fails → row marked `failed`, `retry_count` incremented. Retried on next cron run (max 3).
- 3rd failure → row marked `suppressed`, no more retries.
- Consumer crashes mid-batch → rows stuck in `processing`. Staleness recovery resets after 5 min.
- Unknown `event_key` → warning logged, raw title/body used as fallback.
- Missing preferences → defaults apply (push + email enabled, no quiet hours).

## Journey: Engine process sends notification (onboarding welcome)

**Precondition:** New employee accepts invitation. Onboarding journey engine process is active.

1. Engine process reaches `send_notification` step with `template: "onboarding_welcome"`
2. `engine-dispatch` handler INSERTs into `notification_outbox` with `event_key: "engine.onboarding_welcome"`
3. Consumer picks up row → looks up `getEventConfig("engine.onboarding_welcome")`
4. Resolves `title_template: "Velkommen!"`, `body_template: "Velkommen til teamet! Start opplæringen din her"`
5. INSERTs `notification` with resolved content → employee sees welcome notification

**Postcondition:** Employee sees "Velkommen!" notification with link to `/dashboard/my-training`.

**Error paths:**

- Missing event config entry → warning logged, raw template name used as title (e.g., "onboarding_welcome")

## Journey: Admin marks notification as read

**Precondition:** Admin has unread notifications.

1. Admin clicks bell icon → popover opens showing last 8 notifications
2. Admin clicks a notification row → `useMarkAsRead` mutation fires → `notification.is_read = true`
3. Badge count decrements via query invalidation
4. If `action_url` set → router navigates to target page

**Postcondition:** Notification marked read, badge updated.

## Journey: Employee configures notification preferences

**Precondition:** Employee navigates to Settings → Notifications tab.

1. NotificationPreferences component loads preferences via `useNotificationPreferences`
2. Employee toggles channels (push/email/SMS/browser), categories (work/training/community), or quiet hours
3. `useUpdateNotificationPreferences` mutation saves to `notification_preference` table
4. Changes apply on next notification processing cycle

**Postcondition:** Preferences saved. Future notifications respect new settings.

**Error paths:**

- Browser notifications toggle → requests Notification API permission if not yet granted.

## Journey: Critical notification bypasses quiet hours

**Precondition:** Employee has quiet hours 22:00-07:00. A deviation is reported (priority 2).

1. Deviation trigger fires → INSERTs into `notification_outbox` with `priority: 2`
2. `trg_critical_notification_dispatch` AFTER INSERT trigger fires immediately (bypasses 30s cron)
3. Consumer processes row → quiet hours check: priority 2 = CRITICAL → quiet hours ignored
4. Notification delivered immediately via push + SMS + email + in_app

**Postcondition:** Employee receives notification despite quiet hours.
