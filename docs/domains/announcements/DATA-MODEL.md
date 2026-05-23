---
title: "Announcements Domain — Data Model"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: announcements
tags: [announcements, data-model, schema, announcement_meta, enums, rls, telemetry]
mirror: verified
last_verified: 2026-05-23
---

# Announcements — Data Model

> Every table the announcement surface owns or writes, with verified columns, enums, RLS, triggers, and telemetry. Announcements SHARE the `channel_message` substrate with chat (owned by **communication** domain). This document marks announcement-specific claims; it does not re-document the full communication schema.

---

## 1. Tables Owned by Announcements Domain

### 1.1 `announcement_meta` — Wave B sidecar

**Migration:** `20260620140200_announcement_meta_table.sql`

1:1 with `channel_message` via `message_id` PK FK `ON DELETE CASCADE`. Populated exclusively by `publish_announcement_atomic` SECURITY DEFINER RPC (no INSERT policy for authenticated clients).

| Column | Type | Notes |
|---|---|---|
| `message_id` | UUID PK | FK → `channel_message(id)` ON DELETE CASCADE |
| `workspace_id` | UUID NOT NULL | FK → `workspace(workspace_id)` ON DELETE CASCADE; RLS root |
| `kind` | `announcement_kind` NOT NULL | Classification (7+2 values — see §2.1) |
| `tier` | `announcement_tier` NOT NULL DEFAULT 'work' | social / work / external |
| `tags` | text[] NOT NULL DEFAULT '{}' | GIN-indexed for keyword search |
| `linked_entity_type` | `announcement_link_type` nullable | Polymorphic link type |
| `linked_entity_id` | UUID nullable | FK to the linked entity row |
| `tier_overridden` | boolean NOT NULL DEFAULT false | True when operator manually changed tier from kind-default |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

**CHECK constraints (verified from migration):**
- `meta_kind_link_consistent` — `kind` determines which `linked_entity_type` values are allowed (e.g. `policy_update` requires `linked_entity_type = 'policy'`; `general` requires `linked_entity_type IS NULL`).
- `meta_link_pair_consistent` — `linked_entity_type` and `linked_entity_id` must both be NULL or both non-NULL.

**Indexes:**
- `idx_meta_workspace_kind` on `(workspace_id, kind)`
- `idx_meta_workspace_tier` on `(workspace_id, tier)`
- `idx_meta_tags_gin` GIN on `tags`
- `idx_meta_link` on `(linked_entity_type, linked_entity_id)` WHERE `linked_entity_id IS NOT NULL`

**RLS:**
- `meta_jwt_select` — SELECT for authenticated channel members who can see the parent `channel_message` (membership + visibility_scope check).
- `meta_jwt_update` — UPDATE for own-message sender + manager+ (future edit-after-publish path; no application code uses this yet).
- No INSERT policy — SECURITY DEFINER RPC is the sole write path.
- No DELETE policy — CASCADE from parent `channel_message`.
- `meta_api_select` — workspace API key SELECT.

---

## 2. Tables Used (Shared with Communication Domain)

### 2.1 `channel_message` — the announcement row

**Migration:** `20260422300000_channel_communications.sql` (foundation, owned by communication). Wave B adds announcement classification via sidecar; `channel_message` schema is unchanged (ADR-0371).

Announcement-relevant columns:

| Column | Announcement use |
|---|---|
| `message_type` | `'announcement'` is the discriminator. Enum: `channel_message_type` |
| `system_data` | Composers write `{ audience_kind, audience_label }` and (Day-Control) `{ broadcast_type, session_id, source:'day_control' }` |
| `delivery_mode` | `notification_only` for Day-Control broadcasts (suppresses feed appearance); `timeline` for bulletin-board composers |
| `visibility_scope` | `all_members` or `targeted_members`. When `targeted_members`, RLS checks `target_profile_ids` |
| `target_profile_ids` | uuid[] populated when `visibility_scope='targeted_members'` |
| `is_pinned` + `pinned_by` + `pinned_at` | Pin state |
| `deleted_at` | Soft-delete |
| `client_message_id` | UNIQUE per channel — idempotency for optimistic UI |

Full column list in `docs/domains/communication/DATA-MODEL.md` (communication domain owns the table).

---

## 3. Enums

### 3.1 `announcement_kind` (Wave B)

**Migration:** `20260620140100_announcement_enums.sql` + `20260620140700_announcement_kind_add_celebration_and_system_message.sql`

| Value | When added | Default tier |
|---|---|---|
| `general` | M1 | `work` |
| `new_menu` | M1 | `work` |
| `new_hire` | M1 | `social` |
| `staff_event` | M1 | `social` |
| `schedule_change` | M1 | `work` |
| `policy_update` | M1 | `work` |
| `external` | M1 | `external` |
| `celebration` | M7 (`ALTER TYPE ADD VALUE`) | `social` |
| `system_message` | M7 (`ALTER TYPE ADD VALUE`) | `work` |

### 3.2 `announcement_tier` (Wave B)

**Migration:** `20260620140100_announcement_enums.sql`

| Value | Priority | Mode | Channels |
|---|---|---|---|
| `social` | 0 | `community` | push, in_app |
| `work` | 1 | `work` | push, in_app |
| `external` | 2 | `work` | push, in_app, email |

### 3.3 `announcement_link_type` (Wave B)

**Migration:** `20260620140100_announcement_enums.sql`

Values: `staff_event`, `schedule_shift`, `policy`, `protocol`, `profile`, `menu_document`, `external_url`.

### 3.4 Pre-existing enums (communication-owned, used by announcements)

| Enum | Announcement-relevant values |
|---|---|
| `channel_message_type` | `announcement` is the discriminator |
| `comm_channel_type` | `news` is the canonical container |
| `channel_delivery_mode` | `notification_only` used by Day-Control path |
| `channel_message_visibility` | `all_members` / `targeted_members` |

---

## 4. RPC and Functions

| Object | Migration | Signature | Role |
|---|---|---|---|
| `publish_announcement_atomic` | M4 (140400) + M13 (141300 celebration) + M17 (141700 drop 14-param overload) | 16 params (see below) | SECURITY DEFINER — sole write path for announcements |
| `fn_publish_announcement_notifications` | M3 (140300) | `(message_id, channel_id, workspace_id, sender_id, content, tier, visibility_scope, target_profile_ids)` | Fan-out helper; called inline by RPC body only |
| `get_channel_messages` (extended) | M6 (140600) | `(channel_id, cursor, limit)` | Returns announcement_meta columns (kind, tier, tags, entity_link_type, entity_link_id) as nullable additions to base shape |

**`publish_announcement_atomic` 16-param signature (canonical post-M17):**

```
p_workspace_id, p_actor_profile_id, p_channel_id, p_content,
p_visibility_scope, p_target_profile_ids, p_system_data,
p_kind, p_tier, p_tags, p_linked_entity_type, p_linked_entity_id,
p_tier_overridden, p_client_message_id,
p_celebration_kind, p_celebration_date
```

Last 2 params are celebration-branch only; default NULL for non-celebration kinds.

**Trigger (amended):** `trigger_channel_message_notification` at `20260620140500_channel_message_trigger_announcement_guard.sql` — AFTER INSERT on `channel_message`; early-returns `NEW` when `message_type='announcement'` to prevent double fan-out.

---

## 5. Migration Phase Map

| Phase | Migrations | What it adds |
|---|---|---|
| **Foundation (communication)** | 20260422300000–310100 | channel, channel_message, enums, RLS, notification trigger |
| **Priority routing (Wave A)** | 20260528020000 | Trigger branch: `message_type='announcement'` → `priority=1, mode='work'` |
| **Wave B M1–M7** | 20260620140100–140700 | 3 enums + `announcement_meta` table + `fn_publish_announcement_notifications` + `publish_announcement_atomic` RPC + trigger guard + `get_channel_messages` extended + `celebration`/`system_message` kind values |
| **Celebration branch** | 20260620141300 | Celebration-branch logic in RPC (ADR-0372); 16-param signature |
| **Celebration fix** | 20260620141600 | Bug fix to celebration branch |
| **Drop overload** | 20260620141700 | Drop 14-param orphan overload (PGRST203 prevention) |

---

## 6. Telemetry

**Registry:** `packages/telemetry/src/registry.ts` (grep: `channel.message.sent`, `communication.broadcast_sent`, `news.post.created`, `news.post.reacted`).

**Emit helper:** `packages/ai/src/capabilities/communication/emit-announcement-events.ts` (all 4 composer paths share this post-publish emit — grep: `AnnouncementPublishedPayload`).

| Event | Properties | Destinations |
|---|---|---|
| `channel.message.sent` | `channel_id`, `origin_type`, `message_type`, `visibility_scope`, `target_profile_count`, `audience_kind`, `notification_priority`, `notification_mode`, `kind`, `tier` (extended V2) | posthog, logger, activity_trail |
| `channel.message.pinned` | base | posthog, logger, activity_trail |
| `channel.message.unpinned` | base | posthog, logger, activity_trail |
| `communication.broadcast_sent` | `{ source, recipient_count, channel_id }` | activity_trail, posthog |
| `news.post.created` | `channel_id` | posthog, logger, activity_trail |
| `news.post.reacted` | `channel_id`, `emoji` | posthog |
| `channel.announcement.published` | publish success | posthog, activity_trail |
| `announcement.kind_changed` | composer onChange | posthog |
| `announcement.tier_overridden` | composer onChange | posthog, activity_trail |
| `announcement.link_followed` | UI onClick | posthog, activity_trail |

---

## 7. Authority Seed

| Capability key | Seed migration | Level | Min role |
|---|---|---|---|
| `communication` (agent path) | `20260601100000_seed_communication_authority.sql:42` | suggest | employee |
| `broadcast.send` (Day-Control server-action) | `20260515110000_seed_day_control_authority.sql:55` + `20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:193` | confirm | manager |

The agent capability tool (`publish-announcement.ts`) uses `capability='communication'` (ADR-0370 Option B). The Day-Control server action uses `broadcast.send` (separate, more restrictive gate). Both paths accept `manager+` in practice; agent path is technically `employee+/suggest` level.

---

## 8. Schema Invariants

1. Every `channel_message WHERE message_type='announcement'` that goes through the RPC gets a corresponding `announcement_meta` row (atomicity via single transaction in RPC body — ADR-0369).
2. `announcement_meta.message_id` FK has `ON DELETE CASCADE` — meta row is removed when parent message is soft-deleted's hard-cleanup or when message row is hard-deleted in tests.
3. `linked_entity_type` and `linked_entity_id` are always a matched pair (both NULL or both non-NULL) — enforced by `meta_link_pair_consistent` CHECK.
4. `kind='celebration'` → service-role callers only (ADR-0372). JWT callers receive `CELEBRATION_SERVICE_ROLE_ONLY` error.
5. Pre-Wave-B rows have no `announcement_meta` row (sidecar did not exist for Wave A publishes). `get_channel_messages` returns NULL for the 5 announcement_meta columns for these rows.
6. `client_message_id` is UNIQUE per `(channel_id, client_message_id)` — idempotency for optimistic UI (migration `20260428200000_idempotent_indexes.sql`).
