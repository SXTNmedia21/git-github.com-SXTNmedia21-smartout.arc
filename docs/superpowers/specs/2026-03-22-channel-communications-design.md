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
- **Session**: Trigger on `department_session.status` → `active` creates channel, adds on-shift profiles. `closed` archives channel, generates summary
- **Skill**: Trigger on `protocol_assignment` INSERT — when 2+ profiles share an assignment, create skill channel
- **AI member**: Botsson auto-joins all department and session channels as a member with `is_ai = true`

---

## 3. Database Schema

### 3.1 Subsystem 1 — Channel Messaging Domain

#### Enums

```sql
CREATE TYPE channel_type AS ENUM (
  'department', 'team', 'session', 'custom', 'direct', 'news', 'skill'
);

CREATE TYPE channel_message_type AS ENUM (
  'text', 'image', 'file', 'voice_clip', 'system', 'brief',
  'handoff', 'announcement', 'reminder', 'summary'
);

CREATE TYPE message_origin_type AS ENUM (
  'human', 'ai', 'system', 'webhook', 'scheduler', 'workflow'
);

CREATE TYPE message_delivery_mode AS ENUM (
  'timeline', 'silent', 'notification_only'
);

CREATE TYPE message_visibility_scope AS ENUM (
  'all_members', 'admins', 'targeted_members'
);
```

#### `channel`

| Column                  | Type         | Constraint                     | Notes                                    |
| ----------------------- | ------------ | ------------------------------ | ---------------------------------------- |
| `id`                    | uuid         | PK, default gen_random_uuid()  |                                          |
| `workspace_id`          | uuid         | FK -> workspace, NOT NULL      | RLS isolation                            |
| `channel_type`          | channel_type | NOT NULL                       |                                          |
| `name`                  | text         | NULL for direct                | Display name                             |
| `description`           | text         | NULL                           |                                          |
| `avatar_url`            | text         | NULL                           |                                          |
| `created_by`            | uuid         | FK -> profile, NULL            | NULL = system-created                    |
| `department_id`         | uuid         | FK -> department, NULL         | For department channels                  |
| `team_id`               | uuid         | FK -> team, NULL               | For team channels                        |
| `session_id`            | uuid         | FK -> department_session, NULL | For session channels                     |
| `is_read_only`          | boolean      | DEFAULT false                  | News/announcement channels               |
| `is_archived`           | boolean      | DEFAULT false                  | Soft archive                             |
| `read_receipts_enabled` | boolean      | DEFAULT false                  | Enable per-message read tracking         |
| `audio_policy`          | text         | DEFAULT 'disabled'             | disabled, ptt, open_mic, listen_only     |
| `video_policy`          | text         | DEFAULT 'disabled'             | disabled, optional, default_on, required |
| `recording_policy`      | text         | DEFAULT 'off'                  | off, optional, auto                      |
| `ai_voice_policy`       | text         | DEFAULT 'disabled'             | disabled, listen_only, interactive       |
| `allow_user_override`   | boolean      | DEFAULT true                   | Can users override voice/video defaults? |
| `created_at`            | timestamptz  | DEFAULT now()                  |                                          |
| `updated_at`            | timestamptz  | DEFAULT now()                  |                                          |

Indexes:

- `idx_channel_workspace` ON (workspace_id)
- `idx_channel_department` ON (department_id) WHERE department_id IS NOT NULL
- `idx_channel_team` ON (team_id) WHERE team_id IS NOT NULL
- `idx_channel_session` ON (session_id) WHERE session_id IS NOT NULL

#### `channel_member`

| Column                 | Type        | Constraint                  | Notes                           |
| ---------------------- | ----------- | --------------------------- | ------------------------------- |
| `id`                   | uuid        | PK                          |                                 |
| `channel_id`           | uuid        | FK -> channel, NOT NULL     |                                 |
| `profile_id`           | uuid        | FK -> profile, NOT NULL     |                                 |
| `role`                 | text        | DEFAULT 'member'            | member, admin                   |
| `is_ai`                | boolean     | DEFAULT false               | TRUE for Botsson system profile |
| `last_read_message_id` | uuid        | FK -> channel_message, NULL | Primary unread pointer          |
| `is_muted`             | boolean     | DEFAULT false               |                                 |
| `muted_until`          | timestamptz | NULL                        | Temporary mute                  |
| `joined_at`            | timestamptz | DEFAULT now()               |                                 |
| `left_at`              | timestamptz | NULL                        | NULL = active member            |

Constraints:

- `UNIQUE(channel_id, profile_id)`

Indexes:

- `idx_channel_member_channel_active` ON (channel_id) WHERE left_at IS NULL
- `idx_channel_member_profile_active` ON (profile_id) WHERE left_at IS NULL

#### `channel_message`

| Column               | Type                     | Constraint                | Notes                                           |
| -------------------- | ------------------------ | ------------------------- | ----------------------------------------------- |
| `id`                 | uuid                     | PK                        |                                                 |
| `channel_id`         | uuid                     | FK -> channel, NOT NULL   |                                                 |
| `workspace_id`       | uuid                     | FK -> workspace, NOT NULL | RLS efficiency                                  |
| `sender_id`          | uuid                     | FK -> profile, NOT NULL   | AI uses system profile                          |
| `content`            | text                     | NOT NULL                  | Markdown supported                              |
| `message_type`       | channel_message_type     | DEFAULT 'text'            |                                                 |
| `origin_type`        | message_origin_type      | DEFAULT 'human'           | Who/what created this                           |
| `origin_id`          | text                     | NULL                      | Source identity (webhook ID, workflow ID, etc.) |
| `delivery_mode`      | message_delivery_mode    | DEFAULT 'timeline'        | timeline, silent, notification_only             |
| `visibility_scope`   | message_visibility_scope | DEFAULT 'all_members'     | Who can see this                                |
| `target_profile_ids` | uuid[]                   | NULL                      | For targeted_members visibility                 |
| `event_id`           | uuid                     | FK -> channel_event, NULL | Source event if machine-generated               |
| `reply_to_id`        | uuid                     | FK -> self, NULL          | Threading                                       |
| `system_data`        | jsonb                    | NULL                      | Structured metadata for system messages         |
| `is_pinned`          | boolean                  | DEFAULT false             |                                                 |
| `pinned_by`          | uuid                     | FK -> profile, NULL       |                                                 |
| `pinned_at`          | timestamptz              | NULL                      |                                                 |
| `edited_at`          | timestamptz              | NULL                      |                                                 |
| `deleted_at`         | timestamptz              | NULL                      | Soft delete                                     |
| `created_at`         | timestamptz              | DEFAULT now()             |                                                 |
| `updated_at`         | timestamptz              | DEFAULT now()             |                                                 |

Indexes:

- `idx_channel_message_channel_created` ON (channel_id, created_at DESC)
- `idx_channel_message_reply_to` ON (reply_to_id) WHERE reply_to_id IS NOT NULL
- `idx_channel_message_event` ON (event_id) WHERE event_id IS NOT NULL

#### `channel_event`

Immutable source-of-truth for machine/system/AI/external/generated events.

| Column                | Type        | Constraint                  | Notes                                                                     |
| --------------------- | ----------- | --------------------------- | ------------------------------------------------------------------------- |
| `id`                  | uuid        | PK                          |                                                                           |
| `channel_id`          | uuid        | FK -> channel, NOT NULL     |                                                                           |
| `workspace_id`        | uuid        | FK -> workspace, NOT NULL   |                                                                           |
| `event_type`          | text        | NOT NULL                    | e.g. 'shift_prep', 'reminder', 'handoff', 'webhook_payload', 'ai_summary' |
| `source`              | text        | NOT NULL                    | e.g. 'scheduler', 'stage-engine', 'n8n', 'livekit', 'guardian'            |
| `source_id`           | text        | NULL                        | External reference ID                                                     |
| `payload`             | jsonb       | NOT NULL                    | Event data                                                                |
| `correlation_id`      | uuid        | NULL                        | Trace through event chains                                                |
| `causation_id`        | uuid        | NULL                        | Which event caused this one                                               |
| `idempotency_key`     | text        | NULL                        | Dedupe for webhooks                                                       |
| `rendered_message_id` | uuid        | FK -> channel_message, NULL | The visible message, if any                                               |
| `created_at`          | timestamptz | DEFAULT now()               | Immutable                                                                 |

Constraints:

- `UNIQUE(idempotency_key)` WHERE idempotency_key IS NOT NULL

Indexes:

- `idx_channel_event_channel` ON (channel_id, created_at DESC)
- `idx_channel_event_correlation` ON (correlation_id) WHERE correlation_id IS NOT NULL
- `idx_channel_event_idempotency` ON (idempotency_key) WHERE idempotency_key IS NOT NULL

#### `channel_message_reaction`

| Column       | Type        | Constraint                               | Notes                  |
| ------------ | ----------- | ---------------------------------------- | ---------------------- |
| `id`         | uuid        | PK                                       |                        |
| `message_id` | uuid        | FK -> channel_message, ON DELETE CASCADE |                        |
| `profile_id` | uuid        | FK -> profile, NOT NULL                  |                        |
| `emoji`      | text        | NOT NULL                                 | Single emoji character |
| `created_at` | timestamptz | DEFAULT now()                            |                        |

Constraints:

- `UNIQUE(message_id, profile_id, emoji)`

#### `channel_message_attachment`

| Column             | Type        | Constraint                               | Notes                              |
| ------------------ | ----------- | ---------------------------------------- | ---------------------------------- |
| `id`               | uuid        | PK                                       |                                    |
| `message_id`       | uuid        | FK -> channel_message, ON DELETE CASCADE |                                    |
| `file_type`        | text        | NOT NULL                                 | image, document, voice_clip, video |
| `url`              | text        | NOT NULL                                 | Supabase Storage path              |
| `filename`         | text        | NOT NULL                                 |                                    |
| `size_bytes`       | bigint      | NOT NULL                                 |                                    |
| `mime_type`        | text        | NULL                                     |                                    |
| `duration_seconds` | int         | NULL                                     | For voice clips / video            |
| `created_at`       | timestamptz | DEFAULT now()                            |                                    |

#### `channel_message_read`

Only populated when `channel.read_receipts_enabled = true`.

| Column       | Type        | Constraint                      | Notes |
| ------------ | ----------- | ------------------------------- | ----- |
| `id`         | uuid        | PK                              |       |
| `message_id` | uuid        | FK -> channel_message, NOT NULL |       |
| `profile_id` | uuid        | FK -> profile, NOT NULL         |       |
| `read_at`    | timestamptz | DEFAULT now()                   |       |

Constraints:

- `UNIQUE(message_id, profile_id)`

---

### 3.2 Subsystem 2 — Realtime Media Domain

#### `channel_presence`

Ephemeral runtime state. Could be backed by Redis/Supabase Realtime Presence for hot path, persisted to PG for analytics.

| Column         | Type        | Constraint              | Notes                 |
| -------------- | ----------- | ----------------------- | --------------------- |
| `id`           | uuid        | PK                      |                       |
| `channel_id`   | uuid        | FK -> channel, NOT NULL |                       |
| `profile_id`   | uuid        | FK -> profile, NOT NULL |                       |
| `status`       | text        | NOT NULL                | online, away, offline |
| `device_type`  | text        | NULL                    | web, ios, android     |
| `last_seen_at` | timestamptz | DEFAULT now()           |                       |
| `updated_at`   | timestamptz | DEFAULT now()           |                       |

Constraints:

- `UNIQUE(channel_id, profile_id)`

#### `channel_call_session`

Active call instance in a channel. One active session per channel at a time.

| Column                | Type        | Constraint                | Notes                                        |
| --------------------- | ----------- | ------------------------- | -------------------------------------------- |
| `id`                  | uuid        | PK                        |                                              |
| `channel_id`          | uuid        | FK -> channel, NOT NULL   |                                              |
| `workspace_id`        | uuid        | FK -> workspace, NOT NULL |                                              |
| `livekit_room_name`   | text        | NOT NULL                  | {workspace_id}:{channel_id}                  |
| `status`              | text        | NOT NULL                  | active, ending, ended                        |
| `audio_policy`        | text        | NOT NULL                  | Snapshot from channel settings at call start |
| `video_policy`        | text        | NOT NULL                  | Snapshot from channel settings at call start |
| `recording_policy`    | text        | NOT NULL                  |                                              |
| `recording_egress_id` | text        | NULL                      | LiveKit egress ID if recording               |
| `started_at`          | timestamptz | DEFAULT now()             |                                              |
| `ended_at`            | timestamptz | NULL                      | Set by webhook reconciliation                |
| `started_by`          | uuid        | FK -> profile, NULL       |                                              |
| `max_participants`    | int         | DEFAULT 0                 | Updated as people join                       |
| `created_at`          | timestamptz | DEFAULT now()             |                                              |
| `updated_at`          | timestamptz | DEFAULT now()             |                                              |

#### `channel_call_participant`

Per-participant state in an active call.

| Column             | Type        | Constraint                           | Notes                    |
| ------------------ | ----------- | ------------------------------------ | ------------------------ |
| `id`               | uuid        | PK                                   |                          |
| `call_session_id`  | uuid        | FK -> channel_call_session, NOT NULL |                          |
| `profile_id`       | uuid        | FK -> profile, NOT NULL              |                          |
| `is_ai`            | boolean     | DEFAULT false                        | Botsson joining as agent |
| `joined_at`        | timestamptz | DEFAULT now()                        |                          |
| `left_at`          | timestamptz | NULL                                 | NULL = still in call     |
| `mic_enabled`      | boolean     | DEFAULT false                        |                          |
| `camera_enabled`   | boolean     | DEFAULT false                        |                          |
| `camera_facing`    | text        | NULL                                 | front, back              |
| `speaking_seconds` | int         | DEFAULT 0                            | Accumulated              |
| `device_type`      | text        | NULL                                 | web, ios, android        |

Constraints:

- `UNIQUE(call_session_id, profile_id)` WHERE left_at IS NULL

#### `call_log`

Historical record. Created from `channel_call_session` when call ends.

| Column                | Type        | Constraint                 | Notes                                                  |
| --------------------- | ----------- | -------------------------- | ------------------------------------------------------ |
| `id`                  | uuid        | PK                         |                                                        |
| `channel_id`          | uuid        | FK -> channel, NOT NULL    |                                                        |
| `workspace_id`        | uuid        | FK -> workspace, NOT NULL  |                                                        |
| `call_session_id`     | uuid        | FK -> channel_call_session | Source                                                 |
| `livekit_room_name`   | text        | NOT NULL                   |                                                        |
| `started_at`          | timestamptz | NOT NULL                   |                                                        |
| `ended_at`            | timestamptz | NOT NULL                   |                                                        |
| `duration_seconds`    | int         | NOT NULL                   |                                                        |
| `max_participants`    | int         | NOT NULL                   |                                                        |
| `total_participants`  | int         | NOT NULL                   | Distinct profiles                                      |
| `recording_url`       | text        | NULL                       | Supabase Storage path                                  |
| `participant_summary` | jsonb       | NOT NULL                   | [{profile_id, joined, left, spoke_seconds, had_video}] |
| `created_at`          | timestamptz | DEFAULT now()              |                                                        |

---

### 3.3 Subsystem 3 — Automation & Events Domain

#### `channel_integration`

External service connections per channel.

| Column            | Type        | Constraint                | Notes                                                |
| ----------------- | ----------- | ------------------------- | ---------------------------------------------------- |
| `id`              | uuid        | PK                        |                                                      |
| `channel_id`      | uuid        | FK -> channel, NOT NULL   |                                                      |
| `workspace_id`    | uuid        | FK -> workspace, NOT NULL |                                                      |
| `provider_type`   | text        | NOT NULL                  | e.g. 'webhook', 'n8n', 'pos', 'supplier', 'calendar' |
| `display_name`    | text        | NOT NULL                  | Human-readable label                                 |
| `status`          | text        | DEFAULT 'active'          | active, paused, error                                |
| `endpoint_url`    | text        | NULL                      | For outbound integrations                            |
| `endpoint_secret` | text        | NULL                      | HMAC verification for inbound                        |
| `config`          | jsonb       | DEFAULT '{}'              | Provider-specific config                             |
| `enabled_events`  | text[]      | NULL                      | Filter which events to ingest                        |
| `created_by`      | uuid        | FK -> profile, NOT NULL   |                                                      |
| `created_at`      | timestamptz | DEFAULT now()             |                                                      |
| `updated_at`      | timestamptz | DEFAULT now()             |                                                      |

#### `channel_notification_policy`

Per-channel notification routing rules.

| Column                | Type        | Constraint              | Notes                              |
| --------------------- | ----------- | ----------------------- | ---------------------------------- |
| `id`                  | uuid        | PK                      |                                    |
| `channel_id`          | uuid        | FK -> channel, NOT NULL |                                    |
| `event_type`          | text        | NOT NULL                | Which events trigger notifications |
| `priority`            | text        | DEFAULT 'normal'        | critical, high, normal, low        |
| `delivery_channels`   | text[]      | DEFAULT '{in_app}'      | in_app, push, sms, email           |
| `respect_quiet_hours` | boolean     | DEFAULT true            |                                    |
| `created_at`          | timestamptz | DEFAULT now()           |                                    |

Constraints:

- `UNIQUE(channel_id, event_type)`

#### `channel_ai_policy`

Per-channel AI behavior configuration.

| Column                 | Type        | Constraint              | Notes                               |
| ---------------------- | ----------- | ----------------------- | ----------------------------------- |
| `id`                   | uuid        | PK                      |                                     |
| `channel_id`           | uuid        | FK -> channel, NOT NULL |                                     |
| `text_participation`   | text        | DEFAULT 'disabled'      | disabled, mention_only, proactive   |
| `voice_participation`  | text        | DEFAULT 'disabled'      | disabled, listen_only, interactive  |
| `auto_summarize`       | boolean     | DEFAULT false           | Generate summaries on session close |
| `auto_shift_prep`      | boolean     | DEFAULT false           | Generate shift prep briefings       |
| `auto_reminders`       | boolean     | DEFAULT false           | Post reminders for deadlines        |
| `personality_override` | jsonb       | NULL                    | Channel-specific personality tuning |
| `created_at`           | timestamptz | DEFAULT now()           |                                     |
| `updated_at`           | timestamptz | DEFAULT now()           |                                     |

Constraints:

- `UNIQUE(channel_id)`

#### `channel_retention_policy`

Lifecycle rules, especially for session channels.

| Column                       | Type        | Constraint              | Notes                              |
| ---------------------------- | ----------- | ----------------------- | ---------------------------------- |
| `id`                         | uuid        | PK                      |                                    |
| `channel_id`                 | uuid        | FK -> channel, NOT NULL |                                    |
| `auto_archive_on_close`      | boolean     | DEFAULT true            | Archive when session ends          |
| `archive_grace_period_hours` | int         | DEFAULT 1               | Grace period after close           |
| `generate_summary_on_close`  | boolean     | DEFAULT true            | AI summary                         |
| `pin_summary_on_close`       | boolean     | DEFAULT true            | Pin the generated summary          |
| `retain_media_days`          | int         | DEFAULT 90              | How long to keep files/media       |
| `retain_messages_days`       | int         | DEFAULT 365             | How long to keep messages          |
| `searchable_after_archive`   | boolean     | DEFAULT true            | Can archived channels be searched? |
| `created_at`                 | timestamptz | DEFAULT now()           |                                    |

Constraints:

- `UNIQUE(channel_id)`

---

### 3.4 RLS Policies

All tables use workspace-scoping via channel membership.

```sql
-- channel: read if you are an active member
CREATE POLICY "channel_read" ON channel FOR SELECT USING (
  id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

-- channel_message: read if you are a member of the channel
CREATE POLICY "message_read" ON channel_message FOR SELECT USING (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
  AND (
    visibility_scope = 'all_members'
    OR (visibility_scope = 'admins' AND EXISTS (
      SELECT 1 FROM channel_member
      WHERE channel_id = channel_message.channel_id
      AND profile_id IN (SELECT id FROM profile WHERE user_id = auth.uid())
      AND role = 'admin' AND left_at IS NULL
    ))
    OR (visibility_scope = 'targeted_members' AND (
      SELECT id FROM profile WHERE user_id = auth.uid()
    ) = ANY(target_profile_ids))
  )
);

-- channel_message: insert if you are a member and sender is yourself
CREATE POLICY "message_insert" ON channel_message FOR INSERT WITH CHECK (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
  AND sender_id IN (SELECT id FROM profile WHERE user_id = auth.uid())
);

-- API key policies for all tables
CREATE POLICY "api_key_read_channel" ON channel FOR SELECT
  USING (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_read_channel_message" ON channel_message FOR SELECT
  USING (workspace_id = get_api_workspace_id());
```

Pattern repeats for all tables: JWT membership check + API key workspace check.

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

| Method | Route                                 | Description                                |
| ------ | ------------------------------------- | ------------------------------------------ |
| GET    | `/api/channels/[id]/messages`         | Paginated messages (50/page, cursor-based) |
| POST   | `/api/channels/[id]/messages`         | Send message                               |
| PATCH  | `/api/channels/[id]/messages/[msgId]` | Edit message                               |
| DELETE | `/api/channels/[id]/messages/[msgId]` | Soft delete                                |
| GET    | `/api/channels/[id]/messages/search`  | Search messages in channel                 |

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

| Command                   | Trigger                              | Effect                                               |
| ------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `join-channel`            | POST /members or auto-trigger        | Add member, emit event, update presence              |
| `leave-channel`           | DELETE /members                      | Remove member, emit event, leave call if active      |
| `mark-read`               | POST /read                           | Update last_read_message_id, clear badge             |
| `start-call-session`      | POST /call/token (first participant) | Create channel_call_session, create LiveKit room     |
| `end-call-session`        | LiveKit webhook (room_finished)      | Finalize call_session, create call_log, emit         |
| `set-ptt-state`           | Client-side (LiveKit SDK)            | Update call_participant.mic_enabled                  |
| `set-camera-state`        | Client-side (LiveKit SDK)            | Update call_participant.camera_enabled               |
| `post-system-event`       | Scheduler, workflow, webhook         | Create channel_event, optionally render as message   |
| `generate-shift-summary`  | Session close trigger                | AI generates summary, posts as pinned system message |
| `request-ai-response`     | @mention or proactive trigger        | Route to Stage Engine, post response as AI message   |
| `archive-session-channel` | Session close + grace period         | Archive channel, pin summary, enforce retention      |

### 4.3 Supabase Edge Functions

| Function                 | verify_jwt | Purpose                                                                               |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------- |
| `livekit-token`          | true       | Generate LiveKit access token with channel-specific grants                            |
| `livekit-webhook`        | false      | Receive LiveKit webhooks (HMAC validated). Reconcile call state.                      |
| `channel-webhook-ingest` | false      | Receive third-party webhooks. Validate HMAC. Create channel_event + optional message. |
| `channel-system-event`   | true       | Internal: post system events (briefs, reminders, summaries) from workflows            |

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
  // Video publish controlled separately
  canPublishSources: buildAllowedSources(audioPolicy, videoPolicy),
};
```

| Policy combo        | canPublish | canPublishSources        |
| ------------------- | ---------- | ------------------------ |
| ptt + disabled      | true       | ['microphone']           |
| ptt + default_on    | true       | ['microphone', 'camera'] |
| open_mic + optional | true       | ['microphone', 'camera'] |
| listen_only + any   | false      | []                       |

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

### 5.6 Webhook Reconciliation

LiveKit webhooks are authoritative for call state:

| Webhook event        | Action                                                          |
| -------------------- | --------------------------------------------------------------- |
| `participant_joined` | Upsert channel_call_participant, update max_participants        |
| `participant_left`   | Set left_at on participant                                      |
| `room_started`       | Create channel_call_session if not exists                       |
| `room_finished`      | Finalize call_session (status=ended, ended_at), create call_log |
| `egress_ended`       | Save recording_url to call_log                                  |

Client-initiated start/end are commands; webhook events are reconciliation truth.

### 5.7 Recording

- Triggered by `recording_policy = 'auto'` or manual start
- Uses LiveKit Egress RoomComposite → MP4
- Storage: Supabase Storage `{workspace_id}/recordings/{call_session_id}.mp4`
- Norwegian labor law: recording indicator via `Room.isRecording` displayed in UI
- Consent managed at channel policy level

### 5.8 Mobile-Specific

| Concern            | iOS                                      | Android                            |
| ------------------ | ---------------------------------------- | ---------------------------------- |
| Background audio   | CallKit via react-native-callkeep        | Foreground service                 |
| Audio session      | AudioSession.startAudioSession()         | AudioType.CommunicationAudioType() |
| Noise cancellation | @livekit/react-native-krisp-noise-filter | Same                               |
| Camera permission  | NSCameraUsageDescription in Info.plist   | Expo plugin handles                |
| Expo compatibility | Dev builds only (no Expo Go)             | Dev builds only                    |

### 5.9 Agent SDK LiveKit Provider

Replace stub in `packages/agent-sdk/src/providers/livekit.ts`:

```typescript
class LiveKitVoiceSession implements VoiceSession {
  private room: Room;

  join(url: string): void {
    // url contains serverUrl + token
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

These produce `channel_event` records, optionally rendered as messages:

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

All pipelines: event first, message second. Silent events (delivery_mode: 'silent') create the event record but do not render in the timeline.

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

### 8.1 Shared Components (web + mobile via @smartout/ui or shared patterns)

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
   - All Subsystem 1 tables + enums + indexes + RLS + triggers
   - Subsystem 3 tables (policies, integrations)
2. Build web UI components under `/dashboard/channels/`
3. Auto-create channels for existing departments, teams
4. Add AI system profile for Botsson
5. Keep old `/dashboard/chat/` working — both systems live side by side

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

| Decision                      | Choice                       | Reason                                               |
| ----------------------------- | ---------------------------- | ---------------------------------------------------- |
| Channel vs conversation model | Channel-first (Module 9)     | Persistent, org-tied, supports system events         |
| Schema approach               | Parallel build (Approach C)  | No risk to existing chat, clean domain model         |
| Voice/video provider          | LiveKit Cloud (Ship plan)    | Open source, RN support, AI agents, Deno SDK         |
| Event vs message separation   | Separate channel_event table | Dedupe, replay, audit, silent events                 |
| Reactions storage             | Dedicated table              | Concurrent writes, RLS, analytics                    |
| Read tracking                 | last_read_message_id primary | Lightweight, per-message read optional per channel   |
| Voice mode                    | Composable policies (4 axes) | Avoids enum explosion, future-proof                  |
| Integration model             | channel_integration table    | Multi-provider, rotatable secrets, per-channel       |
| AI participation              | Regular member with policy   | Consistent messaging model, configurable per channel |

---

## 12. Out of Scope (YAGNI)

- E2E encryption (evaluate later, conflicts with recording)
- SIP/PSTN telephony (keep Twilio for now, add when needed)
- Thread view (reply_to_id exists, threaded UI is future)
- Emoji picker (quick reactions only for now)
- Message forwarding between channels
- Channel discovery / directory
- Voice transcription in channels (LiveKit supports it, add later)
- Typing indicators (add later via Supabase Realtime Presence)
