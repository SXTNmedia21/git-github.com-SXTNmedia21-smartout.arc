---
title: Notifications — E2E Coverage
status: in_progress
updated: 2026-05-22
created: 2026-05-22
module: notifications
tags: [e2e, testing, notifications, coverage, playwright, vitest]
---

# Notifications — E2E Coverage

> Test coverage status for the notification system. Tracks automated tests, device tests, and manual verification points.

---

## Automated Tests

### Unit Tests — Deep-Link Mapper

**File:** `apps/mobile/src/lib/__tests__/deep-link.test.ts`
**Runner:** vitest (`pnpm --filter @smartout/mobile test deep-link`)
**Status:** ✅ PRESENT AND PASSING (8 test cases)

| Test | Status |
|------|--------|
| komm channel → channel-detail | ✅ |
| shift-clock → punch-clock | ✅ |
| my-schedule → shifts tab | ✅ |
| schedule → shifts tab | ✅ |
| operations → operations | ✅ |
| reconciliation → operations | ✅ |
| my-training → training | ✅ |
| contracts → contract | ✅ |
| people → team | ✅ |
| null for generic /dashboard | ✅ |
| null for unknown paths | ✅ |
| null for empty string | ✅ |

### Unit Tests — OneSignal Helper

**File:** `supabase/functions/_shared/onesignal.test.ts`
**Runner:** Deno test (`deno test _shared/onesignal.test.ts --allow-net`)
**Status:** ✅ PRESENT (3 test cases — mocked fetch)

| Test | Status |
|------|--------|
| Posts external_id alias + headings/contents + url | ✅ |
| Reports zero recipients (no subscribed device) | ✅ |
| Returns ok=false on non-2xx | ✅ |

### Unit Tests — Push Token Hook

**File:** `apps/mobile/src/hooks/__tests__/use-push-token.test.ts`
**Status:** EXISTS (confirmed by gap-closure plan reference) — content not read in this session
**Coverage:** GAP — unknown which paths are covered

---

## Server-Side Verification (Manual, 2026-05-22)

Performed via local-prod-bridge against production Supabase (project `yljaglomadbhyqpcigff`):

| Scenario | Result |
|----------|--------|
| `push-dispatch` reaches OneSignal API (HTTP 200) | ✅ VERIFIED |
| `recipients=1` for a subscribed profile | ✅ VERIFIED |
| `sms_fallback:true` on recipients=0 for critical event | ✅ VERIFIED |
| Auth gate: invalid bearer → 401 | ✅ VERIFIED |
| Server config: ONESIGNAL_APP_ID/REST_API_KEY/DEEP_LINK_BASE set on prod EF | ✅ VERIFIED |

---

## Device Tests (Manual) — PENDING

**Status:** UNVERIFIED — 0 push subscribers as of 2026-05-22. Branch not yet deployed to production mobile.smartout.ai.

| Journey | Device | Expected | Status |
|---------|--------|----------|--------|
| Employee receives push notification | Android Chrome | Notification appears ≤30s after outbox insert | ❌ UNVERIFIED |
| Push tap → deep link to correct screen | Android Chrome | Catch-all redirects to target screen | ❌ UNVERIFIED |
| OneSignal SDK init on iOS PWA (home screen) | iOS 16.4+ | SDK initialises on mount | ❌ UNVERIFIED |
| Push permission prompt on iOS | iOS 16.4+ | Dialog appears on "Aktiver varsler" tap | ❌ UNVERIFIED |
| Push delivered to iOS PWA | iOS 16.4+ | Notification appears in installed PWA | ❌ UNVERIFIED |
| Service worker served as JS (not HTML) | Any | `curl .../OneSignalSDKWorker.js | head -1` = importScripts | ❌ UNVERIFIED (not deployed) |
| auth.redirect whitelist: mobile.smartout.ai | Any | Sign-in works on mobile origin | ❌ UNVERIFIED |

---

## Playwright E2E — NOT PRESENT

No Playwright specs exist for the notification system. Planned tests (future):

| Spec | Journey covered |
|------|----------------|
| `notifications/receive-shift-push.spec.ts` | Journey 1: employee receives push |
| `notifications/critical-sms-fallback.spec.ts` | Journey 2: SMS fallback |
| `notifications/preferences.spec.ts` | Journey 6: preference update |
| `notifications/bell-center.spec.ts` | Journey 5: in-app bell read |

---

## Manual Test Checklist (pre-close-feature)

Before closing this feature, complete the following manual checks:

- [ ] Deploy `feat/onesignal-push` → `development` → pipeline to mobile.smartout.ai
- [ ] Verify `OneSignalSDKWorker.js` serves as JS at site root
- [ ] Android Chrome: sign in → grant permission → receive test push → confirm deep link
- [ ] iOS 16.4+ home-screen PWA: install → sign in → "Aktiver varsler" → grant → receive push
- [ ] Record device/OS/result in HANDOFF
- [ ] Flip 3 journey docs to `status: verified` in `docs/journeys/JOURNEY-onesignal-push-*.md`
