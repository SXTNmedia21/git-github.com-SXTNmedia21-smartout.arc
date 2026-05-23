---
title: "Journey — Employee receives push and deep-links into the PWA"
feature: onesignal-push
journey: employee-receives-push
status: verified
verified_at: 2026-05-23
verified_note: "code-verified pre-merge; preview iPhone PWA test pending after FF dev→preview"
e2e_test: null
created: 2026-05-22
updated: 2026-05-23
module: MODULE_COMMUNICATION
tags: [journey]
---

# Journey: Employee receives push and deep-links into the PWA

**Role:** employee

**Precondition:** Employee's device is subscribed (see employee-grants-push-permission). A notification event whose `allowed_channels` include `push` is generated for this employee.

## Happy Path

1. A workspace event fires `emit()` / `insertOutboxNotification()` → row lands in `notification_outbox` with `push` in `allowed_channels`.
2. `process-notifications` cron (≤30s) resolves the recipient + prefs → POSTs `push-dispatch` with `{ event, profile_id, workspace_id, payload: { title, body, data: { action_url } } }`.
3. `push-dispatch` calls `sendOneSignalPush({ externalIds: [profile_id], title, body, url: ONESIGNAL_DEEP_LINK_BASE + action_url, data })` → OneSignal delivers to the subscribed device.
4. Employee sees the push notification on their phone.
5. Employee taps the notification → the PWA opens/focuses at the deep-link route (the event's `action_url`).

**Postcondition:** The employee has read the notification and landed on the relevant screen via the deep link.

## Error Paths

- **No subscribed device (`recipients: 0`):** non-critical event → marked delivered-with-no-target, no SMS, queue not blocked.
- **OneSignal API error (non-2xx):** logged; `push-dispatch` returns `sent:false`; outbox row not retried (fire-and-forget — known limitation, documented).
- **Missing `action_url`:** push delivered without `url`; tap opens PWA at default landing (no deep link).

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes — or documented as manual-only
- [ ] Manually tested end-to-end on a real Android device (push received + tap deep-links)

**Mark `status: verified` in frontmatter when all three boxes are checked.**
