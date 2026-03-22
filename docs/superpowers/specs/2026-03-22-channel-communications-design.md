---
title: "Design — Channel Communications System"
status: draft
updated: 2026-03-22
created: 2026-03-22
module: communications
tags: [channels, chat, livekit, voice, video, walkie-talkie, mobile, ai, realtime]
---

# Design — Channel Communications System

> Operational communications fabric for Smartout. Persistent channels, real-time messaging,
> LiveKit voice/video with push-to-talk, AI as participant, system events, mobile-first.
> Replaces current `chat_conversation` system (Approach C: parallel build + sunset).

---

## 1. Architecture Overview

Three explicit subsystems rendered into one UX:

```
+---------------------------------------------------------------+
|                        UX Layer                                |
|   Web (Next.js)  |  Mobile (React Native + Expo)              |
+------------------+--------------------------------------------+
|                                                                |
|  +-----------------+  +------------------+  +--------------+   |
|  | 1. Channel      |  | 2. Realtime      |  | 3. Automation|   |
|  |    Messaging     |  |    Media          |  |    & Events  |   |
|  |                 |  |                  |  |              |   |
|  | channel         |  | channel_presence |  | channel_     |   |
|  | channel_member  |  | channel_call_    |  |  integration |   |
|  | channel_message |  |  session         |  | channel_     |   |
|  | channel_event   |  | channel_call_    |  |  notification|   |
|  | channel_message_|  |  participant     |  |  _policy     |   |
|  |  reaction       |  |                  |  | channel_     |   |
|  | channel_message_|  | LiveKit Cloud    |  |  ai_policy   |   |
|  |  attachment     |  | (SFU + Agents)   |  | channel_     |   |
|  | channel_message_|  |                  |  |  retention_  |   |
|  |  read           |  |                  |  |  policy      |   |
|  +-----------------+  +------------------+  +--------------+   |
|                                                                |
+---------------------------+------------------------------------+
                            |
              Supabase (PostgreSQL + Realtime + Storage)
              LiveKit Cloud (EU region)
              @smartout/telemetry (PostHog + activity_trail + engine_event)
```

### Design principles

1. **Channel-first** — departments, teams, sessions, skills are durable communication surfaces, not throwaway conversations
2. **Event-first** — business events are the source of truth; rendered messages are derived artifacts
3. **Mobile-first** — contracts are compact, offline-resilient, and lifecycle-aware
4. **AI as participant** — Botsson has identity, membership, permissions, and event provenance like any member
5. **Composable policies** — voice, video, recording, AI are independent axes, not enum presets

### AI System Profile

Botsson requires a `profile` row per workspace to act as a channel member and message sender.

- Created during workspace setup (onboarding finalization or seed)
- `profile.role = 'system'`, `profile.full_name = 'Mr. Botsson'`
- `profile.is_active = true`, `profile.user_id` = a dedicated service auth.users entry
- This profile is used as `sender_id` for all AI messages and as `profile_id` in `channel_member`
- Phase 1 migration must include a seed step to create this profile for existing workspaces

---

## 2. Channel Types

| Type         | Auto-created?              | Example                  | Members                              | Lifecycle                |
| ------------ | -------------------------- | ------------------------ | ------------------------------------ | ------------------------ |
| `department` | Yes, on dept creation      | #kjokken                 | All profiles in dept (derived)       | Permanent                |
| `team`       | Yes, on team creation      | #lunsj-kjokken           | All profiles in team (derived)       | Permanent                |
| `session`    | Yes, on session activation | #kjokken-22mar           | On-shift profiles                    | Archive on session close |
| `custom`     | Manager creates            | #leverandor, #sosialt    | Invited members                      | Until archived           |
| `direct`     | On demand                  | Anna <-> Erik            | 2 people                             | Permanent                |
| `news`       | Admin creates              | #nyheter, #oppdateringer | All workspace (read-only + comments) | Until archived           |
| `skill`      | Auto on 2+ assignees       | #barista-opplaering      | Profiles with assignment             | Until assignment removed |

### Auto-creation rules

- **Department/Team**: DB trigger on `profile` INSERT/UPDATE — when `department_id` or `team_id` changes, add/remove from corresponding channel
- **Session**: Trigger on `department_session.status` -> `active` creates channel, adds on-shift profiles. `closed` archives channel, generates summary
- **Skill**: Trigger on `protocol_assignment` INSERT — when 2+ profiles share an assignment, create skill channel
- **AI member**: Botsson auto-joins all department and session channels as a member with `is_ai = true`

---

## 3. Database Schema

### FK Convention

All foreign keys in this spec use the actual PK column names from the existing Smartout schema:

- `profile` PK = `profile_id` (NOT `id`)
- `workspace` PK = `workspace_id` (NOT `id`)
- `department` PK = `department_id`
- `team` PK = `team_id`
- `department_session` PK = `department_session_id`

All new tables in this spec use `id` as their own PK for consistency within the channel domain.

### Trigger Convention

Every table with an `updated_at` column gets a `set_updated_at()` trigger:

```sql
CREATE TRIGGER set_updated_at BEFORE UPDATE ON {table}
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Archive vs Delete Convention

- **Archive** (normal operation): `channel.is_archived = true`. Channel row and all child data remain. Hidden from active UX. Searchable per retention policy.
- **Hard delete** (rare, admin/service-only): Physical delete via retention purge job or explicit admin action. Child tables use `ON DELETE CASCADE` for referential integrity IF a hard delete occurs.
- No normal API route performs physical delete. `DELETE /api/channels/[id]` sets `is_archived = true`.
- `channel_message` self-reference (`reply_to_id`) uses `ON DELETE SET NULL`
- Reverse lookup (event -> message) via `channel_message.event_id` query, no cyclic FK
- Profile references use `ON DELETE RESTRICT` (never delete profiles with channel history)

---

### 3.1 Subsystem 1 — Channel Messaging Domain

#### Enums

```sql
-- Prefixed to avoid collision with existing 72+ enums
CREATE TYPE comm_channel_type AS ENUM (
  'department', 'team', 'session', 'custom', 'direct', 'news', 'skill'
);

CREATE TYPE channel_message_type AS ENUM (
  'text', 'image', 'file', 'voice_clip', 'system', 'brief',
  'handoff', 'announcement', 'reminder', 'summary'
);

CREATE TYPE channel_origin_type AS ENUM (
  'human', 'ai', 'system', 'webhook', 'scheduler', 'workflow'
);

CREATE TYPE channel_delivery_mode AS ENUM (
  'timeline', 'silent', 'notification_only'
);

CREATE TYPE channel_message_visibility AS ENUM (
  'all_members', 'admins', 'targeted_members'
);

-- Policy enums (used across channel and call tables)
CREATE TYPE channel_audio_policy AS ENUM (
  'disabled', 'ptt', 'open_mic', 'listen_only'
);

CREATE TYPE channel_video_policy AS ENUM (
  'disabled', 'optional', 'default_on', 'required'
);

CREATE TYPE channel_recording_policy AS ENUM (
  'off', 'optional', 'auto'
);

CREATE TYPE channel_ai_voice_policy AS ENUM (
  'disabled', 'listen_only', 'interactive'
);

CREATE TYPE channel_member_role AS ENUM ('member', 'admin');

CREATE TYPE channel_call_status AS ENUM ('active', 'ending', 'ended');

CREATE TYPE channel_presence_status AS ENUM ('online', 'away', 'offline');

CREATE TYPE channel_integration_status AS ENUM ('active', 'paused', 'error');

CREATE TYPE channel_ai_text_mode AS ENUM ('disabled', 'mention_only', 'proactive');

CREATE TYPE channel_ai_voice_mode AS ENUM ('disabled', 'listen_only', 'interactive');

CREATE TYPE channel_notification_priority AS ENUM ('critical', 'high', 'normal', 'low');
```

#### `channel`

| Column                  | Type                     | Constraint                                            | Notes                                    |
| ----------------------- | ------------------------ | ----------------------------------------------------- | ---------------------------------------- |
| `id`                    | uuid                     | PK, default gen_random_uuid()                         |                                          |
| `workspace_id`          | uuid                     | FK -> workspace(workspace_id), NOT NULL               | RLS isolation                            |
| `channel_type`          | comm_channel_type        | NOT NULL                                              |                                          |
| `name`                  | text                     | NULL for direct                                       | Display name                             |
| `description`           | text                     | NULL                                                  |                                          |
| `avatar_url`            | text                     | NULL                                                  |                                          |
| `created_by`            | uuid                     | FK -> profile(profile_id), NULL                       | NULL = system-created                    |
| `department_id`         | uuid                     | FK -> department(department_id), NULL                 | For department channels                  |
| `team_id`               | uuid                     | FK -> team(team_id), NULL                             | For team channels                        |
| `session_id`            | uuid                     | FK -> department_session(department_session_id), NULL | For session channels                     |
| `is_read_only`          | boolean                  | DEFAULT false                                         | News/announcement channels               |
| `is_archived`           | boolean                  | DEFAULT false                                         | Soft archive                             |
| `read_receipts_enabled` | boolean                  | DEFAULT false                                         | Enable per-message read tracking         |
| `audio_policy`          | channel_audio_policy     | DEFAULT 'disabled'                                    |                                          |
| `video_policy`          | channel_video_policy     | DEFAULT 'disabled'                                    |                                          |
| `recording_policy`      | channel_recording_policy | DEFAULT 'off'                                         |                                          |
| `ai_voice_policy`       | channel_ai_voice_policy  | DEFAULT 'disabled'                                    |                                          |
| `allow_user_override`   | boolean                  | DEFAULT true                                          | Can users override voice/video defaults? |
| `created_at`            | timestamptz              | DEFAULT now()                                         |                                          |
| `updated_at`            | timestamptz              | DEFAULT now()                                         | + set_updated_at trigger                 |

Indexes:

- `idx_channel_workspace` ON (workspace_id)
- `idx_channel_department` ON (department_id) WHERE department_id IS NOT NULL
- `idx_channel_team` ON (team_id) WHERE team_id IS NOT NULL
- `idx_channel_session` ON (session_id) WHERE session_id IS NOT NULL

#### `channel_member`

| Column                 | Type                | Constraint                                             | Notes                           |
| ---------------------- | ------------------- | ------------------------------------------------------ | ------------------------------- |
| `id`                   | uuid                | PK, default gen_random_uuid()                          |                                 |
| `channel_id`           | uuid                | FK -> channel(id) ON DELETE CASCADE, NOT NULL          |                                 |
| `workspace_id`         | uuid                | FK -> workspace(workspace_id), NOT NULL                | For API key RLS                 |
| `profile_id`           | uuid                | FK -> profile(profile_id) ON DELETE RESTRICT, NOT NULL |                                 |
| `role`                 | channel_member_role | DEFAULT 'member'                                       |                                 |
| `is_ai`                | boolean             | DEFAULT false                                          | TRUE for Botsson system profile |
| `last_read_message_id` | uuid                | FK -> channel_message(id) ON DELETE SET NULL, NULL     | Primary unread pointer          |
| `is_muted`             | boolean             | DEFAULT false                                          |                                 |
| `muted_until`          | timestamptz         | NULL                                                   | Temporary mute                  |
| `joined_at`            | timestamptz         | DEFAULT now()                                          |                                 |
| `left_at`              | timestamptz         | NULL                                                   | NULL = active member            |

Constraints:

- `UNIQUE(channel_id, profile_id)`

Indexes:

- `idx_channel_member_channel_active` ON (channel_id) WHERE left_at IS NULL
- `idx_channel_member_profile_active` ON (profile_id) WHERE left_at IS NULL
- `idx_channel_member_workspace` ON (workspace_id)

#### `channel_message`

| Column               | Type                       | Constraint                                             | Notes                                                   |
| -------------------- | -------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `id`                 | uuid                       | PK, default gen_random_uuid()                          |                                                         |
| `channel_id`         | uuid                       | FK -> channel(id) ON DELETE CASCADE, NOT NULL          |                                                         |
| `workspace_id`       | uuid                       | FK -> workspace(workspace_id), NOT NULL                | RLS + API key                                           |
| `sender_id`          | uuid                       | FK -> profile(profile_id) ON DELETE RESTRICT, NOT NULL | AI uses system profile                                  |
| `content`            | text                       | NOT NULL                                               | Markdown supported                                      |
| `message_type`       | channel_message_type       | DEFAULT 'text'                                         |                                                         |
| `origin_type`        | channel_origin_type        | DEFAULT 'human'                                        | Who/what created this                                   |
| `origin_id`          | text                       | NULL                                                   | Source identity (webhook ID, workflow ID, etc.)         |
| `delivery_mode`      | channel_delivery_mode      | DEFAULT 'timeline'                                     |                                                         |
| `visibility_scope`   | channel_message_visibility | DEFAULT 'all_members'                                  | Who can see this                                        |
| `target_profile_ids` | uuid[]                     | NULL                                                   | For targeted_members visibility                         |
| `event_id`           | uuid                       | FK -> channel_event(id) ON DELETE SET NULL, NULL       | Source event if machine-generated                       |
| `reply_to_id`        | uuid                       | FK -> self ON DELETE SET NULL, NULL                    | Threading                                               |
| `system_data`        | jsonb                      | NULL                                                   | Structured metadata for system messages                 |
| `is_pinned`          | boolean                    | DEFAULT false                                          |                                                         |
| `pinned_by`          | uuid                       | FK -> profile(profile_id), NULL                        |                                                         |
| `pinned_at`          | timestamptz                | NULL                                                   |                                                         |
| `edited_at`          | timestamptz                | NULL                                                   |                                                         |
| `deleted_at`         | timestamptz                | NULL                                                   | Soft delete                                             |
| `client_message_id`  | uuid                       | NULL                                                   | Client-generated UUID for idempotent retry (Section 13) |
| `created_at`         | timestamptz                | DEFAULT now()                                          |                                                         |
| `updated_at`         | timestamptz                | DEFAULT now()                                          | + set_updated_at trigger                                |

Indexes:

- `idx_channel_message_channel_created` ON (channel_id, created_at DESC)
- `idx_channel_message_workspace` ON (workspace_id) — for API key RLS
- `idx_channel_message_reply_to` ON (reply_to_id) WHERE reply_to_id IS NOT NULL
- `idx_channel_message_event` ON (event_id) WHERE event_id IS NOT NULL
- `CREATE UNIQUE INDEX idx_channel_message_client_id ON channel_message(channel_id, client_message_id) WHERE client_message_id IS NOT NULL`

#### `channel_event`

Immutable source-of-truth for machine/system/AI/external/generated events.

| Column            | Type        | Constraint                                    | Notes                                                                     |
| ----------------- | ----------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `id`              | uuid        | PK, default gen_random_uuid()                 |                                                                           |
| `channel_id`      | uuid        | FK -> channel(id) ON DELETE CASCADE, NOT NULL |                                                                           |
| `workspace_id`    | uuid        | FK -> workspace(workspace_id), NOT NULL       |                                                                           |
| `event_type`      | text        | NOT NULL                                      | e.g. 'shift_prep', 'reminder', 'handoff', 'webhook_payload', 'ai_summary' |
| `source`          | text        | NOT NULL                                      | e.g. 'scheduler', 'stage-engine', 'n8n', 'livekit', 'guardian'            |
| `source_id`       | text        | NULL                                          | External reference ID                                                     |
| `payload`         | jsonb       | NOT NULL                                      | Event data                                                                |
| `correlation_id`  | uuid        | NULL                                          | Trace through event chains                                                |
| `causation_id`    | uuid        | NULL                                          | Which event caused this one                                               |
| `idempotency_key` | text        | NULL                                          | Dedupe for webhooks                                                       |
| `created_at`      | timestamptz | DEFAULT now()                                 | Immutable — no updated_at                                                 |

Note: No back-reference to `channel_message`. To find the rendered message for an event: `SELECT id FROM channel_message WHERE event_id = $1`. This avoids cyclic FK dependencies, insert ordering issues, and retry complications.

Indexes:

- `idx_channel_event_channel` ON (channel_id, created_at DESC)
- `idx_channel_event_workspace` ON (workspace_id)
- `idx_channel_event_correlation` ON (correlation_id) WHERE correlation_id IS NOT NULL
- `CREATE UNIQUE INDEX idx_channel_event_idempotency ON channel_event(idempotency_key) WHERE idempotency_key IS NOT NULL`

#### `channel_message_reaction`

| Column         | Type        | Constraint                                             | Notes                  |
| -------------- | ----------- | ------------------------------------------------------ | ---------------------- |
| `id`           | uuid        | PK, default gen_random_uuid()                          |                        |
| `message_id`   | uuid        | FK -> channel_message(id) ON DELETE CASCADE, NOT NULL  |                        |
| `workspace_id` | uuid        | FK -> workspace(workspace_id), NOT NULL                | For API key RLS        |
| `profile_id`   | uuid        | FK -> profile(profile_id) ON DELETE RESTRICT, NOT NULL |                        |
| `emoji`        | text        | NOT NULL                                               | Single emoji character |
| `created_at`   | timestamptz | DEFAULT now()                                          |                        |

Constraints:

- `UNIQUE(message_id, profile_id, emoji)`

#### `channel_message_attachment`

| Column             | Type        | Constraint                                            | Notes                              |
| ------------------ | ----------- | ----------------------------------------------------- | ---------------------------------- |
| `id`               | uuid        | PK, default gen_random_uuid()                         |                                    |
| `message_id`       | uuid        | FK -> channel_message(id) ON DELETE CASCADE, NOT NULL |                                    |
| `workspace_id`     | uuid        | FK -> workspace(workspace_id), NOT NULL               | For API key RLS                    |
| `file_type`        | text        | NOT NULL                                              | image, document, voice_clip, video |
| `url`              | text        | NOT NULL                                              | Supabase Storage path              |
| `filename`         | text        | NOT NULL                                              |                                    |
| `size_bytes`       | bigint      | NOT NULL                                              |                                    |
| `mime_type`        | text        | NULL                                                  |                                    |
| `duration_seconds` | int         | NULL                                                  | For voice clips / video            |
| `created_at`       | timestamptz | DEFAULT now()                                         |                                    |

#### `channel_message_read`

Only populated when `channel.read_receipts_enabled = true`.

| Column         | Type        | Constraint                                             | Notes           |
| -------------- | ----------- | ------------------------------------------------------ | --------------- |
| `id`           | uuid        | PK, default gen_random_uuid()                          |                 |
| `message_id`   | uuid        | FK -> channel_message(id) ON DELETE CASCADE, NOT NULL  |                 |
| `workspace_id` | uuid        | FK -> workspace(workspace_id), NOT NULL                | For API key RLS |
| `profile_id`   | uuid        | FK -> profile(profile_id) ON DELETE RESTRICT, NOT NULL |                 |
| `read_at`      | timestamptz | DEFAULT now()                                          |                 |

Constraints:

- `UNIQUE(message_id, profile_id)`

---

### 3.2 Subsystem 2 — Realtime Media Domain

#### `channel_presence`

**Non-authoritative persistence.** Authoritative runtime presence lives in Supabase Realtime Presence and LiveKit participant state. This table is a coarse analytics/last-seen snapshot only. Do NOT build business logic that depends on `channel_presence.status = 'online'` being current — it will drift.

| Column         | Type                    | Constraint                                             | Notes                    |
| -------------- | ----------------------- | ------------------------------------------------------ | ------------------------ |
| `id`           | uuid                    | PK, default gen_random_uuid()                          |                          |
| `channel_id`   | uuid                    | FK -> channel(id) ON DELETE CASCADE, NOT NULL          |                          |
| `workspace_id` | uuid                    | FK -> workspace(workspace_id), NOT NULL                |                          |
| `profile_id`   | uuid                    | FK -> profile(profile_id) ON DELETE RESTRICT, NOT NULL |                          |
| `status`       | channel_presence_status | NOT NULL                                               |                          |
| `device_type`  | text                    | NULL                                                   | web, ios, android        |
| `last_seen_at` | timestamptz             | DEFAULT now()                                          |                          |
| `updated_at`   | timestamptz             | DEFAULT now()                                          | + set_updated_at trigger |

Constraints:

- `UNIQUE(channel_id, profile_id)`

#### `channel_call_session`

Active call instance in a channel. One active session per channel at a time.

| Column                | Type                     | Constraint                                    | Notes                                        |
| --------------------- | ------------------------ | --------------------------------------------- | -------------------------------------------- |
| `id`                  | uuid                     | PK, default gen_random_uuid()                 |                                              |
| `channel_id`          | uuid                     | FK -> channel(id) ON DELETE CASCADE, NOT NULL |                                              |
| `workspace_id`        | uuid                     | FK -> workspace(workspace_id), NOT NULL       |                                              |
| `livekit_room_name`   | text                     | NOT NULL                                      | {workspace_id}:{channel_id}                  |
| `status`              | channel_call_status      | NOT NULL                                      |                                              |
| `audio_policy`        | channel_audio_policy     | NOT NULL                                      | Snapshot from channel settings at call start |
| `video_policy`        | channel_video_policy     | NOT NULL                                      | Snapshot from channel settings at call start |
| `recording_policy`    | channel_recording_policy | NOT NULL                                      |                                              |
| `recording_egress_id` | text                     | NULL                                          | LiveKit egress ID if recording               |
| `started_at`          | timestamptz              | DEFAULT now()                                 |                                              |
| `ended_at`            | timestamptz              | NULL                                          | Set by webhook reconciliation                |
| `started_by`          | uuid                     | FK -> profile(profile_id), NULL               |                                              |
| `max_participants`    | int                      | DEFAULT 0                                     | Updated as people join                       |
| `created_at`          | timestamptz              | DEFAULT now()                                 |                                              |
| `updated_at`          | timestamptz              | DEFAULT now()                                 | + set_updated_at trigger                     |

#### `channel_call_participant`

Per-participant state in an active call.

| Column             | Type        | Constraint                                                 | Notes                    |
| ------------------ | ----------- | ---------------------------------------------------------- | ------------------------ |
| `id`               | uuid        | PK, default gen_random_uuid()                              |                          |
| `call_session_id`  | uuid        | FK -> channel_call_session(id) ON DELETE CASCADE, NOT NULL |                          |
| `workspace_id`     | uuid        | FK -> workspace(workspace_id), NOT NULL                    | For API key RLS          |
| `profile_id`       | uuid        | FK -> profile(profile_id) ON DELETE RESTRICT, NOT NULL     |                          |
| `is_ai`            | boolean     | DEFAULT false                                              | Botsson joining as agent |
| `joined_at`        | timestamptz | DEFAULT now()                                              |                          |
| `left_at`          | timestamptz | NULL                                                       | NULL = still in call     |
| `mic_enabled`      | boolean     | DEFAULT false                                              |                          |
| `camera_enabled`   | boolean     | DEFAULT false                                              |                          |
| `camera_facing`    | text        | NULL                                                       | front, back              |
| `speaking_seconds` | int         | DEFAULT 0                                                  | Accumulated              |
| `device_type`      | text        | NULL                                                       | web, ios, android        |

Indexes:

- `CREATE UNIQUE INDEX idx_call_participant_active ON channel_call_participant(call_session_id, profile_id) WHERE left_at IS NULL` — partial unique index (not a constraint)

#### `call_log`

Historical record. Created from `channel_call_session` when call ends.

| Column                | Type        | Constraint                                    | Notes                                                  |
| --------------------- | ----------- | --------------------------------------------- | ------------------------------------------------------ |
| `id`                  | uuid        | PK, default gen_random_uuid()                 |                                                        |
| `channel_id`          | uuid        | FK -> channel(id) ON DELETE CASCADE, NOT NULL |                                                        |
| `workspace_id`        | uuid        | FK -> workspace(workspace_id), NOT NULL       |                                                        |
| `call_session_id`     | uuid        | FK -> channel_call_session(id), NOT NULL      | Source                                                 |
| `livekit_room_name`   | text        | NOT NULL                                      |                                                        |
| `started_at`          | timestamptz | NOT NULL                                      |                                                        |
| `ended_at`            | timestamptz | NOT NULL                                      |                                                        |
| `duration_seconds`    | int         | NOT NULL                                      |                                                        |
| `max_participants`    | int         | NOT NULL                                      |                                                        |
| `total_participants`  | int         | NOT NULL                                      | Distinct profiles                                      |
| `recording_url`       | text        | NULL                                          | Supabase Storage path                                  |
| `participant_summary` | jsonb       | NOT NULL                                      | [{profile_id, joined, left, spoke_seconds, had_video}] |
| `created_at`          | timestamptz | DEFAULT now()                                 |                                                        |

---

### 3.3 Subsystem 3 — Automation & Events Domain

#### `channel_integration`

External service connections per channel.

| Column                     | Type                       | Constraint                                    | Notes                                                 |
| -------------------------- | -------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| `id`                       | uuid                       | PK, default gen_random_uuid()                 |                                                       |
| `channel_id`               | uuid                       | FK -> channel(id) ON DELETE CASCADE, NOT NULL |                                                       |
| `workspace_id`             | uuid                       | FK -> workspace(workspace_id), NOT NULL       |                                                       |
| `provider_type`            | text                       | NOT NULL                                      | e.g. 'webhook', 'n8n', 'pos', 'supplier', 'calendar'  |
| `display_name`             | text                       | NOT NULL                                      | Human-readable label                                  |
| `status`                   | channel_integration_status | DEFAULT 'active'                              |                                                       |
| `endpoint_url`             | text                       | NULL                                          | For outbound integrations                             |
| `endpoint_secret_vault_id` | text                       | NULL                                          | Vault reference via upsert_secret() — never plaintext |
| `config`                   | jsonb                      | DEFAULT '{}'                                  | Provider-specific config                              |
| `enabled_events`           | text[]                     | NULL                                          | Filter which events to ingest                         |
| `created_by`               | uuid                       | FK -> profile(profile_id), NOT NULL           |                                                       |
| `created_at`               | timestamptz                | DEFAULT now()                                 |                                                       |
| `updated_at`               | timestamptz                | DEFAULT now()                                 | + set_updated_at trigger                              |

Note: `endpoint_secret_vault_id` stores a Supabase Vault secret reference (via `upsert_secret()`), not a plaintext secret. Per Security Three Laws: "Never plaintext secrets in DB columns."

#### `channel_notification_policy`

Per-channel notification routing rules.

| Column                | Type                          | Constraint                                    | Notes                              |
| --------------------- | ----------------------------- | --------------------------------------------- | ---------------------------------- |
| `id`                  | uuid                          | PK, default gen_random_uuid()                 |                                    |
| `channel_id`          | uuid                          | FK -> channel(id) ON DELETE CASCADE, NOT NULL |                                    |
| `workspace_id`        | uuid                          | FK -> workspace(workspace_id), NOT NULL       |                                    |
| `event_type`          | text                          | NOT NULL                                      | Which events trigger notifications |
| `priority`            | channel_notification_priority | DEFAULT 'normal'                              |                                    |
| `delivery_channels`   | text[]                        | DEFAULT '{in_app}'                            | in_app, push, sms, email           |
| `respect_quiet_hours` | boolean                       | DEFAULT true                                  |                                    |
| `created_at`          | timestamptz                   | DEFAULT now()                                 |                                    |
| `updated_at`          | timestamptz                   | DEFAULT now()                                 | + set_updated_at trigger           |

Constraints:

- `UNIQUE(channel_id, event_type)`

#### `channel_ai_policy`

Per-channel AI behavior configuration.

| Column                 | Type                  | Constraint                                    | Notes                               |
| ---------------------- | --------------------- | --------------------------------------------- | ----------------------------------- |
| `id`                   | uuid                  | PK, default gen_random_uuid()                 |                                     |
| `channel_id`           | uuid                  | FK -> channel(id) ON DELETE CASCADE, NOT NULL |                                     |
| `workspace_id`         | uuid                  | FK -> workspace(workspace_id), NOT NULL       |                                     |
| `text_participation`   | channel_ai_text_mode  | DEFAULT 'disabled'                            |                                     |
| `voice_participation`  | channel_ai_voice_mode | DEFAULT 'disabled'                            |                                     |
| `auto_summarize`       | boolean               | DEFAULT false                                 | Generate summaries on session close |
| `auto_shift_prep`      | boolean               | DEFAULT false                                 | Generate shift prep briefings       |
| `auto_reminders`       | boolean               | DEFAULT false                                 | Post reminders for deadlines        |
| `personality_override` | jsonb                 | NULL                                          | Channel-specific personality tuning |
| `created_at`           | timestamptz           | DEFAULT now()                                 |                                     |
| `updated_at`           | timestamptz           | DEFAULT now()                                 | + set_updated_at trigger            |

Constraints:

- `UNIQUE(channel_id)`

#### `channel_retention_policy`

Lifecycle rules, especially for session channels.

| Column                       | Type        | Constraint                                    | Notes                              |
| ---------------------------- | ----------- | --------------------------------------------- | ---------------------------------- |
| `id`                         | uuid        | PK, default gen_random_uuid()                 |                                    |
| `channel_id`                 | uuid        | FK -> channel(id) ON DELETE CASCADE, NOT NULL |                                    |
| `workspace_id`               | uuid        | FK -> workspace(workspace_id), NOT NULL       |                                    |
| `auto_archive_on_close`      | boolean     | DEFAULT true                                  | Archive when session ends          |
| `archive_grace_period_hours` | int         | DEFAULT 1                                     | Grace period after close           |
| `generate_summary_on_close`  | boolean     | DEFAULT true                                  | AI summary                         |
| `pin_summary_on_close`       | boolean     | DEFAULT true                                  | Pin the generated summary          |
| `retain_media_days`          | int         | DEFAULT 90                                    | How long to keep files/media       |
| `retain_messages_days`       | int         | DEFAULT 365                                   | How long to keep messages          |
| `searchable_after_archive`   | boolean     | DEFAULT true                                  | Can archived channels be searched? |
| `created_at`                 | timestamptz | DEFAULT now()                                 |                                    |
| `updated_at`                 | timestamptz | DEFAULT now()                                 | + set_updated_at trigger           |

Constraints:

- `UNIQUE(channel_id)`

---

### 3.4 RLS Policies

All tables have BOTH JWT and API key policies per CLAUDE.md mandatory checklist.

Helper subquery used throughout:

```sql
-- Resolve current user's profile_id(s)
SELECT profile_id FROM profile WHERE user_id = auth.uid()
```

#### channel

```sql
-- JWT: read if active member
CREATE POLICY "channel_jwt_select" ON channel FOR SELECT USING (
  id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

-- JWT: insert gated by security-definer function (not direct RLS)
-- Creation permissions enforced by create_channel() function which checks:
--   custom: manager/admin/owner role
--   news: admin/owner only
--   direct: any member (function enforces exactly 2 participants + dedup)
--   department/team/session/skill: system/service role only (auto-created by triggers)
-- RLS INSERT policy delegates to the function:
CREATE POLICY "channel_jwt_insert" ON channel FOR INSERT WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND channel_type IN ('custom', 'direct')  -- news via admin-only function
);

-- JWT: update if channel admin
CREATE POLICY "channel_jwt_update" ON channel FOR UPDATE USING (
  id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND role = 'admin' AND left_at IS NULL
  )
);

-- API key: workspace-scoped read
CREATE POLICY "channel_api_select" ON channel FOR SELECT
  USING (workspace_id = get_api_workspace_id());
```

#### channel_member

```sql
-- JWT: read members of channels you belong to
CREATE POLICY "member_jwt_select" ON channel_member FOR SELECT USING (
  channel_id IN (
    SELECT channel_id FROM channel_member cm2
    WHERE cm2.profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND cm2.left_at IS NULL
  )
);

-- JWT: add members if channel admin or channel creator
CREATE POLICY "member_jwt_insert" ON channel_member FOR INSERT WITH CHECK (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND role = 'admin' AND left_at IS NULL
  )
);

-- JWT: update own record only (mute, read pointer)
CREATE POLICY "member_jwt_update" ON channel_member FOR UPDATE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- JWT: remove self or admin removes others
CREATE POLICY "member_jwt_delete" ON channel_member FOR DELETE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
  OR channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND role = 'admin' AND left_at IS NULL
  )
);

-- API key
CREATE POLICY "member_api_select" ON channel_member FOR SELECT
  USING (workspace_id = get_api_workspace_id());
```

#### channel_message

```sql
-- JWT: read if member + visibility check
CREATE POLICY "message_jwt_select" ON channel_message FOR SELECT USING (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
  AND (
    visibility_scope = 'all_members'
    OR (visibility_scope = 'admins' AND EXISTS (
      SELECT 1 FROM channel_member
      WHERE channel_id = channel_message.channel_id
      AND profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
      AND role = 'admin' AND left_at IS NULL
    ))
    OR (visibility_scope = 'targeted_members' AND (
      SELECT profile_id FROM profile WHERE user_id = auth.uid() LIMIT 1
    ) = ANY(target_profile_ids))
  )
);

-- JWT: insert if member and sender is self
CREATE POLICY "message_jwt_insert" ON channel_message FOR INSERT WITH CHECK (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
  AND sender_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- JWT: update own messages only (edit, pin)
CREATE POLICY "message_jwt_update" ON channel_message FOR UPDATE USING (
  sender_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- JWT: soft-delete own messages only
CREATE POLICY "message_jwt_delete" ON channel_message FOR DELETE USING (
  sender_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- API key
CREATE POLICY "message_api_select" ON channel_message FOR SELECT
  USING (workspace_id = get_api_workspace_id());
```

#### channel_event

```sql
-- JWT: read if member of channel
CREATE POLICY "event_jwt_select" ON channel_event FOR SELECT USING (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

-- Insert: service role only (system/webhook/scheduler)

-- API key
CREATE POLICY "event_api_select" ON channel_event FOR SELECT
  USING (workspace_id = get_api_workspace_id());
```

#### channel_message_reaction

```sql
-- JWT: read/insert/delete if member of the message's channel
CREATE POLICY "reaction_jwt_select" ON channel_message_reaction FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

CREATE POLICY "reaction_jwt_insert" ON channel_message_reaction FOR INSERT WITH CHECK (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

CREATE POLICY "reaction_jwt_delete" ON channel_message_reaction FOR DELETE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- API key
CREATE POLICY "reaction_api_select" ON channel_message_reaction FOR SELECT
  USING (workspace_id = get_api_workspace_id());
```

#### Remaining tables (pattern)

All remaining tables (`channel_message_attachment`, `channel_message_read`, `channel_presence`, `channel_call_session`, `channel_call_participant`, `call_log`, `channel_integration`, `channel_notification_policy`, `channel_ai_policy`, `channel_retention_policy`) follow the same pattern:

- **JWT SELECT**: via workspace membership (`workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))`)
- **JWT INSERT/UPDATE/DELETE**: scoped to own profile or channel admin role
- **API key SELECT**: `workspace_id = get_api_workspace_id()`

Full SQL for all policies will be in the migration file.

---

## 4. API Surface

### 4.1 REST Routes (Next.js App Router)

#### Channels

| Method | Route                  | Description                              |
| ------ | ---------------------- | ---------------------------------------- |
| GET    | `/api/channels`        | List user's active channels              |
| POST   | `/api/channels`        | Create custom/news/skill channel         |
| GET    | `/api/channels/[id]`   | Get channel details + members + policies |
| PATCH  | `/api/channels/[id]`   | Update name, description, policies       |
| DELETE | `/api/channels/[id]`   | Archive channel                          |
| GET    | `/api/channels/unread` | Unread counts for all channels           |

#### Members

| Method | Route                                    | Description         |
| ------ | ---------------------------------------- | ------------------- |
| GET    | `/api/channels/[id]/members`             | List active members |
| POST   | `/api/channels/[id]/members`             | Add member(s)       |
| DELETE | `/api/channels/[id]/members/[profileId]` | Remove member       |
| PATCH  | `/api/channels/[id]/members/[profileId]` | Update role, mute   |

#### Messages

| Method | Route                                 | Description                                        |
| ------ | ------------------------------------- | -------------------------------------------------- |
| GET    | `/api/channels/[id]/messages`         | Paginated messages (50/page, cursor-based)         |
| POST   | `/api/channels/[id]/messages`         | Send message                                       |
| PATCH  | `/api/channels/[id]/messages/[msgId]` | Edit message                                       |
| DELETE | `/api/channels/[id]/messages/[msgId]` | Soft delete                                        |
| GET    | `/api/channels/[id]/messages/search`  | Search messages (future: tsvector, for now: ILIKE) |

#### Reactions & Attachments

| Method | Route                                             | Description       |
| ------ | ------------------------------------------------- | ----------------- |
| POST   | `/api/channels/[id]/messages/[msgId]/reactions`   | Toggle reaction   |
| POST   | `/api/channels/[id]/messages/[msgId]/attachments` | Upload attachment |
| POST   | `/api/channels/[id]/messages/[msgId]/pin`         | Pin/unpin         |

#### Read Tracking

| Method | Route                     | Description                                |
| ------ | ------------------------- | ------------------------------------------ |
| POST   | `/api/channels/[id]/read` | Mark as read (update last_read_message_id) |

#### Voice/Video (LiveKit)

| Method | Route                            | Description             |
| ------ | -------------------------------- | ----------------------- |
| POST   | `/api/channels/[id]/call/token`  | Generate LiveKit token  |
| GET    | `/api/channels/[id]/call/status` | Get active call session |

### 4.2 Command Handlers

Business operations beyond CRUD. Implemented as internal service functions called by routes.

| Command                   | Trigger                              | Effect                                                                                                                           |
| ------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `join-channel`            | POST /members or auto-trigger        | Add member, emit event, update presence                                                                                          |
| `leave-channel`           | DELETE /members                      | Remove member, emit event, leave call if active                                                                                  |
| `mark-read`               | POST /read                           | Update last_read_message_id, clear badge                                                                                         |
| `start-call-session`      | POST /call/token (first participant) | Create channel_call_session, create LiveKit room                                                                                 |
| `end-call-session`        | LiveKit webhook (room_finished)      | Finalize call_session, create call_log, emit                                                                                     |
| `set-ptt-state`           | Client-side (LiveKit SDK)            | Local SDK action only. Telemetry sampled/debounced. DB persistence only in call summary aggregation, NOT per press.              |
| `set-camera-state`        | Client-side (LiveKit SDK)            | Local SDK action + LiveKit participant metadata update (requires canUpdateOwnMetadata token grant). DB only on call end summary. |
| `post-system-event`       | Scheduler, workflow, webhook         | Create channel_event, optionally render as message                                                                               |
| `generate-shift-summary`  | Session close trigger                | AI generates summary, posts as pinned system message                                                                             |
| `request-ai-response`     | @mention or proactive trigger        | Route to Stage Engine, post response as AI message                                                                               |
| `archive-session-channel` | Session close + grace period         | Archive channel, pin summary, enforce retention                                                                                  |

### 4.3 Supabase Edge Functions

| Function                 | verify_jwt | Purpose                                                                                                |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------------------------ |
| `livekit-token`          | true       | Generate LiveKit access token with channel-specific grants                                             |
| `livekit-webhook`        | false      | Receive LiveKit webhooks (HMAC validated). Reconcile call state.                                       |
| `channel-webhook-ingest` | false      | Receive third-party webhooks. Validate HMAC via Vault secret. Create channel_event + optional message. |
| `channel-system-event`   | true       | Internal: post system events (briefs, reminders, summaries) from workflows                             |

### 4.4 Supabase Realtime Subscriptions

```
Channel: channel:{workspace_id}:{channel_id}
Tables:
  - channel_message (INSERT, UPDATE, DELETE)
  - channel_message_reaction (INSERT, DELETE)
  - channel_call_session (INSERT, UPDATE)
  - channel_call_participant (INSERT, UPDATE)
Filter: channel_id = eq.{id}
```

Presence channel (Supabase Realtime Presence):

```
Channel: presence:{workspace_id}:{channel_id}
State: { profile_id, status, device_type, last_seen_at }
```

---

## 5. LiveKit Integration

### 5.1 Room Architecture

Room name: `{workspace_id}:{channel_id}`
Rooms auto-create on first participant join, auto-close when empty.

| Channel policy  | emptyTimeout | Notes                            |
| --------------- | ------------ | -------------------------------- |
| PTT channels    | 300s (5 min) | Persistent walkie-talkie rooms   |
| Video/open_call | 60s          | Close quickly when done          |
| Listen-only     | 600s         | Broadcast rooms stay open longer |

### 5.2 Token Grants (server-side enforcement)

```typescript
// In livekit-token Edge Function
const grant: VideoGrant = {
  roomJoin: true,
  room: `${workspaceId}:${channelId}`,
  canPublish: audioPolicy !== "listen_only",
  canPublishData: true,
  canSubscribe: true,
  canPublishSources: buildAllowedSources(audioPolicy, videoPolicy),
  canUpdateOwnMetadata: true, // Required for camera facing, mode markers, ephemeral state
};
```

| Policy combo        | canPublish | canPublishSources        |
| ------------------- | ---------- | ------------------------ |
| ptt + disabled      | true       | ['microphone']           |
| ptt + default_on    | true       | ['microphone', 'camera'] |
| open_mic + optional | true       | ['microphone', 'camera'] |
| listen_only + any   | false      | []                       |

Listen-only is **server-enforced** via token grants, not just frontend UI.

### 5.3 Push-to-Talk

```typescript
// Shared logic — web and mobile
function usePushToTalk(localParticipant: LocalParticipant) {
  const startTalking = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(true);
  }, [localParticipant]);

  const stopTalking = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(false);
  }, [localParticipant]);

  return { startTalking, stopTalking };
}
```

Web: `onPointerDown` / `onPointerUp`
Mobile: `onPressIn` / `onPressOut` on `Pressable`

### 5.4 Camera Controls

```typescript
// Toggle camera
await localParticipant.setCameraEnabled(enabled);

// Switch front/back
await room.switchActiveDevice("videoinput", deviceId);
// or via createLocalVideoTrack({ facingMode: 'environment' | 'user' })
```

### 5.5 AI Agent in Room

Botsson joins LiveKit rooms via the LiveKit Agents framework:

```
1. Channel has ai_voice_policy = 'interactive'
2. User starts call OR @mentions Botsson in voice channel
3. Backend dispatches agent to room via LiveKit Agents API
4. Agent joins as participant with system profile identity
5. Agent uses STT -> Stage Engine -> TTS pipeline
6. Agent appears in participant list with is_ai = true badge
```

Policy gate: AI voice participation is only activated when `channel_ai_policy.voice_participation != 'disabled'` AND `channel.ai_voice_policy != 'disabled'`. Both must be enabled.

### 5.6 Webhook Reconciliation

LiveKit webhooks are **authoritative** for call state. Client-initiated start/end are commands; webhook events are reconciliation truth.

| Webhook event        | Action                                                          |
| -------------------- | --------------------------------------------------------------- |
| `participant_joined` | Upsert channel_call_participant, update max_participants        |
| `participant_left`   | Set left_at on participant                                      |
| `room_started`       | Create channel_call_session if not exists                       |
| `room_finished`      | Finalize call_session (status=ended, ended_at), create call_log |
| `egress_ended`       | Save recording_url to call_log                                  |

### 5.7 Recording

- Triggered by `recording_policy = 'auto'` or manual start
- Uses LiveKit Egress RoomComposite -> MP4
- Storage: Supabase Storage `{workspace_id}/recordings/{call_session_id}.mp4`
- Norwegian labor law: recording indicator via `Room.isRecording` displayed in UI
- Consent managed at channel policy level
- Retention per `channel_retention_policy.retain_media_days`

### 5.8 Mobile-Specific

| Concern            | iOS                                                          | Android                            |
| ------------------ | ------------------------------------------------------------ | ---------------------------------- |
| Background audio   | CallKit via react-native-callkeep                            | Foreground service                 |
| Audio session      | AudioSession.startAudioSession()                             | AudioType.CommunicationAudioType() |
| Noise cancellation | LiveKit Krisp NC (pin exact RN package after proof-of-build) | Same                               |
| Camera permission  | NSCameraUsageDescription in Info.plist                       | Expo plugin handles                |
| Expo compatibility | Dev builds only (no Expo Go)                                 | Dev builds only                    |

### 5.9 Agent SDK LiveKit Provider

Replace stub in `packages/agent-sdk/src/providers/livekit.ts`:

```typescript
class LiveKitVoiceSession implements VoiceSession {
  private room: Room;

  join(url: string): void {
    this.room = new Room();
    this.room.connect(serverUrl, token);
  }

  leave(): void {
    this.room.disconnect();
  }
  muteMic(): void {
    this.room.localParticipant.setMicrophoneEnabled(false);
  }
  unmuteMic(): void {
    this.room.localParticipant.setMicrophoneEnabled(true);
  }

  // Map RoomEvent -> VoiceSessionEvent
  on(event, handler): void {
    /* ... */
  }
}
```

---

## 6. AI Participation

### 6.1 Text Participation

Botsson participates in channels as a regular member:

| Mode           | Behavior                                                     |
| -------------- | ------------------------------------------------------------ |
| `disabled`     | AI not in channel                                            |
| `mention_only` | Responds only to @Botsson mentions                           |
| `proactive`    | Sends reminders, summaries, shift prep, responds to mentions |

Message flow:

```
@Botsson mention in channel
  -> channel_event (event_type: 'ai_request')
  -> POST /agent/chat on Stage Engine
  -> Response as channel_message (origin_type: 'ai', sender_id: botsson_profile_id)
  -> Supabase Realtime broadcasts to all members
```

### 6.2 Automated Pipelines

These produce `channel_event` records, optionally rendered as messages.

#### Shift Preparation Pipeline

```
Trigger: 1 hour before session activation
Inputs: schedule, role assignments, recent incidents, unresolved tasks, yesterday summary
Output: channel_event (type: 'shift_prep') -> channel_message (type: 'brief')
Target: session channel (pre-created) or department channel
```

#### Reminder Pipeline

```
Trigger: scheduler (configurable per channel_ai_policy)
Inputs: checklist deadlines, training due dates, unread critical announcements
Output: channel_event (type: 'reminder') -> channel_message (type: 'reminder')
Target: relevant channel or direct message
```

#### Summary Pipeline

```
Trigger: session close, end of day, or on-demand
Inputs: message history, task completions, incidents, call activity
Output: channel_event (type: 'summary') -> channel_message (type: 'summary', is_pinned: true)
Target: session channel (pinned before archive)
```

#### Handoff Pipeline

```
Trigger: session close or shift change
Inputs: open tasks, notes, incidents, AI extraction from conversation
Output: channel_event (type: 'handoff') -> channel_message (type: 'handoff')
Target: next session channel or department channel
```

All pipelines: event first, message second. Silent events (`delivery_mode: 'silent'`) create the event record but do not render in the timeline.

---

## 7. Telemetry

### 7.1 Event Schema

Every emitted event includes:

```typescript
type ChannelTelemetryEvent = {
  event_id: string; // Unique event ID
  event_name: string; // e.g. 'message.sent'
  workspace_id: string;
  channel_id: string;
  actor_profile_id: string; // Who triggered this
  origin_type: string; // human, ai, system, webhook, scheduler, workflow
  correlation_id?: string; // Trace through event chains
  causation_id?: string; // Which event caused this one
  request_id?: string; // HTTP request ID
  device_type?: string; // web, ios, android
  platform?: string; // next, expo
  session_id?: string; // Engine session if AI-related
  data: Record<string, unknown>; // Event-specific payload
};
```

### 7.2 Event Registry

| Event                     | Trigger                    | Destinations                          |
| ------------------------- | -------------------------- | ------------------------------------- |
| `channel.created`         | New channel                | PostHog, activity_trail, engine_event |
| `channel.updated`         | Settings/policy changed    | PostHog, activity_trail               |
| `channel.archived`        | Channel archived           | PostHog, activity_trail               |
| `channel.read`            | Mark as read               | PostHog                               |
| `channel.member_joined`   | Member added               | PostHog, activity_trail, engine_event |
| `channel.member_left`     | Member removed             | PostHog, activity_trail               |
| `channel.member_updated`  | Role/mute change           | PostHog, activity_trail               |
| `message.sent`            | New message                | PostHog, activity_trail, engine_event |
| `message.edited`          | Message edited             | PostHog, activity_trail               |
| `message.deleted`         | Message soft-deleted       | PostHog, activity_trail               |
| `message.pinned`          | Pin message                | PostHog, activity_trail               |
| `message.unpinned`        | Unpin message              | PostHog, activity_trail               |
| `reaction.added`          | Emoji added                | PostHog                               |
| `reaction.removed`        | Emoji removed              | PostHog                               |
| `attachment.uploaded`     | File uploaded              | PostHog, activity_trail               |
| `call.session_started`    | Call begins                | PostHog, activity_trail, engine_event |
| `call.session_ended`      | Call ends                  | PostHog, activity_trail, engine_event |
| `call.participant_joined` | User joins call            | PostHog, activity_trail               |
| `call.participant_left`   | User leaves call           | PostHog, activity_trail               |
| `call.ptt_activated`      | PTT button pressed         | PostHog                               |
| `call.ptt_deactivated`    | PTT button released        | PostHog                               |
| `call.recording_started`  | Egress begins              | PostHog, activity_trail               |
| `call.recording_ended`    | Egress completes           | PostHog, activity_trail               |
| `event.system_posted`     | System event rendered      | PostHog, engine_event                 |
| `event.webhook_received`  | External webhook hit       | activity_trail, engine_event          |
| `ai.response_posted`      | AI message sent            | PostHog, activity_trail, engine_event |
| `ai.summary_generated`    | Summary created            | PostHog, activity_trail               |
| `ai.reminder_posted`      | Reminder sent              | PostHog, activity_trail               |
| `ai.shift_prep_posted`    | Shift prep briefing        | PostHog, activity_trail, engine_event |
| `presence.online`         | User comes online          | PostHog                               |
| `presence.offline`        | User goes offline          | PostHog                               |
| `integration.connected`   | External integration added | PostHog, activity_trail               |
| `integration.error`       | Integration failure        | activity_trail, engine_event          |

---

## 8. Component Architecture

### 8.1 Shared Component Patterns

Presentational components extracted from current chat UI and adapted:

| Component         | Responsibility                                                      | Reuse from current chat?       |
| ----------------- | ------------------------------------------------------------------- | ------------------------------ |
| `ChannelShell`    | Main layout — list + content + detail panel                         | Evolve from ChatShell          |
| `ChannelList`     | Left panel — channels grouped by type                               | Evolve from ConversationList   |
| `ChannelItem`     | Row in list — avatar, name, unread badge, last message              | Evolve from ConversationItem   |
| `ChannelHeader`   | Channel title, members count, call button, settings                 | Evolve from ChatHeader         |
| `MessageTimeline` | Scrollable message area with date groups                            | Evolve from MessageList        |
| `MessageBubble`   | Single message — sender, content, time, actions                     | Evolve from MessageBubble      |
| `SystemMessage`   | Brief, handoff, reminder, summary — distinct styling                | New                            |
| `MessageInput`    | Text field + attachment + emoji + PTT button                        | Evolve from MessageInput       |
| `ReplyPreview`    | "Replying to X..." banner                                           | Reuse as-is                    |
| `MemberPanel`     | Right panel — member list with presence indicators                  | Evolve from MemberPanel        |
| `CallBar`         | In-call overlay — participants, PTT button, camera toggle, end call | New                            |
| `PTTButton`       | Push-to-talk button (hold to speak)                                 | New                            |
| `VideoGrid`       | Video stream layout — grid/spotlight/pip                            | New                            |
| `CameraSwitch`    | Front/back camera toggle                                            | New                            |
| `CreateChannel`   | Modal — type, name, members, policies                               | Evolve from CreateConversation |
| `ChannelSettings` | Drawer — policies, integrations, retention, AI config               | New                            |

### 8.2 Web-Specific (Next.js)

```
apps/web/src/app/dashboard/channels/
  page.tsx                          -- Server component: workspace + profile
  _components/
    ChannelShell.tsx                -- "use client" main layout
    ChannelList.tsx
    ChannelItem.tsx
    ChannelHeader.tsx
    MessageTimeline.tsx
    MessageBubble.tsx
    SystemMessage.tsx
    MessageInput.tsx
    ReplyPreview.tsx
    MemberPanel.tsx
    CallBar.tsx
    PTTButton.tsx
    VideoGrid.tsx
    CameraSwitch.tsx
    CreateChannel.tsx
    ChannelSettings.tsx
  _hooks/
    channel-keys.ts                -- TanStack Query key factory
    channel-types.ts               -- TypeScript types
    use-channels.ts                -- Channel list query
    use-channel-messages.ts        -- Infinite query + cursor pagination
    use-channel-realtime.ts        -- Supabase Realtime subscription
    use-send-message.ts            -- Mutation with optimistic update
    use-reactions.ts               -- Toggle reaction mutation
    use-mark-as-read.ts            -- Mark read mutation
    use-create-channel.ts          -- Create channel mutation
    use-channel-presence.ts        -- Supabase Realtime Presence
    use-livekit-call.ts            -- LiveKit room connection + PTT + camera
    use-call-state.ts              -- Active call session query
```

### 8.3 Mobile (React Native + Expo)

Note: `apps/mobile/` is the planned directory for the Expo app (not yet created in the monorepo).

```
apps/mobile/src/features/channels/
  ChannelListScreen.tsx
  ChannelScreen.tsx
  CallScreen.tsx
  components/
    ChannelItem.tsx
    MessageBubble.tsx
    SystemMessage.tsx
    MessageInput.tsx
    PTTButton.tsx                   -- Pressable with onPressIn/onPressOut
    VideoGrid.tsx
    CameraSwitch.tsx
    CallBar.tsx
  hooks/
    use-channels.ts
    use-channel-messages.ts
    use-channel-realtime.ts
    use-send-message.ts
    use-livekit-call.ts            -- LiveKit RN SDK + AudioSession lifecycle
    use-call-state.ts
```

Mobile uses the same Supabase backend, same query keys, same realtime channels. LiveKit uses `@livekit/react-native` with Expo dev builds.

---

## 9. Migration Strategy

### Phase 1: Channel Messaging (no voice/video)

1. Create migration: `supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql`
   - All enums (with `IF NOT EXISTS` guards)
   - All Subsystem 1 tables + indexes + RLS policies (all operations) + `set_updated_at()` triggers
   - All Subsystem 3 tables (policies, integrations)
   - Seed: create Botsson system profile for existing workspaces
2. Build web UI components under `/dashboard/channels/`
3. Auto-create channels for existing departments, teams
4. Keep old `/dashboard/chat/` working — both systems live side by side

### Phase 2: LiveKit Voice/Video

1. Create migration for Subsystem 2 tables (presence, call_session, call_participant, call_log)
2. LiveKit Cloud setup (Ship plan, EU region)
3. Implement `livekit-token` and `livekit-webhook` Edge Functions
4. Build CallBar, PTTButton, VideoGrid components
5. Implement Agent SDK LiveKit provider (replace stub)
6. Mobile: LiveKit RN SDK + Expo plugin + CallKit/foreground service

### Phase 3: AI Participation + Automation

1. Botsson as channel member — @mention routing to Stage Engine
2. Shift prep pipeline
3. Reminder pipeline
4. Summary/handoff pipeline on session close
5. channel_ai_policy enforcement

### Phase 4: Integrations + Sunset

1. channel_integration table + webhook ingest Edge Function
2. Mobile feature parity verification
3. Sunset old `/dashboard/chat/` — redirect to `/dashboard/channels/`
4. Migration to drop old `chat_conversation`, `chat_participant`, `chat_message` tables

---

## 10. Environment Variables

```
# LiveKit Cloud
LIVEKIT_API_KEY=                    # op://Smartout/livekit/api-key
LIVEKIT_API_SECRET=                 # op://Smartout/livekit/api-secret
NEXT_PUBLIC_LIVEKIT_URL=            # wss://smartout-eu.livekit.cloud

# LiveKit webhook
LIVEKIT_WEBHOOK_SECRET=             # op://Smartout/livekit/webhook-secret
```

Added to `.env.template` and `apps/web/src/env.ts` Zod validation.

---

## 11. Decisions for ADR

| Decision                      | Choice                          | Reason                                               |
| ----------------------------- | ------------------------------- | ---------------------------------------------------- |
| Channel vs conversation model | Channel-first (Module 9)        | Persistent, org-tied, supports system events         |
| Schema approach               | Parallel build (Approach C)     | No risk to existing chat, clean domain model         |
| Voice/video provider          | LiveKit Cloud (Ship plan)       | Open source, RN support, AI agents, Deno SDK         |
| Event vs message separation   | Separate channel_event table    | Dedupe, replay, audit, silent events                 |
| Reactions storage             | Dedicated table                 | Concurrent writes, RLS, analytics                    |
| Read tracking                 | last_read_message_id primary    | Lightweight, per-message read optional per channel   |
| Voice mode                    | Composable policies (4 axes)    | Avoids enum explosion, future-proof                  |
| Integration secrets           | Vault references, not plaintext | Security Three Laws compliance                       |
| Integration model             | channel_integration table       | Multi-provider, rotatable secrets, per-channel       |
| AI participation              | Regular member with policy      | Consistent messaging model, configurable per channel |
| Enum naming                   | Prefixed (comm_channel_type)    | Avoid collision with 72+ existing enums              |
| Policy columns                | Typed enums, not text           | Project convention, prevents invalid values          |

---

## 12. Channel Kind Rules

Permissions and invariants per channel type:

| Type         | Who creates         | Who joins                      | Who posts    | AI auto-joins | Media allowed | Retention                           | Comments if read-only     |
| ------------ | ------------------- | ------------------------------ | ------------ | ------------- | ------------- | ----------------------------------- | ------------------------- |
| `department` | System (trigger)    | Auto: all dept profiles        | All members  | Yes           | Yes           | Permanent                           | N/A (not read-only)       |
| `team`       | System (trigger)    | Auto: all team profiles        | All members  | No (opt-in)   | Yes           | Permanent                           | N/A                       |
| `session`    | System (trigger)    | Auto: on-shift profiles        | All members  | Yes           | Yes           | Archive on close + retention policy | N/A                       |
| `custom`     | Manager/admin/owner | Invited by admin               | All members  | No (opt-in)   | Yes           | Until archived                      | N/A                       |
| `direct`     | Any member          | Exactly 2 (enforced)           | Both members | No            | Yes           | Permanent                           | N/A                       |
| `news`       | Admin/owner only    | All workspace (auto)           | Admins only  | No            | Yes           | Until archived                      | Yes (members can comment) |
| `skill`      | System (trigger)    | Auto: profiles with assignment | All members  | No (opt-in)   | Yes           | Until assignment removed            | N/A                       |

### Direct Channel Uniqueness

Direct channels must be unique per pair. Enforced via a normalized hash:

```sql
-- Computed column on channel (for direct type only)
ALTER TABLE channel ADD COLUMN direct_pair_hash text
  GENERATED ALWAYS AS (
    CASE WHEN channel_type = 'direct' THEN
      -- Hash is computed from sorted profile_id pair via create_channel() function
      -- Stored as: lesser_profile_id || ':' || greater_profile_id
      NULL -- Set by create_channel() function, not generated column
    END
  ) STORED;
```

Actually implemented as:

- `create_channel()` security-definer function computes `direct_pair_hash = sort(profile_a, profile_b).join(':')`
- `UNIQUE(workspace_id, direct_pair_hash)` WHERE `direct_pair_hash IS NOT NULL`
- Mobile retries and race conditions produce the same hash — dedup guaranteed

---

## 13. Message Idempotency

For client retries (especially mobile with poor connectivity):

| Column              | Type | Constraint               | Notes                                        |
| ------------------- | ---- | ------------------------ | -------------------------------------------- |
| `client_message_id` | uuid | UNIQUE per channel, NULL | Client-generated UUID sent with each message |

Added to `channel_message` table. Client sets this on send. Server checks uniqueness before insert. If duplicate, returns the existing message (idempotent). Mobile clients generate UUID locally before network call.

```sql
CREATE UNIQUE INDEX idx_channel_message_client_id
  ON channel_message(channel_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
```

---

## 14. Attachment Lifecycle

| Aspect         | Rule                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Storage bucket | `{workspace_id}/channels/{channel_id}/attachments/`                                                      |
| Upload flow    | Upload-before-message: client uploads to Storage, gets URL, then sends message with attachment reference |
| Max size       | Images: 10MB, Documents: 25MB, Voice clips: 5MB, Video: 50MB                                             |
| Allowed types  | Images (jpg, png, gif, webp), Documents (pdf, xlsx, csv), Voice (m4a, opus, wav), Video (mp4, webm)      |
| Validation     | Mime-type check on upload via Storage policy. No server-side antivirus in v1 (add later if needed).      |
| Orphan cleanup | Cron job: delete Storage objects not referenced by any `channel_message_attachment` row after 24h        |
| Retention      | Per `channel_retention_policy.retain_media_days`. Purge job deletes Storage objects + attachment rows.   |

---

## 15. Call Participant Identity

LiveKit participant identity must be stable and unique per room.

| Rule                    | Value                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Participant identity    | `profile_id` (stable across devices)                                                                          |
| Device info             | Stored in LiveKit participant metadata: `{ device_type, camera_facing }`                                      |
| Reconnect behavior      | Same identity reconnects — LiveKit displaces the old connection (correct behavior for single-device-per-user) |
| AI participant identity | `botsson:{workspace_id}` (unique per workspace, distinguishable from human profiles)                          |
| Multi-device            | Not supported in v1. If user joins from second device, first connection is displaced.                         |

```typescript
// Token generation
const identity = profileId; // Stable human identity
// or for AI:
const identity = `botsson:${workspaceId}`;

const metadata = JSON.stringify({
  device_type: "web", // or 'ios', 'android'
  display_name: profile.full_name,
  avatar_url: profile.avatar_url,
  is_ai: false,
});
```

---

## 16. Out of Scope (YAGNI)

- E2E encryption (evaluate later, conflicts with recording)
- SIP/PSTN telephony (keep Twilio for now, add when needed)
- Thread view (reply_to_id exists, threaded UI is future)
- Emoji picker (quick reactions only for now)
- Message forwarding between channels
- Channel discovery / directory
- Voice transcription in channels (LiveKit supports it, add later)
- Typing indicators (add later via Supabase Realtime Presence)
- Full-text search (tsvector column on channel_message — add when search UI is built)
