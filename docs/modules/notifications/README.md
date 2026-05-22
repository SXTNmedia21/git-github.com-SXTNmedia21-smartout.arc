---
title: Notifications Module — Folder Index
status: in_progress
updated: 2026-05-22
created: 2026-05-22
module: notifications
tags: [module, notifications, push, email, sms, in-app, onesignal, preferences]
---

# Notifications Module — Folder Index

> Source of truth for Smartout's notification system. If code contradicts this folder → CODE wins, update these docs.

## Service Status

**All 4 channels operational as of branch `feat/onesignal-push` (ADR-0389).**

| Channel | Provider | Status |
|---------|----------|--------|
| in_app  | `notification` table + Realtime bell | ✅ shipped |
| email   | SendGrid (`process-notifications`) | ✅ shipped |
| sms     | Twilio (`process-notifications`) | ✅ shipped (priority=2 events only) |
| push    | OneSignal REST API (`push-dispatch`) | ✅ live (was Expo — dead in PWA) |

## Reading Order

| # | File | Purpose |
|---|------|---------|
| 1 | [MODULE_NOTIFICATIONS.md](./MODULE_NOTIFICATIONS.md) | Main module doc: overview, cascade role, channels, event taxonomy, preferences, AI integration |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | The unified funnel — funnel stages, Edge Functions, OneSignal leg, deep links, cron/grouping/quiet hours |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | Every table, columns, enums, indexes, RLS policies |
| 4 | [API.md](./API.md) | All send paths, Edge Functions, package helpers, mobile client exports |
| 5 | [CONTRACTS.md](./CONTRACTS.md) | Machine-checkable payloads: outbox row, PushRequest, OneSignal REST body, preference semantics, deep-link table |
| 6 | [USER-FLOWS.md](./USER-FLOWS.md) | Employee / manager / admin journeys + the 3 OneSignal journeys |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | Test coverage status |
| 8 | [BLUEPRINT.md](./BLUEPRINT.md) | Phased target (P1–P4): what ships when and why |
| 9 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | Open work, known bugs, deviations |

## Code Locations at a Glance

| Layer | Path |
|-------|------|
| Outbox insert helper | `packages/notifications/src/outbox.ts` |
| 40-event registry | `packages/notifications/src/event-config.ts` |
| Preferences hook | `packages/notifications/src/hooks/use-notification-preferences.ts` |
| Cron fan-out EF | `supabase/functions/process-notifications/index.ts` |
| Push sender EF | `supabase/functions/push-dispatch/index.ts` |
| OneSignal REST helper | `supabase/functions/_shared/onesignal.ts` |
| Mobile OneSignal client | `apps/mobile/src/lib/onesignal.ts` |
| Deep-link mapper | `apps/mobile/src/lib/deep-link.ts` |
| Deep-link catch-all route | `apps/mobile/app/dashboard/[...rest].tsx` |
| Push token / shift-session | `apps/mobile/src/lib/push.ts` |
| Schema migrations | `supabase/migrations/00006_notification_engine.sql`, `20260324220000_notification_table.sql` |

## ADRs

- **ADR-0389** — OneSignal as the push channel (Expo path retired). `docs/decisions/0389-onesignal-push-channel.md`
- **ADR-0390** — (planned) Notification preference matrix + AI notify capability. Written in P2/P3.

## Sibling Modules

- [MODULE_COMMUNICATION](../MODULE_COMMUNICATION.md) — channel infrastructure that the notification module delivers into
- [announcments/MODULE_ANNOUNCEMENTS](../announcments/MODULE_ANNOUNCEMENTS.md) — announcement writes notification_outbox with `priority=1, mode='work'`
- [MODULE_BOTSSON](../MODULE_BOTSSON.md) — planned AI notify capability (P3)
