---
title: Notifications — User Flows
status: in_progress
updated: 2026-05-22
created: 2026-05-22
module: notifications
tags: [user-flows, notifications, push, employee, manager, admin, onesignal, deep-link]
---

# Notifications — User Flows

> System-level and user-facing journeys. Includes the 3 OneSignal journeys from the gap-closure plan.

---

## Journey 1: Employee Receives a Shift Push Notification (OneSignal)

**Status:** UNVERIFIED — awaiting deploy + device test (0 subscribers as of 2026-05-22)

**Precondition:**
- Employee has signed in to the mobile PWA at `https://mobile.smartout.ai`
- Employee has granted push permission (tapped "Aktiver varsler")
- `loginOneSignal(profile_id)` has run → External ID registered in OneSignal
- A shift has been published by a manager for this employee

**Happy path:**

1. Manager publishes a shift for the employee → server emits `shift.published` event.
2. `insertOutboxNotification()` inserts row: `mode=work, priority=1, event_key="shift.published", allowed_channels=["push","email","in_app"]`.
3. `process-notifications` cron (30s interval) picks up the row.
4. Preference check: `work_enabled=true`, `push_enabled=true`, not in quiet hours → proceeds.
5. Grouping check: no recent unread `shift:dept:date` group → no merge.
6. `notification` row inserted (in_app).
7. `push-dispatch` EF called with `{ event: "shift.published", profile_id, payload: { title, body, data: { action_url: "/dashboard/my-schedule?date=2026-05-22" } } }`.
8. `push-dispatch` calls `sendOneSignalPush({ externalIds: [profile_id], title, body, url: "https://mobile.smartout.ai/dashboard/my-schedule?date=2026-05-22" })`.
9. OneSignal delivers push to the employee's device. Notification displays: "Ny vakt 2026-05-22 kl 08:00".
10. Employee taps the notification.
11. PWA navigates to `https://mobile.smartout.ai/dashboard/my-schedule?date=2026-05-22`.
12. `app/dashboard/[...rest].tsx` mounts → calls `mobileRouteForActionUrl("/dashboard/my-schedule?date=2026-05-22")` → returns `/(app)/(shifts)`.
13. `router.replace("/(app)/(shifts)")` → employee lands on the shifts tab.

**Postcondition:** Employee sees their shift on the shifts tab. In-app notification is unread in the bell center.

**Error paths:**
- Employee has not installed the PWA / not granted permission → `recipients=0` from OneSignal. Not a critical event → no SMS fallback. In-app notification still delivered.
- Employee in quiet hours (priority=1) → row rescheduled to next 07:00. Push delayed. In-app NOT inserted until after quiet hours.
- `push-dispatch` EF misconfigured (missing ONESIGNAL_APP_ID) → 500 response, push fails, in-app still delivered.
- iOS device: push only on home-screen-installed PWA. In-browser Safari tab receives nothing → in-app is the only channel.

---

## Journey 2: Critical SMS Fallback (OneSignal recipients=0)

**Status:** VERIFIED server-side (live test: `sms_fallback:true` + "No phone number" log — device delivery unverified)

**Precondition:**
- A deviation is reported in a workspace.
- The manager recipient has no push subscription (no subscribed device in OneSignal).
- The event `deviation.reported` is in `CRITICAL_EVENTS`.

**Happy path:**

1. Deviation reported → `insertOutboxNotification()` inserts: `mode=work, priority=2, event_key="deviation.reported", allowed_channels=["push","sms","email","in_app"]`.
2. Priority=2 → `dispatch_critical_notification()` DB trigger fires immediately. Does NOT wait 30s.
3. `process-notifications` runs. Priority=2 → quiet hours bypassed.
4. `notification` row inserted (in_app).
5. SMS channel: `channels.includes("sms") && pref.sms_enabled && row.priority === 2`. If `sms_enabled=true` AND phone present → `sendSms()` fires.
6. Push channel: `push-dispatch` called.
7. `sendOneSignalPush()` returns `{ ok: true, recipients: 0 }` (no subscribed device).
8. `isCritical=true` (deviation.reported in CRITICAL_EVENTS) → `attemptSmsFallback(userId, body)`.
9. `user_identity.phone` fetched. If present → `sendSms()`. If absent → logs "No phone number for SMS fallback, user: ...".

**Postcondition:** Manager receives SMS with deviation alert body. In-app notification delivered regardless.

**Error paths:**
- `user_identity.phone` is null → SMS fallback logs warning, no SMS sent. In-app is the only reliable channel.
- Twilio failure → `sendSms()` returns `{ success: false, error }` → warning logged, not retried.

---

## Journey 3: Deep Link Lands on Correct Mobile Screen

**Status:** UNVERIFIED — route implemented, device test pending

**Precondition:**
- Employee has a push subscription.
- A push notification has been delivered with `url = "https://mobile.smartout.ai/dashboard/my-training"`.
- Employee taps the notification (app may be closed, backgrounded, or foreground).

**Happy path (cold start — app closed):**

1. Employee taps notification → OS opens `https://mobile.smartout.ai/dashboard/my-training`.
2. Expo Router loads. No matching screen at `/dashboard/my-training`.
3. `app/dashboard/[...rest].tsx` mounts with `pathname="/dashboard/my-training"`.
4. `useEffect` calls `mobileRouteForActionUrl("/dashboard/my-training")` → returns `/(app)/(home)/training`.
5. `router.replace("/(app)/(home)/training")` → employee sees the training screen.

**Happy path (warm — app backgrounded):**
Same as above. OneSignal web-push opens the URL in the PWA window. Catch-all mounts and redirects.

**Error paths:**
- Unknown `action_url` (e.g. `/dashboard/settings`) → mapper returns `null` → `router.replace("/(app)/(home)")` → employee lands on home. No dead-end.
- Generic `/dashboard` → mapper returns `null` → home fallback.
- Service worker not served correctly (HTML instead of JS) → OneSignal SDK fails to init, no push subscriptions possible. Check with `curl https://mobile.smartout.ai/OneSignalSDKWorker.js | head -1`.

---

## Journey 4: Employee Opts In to Push (iOS PWA — Gesture Gate)

**Precondition:**
- Employee has installed the PWA to iOS home screen (iOS 16.4+).
- Employee opens the PWA and signs in.
- `loginOneSignal(profile_id)` has linked the session.
- Employee has NOT yet granted push permission.

**Happy path:**

1. Employee navigates to notification settings or sees "Aktiver varsler" prompt in `NotificationScreen`.
2. Employee taps "Aktiver varsler" button.
3. Button handler calls `requestPushPermission()` → `OneSignal.Notifications.requestPermission()` from gesture handler.
4. iOS displays the push permission dialog.
5. Employee taps "Tillat" (Allow).
6. `requestPushPermission()` returns `true`.
7. OneSignal registers the subscription → External ID `profile_id` now has a device.
8. Future pushes deliver to this device.

**Error paths:**
- Employee taps "Ikke tillat" (Deny) → `requestPushPermission()` returns `false`. No subscription. In-app channel is the only delivery path.
- `requestPermission()` called outside gesture handler (e.g. on mount) → iOS silently rejects, returns `false`. This is why `loginOneSignal()` does NOT call `requestPermission()` automatically.
- Employee on iOS in-browser Safari (not home screen) → push permission dialog may not appear even from gesture. iOS 16.4+ requires installed PWA.

---

## Journey 5: Manager Reads In-App Notification (Bell Center)

**Precondition:** Manager is signed in on web dashboard. A new notification has been delivered.

**Happy path:**

1. `process-notifications` inserts into `notification` table.
2. Realtime subscription fires → bell icon increments unread count.
3. Manager clicks bell icon → notification center opens.
4. List of unread notifications displayed (sorted by `created_at DESC WHERE is_read=false`).
5. Manager clicks a notification row.
6. Notification marked `is_read=true`, `read_at=now()` in DB.
7. Manager navigated to `action_url` (web route).

**Mobile variant:**
1. Same Realtime subscription fires in mobile app.
2. Employee opens `(me)/notifications` screen.
3. Taps notification → `handleNotificationPress` in `NotificationScreen` → `mobileRouteForActionUrl(action_url)` → `router.push(route)`.

---

## Journey 6: Employee Updates Notification Preferences

**Precondition:** Employee signed in. Has never changed preferences (row may not exist).

**Happy path:**

1. Employee navigates to notification settings page (web: `/dashboard/notifications/settings` — route GAP: preferences settings page not verified as existing; GAP marked below).
2. Page loads `useNotificationPreferences(userId)`. Returns null if first time.
3. Employee toggles "Email varsler" off.
4. `useUpdateNotificationPreferences` fires `upsert({ user_id, email_enabled: false })`.
5. `notification_preference` row created or updated.
6. Future `process-notifications` runs skip email fan-out for this user.

**GAP:** No mobile preferences UI. The hook exists in `packages/notifications/` but no mobile settings screen renders it. Deferred to P4.

---

## Channel + Surface Matrix

| Surface | in_app | email | sms | push |
|---------|--------|-------|-----|------|
| Web bell + `/dashboard/notifications` | ✅ | — | — | — |
| Mobile `(me)/notifications` screen | ✅ | — | — | — |
| Mobile push (OneSignal web) | — | — | — | ✅ (P1) |
| Email (SendGrid) | — | ✅ | — | — |
| SMS (Twilio, priority=2 only) | — | — | ✅ | — |
| Native push (future phase) | — | — | — | ✅ (future) |
| Web browser push | — | — | — | ❌ (not wired; `browser_enabled` unused) |
