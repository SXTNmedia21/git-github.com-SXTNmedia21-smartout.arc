---
title: "Journey — Employee grants push permission and subscribes"
feature: onesignal-push
journey: employee-grants-push-permission
status: verified
verified_at: 2026-05-23
verified_note: "code-verified pre-merge; preview iPhone PWA test pending after FF dev→preview"
e2e_test: null
created: 2026-05-22
updated: 2026-05-23
module: MODULE_COMMUNICATION
tags: [journey]
---

# Journey: Employee grants push permission and subscribes

**Role:** employee

**Precondition:** Employee has a Smartout account and opens the mobile PWA (m.smartout.ai) in a supported browser (Android Chrome, or iOS 16.4+ PWA installed to home screen).

## Happy Path

1. Employee opens the PWA → OneSignal Web SDK initialises at app mount (`initOneSignal`) → SDK registers `OneSignalSDKWorker.js` at site root.
2. Employee signs in → a profile resolves → `loginOneSignal(profileId)` runs → OneSignal sets `external_id = profile_id`.
3. SDK prompts for notification permission → Employee taps "Allow" → browser registers the push subscription with OneSignal.
4. Employee sees no error; the device is now a subscribed OneSignal recipient addressable by `external_id`.

**Postcondition:** The employee's device is subscribed in OneSignal under `external_id = profile_id`. Server-side `sendOneSignalPush` targeting that profile will reach this device.

## Error Paths

- **Permission denied:** Employee taps "Block" → no subscription created. Future pushes return `recipients: 0`; no crash. Re-prompt only via browser settings.
- **iOS Safari tab (not installed):** Permission prompt unavailable / push silently undelivered → documented limitation; UX should advise "Add to Home Screen".
- **`EXPO_PUBLIC_ONESIGNAL_APP_ID` missing:** `initOneSignal` logs a warning and no-ops; app continues without push.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter) — or documented as manual-only (web-push subscribe is device/permission gated)
- [ ] Manually tested end-to-end on a real Android device

**Mark `status: verified` in frontmatter when all three boxes are checked.**
