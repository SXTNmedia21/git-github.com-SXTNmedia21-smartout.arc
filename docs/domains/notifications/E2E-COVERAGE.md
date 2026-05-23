---
title: Notifications Domain — E2E Coverage
status: done
updated: 2026-05-23
created: 2026-05-23
domain: notifications
mirror: verified
last_verified: 2026-05-23
tags: [notifications, e2e, testing, playwright, coverage]
---

# Notifications — E2E Coverage

> Verified against `apps/e2e/` — honest map of what is actually tested.

## Test Files

### Playwright E2E

| File | What it covers | Status |
|------|---------------|--------|
| `apps/e2e/tests/heartbeat/j4-stale-notification-breach.spec.ts` | Heartbeat check: notification outbox staleness breach (guardian integration) | ✅ exists |

No dedicated notifications/ Playwright spec directory found. No `apps/e2e/specs/*notif*` or `apps/e2e/specs/*push*` files.

### Unit Tests

| File | What it covers | Status |
|------|---------------|--------|
| `apps/mobile/src/lib/__tests__/deep-link.test.ts` | `mobileRouteForActionUrl()` mapper — 9 routes | ✅ 9 tests pass (verified in HANDOFF) |
| `supabase/functions/_shared/onesignal.test.ts` | `sendOneSignalPush()` helper with mocked fetch | ✅ created in feat/onesignal-push (merged) |

## Coverage Delta

| Flow | Test coverage | Notes |
|------|--------------|-------|
| in-app notification bell — receives + reads | ❌ No Playwright spec | Basic flow; should be J1 |
| Notification center page (`/dashboard/notifications`) | ❌ No Playwright spec | |
| Mark all read | ❌ No spec | Telemetry event registered; flow untested |
| Push permission grant (web PWA) | ❌ No spec | Requires real device / OneSignal; hard to automate |
| Push received + deep-link tap | ❌ No spec | Requires real device; unit tests cover mapper |
| Critical SMS fallback | ❌ No spec | Requires Twilio test credentials |
| Quiet hours defer | ❌ No spec | Pure function `checkQuietHours` — unit testable |
| Smart grouping | ❌ No spec | `resolveGrouping` — unit testable |
| outbox staleness recovery | ❌ No dedicated spec | `fetch_pending_outbox` RPC: staleness logic is SQL-only |
| guardian-notify email | ❌ No spec | EF test; integration test possible with local SendGrid mock |
| Notification preference UI (web) | ❌ No spec | Settings panel — should be E2E coverage |
| Morning digest | ❌ No spec | EF test; integration test possible |

## Recommended Next Tests

Priority order:
1. **J1 in-app bell + notification center** — Playwright spec at `apps/e2e/specs/notifications/j1-in-app-bell.spec.ts`. Happy path: trigger an outbox event via API → bell shows unread count → open center → mark read → count clears.
2. **J2 quiet hours defer** — Vitest unit test for `checkQuietHours` + `getNext7am`. Pure functions, easy to test.
3. **J3 smart grouping** — Vitest unit for `resolveGrouping`. Mock Supabase client.
4. **J4 notification preference toggle** — Playwright: toggle `email_enabled` off → trigger event → confirm no email delivered to Mailpit.
5. **J5 outbox retry** — pgTAP or integration test: force a failed row → confirm retry up to 3x → suppressed.
