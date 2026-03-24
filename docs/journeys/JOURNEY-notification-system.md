---
title: "User Journeys — Notification System"
status: done
updated: 2026-03-25
created: 2026-03-25
module: communications
tags: [notifications, journeys]
---

# User Journeys — Notification System

## Journey: Employee Receives Shift Notification

**Precondition:** Employee has a profile in the workspace. Push notifications enabled (default).

1. Manager publishes a shift for the employee → DB trigger fires → `notification_outbox` row created with event_key `shift.published`, priority 1
2. `process-notifications` cron picks up outbox row within 30s → Checks employee's `notification_preference`
3. If within quiet hours (non-critical) → Reschedules to 07:00 next morning
4. If outside quiet hours → INSERTs into `notification` table (in-app) + dispatches push via `push-dispatch` EF
5. Employee sees:
   - **Mobile:** Push notification on device + badge count on bell icon updates
   - **Web:** Realtime subscription fires → bell icon shows red unread dot → browser notification if tab hidden
6. Employee clicks notification → Mark as read + navigate to `/dashboard/my-schedule?date={date}`

**Postcondition:** Notification marked as read, employee viewing their schedule.

**Error paths:**

- No push token → push delivery silently fails, in-app notification still created
- Employee has push_enabled=false → Only in-app notification created
- process-notifications EF fails → outbox row stays `pending`, retried next cron cycle (max 3 attempts, then `failed`)

---

## Journey: Employee Views Notification Center (Web)

**Precondition:** Employee logged into dashboard.

1. Employee sees bell icon in dashboard header with unread badge count
2. Employee clicks bell → Popover opens showing last 8 notifications
3. Each notification shows: icon (per type), title, relative time, unread dot
4. Employee clicks a notification → Mark as read + navigate to action_url
5. Employee clicks "Se alle varsler" → Navigates to `/dashboard/notifications`
6. Full page shows: filter tabs (Alle, Uleste, per category), infinite scroll list
7. Employee selects "Uleste" filter → Only unread notifications shown
8. Employee clicks "Marker alle som lest" → All visible notifications marked as read → Badge count drops to 0

**Postcondition:** All notifications marked as read.

**Error paths:**

- No notifications → Empty state: "Ingen varsler ennå"
- Realtime subscription drops → Notifications still load on page refresh (polling via TanStack Query refetchOnWindowFocus)

---

## Journey: Employee Views Notification Center (Mobile)

**Precondition:** Employee has the mobile app installed.

1. Employee sees bell icon in home header with animated unread badge
2. Employee taps bell → NotificationScreen opens with full notification list
3. Filter chips at top: Alle, Uleste, Vakter, Oppgaver
4. Employee pulls down → Pull-to-refresh triggers data reload
5. Employee taps notification row → Mark as read + navigate to relevant screen
6. Employee taps "Alle lest" button → All notifications marked as read

**Postcondition:** Notifications viewed and managed.

**Error paths:**

- Push notification tap when app is closed → App opens, marks notification read, navigates to action_url
- No matching deep link for action_url → Falls back to notifications screen

---

## Journey: Manager Receives Critical Deviation Alert

**Precondition:** Manager has admin/manager role in workspace. Deviation is reported.

1. Employee reports a deviation → DB trigger fires → `notification_outbox` row created with event_key `deviation.reported`, **priority 2** (CRITICAL)
2. CRITICAL fast-path trigger on outbox immediately invokes `process-notifications` (no 30s wait)
3. process-notifications processes the row:
   - Priority 2 → Quiet hours IGNORED (always delivered)
   - Channels: push + SMS + email + in-app
4. Manager receives:
   - Push notification immediately
   - SMS via Twilio (if sms_enabled + phone number on file)
   - Email via SendGrid (stub in MVP, console.log)
   - In-app notification in bell
5. All managers/admins in workspace notified (excluding reporter)

**Postcondition:** All managers alerted to deviation.

**Error paths:**

- No SMS credentials configured → SMS delivery skipped, other channels still fire
- Manager has sms_enabled=false → SMS skipped per preference

---

## Journey: Employee Configures Notification Preferences

**Precondition:** Employee logged into dashboard, navigates to Settings.

1. Employee goes to `/dashboard/settings` → Clicks "Notifications" tab
2. Settings page shows three sections:
   - **Channels:** Push (on), Email (on), SMS (off), Browser (off) — toggles
   - **Categories:** Arbeid (on), Opplæring (on), Fellesskap (on) — toggles
   - **Quiet Hours:** Start time (22:00), End time (07:00), Timezone (Europe/Oslo)
3. Employee toggles "Browser-varsler" ON → Browser permission dialog appears
4. Employee grants permission → Toggle stays ON, browser notifications active
5. Employee toggles "SMS" ON → Toggle ON (SMS only fires for CRITICAL events)
6. Employee sets quiet hours 23:00–06:00 → Saved immediately via upsert
7. Disclaimer visible: "Kritiske varsler leveres alltid, uavhengig av stilletid."

**Postcondition:** Preferences saved, applied to all future notifications.

**Error paths:**

- First time user → No preference row exists → Defaults shown → First toggle creates the row via upsert
- Browser notification permission denied → Toggle reverts to off
- Update fails → Toast error, toggle reverts (mutation onError)

---

## Journey: Employee Receives Morning Digest

**Precondition:** Employee has unread notifications from overnight/yesterday.

1. pg_cron fires `send-morning-digest` at 07:00 Europe/Oslo
2. Edge Function queries distinct recipients with unread notifications in last 24h
3. Per recipient:
   - Fetches unread notifications grouped by icon_type
   - Fetches email from profile → user_identity join
   - Builds HTML email with sections per category
4. Employee receives email: "Din morgenoversikt — Smartout"
   - "God morgen!" header
   - Grouped sections: Vakter (3), Oppgaver (1), etc.
   - Each item clickable → opens dashboard
   - "Se alle varsler →" link at bottom
5. If no unread notifications → Skip, no email sent

**Postcondition:** Employee informed of overnight activity.

**Error paths:**

- SendGrid API key not configured → Digest skipped silently
- No email on user_identity → Recipient skipped
- All notifications already read → Recipient skipped (no empty emails)

---

## Journey: Smart Grouping of Chat Messages

**Precondition:** Multiple chat messages arrive for same conversation within 3 minutes.

1. First chat message → `notification_outbox` row created → Processed → New `notification` row with group_key `chat:{channel_id}`
2. Second message within 3 min → process-notifications checks: is there an unread notification with same group_key within 3 min?
3. Yes → UPDATES existing notification: body updated, metadata.count incremented → No new push sent
4. Third message within 3 min → Same: updates existing notification → Count = 3
5. Employee sees ONE notification: "3 nye meldinger" instead of 3 separate notifications

**Postcondition:** Grouped notification visible, reduces notification noise.

**Error paths:**

- Messages > 3 min apart → Each gets its own notification row (no grouping)
- group_key is null → No grouping attempted (each event standalone)
