---
title: Notifications — Data Model
status: in_progress
updated: 2026-05-22
created: 2026-05-22
module: notifications
tags: [data-model, notifications, schema, rls, tables, enums]
---

# Notifications — Data Model

> Ground truth from migrations. If types differ, regenerate `database.types.ts` — never edit manually.

## Enums

### `notification_mode`
**Migration:** `00006_notification_engine.sql:1`
```sql
CREATE TYPE notification_mode AS ENUM ('training', 'work', 'community');
```

### `notification_channel`
**Migration:** `00006_notification_engine.sql:2` + `20260324220000:7`
```sql
CREATE TYPE notification_channel AS ENUM ('push', 'sms', 'email', 'voice', 'in_app');
```
Note: `voice` exists in the enum but is not used in any event config's `allowed_channels`. `in_app` was added in the second migration.

### `notification_status`
**Migration:** `00006_notification_engine.sql:3`
```sql
CREATE TYPE notification_status AS ENUM ('pending', 'processing', 'delivered', 'failed', 'suppressed');
```

---

## Tables

### `notification_preference`

**Migration:** `00006_notification_engine.sql:6-27` + `20260324220000_notification_table.sql:10-25`
**Purpose:** Per-user cross-workspace delivery preferences.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `user_id` | `uuid` PRIMARY KEY | — | FK → `user_identity(user_id)` ON DELETE CASCADE. Cross-workspace: one row per auth user. |
| `training_enabled` | `boolean` | `true` | Mode gate: training notifications on/off |
| `work_enabled` | `boolean` | `true` | Mode gate: work notifications on/off |
| `community_enabled` | `boolean` | `true` | Mode gate: community notifications on/off |
| `push_enabled` | `boolean` | `true` | Channel gate: push (OneSignal) on/off |
| `sms_enabled` | `boolean` | `false` | Channel gate: sms (Twilio) on/off |
| `email_enabled` | `boolean` | `true` | Channel gate: email (SendGrid) on/off |
| `browser_enabled` | `boolean` | `false` | Added in migration 20260324220000. Present but NOT used in `deliverToChannels()` to gate in-app delivery — in_app is always-on. Reserved for future browser/web push distinction. |
| `quiet_hours_start` | `time` | NULL | DND window start (e.g. `22:00`) |
| `quiet_hours_end` | `time` | NULL | DND window end (e.g. `07:00`). Overnight ranges supported. |
| `quiet_hours_timezone` | `text` | `'Europe/Oslo'` | IANA timezone. Used to localize quiet hours check. |
| `created_at` | `timestamptz` | `now()` | NOT NULL |
| `updated_at` | `timestamptz` | `now()` | NOT NULL, updated by `set_notification_pref_updated_at` trigger |

**RLS Policies** (migration `20260324220000:14-25`):
- `"Users read own preferences"`: `FOR SELECT USING (user_id = auth.uid())`
- `"Users update own preferences"`: `FOR UPDATE USING/WITH CHECK (user_id = auth.uid())`
- `"Users insert own preferences"`: `FOR INSERT WITH CHECK (user_id = auth.uid())`

No API key policy — preference table is user-owned, not workspace-scoped (no `workspace_id`). API keys cannot read preferences.

---

### `notification_outbox`

**Migration:** `00006_notification_engine.sql:31-61`
**Purpose:** Transient queue. All notifications enter here; `process-notifications` fans them out and marks delivered.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | `bigserial` PRIMARY KEY | — | Intentionally not UUID — sequential for polling efficiency |
| `workspace_id` | `uuid` NOT NULL | — | FK → `workspace(workspace_id)`. Workspace-scoped. |
| `recipient_id` | `uuid` NOT NULL | — | FK → `profile(profile_id)`. The target profile. |
| `mode` | `notification_mode` NOT NULL | — | `work` / `training` / `community` |
| `priority` | `smallint` NOT NULL | `0` | 0=normal, 1=high, 2=urgent. Urgent bypasses quiet hours + triggers immediate dispatch. |
| `title` | `text` NOT NULL | — | Interpolated title text |
| `body` | `text` NOT NULL | — | Interpolated body text |
| `action_url` | `text` | NULL | Web-shaped path (e.g. `/dashboard/my-schedule?date=2026-05-22`). Used as OneSignal deep link base. |
| `metadata` | `jsonb` | `{}` | Carries `event_key`, `group_key`, `icon_type`, + producer-specific fields for template re-interpolation. |
| `allowed_channels` | `notification_channel[]` | `'{push, email}'` | Channels this notification may be delivered to. Intersected with user prefs at fan-out. |
| `status` | `notification_status` | `'pending'` | State machine: `pending → delivered | failed | suppressed` |
| `error_log` | `text` | NULL | Last error message on failure |
| `retry_count` | — | — | NOTE: column referenced in application code (`row.retry_count ?? 0`) but NOT in the original migration DDL. **GAP — verify presence in actual DB schema.** |
| `scheduled_for` | `timestamptz` | `now()` | When to deliver. Updated to next 07:00 for quiet-hour deferrals. |
| `processed_at` | `timestamptz` | NULL | Set on delivery. |
| `created_at` | `timestamptz` NOT NULL | `now()` | |

**Indexes:**
- `idx_outbox_pending` on `(status, scheduled_for) WHERE status = 'pending'` — powers the `fetch_pending_outbox` RPC

**RLS Policy** (migration `00006:63-67`):
```sql
CREATE POLICY "System manages outbox" ON notification_outbox
  FOR ALL WITH CHECK (TRUE);
```
Service-role only. No JWT user access to the outbox. Correct — users must not read or write this table directly.

---

### `notification`

**Migration:** `20260324220000_notification_table.sql:24-52`
**Purpose:** In-app notification inbox. Written by `process-notifications` (never by application code). Read via Realtime subscription and bell component.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | `uuid` PRIMARY KEY | `gen_random_uuid()` | |
| `workspace_id` | `uuid` NOT NULL | — | FK → `workspace(workspace_id)` |
| `recipient_id` | `uuid` NOT NULL | — | FK → `profile(profile_id)` |
| `group_key` | `text` | NULL | Groups related notifications (e.g. `chat:<channel_id>`, `shift:<dept>:<date>`). Used by `resolveGrouping()` to merge bursts within 3 minutes. |
| `title` | `text` NOT NULL | — | Resolved title |
| `body` | `text` | NULL | Resolved body. May be updated by `resolveGrouping()` to e.g. "3 nye varsler i Kjøkken". |
| `action_url` | `text` | NULL | Web-shaped path for navigation on tap |
| `icon_type` | `text` NOT NULL | `'info'` | One of: `shift`, `task`, `chat`, `deviation`, `training`, `approval`, `contract`, `info` |
| `is_read` | `boolean` NOT NULL | `false` | Toggled on open/tap. Used to filter unread count. |
| `read_at` | `timestamptz` | NULL | Set when `is_read` flips to true |
| `metadata` | `jsonb` | NULL | Copy of outbox metadata at delivery time |
| `created_at` | `timestamptz` NOT NULL | `now()` | |
| `updated_at` | `timestamptz` NOT NULL | `now()` | Updated by `set_notification_updated_at` trigger; also updated by `resolveGrouping()` |

**Indexes:**
- `idx_notification_recipient_unread` on `(recipient_id, created_at DESC) WHERE is_read = false`
- `idx_notification_group` on `(recipient_id, group_key, created_at DESC) WHERE group_key IS NOT NULL`

**RLS Policies:**
- `"Users read own notifications"`: `FOR SELECT USING (recipient_id IN (SELECT profile_id FROM profile WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))))`
- `"Users update own notifications"`: same pattern with `USING` + `WITH CHECK`
- `"api_key_read_notification"`: `FOR SELECT USING (workspace_id = get_api_workspace_id())`

**Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE notification` — web/mobile bell subscribes and receives real-time inserts.

---

## DB Triggers

| Trigger name | On table | When | Action |
|---|---|---|---|
| `set_notification_pref_updated_at` | `notification_preference` | BEFORE UPDATE | Calls `set_updated_at()` |
| `set_notification_updated_at` | `notification` | BEFORE UPDATE | Calls `set_updated_at()` |
| `trg_critical_notification_dispatch` | `notification_outbox` | AFTER INSERT WHERE priority=2 | Calls `dispatch_critical_notification()` → `net.http_post` to `process-notifications` EF |

---

## Functions (DB-level)

### `dispatch_critical_notification()`
**Migration:** `20260324220000:83-94`
SECURITY DEFINER. Called by the critical dispatch trigger. Posts to `process-notifications` using `app.supabase_url` + `app.process_notifications_secret` GUC settings.

---

## No Device Token Column

OneSignal targeting uses External ID = `profile_id`. There is no `onesignal_external_id`, `onesignal_token`, or `push_token` column on `profile` or any other table. The `expo_push_token` column on `profile` is the legacy Expo column — still present but the outbox push path no longer reads it (ADR-0394). `push.ts` (`registerPushToken`) still writes to it for native builds but OneSignal targeting is handled server-side by External ID.
