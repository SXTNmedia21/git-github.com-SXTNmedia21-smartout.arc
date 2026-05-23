---
title: Notifications Domain — Roadmap
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: notifications
mirror: aspirational
last_verified: 2026-05-23
tags: [notifications, roadmap, push, onesignal, p1, p2, p3, p4, adr]
---

# Notifications — Roadmap

> `mirror: aspirational` — this file describes the forward plan. Confirmed-shipped items live in ARCHITECTURE and DATA-MODEL.

## Governing ADRs

- **ADR-0022** — Original notification service architecture. The source of record for the initial notification pipeline design. `docs/decisions/0022-notification-service-architecture.md`
- **ADR-0104** — Notification consolidation roadmap. Ongoing migration of scattered DB-trigger push paths to the unified outbox + engine pipeline. `docs/decisions/0104-notification-consolidation-roadmap.md`
- **ADR-0394** — OneSignal as push channel (Expo retired from outbox path). External ID = profile_id. No device token in DB. `docs/decisions/0394-onesignal-push-channel.md`

## Delivered (P0 + P1)

### P0 — Notification Engine Foundation (2026-03-24 — 2026-03-27)
- ✅ `notification_outbox` + `notification_preference` + enums (00006_notification_engine)
- ✅ `notification` in-app table + Realtime + bell UI + notification center (web + mobile)
- ✅ 6 push triggers refactored to outbox (20260324230000)
- ✅ `process-notifications` EF — outbox consumer with quiet hours, grouping, event-config registry
- ✅ Outbox reliability hardening: retry_count, deny-all RLS, `fetch_pending_outbox` RPC (20260427200000)
- ✅ Email channel — SendGrid REST + dev SMTP bridge to Mailpit/Inbucket
- ✅ Event-config registry: 43 event keys in `packages/notifications/src/event-config.ts`
- ✅ `notification_policy` + `notification_sent_log` tables (ADR-0104 Phase 0 schema)

### P1 — OneSignal Push Channel (2026-05-21 — 2026-05-22, ADR-0394)
- ✅ `sendOneSignalPush()` helper (`_shared/onesignal.ts`) — new REST API (`api.onesignal.com`)
- ✅ `push-dispatch` EF: Expo → OneSignal swap, critical-event SMS fallback (recipients=0)
- ✅ Mobile client: `apps/mobile/src/lib/onesignal.ts`, `OneSignalSDKWorker.js`, "Aktiver varsler" gesture button
- ✅ Deep-link mapper: `apps/mobile/src/lib/deep-link.ts` + 9 unit tests
- ✅ Catch-all route: `apps/mobile/app/dashboard/[...rest].tsx`
- ✅ Deep-link base: `ONESIGNAL_DEEP_LINK_BASE = https://mobile.smartout.ai`
- ✅ `profile.active_push_topic` column (20260620142000)
- ✅ task.due_soon + task.overdue events + task_due_reminder cron (feat/onesignal-push wt-5, pending timestamp fix L-0042)
- 🟡 **iPhone device test pending** — 0 subscribers until deploy to mobile.smartout.ai + home-screen install

### P1 Follow-up (pending)
- 🔴 Migrate `engine-dispatch/handlers/day-line-push.ts` → OneSignal shared helper (currently Expo, dead in PWA)
- 🔴 Migrate `platform-admin/communications/push/send/route.ts` broadcast → OneSignal shared helper

## Forward Plan

### P2 — Preference Matrix (planned)
- 3×3 preference matrix: mode (work/training/community) × channel (push/email/sms); `in_app` always-on.
- Runtime resolve: `effectiveChannels = allowed_channels ∩ user_channel_prefs(mode)`.
- DB migration: extend `notification_preference` with per-mode channel flags.
- Mobile preferences UI: reuse `useNotificationPreferences` hook (exists, web-only today).
- Fix: `morning-digest` ignores `email_enabled` preference; fix grouping_window_sec (hardcoded 3 min instead of registry value).
- Wire `notification_policy` escalation ladders into `process-notifications` consumer.
- Wire `notification_sent_log` inserts for rate-limit enforcement.

### P3 — AI Notify Capability (planned)
- `notify` capability tool in the agent capability registry. Sends via any of 4 channels through outbox.
- Fix `set_reminder` (personal capability): wires engine state but dead-ends — outbox handler missing. Connect.
- AI sends must route through C4 `callGateAction` (no autonomous send without permission gate).
- Channel: chat + voice for in_app send; chat-only V1 for email/SMS/push (PII risk per ADR).

### P4 — Mobile Parity + Bug Fixes (planned)
- Mobile preferences UI: `useNotificationPreferences` hook surfaced in settings screen.
- Unify two parallel deep-link mappers: native `push.ts` uses `resolveDeepLink` from `@smartout/notifications/deep-links`; OneSignal web uses `lib/deep-link.ts`. Extract shared map to `packages/notifications`.
- Morning digest: add pending actions section (shift approvals, protocol deadlines, open deviations).
- SendGrid dynamic templates (replace plain-text per-notification emails).
- Email subject template interpolation: verify variables filled for real events (demo metadata showed raw `{date}`/`{start_time}`).
- Single OneSignal app dev+prod isolation: rotate keys at 30-day mark.

## ADR-0104 Consolidation Remaining Work

Migrations still routing push directly via pg_net (not through engine `send_notification`):
- Swap triggers (`20260504100005/06`) — write outbox via DB trigger, OK pattern.
- `push_dispatch_triggers` (`20260418120000`) — shift updated / task assigned / deviation / join request. These 3 events still call `push-dispatch` directly from a trigger; migration to engine `send_notification` is deferred.
