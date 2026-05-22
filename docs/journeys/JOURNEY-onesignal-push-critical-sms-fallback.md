---
title: "Journey — Critical event falls back to SMS when no push subscription"
feature: onesignal-push
journey: critical-sms-fallback
status: draft
verified_at: null
e2e_test: null
created: 2026-05-22
updated: 2026-05-22
module: MODULE_COMMUNICATION
tags: [journey]
---

# Journey: Critical event falls back to SMS when no push subscription

**Role:** employee (or manager) — recipient of a critical event

**Precondition:** A `CRITICAL_EVENTS` event fires (`shift_confirmation_reminder`, `deviation_reported`, `contract.signed`, `contract.expired`) for a recipient who has NO subscribed OneSignal device (never granted permission / never installed PWA), and whose `user_identity.phone` is set.

## Happy Path

1. Critical event → `push-dispatch` called with the event + recipient `profile_id`.
2. `push-dispatch` calls `sendOneSignalPush` → OneSignal returns `recipients: 0` (no subscribed device).
3. `push-dispatch` detects `recipients === 0 && isCritical` → calls `attemptSmsFallback(supabase, user_id, body)`.
4. Twilio sends the SMS to the recipient's phone.
5. Recipient receives the critical message as SMS.

**Postcondition:** The critical message reached the recipient via SMS despite no push subscription. The safety net that existed under the Expo `!pushToken` branch is preserved under the OneSignal `recipients === 0` condition.

## Error Paths

- **No phone number:** `attemptSmsFallback` logs "No phone number for SMS fallback" and exits; no crash.
- **Non-critical event with `recipients: 0`:** no SMS sent (fallback is critical-only by design).
- **Twilio send fails:** logged as warning; `push-dispatch` still returns 200 (best-effort fallback).

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E / integration test exists (mock OneSignal zero-recipients → assert `attemptSmsFallback` invoked for critical) — or documented manual test
- [ ] Manually tested: critical event to a no-device recipient triggers SMS

**Mark `status: verified` in frontmatter when all three boxes are checked.**
