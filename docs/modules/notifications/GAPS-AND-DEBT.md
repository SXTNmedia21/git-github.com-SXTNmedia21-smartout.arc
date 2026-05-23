---
title: Notifications — Gaps and Debt
status: in_progress
updated: 2026-05-22
created: 2026-05-22
module: notifications
tags: [gaps, debt, notifications, push, ai, preferences]
---

# Notifications — Gaps and Debt

> Verified gaps. Every item is traceable to code or spec. Severity: CRITICAL / HIGH / MEDIUM / LOW.

---

## G1 — Device delivery unverified (HIGH)

**Source:** gap-closure plan `2026-05-22`, Task 5; spec risk section
**Status:** OPEN

Push-dispatch reaches OneSignal server-side (HTTP 200, recipients returned, verified 2026-05-22). But:
- 0 push subscribers exist (branch not deployed to `mobile.smartout.ai`)
- No Android or iOS device has gone through `loginOneSignal` → push permission → subscription
- Three journeys in `docs/journeys/JOURNEY-onesignal-push-*.md` have unset `status: verified`

**Fix:** Deploy branch → follow Task 5 of gap-closure plan → device test on Android (no install gate) → iOS spot-check.

---

## G2 — Per-mode×channel preference matrix absent (MEDIUM)

**Source:** spec `2026-05-21-notification-system-design.md` §What's missing #2; ADR-0390 (planned)
**Status:** P2 — planned

Today the preference model is coarse:
- 3 binary mode toggles: `work_enabled`, `training_enabled`, `community_enabled`
- 4 binary global channel toggles: `push_enabled`, `email_enabled`, `sms_enabled`, `browser_enabled`

No user can say "for work events, push only; for training events, email only". The matrix P2 adds is 3×3 (mode × channel), giving 9 independent controls.

**Impact:** Users cannot tune notification channels per context. All work notifications go to all enabled channels equally.

**Fix:** P2 — ADR-0390 + schema change + updated preference resolution in `process-notifications`.

---

## G3 — No AI `notify` capability tool (HIGH)

**Source:** spec §What's missing #3; MODULE_BOTSSON
**Status:** P3 — planned

Botsson has no tool to send a notification to a user. There is no `notify` capability in `packages/ai/src/capabilities/`.

Additionally, the `set_reminder` tool in the personal capability wires an engine state step but there is no `engine-dispatch` handler that reads that state step and writes to `notification_outbox`. AI-triggered reminders silently produce no delivery.

**Impact:** AI cannot reach users outside the chat session. Voice reminders ("remind me at 17:00 to check the fridge temp") are accepted but never delivered.

**Fix:** P3 — `notify` capability tool calling `insertOutboxNotification()` directly + fix `set_reminder` handler in engine-dispatch.

---

## G4 — Mobile preferences UI absent (MEDIUM)

**Source:** spec §What's missing #4; ADR-0133 (mobile boundary)
**Status:** P4 — planned

`useNotificationPreferences` and `useUpdateNotificationPreferences` exist in `packages/notifications/src/hooks/` and are mobile-compatible (React Query, `@smartout/supabase/client`). But no mobile screen renders them.

Employees on mobile cannot toggle quiet hours, disable email, or control push permission beyond the OS-level toggle.

**Impact:** Mobile users have no in-app preference control. Must use web dashboard.

**Fix:** P4 — mobile settings screen composing the existing hook.

---

## G5 — 2 Expo senders bypass outbox + push-dispatch (MEDIUM)

**Source:** spec decision D2; ADR-0394 consequences
**Status:** OPEN (deferred, P1-followup)

Two senders call the Expo Push API directly and are dead in PWA:

1. `supabase/functions/engine-dispatch/handlers/day-line-push.ts` — ADR-0367 day-line operational pushes (clocked-in task notifications).
2. `apps/web/src/app/api/platform-admin/communications/push/send/route.ts` — godmode broadcast from platform-admin.

Neither is wired to `push-dispatch` or `sendOneSignalPush()`. Both are bypassing the unified outbox funnel entirely. Neither is dangerous (they are fire-and-forget to a dead endpoint), but they produce no push delivery for any current user.

**Impact:** Day-line task pushes and godmode broadcasts do not reach employees. Zero delivery since PWA launch.

**Fix:** Migrate both to call `sendOneSignalPush()` from `_shared/onesignal.ts` directly (per spec D2 "share the helper") — they intentionally bypass outbox as they are operational/emergency paths.

---

## G6 — `morning-digest` EF ignores `email_enabled` (LOW)

**Source:** spec §What's missing #5
**Status:** OPEN

`supabase/functions/send-morning-digest/index.ts` (not read in this session — GAP: exact line ref unverified) sends digest emails without checking `notification_preference.email_enabled`. Users who have opted out of email still receive morning digests.

**Impact:** Privacy/UX: email-opted-out users receive unwanted email.

**Fix:** Add `notification_preference` lookup before sending in `send-morning-digest`.

---

## G7 — `grouping_window_sec` config field is ignored (LOW)

**Source:** `supabase/functions/process-notifications/index.ts:297` — hardcoded `3 * 60 * 1000` (3 minutes)
**Status:** OPEN

The `NotificationEventConfig.grouping_window_sec` field is set per event (e.g. `shift.punched_in: 300s`, `deviation.reported: 0s`) but `resolveGrouping()` always uses a hardcoded 3-minute lookback regardless of the configured window.

Events with `grouping_window_sec: 0` (no grouping intended) are still merged if a recent unread notification exists with the same group_key.

**Impact:** Low — mostly affects perceived timing of grouped notification updates. Does not affect delivery.

**Fix:** Pass `config.grouping_window_sec` into `resolveGrouping()` and use it in the threshold calculation.

---

## G8 — Single OneSignal app for dev+prod (LOW)

**Source:** ADR-0394 consequences; ops notes
**Status:** OPEN (acceptable for now)

Dev and production share the same OneSignal app ID (`b7d27f4f-5e80-47dc-8728-8f4de8eec1fe`) and REST key. A test push from dev can reach a production subscriber and vice versa.

**Impact:** Low until the first real subscribers exist. Risk increases as user base grows.

**Fix:** Create separate OneSignal apps for dev/staging/prod at first key rotation (~30d after launch). Update both vaults in 1Password + redeploy EF secrets.

---

## G9 — `retry_count` column reference not confirmed in migration DDL (LOW)

**Source:** `apps/web/supabase/functions/process-notifications/index.ts:107` — `(row.retry_count ?? 0) + 1`
**Status:** GAP — UNVERIFIED

The `notification_outbox` table DDL in `00006_notification_engine.sql` does not include a `retry_count` column. The application code references it (`row.retry_count ?? 0`). Either the column exists in a subsequent migration not read here, or the `?? 0` default silently masks the missing column.

**Fix:** Verify with `\d notification_outbox` against local DB. If absent, add migration.

---

## G10 — No preferences settings page route verified on web (LOW)

**Source:** `USER-FLOWS.md` Journey 6
**Status:** GAP — page existence not confirmed in this session

The preferences hook exists. A route like `/dashboard/notifications/settings` or `/dashboard/settings/notifications` presumably exists for web but was not verified by reading the file tree.

**Fix:** Verify `apps/web/src/app/dashboard/` for a notification settings page route.
