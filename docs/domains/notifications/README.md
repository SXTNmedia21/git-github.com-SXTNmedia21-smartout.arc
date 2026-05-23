---
title: Notifications Domain — Entry
status: done
updated: 2026-05-23
created: 2026-05-23
domain: notifications
mirror: verified
last_verified: 2026-05-23
tags: [notifications, push, onesignal, outbox, email, sms, in-app, realtime]
---

# Notifications Domain

> Single-funnel delivery infrastructure. Every alert in Smartout — system event, AI-generated, or scheduled — flows through `notification_outbox` and fans out to in-app, email, SMS, or push. Code wins: if code contradicts this folder, update the doc.

**Build state: 🟡 partial** — 4-channel funnel live (P1 OneSignal shipped, merged 2026-05-22); P2 prefs matrix, P3 AI notify tool, P4 mobile prefs UI deferred.

## Build-state badge

| Channel | Provider | State |
|---------|----------|-------|
| in_app  | `notification` table + Supabase Realtime | ✅ live |
| email   | SendGrid REST + dev SMTP bridge | ✅ live |
| sms     | Twilio (priority=2 only) | ✅ live |
| push    | OneSignal REST (ADR-0394) | ✅ live (mobile PWA; web not subscribed) |

## Reading order

| # | File | mirror | Holds |
|---|------|--------|-------|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why, cascade placement, one-funnel model |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map: triggers → outbox → dispatcher → adapters → audit |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Every table, enum, index, RLS; 27 migrations by phase |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | Journey index (7 journeys) |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | P1–P4 forward plan, 3 ADR references |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Deviations, gaps, overlap edges, known debt |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test matrix — what is actually tested |

## Code locations (fast lookup)

| Surface | Path |
|---------|------|
| Outbox insert helper | `packages/notifications/src/outbox.ts` |
| 43-event registry | `packages/notifications/src/event-config.ts` |
| Prefs hook | `packages/notifications/src/hooks/use-notification-preferences.ts` |
| Outbox consumer EF | `supabase/functions/process-notifications/index.ts` |
| Push sender EF | `supabase/functions/push-dispatch/index.ts` |
| Guardian notify EF | `supabase/functions/guardian-notify/index.ts` |
| OneSignal REST helper | `supabase/functions/_shared/onesignal.ts` |
| Mobile OneSignal client | `apps/mobile/src/lib/onesignal.ts` |
| Deep-link mapper | `apps/mobile/src/lib/deep-link.ts` |
| Deep-link catch-all | `apps/mobile/app/dashboard/[...rest].tsx` |
| Web notifications page | `apps/web/src/app/dashboard/notifications/` |

## Agent Guardrails

**STOP before writing code that touches this domain:**

1. **Notifications = dispatcher. Communication = router-config-owner.** The `channel_notification_policy` table lives in the **communication** domain and defines per-channel quiet hours + delivery rules. Notifications reads and applies the policy. NEVER write to `channel_notification_policy` from notifications-domain code or migrations.

2. **OneSignal is the push channel (ADR-0394).** External ID = `profile_id`. No device token is stored in the DB. Client calls `OneSignal.login(profile_id)`. NEVER add a `push_token` column to `profile` — that was the retired Expo path.

3. **Outbox is the control surface.** Every notification that goes through the user-preference pipeline must insert into `notification_outbox`. Operational bypasses (`day-line-push`, broadcast) call `sendOneSignalPush()` directly per design decision D2 — do NOT add new bypasses without a spec + ADR.

4. **Engine-notify consolidation is in progress (ADR-0104).** DB triggers that call `push-dispatch` directly are being migrated to the engine-driven outbox path. Before adding a new DB trigger that calls an EF directly, check ADR-0104.

5. **SMS = priority=2 only** (process-notifications line 409). Do not route normal notifications to SMS.

6. **process-notifications is the only outbox consumer.** The trigger `trg_outbox_auto_dispatch` fires it on every INSERT for local dev (no pg_cron locally). In prod, pg_cron provides the '30 seconds' schedule. NEVER write a second consumer.

7. **Telemetry:** `notification.marked_read`, `notification.marked_all_read`, `notification deep_link_followed` are registered in `packages/telemetry/src/registry.ts`. Any new notification-domain mutation that the user initiates must emit.

8. **L-0042 warning:** `feat/onesignal-push` wt-5 has a staged migration timestamp bug (`20260621210000_task_due_reminder_cron.sql` < base tip `20260622110000`). Do NOT merge wt-5 until the migration is re-timestamped.

## ADRs

- **ADR-0022** — Original notification service architecture. `docs/decisions/0022-notification-service-architecture.md`
- **ADR-0104** — Notification consolidation roadmap (engine-notify migration). `docs/decisions/0104-notification-consolidation-roadmap.md`
- **ADR-0394** — OneSignal as push channel (Expo retired from outbox path). `docs/decisions/0394-onesignal-push-channel.md`
- **ADR-0186** — Guardian bus pg_notify. `docs/decisions/0186-guardian-bus-pg-notify.md`
- **ADR-0319** — notify_each_profile dispatcher action type. `docs/decisions/0319-notify-each-profile-dispatcher-action-type.md`

## Absorbed sources

- `docs/modules/notifications/MODULE_NOTIFICATIONS.md` → absorbed; `docs/modules/notifications/README.md` now `status: archived`.
- `docs/modules/notificatoins/` (typo folder) → deleted (was empty).
