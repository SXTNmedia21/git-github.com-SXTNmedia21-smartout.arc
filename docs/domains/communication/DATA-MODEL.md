---
title: "Communication Domain — Data Model"
status: done
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: communication
tags: [domain, communication, data-model, schema, RLS, enums]
---

# Communication Domain — Data Model

> All tables, enums, and RLS verified against actual migrations. Primary anchor: `supabase/migrations/20260422300000_channel_communications.sql`. Code wins.

---

## Enums (16 + later additions, all in `public` schema)

Verified against `20260422300000_channel_communications.sql`:

| Enum | Values | Added by |
|---|---|---|
| `comm_channel_type` | `department`, `team`, `session`, `custom`, `direct`, `news`, `skill` | 20260422300000 |
| + `desk` | (deprecated — ADR-0165; use `helpdesk_enabled` flag) | 20260515130000 |
| + `ai` | (Botsson direct channels) | 20260519095959 |
| `channel_message_type` | `text`, `image`, `file`, `voice_clip`, `system`, `brief`, `handoff`, `announcement`, `reminder`, `summary` | 20260422300000 |
| `channel_origin_type` | `human`, `ai`, `system`, `webhook`, `scheduler`, `workflow` | 20260422300000 |
| `channel_delivery_mode` | `timeline`, `silent`, `notification_only` | 20260422300000 |
| `channel_message_visibility` | `all_members`, `admins`, `targeted_members` | 20260422300000 |
| `channel_audio_policy` | `disabled`, `ptt`, `open_mic`, `listen_only` | 20260422300000 |
| `channel_video_policy` | `disabled`, `optional`, `default_on`, `required` | 20260422300000 |
| `channel_recording_policy` | `off`, `optional`, `auto` | 20260422300000 |
| `channel_ai_voice_policy` | `disabled`, `listen_only`, `interactive` | 20260422300000 |
| `channel_member_role` | `member`, `admin` | 20260422300000 |
| + `representative` | (helpdesk representative role) | 20260515130000 |
| `channel_call_status` | `active`, `ending`, `ended` | 20260422300000 |
| `channel_presence_status` | `online`, `away`, `offline` | 20260422300000 |
| `channel_integration_status` | `active`, `paused`, `error` | 20260422300000 |
| `channel_ai_text_mode` | `disabled`, `mention_only`, `proactive` | 20260422300000 |
| `channel_ai_voice_mode` | `disabled`, `listen_only`, `interactive` | 20260422300000 |
| `channel_notification_priority` | `critical`, `high`, `normal`, `low` | 20260422300000 |
| `channel_call_type` | `direct`, `group`, `ptt` | 20260422301000 |

---

## Core tables

### `channel`
Source of truth: `20260422300000_channel_communications.sql` (CREATE TABLE at `IF NOT EXISTS (SELECT 1... 'channel')`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `workspace_id` | uuid FK → workspace | RLS anchor |
| `channel_type` | comm_channel_type | department/team/session/custom/direct/news/skill/ai/desk(deprecated) |
| `name` | text | nullable for direct channels |
| `description` | text | |
| `avatar_url` | text | |
| `created_by` | uuid FK → profile | null = system-created |
| `department_id` | uuid FK → department | department channels only |
| `team_id` | uuid FK → team | team channels only |
| `session_id` | uuid FK → department_session | session channels only |
| `direct_pair_hash` | text | deterministic hash for DM uniqueness |
| `is_read_only` | boolean | default false |
| `is_archived` | boolean | default false |
| `read_receipts_enabled` | boolean | default false |
| `audio_policy` | channel_audio_policy | default `disabled` |
| `video_policy` | channel_video_policy | default `disabled` |
| `recording_policy` | channel_recording_policy | default `off` |
| `ai_voice_policy` | channel_ai_voice_policy | default `disabled` |
| `allow_user_override` | boolean | default true |
| `helpdesk_enabled` | boolean | **truth source for helpdesk** (ADR-0165); added `20260515140000` |
| `responsible_profile_id` | uuid FK → profile | nullable; required when helpdesk_enabled |
| `created_at`, `updated_at` | timestamptz | set_updated_at trigger |

**Unique indexes:**
- `idx_channel_direct_pair` ON `(workspace_id, direct_pair_hash)` WHERE `direct_pair_hash IS NOT NULL`
- `idx_channel_one_per_department` ON `(department_id)` WHERE `department_id IS NOT NULL AND is_archived = false`
- `idx_channel_one_per_team` ON `(team_id)` WHERE `team_id IS NOT NULL AND is_archived = false`
- `idx_channel_one_per_session` ON `(session_id)` WHERE `session_id IS NOT NULL AND is_archived = false`

**RLS** (`20260422300100_channel_rls_policies.sql`):
- SELECT: `id IN (SELECT channel_id FROM channel_member WHERE profile_id = current_profile AND left_at IS NULL)`
- INSERT: `channel_type IN ('custom', 'direct') AND workspace_id IN get_workspace_ids_for_user()`
- UPDATE: channel admin only (`role = 'admin' AND left_at IS NULL`)
- API key: `workspace_id = get_api_workspace_id()`

---

### `channel_member`
Anchor: `20260422300000_channel_communications.sql` — table `channel_member`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `channel_id` | uuid FK → channel ON DELETE CASCADE | |
| `workspace_id` | uuid FK → workspace | denormalized for RLS + Realtime |
| `profile_id` | uuid FK → profile ON DELETE RESTRICT | |
| `role` | channel_member_role | `member`/`admin`/`representative` |
| `is_ai` | boolean | default false — Botsson profile flag |
| `last_read_message_id` | uuid FK → channel_message | null; validated same-channel by trigger |
| `is_muted` | boolean | |
| `muted_until` | timestamptz | |
| `joined_at` | timestamptz | |
| `left_at` | timestamptz | null = active member |

UNIQUE: `(channel_id, profile_id)`
Integrity trigger: `trg_validate_last_read` — `last_read_message_id` must be in same channel.

---

### `channel_message`
Anchor: `20260422300000_channel_communications.sql` — table `channel_message`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `channel_id` | uuid FK → channel ON DELETE CASCADE | |
| `workspace_id` | uuid FK → workspace | |
| `sender_id` | uuid FK → profile ON DELETE RESTRICT | |
| `content` | text NOT NULL | |
| `message_type` | channel_message_type | default `text` |
| `origin_type` | channel_origin_type | default `human` |
| `origin_id` | text | optional source identifier |
| `delivery_mode` | channel_delivery_mode | default `timeline` |
| `visibility_scope` | channel_message_visibility | default `all_members` |
| `target_profile_ids` | uuid[] | populated when visibility_scope = `targeted_members` |
| `event_id` | uuid FK → channel_event ON DELETE SET NULL | link to originating event |
| `reply_to_id` | uuid FK → channel_message ON DELETE SET NULL | thread reply |
| `system_data` | jsonb | structured payload for briefs/handoffs/announcements |
| `is_pinned` | boolean | |
| `pinned_by` | uuid FK → profile | |
| `pinned_at` | timestamptz | |
| `edited_at` | timestamptz | |
| `deleted_at` | timestamptz | soft delete |
| `client_message_id` | uuid | client-side dedup key |
| `created_at`, `updated_at` | timestamptz | |

Unique: `(channel_id, client_message_id)` WHERE `client_message_id IS NOT NULL`
Index: `(channel_id, created_at DESC)` for pagination hot-path.

---

## Supporting tables

### `channel_event`
Immutable projection of `engine_event` for Komm-scoped timeline rendering (ADR-0160).
**Current state: zero writers** — projection trigger not built (gap G2).

| Column | Notes |
|---|---|
| `event_type` | classifier string |
| `source` | origin system identifier |
| `payload` | jsonb |
| `correlation_id`, `causation_id` | event chain tracing |
| `idempotency_key` | unique guard |
| No `updated_at` | immutable |

Unique index: `idx_channel_event_idempotency ON (idempotency_key)` WHERE `idempotency_key IS NOT NULL`.

### `channel_message_reaction`
Emoji reactions. UNIQUE `(message_id, profile_id, emoji)`. Denormalized `channel_id` for Realtime filter.

### `channel_message_attachment`
File/image/voice attachments. Includes `file_type`, `url`, `filename`, `size_bytes`, `mime_type`, `duration_seconds`.

### `channel_message_read`
Per-message read receipts (only when `channel.read_receipts_enabled = true`). UNIQUE `(message_id, profile_id)`.

---

## Policy tables

### `channel_ai_policy`
Per-channel AI behavior (ADR-0087 §4). UNIQUE `(channel_id)`.

| Column | Notes |
|---|---|
| `text_participation` | channel_ai_text_mode (`disabled`/`mention_only`/`proactive`) |
| `voice_participation` | channel_ai_voice_mode |
| `auto_summarize` | boolean |
| `auto_shift_prep` | boolean |
| `auto_reminders` | boolean |
| `personality_override` | jsonb |

**Current state:** Schema + seeds exist. Agent-router does NOT read this table. L-0086: "half-wired". See GAPS §G3.

### `channel_notification_policy`
Per-channel notification routing rules. UNIQUE `(channel_id, event_type)`.

### `channel_retention_policy`
Lifecycle rules per channel. UNIQUE `(channel_id)`. Fields: `auto_archive_on_close`, `archive_grace_period_hours`, `generate_summary_on_close`, `retain_media_days`, `retain_messages_days`, `searchable_after_archive`.

### `channel_integration`
External service webhooks. `endpoint_secret_vault_id` (1Password reference, not inline secret).

---

## Voice tables

Source: `20260422301000_channel_voice.sql`

### `channel_presence`
Coarse presence snapshot. NOT authoritative (Supabase Realtime Presence is). Per ADR-0334: ephemeral typing/delivered-ack via broadcast; this table reserved for durable status.
UNIQUE `(channel_id, profile_id)`.

### `channel_call_session`
Active call. `livekit_room_name`, `status` (active/ending/ended), per-channel policies.

### `channel_call_participant`
Per-participant state. `mic_enabled`, `speaking_seconds`, `device_type`.
Unique active index: `(call_session_id, profile_id) WHERE left_at IS NULL`.

### `call_log`
Immutable historical record created on call end.

---

## Targeted note tables (day-session boundary)

`session_note` is owned by the **day-session domain** (lives on `department_session`), but communication domain wires the fanout via the `session_note.audience JSONB` + `notify_at` pattern (ADR-0331/ADR-0332).

Additions to `session_note` (`20260616100501_session_note_targeted_fanout.sql`):
- `audience JSONB` — `{dept_ids, team_ids, shift_ids, profile_ids}`
- `notify_at TIMESTAMPTZ` — when to fire fanout
- `delivered_at TIMESTAMPTZ` — idempotency guard
- `deleted_at TIMESTAMPTZ` — soft delete
- `session_note_type += 'targeted'` enum value
- CHECK: `session_note_audience_when_targeted_chk` — must have audience when notify_at set

---

## Telemetry events

Authority seed at `20260601100000_seed_communication_authority.sql`. Events emitted by `packages/ai/src/capabilities/communication/emit-announcement-events.ts`:

| Event key | Trigger |
|---|---|
| `channel.message.sent` | `send_message` tool success |
| `channel.announcement.published` | `publish_announcement` success |

Communication capability's `emitPrefix: "channel"` (`packages/ai/src/capabilities/communication/index.ts` — `emitPrefix`).
