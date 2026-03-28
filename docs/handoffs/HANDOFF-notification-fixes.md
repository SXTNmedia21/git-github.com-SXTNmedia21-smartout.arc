---
title: "Handoff — Notification System Fixes"
status: done
updated: 2026-03-27
created: 2026-03-27
module: notifications
tags: [notifications, fixes, handoff]
---

# Handoff — Notification System Fixes

## Summary

Fixed 6 bugs in the existing notification system to make the outbox consumer reliable, title resolution correct, email delivery functional, and timezone handling accurate. The notification system was ~90% built but had real production bugs.

## What was built

1. **Outbox reliability migration** — `retry_count` column, `updated_at` column, deny-all RLS (service_role bypasses), `fetch_pending_outbox` RPC with `FOR UPDATE SKIP LOCKED` and 5-min staleness recovery
2. **Consumer RPC fetch + retry** — Replaced plain SELECT with atomic row-locking RPC. Failed rows retry up to 3 times before suppression.
3. **Event config overhaul** — Renamed `title_key`/`body_key` to `title_template`/`body_template` with interpolatable Norwegian strings. Added 6 engine template entries (`engine.reconciliation_feedback`, `engine.day_closed`, `engine.workspace_ready`, `engine.onboarding_welcome`, `engine.onboarding_complete`, `engine.session_hook_task`). Created `_shared/event-config.ts` for Deno Edge Function access.
4. **Title resolution** — Consumer now resolves titles from event config registry. Unknown keys fall back to raw values with a warning log.
5. **Email delivery** — Replaced console.log stub with actual SendGrid v3 API call. Resolves recipient email via user_identity join.
6. **Timezone fix** — `getNext7am()` now computes 07:00 in recipient's timezone using `Intl.DateTimeFormat` offset detection, handling DST.
7. **Env template** — Added missing `PUSH_DISPATCH_SECRET`.

## Decisions made

| Decision                                                     | Rationale                                                                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deny-all RLS on notification_outbox                          | Service_role and SECURITY DEFINER bypass RLS. No JWT user should access outbox directly. Fix 1 (API route) was eliminated by council.                       |
| Inline event config in `_shared/` instead of packages import | Deno Edge Functions can't import from `packages/`. `_shared/` pattern is established in codebase (`cors.ts`, `twilio.ts`, `auth-middleware.ts`).            |
| Norwegian template strings instead of i18n keys              | Edge Functions have no i18n runtime. Template strings with `{variable}` placeholders work directly. `title_i18n_key` preserved for future client-side i18n. |
| Eliminate Fix 1 (API route)                                  | Council decision: no recipient resolution model exists. Telemetry→outbox path can't determine who to notify.                                                |
| Defer Fix 7 (i18n) to separate PR                            | 30+ string changes across 3 components + 1 EF. Don't mix with backend reliability fixes.                                                                    |

## Learnings

1. **STATE.md was stale** — said notifications were "SPEC'D" when they were actually 90% built. Always audit before assuming.
2. **Engine templates use a different namespace** — `engine.*` keys were invisible to the event config registry which only had `shift.*`, `chat.*`, etc. Always audit all producers before gating behind a registry.
3. **Recipient resolution is a feature, not a detail** — The telemetry→notification path requires knowing WHO receives the notification. DB triggers solve this in transaction context. A generic API route cannot.
4. **`WITH CHECK (TRUE)` RLS is never safe** — Found on `notification_outbox`. Any authenticated user could inject notifications for any workspace.

## Known issues / debt

- Fix 7 (i18n) deferred — hardcoded Norwegian in NotificationBell, NotificationPreferences, notifications page, send-morning-digest
- `_shared/event-config.ts` is a manual sync copy of `packages/notifications/src/event-config.ts` — needs discipline to keep in sync
- Morning digest missing "pending actions" section (shift approvals, protocol deadlines, open deviations)
- No telemetry `emit()` on consumer mutations (notification delivery events)
- SendGrid dynamic templates not used (raw HTML in digest, plain text in per-notification emails)

## Next steps

- Fix 7: i18n strings (separate PR)
- ADR: Notification Outbox Architecture (pending from council)
- Morning digest enhancement: add pending actions queries
- Consider build-time generation of `_shared/event-config.ts` from packages source
