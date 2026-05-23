---
title: Notifications Domain — Gaps and Debt
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: notifications
mirror: verified
last_verified: 2026-05-23
tags: [notifications, gaps, debt, deviations, overlap]
---

# Notifications — Gaps and Debt

> Built-vs-planned delta. Every gap cites code (file:line anchor) or ROADMAP phase. CODE WINS.

## Deviations (spec vs code)

### D1 — `process-notifications` dispatch pattern
**Spec:** 2026-03-24-notification-system-design.md described a pg_cron schedule as the sole dispatch mechanism.
**Code:** pg_cron `'30 seconds'` in prod; ALSO `trg_outbox_auto_dispatch` INSERT trigger via pg_net for local dev (no pg_cron locally). Anchor: `20260328225650_notification_outbox_auto_dispatch.sql`.
**Resolution:** Code wins — dual dispatch is correct and intentional. ARCHITECTURE documented accordingly.

### D2 — Operational push senders bypass outbox (D2 pattern)
**Spec:** 2026-05-21-notification-system-design.md Design Decision D2 explicitly allows two operational senders to bypass outbox. But this was positioned as "deferred to P1-followup."
**Code:** Both are still on Expo (dead in PWA):
- `engine-dispatch/handlers/day-line-push.ts` — Expo path, not migrated to OneSignal yet.
- `apps/web/src/app/[slug]/platform-admin/communications/push/send/route.ts` — broadcast Expo path.
**Status:** Gap (P1 follow-up, not a design mistake). See ROADMAP §P1 Follow-up.

### D3 — `notification_sent_log` / `notification_policy` not wired
**Spec:** ADR-0104 Phase 0 created `notification_policy` + `notification_sent_log` for domain escalation ladders and rate-limiting.
**Code:** Tables exist (`20260415120500`) but `process-notifications` does NOT insert into `notification_sent_log` and does NOT read `notification_policy` escalation ladders. Rate-limiting logic is absent.
**Code anchor:** `process-notifications/index.ts` — no reference to `notification_policy` or `notification_sent_log`.
**Status:** Gap G5 (P2 scope). Tables are schema-only today.

### D4 — `morning-digest` ignores user preferences
**Spec:** morning digest should respect `email_enabled` preference.
**Code:** `supabase/functions/send-morning-digest/index.ts` sends regardless of `email_enabled`. No preference check.
**Status:** Known bug. P4 fix.

### D5 — `grouping_window_sec` config value ignored
**Spec:** Each event in the registry carries a `grouping_window_sec` value.
**Code:** `process-notifications:resolveGrouping` uses a hardcoded 3-minute window (`Date.now() - 3 * 60 * 1000`). The per-event `grouping_window_sec` from the registry is not read. Anchor: `process-notifications/index.ts`, function `resolveGrouping`.
**Status:** Known bug. P4 fix.

### D6 — Two parallel deep-link mappers
**Spec:** one source of truth for web-path → mobile-route mapping.
**Code:** Two exist:
- `apps/mobile/src/lib/deep-link.ts` — new, used by OneSignal web catch-all.
- `packages/notifications/src/deep-links.ts` — older, used by native `apps/mobile/src/lib/push.ts`.
**Status:** P4 consolidation. Unify into `packages/notifications/src/deep-links.ts`.

### D7 — feat/onesignal-push migration timestamp (L-0042 class)
**Spec:** All migrations must have timestamps > base tip.
**Code:** `supabase/migrations/20260621210000_task_due_reminder_cron.sql` on `feat/onesignal-push` wt-5 has timestamp `20260621210000` < base tip `20260622110000`. migration-lint rejects.
**Fix required before merge:** rename migration file to a timestamp > `20260622110000`.
**Status:** Blocker for feat/onesignal-push → development merge. Do NOT touch wt-5 from this domain sortie.

## Gaps

### G1 — No mobile preferences UI
**Description:** `useNotificationPreferences` hook exists in `packages/notifications/src/hooks/`, but there is no settings screen in `apps/mobile` to surface it. Web dashboard has preference UI; mobile is missing.
**ROADMAP:** P4.

### G2 — AI cannot send notifications
**Description:** `set_reminder` (personal capability) wires engine state but the handler that writes to `notification_outbox` is absent. No `notify` capability tool exists.
**Code evidence:** `packages/ai/src/capabilities/personal/` — no `notify` or `set_reminder` → outbox handler.
**ROADMAP:** P3.

### G3 — iPhone device test pending
**Description:** No real push subscriber yet. Requires deploy to `mobile.smartout.ai` + iOS 16.4+ home-screen install. The 3 OneSignal journeys have `status: verified` in code but depend on this gate for full confirmation.
**Status:** Operator action (Pontus) — add redirect whitelist + `EXPO_PUBLIC_ONESIGNAL_APP_ID` on Vercel mobile project, verify `OneSignalSDKWorker.js` serves as JS not SPA HTML.

### G4 — No notification policy admin UI
**Description:** `notification_policy` table exists for workspace-level domain escalation ladders but there is no web UI to manage these policies. Admin must interact via DB or API.
**ROADMAP:** P2.

### G5 — `notification_sent_log` never written
**Description:** The table exists (Phase 2 schema), but nothing inserts into it. Rate-limiting per `notification_policy.rate_limit_per_day` is dead code.
**ROADMAP:** P2.

### G6 — `guardian-notify` not routed through outbox
**Description:** `guardian-notify` sends email directly via SendGrid, bypassing `notification_outbox`, `notification_preference`, and quiet hours. This is intentional for critical signals but means guardian alerts are invisible in the notification center.
**ROADMAP:** Evaluate in P2 — guardian critical alerts may intentionally bypass quiet hours.

### G7 — Single OneSignal app dev+prod
**Description:** Dev and prod share the same OneSignal app. Isolation planned at first key rotation (~30 days post-launch).
**Status:** Accepted debt. No work needed until key rotation milestone.

## Overlap Edges

### O1 — communication: `channel_notification_policy`
**Shared surface:** communication domain owns `channel_notification_policy` (per-channel quiet hours + delivery rules). Notifications domain reads it to apply routing rules.
**Classification:** keep — clear author/consumer boundary. Communication owns schema + writes; notifications reads at dispatch time. Seam: `process-notifications` reads `channel_notification_policy` for channel-level override (when wired — currently not implemented; see G5).
**Status:** resolved (keep). Documented in communication `_DASHBOARD.md` as "notifications-future" edge.

### O2 — scheduling: swap notification triggers
**Shared surface:** `20260504100005/06_swap_notification_triggers` + `20260417140000_fix_swap_notification_approval_branch` write to `notification_outbox`.
**Classification:** keep — scheduling AUTHORS the trigger (swap created/approved/rejected); notifications DISPATCHES. No dual ownership.
**Status:** resolved (keep). Scheduling domain `DATA-MODEL.md:196/224/225` references these migrations.

### O3 — contracts: `contract_event_notify_trigger`
**Shared surface:** `20260414072300_contract_event_notify_trigger.sql` fires on contract lifecycle events → writes `notification_outbox`. `20260414072301_seed_contract_notification_templates.sql` inserts `message_template` rows.
**Classification:** keep — contracts AUTHORS the trigger; notifications DISPATCHES. `message_template` is a contracts-owned table that notifications reads for email body.
**Status:** resolved (keep). Contracts domain `DATA-MODEL.md:163` references these migrations.

### O4 — day-session: day-line push + period-locked
**Shared surface:** Day-line push (`engine-dispatch/handlers/day-line-push.ts`) is authored by day-session; period-locked notifier process (`20260617100000`) is authored by payroll. Both dispatch through notifications infrastructure.
**Classification:** keep — day-session/payroll author the trigger logic; notifications provides the delivery pipe.
**Status:** resolved (keep).

### O5 — payroll: period-locked notifier process
**Shared surface:** `20260617100000_payroll_period_locked_notifier_process.sql` registers an `engine_process` blueprint for period-locked notifications.
**Classification:** keep — payroll owns the process blueprint; notifications owns the dispatch infrastructure.
**Status:** resolved (keep). Payroll domain `ARCHITECTURE.md:99` references this.

### O6 — botsson: guardian-notify EF + `guardian_signal_push_trigger`
**Shared surface:** `guardian-notify` EF notifies workspace admins of critical guardian signals. `guardian_signal_push_trigger` (`20260406150100`) routes guardian signals to push.
**Classification:** keep — botsson owns guardian signal logic + soul; notifications-domain owns the notify EF and the outbox dispatch. Seam: guardian signal → push trigger → outbox (or direct email in guardian-notify).
**Status:** resolved (keep).

### O7 — communication: announcements push
**Shared surface:** `fn_publish_announcement_notifications` (`20260620140300`) + `announcement_notification_priority` (`20260528020000`) push announcements through outbox at elevated priority.
**Classification:** keep — communication/announcements AUTHOR the priority routing; notifications DISPATCHES.
**Status:** resolved (keep).

## Learnings Applied

- **L-0197** (2026-03-27) — required-checks PR-only trigger blocks direct push. Pre-push gates on notification migrations must be run from PRs, not direct branch push.
- **L-0198** (2026-03-27) — push trigger on PR context exits 1. Related to L-0197; workflow exit code trap.
- **L-0261** (2026-03-27) — `bash || true` swallows pre-push hook. Pre-push scripts must not use `|| true` — masks hook failures silently.
- **OneSignal profile.phone trap** (2026-05-22, HANDOFF) — `profile` has NO `phone` column; phone is on `user_identity`. `process-notifications` originally queried `profile.phone` → NULL → email+SMS silently dead. Fixed: resolve via `user_identity.phone`. Anchor: `process-notifications/index.ts`, `deliverToChannels`.
- **user_identity PK is user_id not id** (2026-05-22, HANDOFF) — email lookup used `.eq("id", …)` → always failed. Fixed. Anchor: `process-notifications/index.ts`.
