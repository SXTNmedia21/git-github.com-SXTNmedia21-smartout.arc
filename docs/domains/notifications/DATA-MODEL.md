---
title: Notifications Domain — Data Model
status: done
updated: 2026-05-23
created: 2026-05-23
domain: notifications
mirror: verified
last_verified: 2026-05-23
tags: [notifications, data-model, migrations, schema, rls, telemetry]
---

# Notifications — Data Model

> Code wins. Every table and migration is verified against actual migration files.

## Tables

### `notification_preference`
**Anchor:** `00006_notification_engine.sql:8` (`CREATE TABLE public.notification_preference`)
- PK: `user_id uuid` → `user_identity(user_id)` — user-scoped, NOT workspace-scoped.
- Mode columns: `training_enabled bool DEFAULT true`, `work_enabled bool DEFAULT true`, `community_enabled bool DEFAULT true`.
- Channel columns: `push_enabled bool DEFAULT true`, `sms_enabled bool DEFAULT false`, `email_enabled bool DEFAULT true`, `browser_enabled bool DEFAULT false` (added `20260324220000`).
- Quiet hours: `quiet_hours_start time`, `quiet_hours_end time`, `quiet_hours_timezone text DEFAULT 'Europe/Oslo'`.
- `created_at`, `updated_at`.
- RLS: Users read/update/insert own row (user_id = auth.uid()). Added: `20260324220000_notification_table.sql`.

### `notification_outbox`
**Anchor:** `00006_notification_engine.sql:31` (`CREATE TABLE public.notification_outbox`)
- PK: `id bigserial`.
- `workspace_id uuid NOT NULL → workspace(workspace_id)`.
- `recipient_id uuid NOT NULL → profile(profile_id)`.
- `mode notification_mode NOT NULL` — enum: `training`, `work`, `community`.
- `priority smallint NOT NULL DEFAULT 0` — 0=normal, 1=high, 2=urgent/critical.
- `title text NOT NULL`, `body text NOT NULL`, `action_url text`, `metadata jsonb DEFAULT '{}'`.
- `allowed_channels notification_channel[] DEFAULT '{push, email}'` — enum: `push`, `sms`, `email`, `in_app` (in_app added `20260324220000`), `voice`.
- `status notification_status DEFAULT 'pending'` — enum: `pending`, `processing`, `delivered`, `failed`, `suppressed`.
- `error_log text`, `scheduled_for timestamptz DEFAULT now()`, `processed_at timestamptz`, `created_at timestamptz NOT NULL`.
- Added `20260427200000`: `retry_count smallint NOT NULL DEFAULT 0`, `updated_at timestamptz NOT NULL DEFAULT now()`.
- Index: `idx_outbox_pending ON (status, scheduled_for) WHERE status='pending'`.
- RLS: `No direct user access to outbox` FOR ALL USING (false) — service_role bypasses. `20260427200000`.
- Trigger: `trg_outbox_auto_dispatch` AFTER INSERT → calls `process-notifications` via pg_net. `20260328225650`.

### `notification`
**Anchor:** `20260324220000_notification_table.sql:19` (`CREATE TABLE notification`)
- PK: `id uuid DEFAULT gen_random_uuid()`.
- `workspace_id uuid NOT NULL → workspace(workspace_id)`.
- `recipient_id uuid NOT NULL → profile(profile_id)`.
- `group_key text` (grouping within 3-min window).
- `title text NOT NULL`, `body text`, `action_url text`.
- `icon_type text NOT NULL DEFAULT 'info'`.
- `is_read boolean NOT NULL DEFAULT false`, `read_at timestamptz`.
- `metadata jsonb`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
- Indexes: `idx_notification_recipient_unread ON (recipient_id, created_at DESC) WHERE is_read=false`, `idx_notification_group ON (recipient_id, group_key, created_at DESC) WHERE group_key IS NOT NULL`.
- RLS: users read own via `recipient_id IN (SELECT profile_id FROM profile WHERE workspace_id IN (get_workspace_ids_for_user(auth.uid())))`.
- Realtime: published via `supabase_realtime` publication.

### `notification_policy`
**Anchor:** `20260415120500_notification_policy_tables.sql` (`CREATE TABLE notification_policy`)
- PK: `notification_policy_id uuid`.
- `workspace_id uuid NOT NULL → workspace(workspace_id) ON DELETE CASCADE`.
- `domain text NOT NULL` (e.g. "shift", "contract", "guardian").
- `risk_level text`, `tier_ladder jsonb NOT NULL`, `quiet_hours jsonb`, `rate_limit_per_day int NOT NULL DEFAULT 3`, `locale_overrides jsonb`, `is_active bool NOT NULL DEFAULT true`.
- UNIQUE: `(workspace_id, domain)`.
- RLS: admin JWT (`is_admin_in_workspace`) + service_role. Comment: "Domain-scoped notification escalation ladders. See ADR-0104."
- **Status:** schema exists; escalation ladder NOT wired into process-notifications. See GAPS §G5.

### `notification_sent_log`
**Anchor:** `20260415120500_notification_policy_tables.sql` (`CREATE TABLE notification_sent_log`)
- PK: `notification_sent_log_id uuid`.
- `workspace_id uuid NOT NULL`, `notification_policy_id uuid → notification_policy`, `subject_profile_id uuid NOT NULL → profile`, `related_entity_type text NOT NULL`, `related_entity_id uuid NOT NULL`, `tier text NOT NULL`, `sent_at timestamptz NOT NULL`, `channel text NOT NULL`, `opened_at timestamptz`, `converted_at timestamptz`.
- RLS: own rows OR admin + service_role.
- **Status:** schema exists; not yet populated by process-notifications. See GAPS §G5.

### `profile.active_push_topic` (column)
**Anchor:** `20260620142000_profile_active_push_topic.sql` (`ALTER TABLE public.profile ADD COLUMN active_push_topic text NULL`)
- Added to `profile` table (not a standalone table).
- Format: `dept:<department_id>` or `shift:<shift_session_id>`. NULL = not subscribed.
- Set at clock-in, cleared at clock-out by the mobile client.
- Index: `profile_active_push_topic_idx ON profile(active_push_topic) WHERE active_push_topic IS NOT NULL`.
- Notification domain READS this column for day-line push routing. Day-session / scheduling writes it.

## Enums

| Enum | Values | Defined |
|------|--------|---------|
| `notification_mode` | `training`, `work`, `community` | `00006_notification_engine.sql:1` |
| `notification_channel` | `push`, `sms`, `email`, `voice` (base); `in_app` added `20260324220000` | `00006_notification_engine.sql:2` |
| `notification_status` | `pending`, `processing`, `delivered`, `failed`, `suppressed` | `00006_notification_engine.sql:3` |

## Key Functions / RPCs

| Function | Migration | Purpose |
|----------|-----------|---------|
| `fetch_pending_outbox(p_batch_size int)` | `20260427200000` | SECURITY DEFINER; atomic row-lock (FOR UPDATE SKIP LOCKED); staleness recovery; returns SETOF notification_outbox |
| `dispatch_outbox_notification()` | `20260328225650` | SECURITY DEFINER trigger function; calls process-notifications via pg_net on INSERT |
| `fn_publish_announcement_notifications()` | `20260620140300` | Inserts outbox rows for announcement events |

## Telemetry Events (notification domain)

Registry: `packages/telemetry/src/registry.ts`. Notification-domain events:
- `"notification deep_link_followed"` — user taps a push notification deep link. Line ~5551 (anchor: `event: "notification deep_link_followed"`).
- `"notification.marked_read"` — single notification marked read. Line ~5565.
- `"notification.marked_all_read"` — bulk mark-all-read action. Line ~5572.
- `"notification_policy"` — policy registration event. Line ~146.

No `push.*` telemetry events registered (push outcome is logged in process-notifications stdout, not in telemetry registry).

## 27 Migrations by Phase

### Phase 0 — Foundation
| Migration | Purpose |
|-----------|---------|
| `00006_notification_engine.sql` | `notification_preference`, `notification_outbox`, enums, `idx_outbox_pending`, baseline RLS |
| `20260324220000_notification_table.sql` | `notification` table, Realtime, `in_app` enum value, `browser_enabled` pref column, notification_preference RLS |

### Phase 1 — Outbox Hardening
| Migration | Purpose |
|-----------|---------|
| `20260324230000_refactor_push_triggers.sql` | Refactor 6 original push triggers → outbox INSERT |
| `20260324065817_fix_push_triggers_profile_id.sql` | Fix profile_id on push triggers |
| `20260328225650_notification_outbox_auto_dispatch.sql` | `trg_outbox_auto_dispatch` pg_net trigger on every INSERT |
| `20260427200000_notification_outbox_reliability.sql` | `retry_count`, `updated_at`, deny-all RLS, `fetch_pending_outbox` RPC |

### Phase 2 — Policy Layer
| Migration | Purpose |
|-----------|---------|
| `20260415120500_notification_policy_tables.sql` | `notification_policy` + `notification_sent_log` (ADR-0104 Phase 0) |

### Phase 3 — Push Triggers
| Migration | Purpose |
|-----------|---------|
| `20260418120000_push_dispatch_triggers.sql` | Push triggers: shift published/updated, task assigned, deviation, join request |
| `20260516090000_fix_push_dispatch_profile_pk.sql` | Fix push_dispatch profile PK lookup |
| `20260516150000_push_dispatch_clockout_link.sql` | Add clockout deep link to push notifications |

### Phase 4 — Guardian
| Migration | Purpose |
|-----------|---------|
| `20260406150100_guardian_signal_push_trigger.sql` | Guardian signal → push via outbox |
| `20260422120001_guardian_log_pg_notify.sql` | Guardian log → pg_notify channel |

### Phase 5 — Channel Triggers (Communication)
| Migration | Purpose |
|-----------|---------|
| `20260422310100_channel_message_notification_trigger.sql` | Channel message → notification outbox |
| `20260422310200_missed_call_notification_trigger.sql` | Missed call → notification outbox |
| `20260422310300_incoming_call_notification_trigger.sql` | Incoming call → notification outbox |

### Phase 6 — Swap Notifications (Scheduling edge)
| Migration | Purpose |
|-----------|---------|
| `20260504100005_swap_notification_triggers.sql` | Swap created/approved/rejected → outbox |
| `20260504100006_fix_swap_notification_trigger.sql` | Fix for swap approval branch |
| `20260417140000_fix_swap_notification_approval_branch.sql` | Additional swap approval fix |

### Phase 7 — Contract Notifications (Contracts edge)
| Migration | Purpose |
|-----------|---------|
| `20260414072300_contract_event_notify_trigger.sql` | Contract lifecycle → notification outbox |
| `20260414072301_seed_contract_notification_templates.sql` | Seed `message_template` rows for contract emails |

### Phase 8 — Engine Consolidation (ADR-0104)
| Migration | Purpose |
|-----------|---------|
| `20260507100300_migrate_push_to_engine_notify.sql` | Shift published trigger → engine `send_notification` step (replaces direct pg_net) |

### Phase 9 — Announcements
| Migration | Purpose |
|-----------|---------|
| `20260528020000_announcement_notification_priority.sql` | Announcement notification priority routing |
| `20260620140300_fn_publish_announcement_notifications.sql` | Function to insert outbox rows for announcements |
| `20260620140500_channel_message_trigger_announcement_guard.sql` | Guard channel_message trigger for announcements |
| `20260620140600_get_channel_messages_announcement_columns.sql` | Announcement columns on channel_message view |

### Phase 10 — Push Topic + Payroll Edge
| Migration | Purpose |
|-----------|---------|
| `20260620142000_profile_active_push_topic.sql` | `profile.active_push_topic` column + index (ADR-0367 §M4) |
| `20260617100000_payroll_period_locked_notifier_process.sql` | Engine process blueprint for period-locked notifications (payroll edge) |

### Pending (feat/onesignal-push wt-5 — L-0042 timestamp fix needed before merge)
| Migration | Purpose |
|-----------|---------|
| `20260621210000_task_due_reminder_cron.sql` | task.due_soon + task.overdue cron (15 min) — timestamp < base tip; must be re-timestamped |
