---
title: Announcements — Data Model
status: archived
superseded_by: docs/domains/announcements/
updated: 2026-05-23
created: 2026-05-18
module: announcements
tags: [module, announcements, data-model, schema, channel-message, rls, telemetry]
---

> **ARCHIVED 2026-05-23.** See `docs/domains/announcements/DATA-MODEL.md` (includes Wave B `announcement_meta` schema).

# Announcements — Data Model

> Every table the announcement surface reads or writes, with enum values, RLS, triggers, and telemetry. Announcements share the `channel_message` substrate with chat — this document marks which parts are announcement-load-bearing.

## 1. Tables Touched

### 1.1 `channel` — the container

Migration: `supabase/migrations/20260422300000_channel_communications.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | gen_random_uuid |
| `workspace_id` | UUID NOT NULL FK → workspace | RLS root |
| `channel_type` | enum `comm_channel_type` | `news` is the canonical container for announcements |
| `name` | TEXT NOT NULL | |
| `description` | TEXT | |
| `department_id` / `team_id` / `session_id` | UUID FK | scoping (mutually exclusive with `news`) |
| `is_read_only` | BOOL DEFAULT false | |
| `created_by` | UUID FK profile | |
| `created_at` / `updated_at` | timestamptz NOT NULL DEFAULT now() | audit |

Invariants:
- One `news`-type channel per workspace by convention. Resolve-or-create logic lives in `use-send-broadcast.ts` (service-role).
- JWT cannot create a `news` channel — RLS blocks `channel_type='news'` from `channel_jwt_insert`.

### 1.2 `channel_member` — who reads what

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `channel_id` | UUID NOT NULL FK | |
| `profile_id` | UUID NOT NULL FK | |
| `role` | enum `channel_member_role` | |
| `last_read_message_id` | UUID FK channel_message | read-receipt anchor |
| `is_muted` | BOOL DEFAULT false | |
| `left_at` | timestamptz nullable | soft-leave |

Trigger: `validate_last_read_same_channel()` BEFORE INSERT OR UPDATE guards cross-channel pollution of `last_read_message_id`.

### 1.3 `channel_message` — the announcement row itself

Migration: `20260422300000_channel_communications.sql` + `20260528020000_announcement_notification_priority.sql`.

| Column | Type | Announcement use |
|---|---|---|
| `id` | UUID PK | |
| `channel_id` | UUID NOT NULL FK | typically a `news`-type channel |
| `workspace_id` | UUID NOT NULL FK | RLS root |
| `sender_id` | UUID NOT NULL FK profile | publisher |
| `event_id` | UUID nullable FK → `channel_event` | set when message was system-generated from lifecycle |
| `reply_to_id` | UUID nullable FK → `channel_message` | threading — not used for announcements |
| `content` | TEXT | the body |
| `message_type` | enum `channel_message_type` | **`announcement` is the discriminator** |
| `origin_type` | enum `channel_origin_type` | `human` from operator composers; `ai` from agent tool |
| `delivery_mode` | enum `channel_delivery_mode` | `timeline` default; `notification_only` for Day-Control broadcasts that should not appear in feed history |
| `visibility_scope` | enum `channel_message_visibility` | `all_members` default; `targeted_members` activates `target_profile_ids` |
| `target_profile_ids` | uuid[] nullable | populated when `visibility_scope='targeted_members'` |
| `system_data` | JSONB | composer writes `{ audience_kind, audience_label }` and (for Day-Control) `{ broadcast_type, session_id }` |
| `is_pinned` | BOOL DEFAULT false | pin state |
| `pinned_by` | UUID nullable FK profile | |
| `pinned_at` | timestamptz nullable | |
| `deleted_at` | timestamptz nullable | soft-delete |
| `client_message_id` | UUID NOT NULL | idempotency for optimistic UI |
| `created_at` / `updated_at` | timestamptz NOT NULL DEFAULT now() | audit |

Indexes:
- `idx_channel_message_channel_created` on `(channel_id, created_at DESC)` — feed pagination
- `idx_channel_message_client_id` UNIQUE on `(channel_id, client_message_id)` — idempotency

### 1.4 `channel_message_reaction`

| Column | Type |
|---|---|
| `id` | UUID PK |
| `message_id` | UUID NOT NULL FK |
| `channel_id` | UUID NOT NULL FK |
| `profile_id` | UUID NOT NULL FK |
| `emoji` | TEXT NOT NULL |
| `created_at` | timestamptz |

### 1.5 `channel_message_attachment`

| Column | Type |
|---|---|
| `id` | UUID PK |
| `message_id` | UUID NOT NULL FK |
| `channel_id` | UUID NOT NULL FK |
| `file_type` | TEXT |
| `url` | TEXT |
| `filename` | TEXT |
| `size_bytes` | int |

### 1.6 `channel_message_read`

| Column | Type |
|---|---|
| `id` | UUID PK |
| `message_id` | UUID NOT NULL FK |
| `profile_id` | UUID NOT NULL FK |
| `read_at` | timestamptz |

### 1.7 `channel_notification_policy`

| Column | Type |
|---|---|
| `id` | UUID PK |
| `channel_id` | UUID NOT NULL FK |
| `event_type` | TEXT |
| `priority` | enum `channel_notification_priority` |
| `delivery_channels` | TEXT[] |
| `respect_quiet_hours` | BOOL |

### 1.8 `notification_outbox` (write target — owned by notifications module)

The notification trigger writes here. Announcements always carry `priority=1, mode='work', event_key='announcement.published'`. Other channel messages get `priority=0, mode='community'`. System messages (`system`, `brief`, `handoff`, `summary`) are skipped.

---

## 2. Enums

| Enum | Values | Announcement-relevance |
|---|---|---|
| `comm_channel_type` | `department`, `team`, `session`, `custom`, `direct`, `news`, `skill` | `news` is the canonical container |
| `channel_message_type` | `text`, `image`, `file`, `voice_clip`, `system`, `brief`, `handoff`, `announcement`, `reminder`, `summary` | `announcement` is the discriminator |
| `channel_origin_type` | `human`, `ai`, `system`, `webhook`, `scheduler`, `workflow` | Mr. Botsson posts as `ai` |
| `channel_delivery_mode` | `timeline`, `silent`, `notification_only` | `notification_only` used by Day-Control to deliver without feed entry |
| `channel_message_visibility` | `all_members`, `admins`, `targeted_members` | with `target_profile_ids[]` enforces per-recipient visibility |
| `channel_notification_priority` | `critical`, `high`, `normal`, `low` | used by `channel_notification_policy` lookup |

---

## 3. Audience Model

Composer writes `system_data.audience_kind` (one of 5) + `system_data.audience_label` (display string) + `target_profile_ids[]` (when targeted).

Five audience kinds and their resolution rules:

| `audience_kind` | Resolved set |
|---|---|
| `all` | every active profile in the workspace |
| `on_duty` | profiles with an active or imminent shift today |
| `department` | all profiles in selected department(s) |
| `role` | all profiles holding selected role(s) |
| `individuals` | explicit list of profile IDs |

Resolution lives in two places:
- Web: `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts`
- Agent (server-side): `packages/ai/src/capabilities/communication/audience-resolver.ts`

When the operator targets a non-empty set, the message lands with `visibility_scope='targeted_members'` and `target_profile_ids=[…]`. Otherwise it lands as `all_members` and RLS filtering is membership-only.

---

## 4. RLS Policies

Migration: `supabase/migrations/20260422300100_channel_rls_policies.sql`.

| Table | Policy | Operation | Guard |
|---|---|---|---|
| `channel` | `channel_jwt_select` | SELECT | active `channel_member` |
| `channel` | `channel_jwt_insert` | INSERT | `channel_type IN ('custom','direct')` only — `'news'` blocked under JWT |
| `channel` | `channel_jwt_update` | UPDATE | channel admin only |
| `channel` | `channel_api_select` | SELECT | `workspace_id = get_api_workspace_id()` |
| `channel_message` | `channel_message_jwt_select` | SELECT | channel member + `visibility_scope` check (targets `target_profile_ids &&` current profile) |
| `channel_message` | `channel_message_jwt_insert` | INSERT | channel member + `sender_id` = self |
| `channel_message` | `channel_message_jwt_update` | UPDATE | own messages only |
| `channel_message` | `channel_message_api_select` | SELECT | workspace API key |
| `channel_event` | `channel_event_jwt_select` | SELECT | channel member; no JWT INSERT (service role only) |
| `channel_message_reaction` | `reaction_jwt_*` | SELECT/INSERT/DELETE | membership-scoped |
| `channel_message_read` | `read_jwt_*` | SELECT/INSERT | membership-scoped |

`news` channel creation and `announcement` message inserts via the broadcast composer go through **service-role** (`createAdminClient`) inside `send-broadcast-action.ts` and `use-send-broadcast.ts` because JWT RLS blocks both. The bulletin composer (`use-send-announcement.ts`) inserts under JWT because the `news` channel already exists by then.

---

## 5. Functions and Triggers

| Object | Type | Behaviour |
|---|---|---|
| `get_my_channels(p_workspace_id)` | RPC | Returns channels for caller including `'news'`-type. Drives both web sidebar and mobile channel list. |
| `trigger_channel_message_notification()` | trigger fn (SECURITY DEFINER) | AFTER INSERT on `channel_message`. Inserts `notification_outbox` rows for channel members. **Branches on `message_type='announcement'`** → `priority=1, mode='work'`; all others → `priority=0, mode='community'`. Encodes `event_key='announcement.published'` in metadata. Skips `system`, `brief`, `handoff`, `summary`. |
| `validate_last_read_same_channel()` | trigger fn | BEFORE INSERT OR UPDATE on `channel_member`. Validates `last_read_message_id` is in same channel. |
| `set_updated_at()` | trigger fn | BEFORE UPDATE on `channel` and `channel_message`. |

Sources:
- `supabase/migrations/20260422300200_channel_functions.sql`
- `supabase/migrations/20260422310100_channel_message_notification_trigger.sql`
- `supabase/migrations/20260528020000_announcement_notification_priority.sql`

---

## 6. Telemetry Events

### 6.1 Events

| Event | Properties | Entity |
|---|---|---|
| `channel.message.sent` | `channel_id`, `origin_type`, `message_type`, `visibility_scope`, `target_profile_count`, `audience_kind`, `notification_priority`, `notification_mode` | `channel_message` |
| `channel.message.pinned` | (base) | `channel_message` |
| `channel.message.unpinned` | (base) | `channel_message` |
| `communication.broadcast_sent` | `metadata: { source, recipient_count, channel_id }` | none (by design) |
| `news.post.created` | `channel_id` | `EntityRef` |
| `news.post.reacted` | `channel_id`, `emoji` | `EntityRef` |

`channel.message.sent` carries the announcement variant via the `message_type='announcement'` property; there is no dedicated `announcement.sent` event.

### 6.2 Routing

| Event | Destinations |
|---|---|
| `channel.message.sent` | `posthog`, `logger`, `activity_trail` |
| `channel.message.pinned` | `posthog`, `logger`, `activity_trail` |
| `channel.message.unpinned` | `posthog`, `logger`, `activity_trail` |
| `communication.broadcast_sent` | `activity_trail`, `posthog` |
| `news.post.created` | `posthog`, `logger`, `activity_trail` |
| `news.post.reacted` | `posthog` (line 11799) |

Registry source: `packages/telemetry/src/registry.ts` lines 4171–4278, 11741–11799, 12277.

---

## 7. Migration Inventory

| Migration | Adds |
|---|---|
| `20260422300000_channel_communications.sql` | All 6 channel tables + 6 enums |
| `20260422300100_channel_rls_policies.sql` | All RLS policies including dual-auth (JWT + API key) |
| `20260422300200_channel_functions.sql` | `get_my_channels` + helpers |
| `20260422310100_channel_message_notification_trigger.sql` | Notification fan-out trigger |
| `20260428200000_idempotent_indexes.sql` | UNIQUE `(channel_id, client_message_id)` |
| `20260528020000_announcement_notification_priority.sql` | Branch trigger on `message_type='announcement'` for `priority=1, mode='work'` |

---

## 8. Schema Invariants

1. Every `channel_message` has `workspace_id` matching its `channel.workspace_id` (denormalized for RLS performance).
2. `client_message_id` UNIQUE per `(channel_id, …)` blocks optimistic-UI duplicate inserts.
3. `last_read_message_id` in `channel_member` MUST belong to the same channel (validated by trigger).
4. `target_profile_ids` is non-empty when `visibility_scope='targeted_members'` (enforced by composer, not by DB constraint — no CHECK exists).
5. `pinned_by` MUST be set when `is_pinned=true` (enforced by composer, not DB — no CHECK).
6. `deleted_at IS NULL` is the live-row predicate. Feed queries filter on it; no row is ever hard-deleted.
