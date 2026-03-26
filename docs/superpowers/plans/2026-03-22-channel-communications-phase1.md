---
title: "Plan — Channel Communications Phase 1: Messaging"
status: done
updated: 2026-03-26
created: 2026-03-22
module: communications
tags: [channels, chat, messaging, supabase, realtime, phase-1]
---

# Channel Communications Phase 1: Messaging

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the channel messaging domain — persistent channels tied to org structure, with text messaging, reactions, attachments, read tracking, and AI as participant. No voice/video yet (Phase 2).

**Architecture:** New parallel schema (`channel`, `channel_member`, `channel_message`, `channel_event`, etc.) alongside existing `chat_conversation` system. Supabase Realtime for live updates. WhatsApp Business-inspired UI under `/dashboard/channels/`. Same backend serves web + future mobile.

**Tech Stack:** PostgreSQL 17 (Supabase), TypeScript strict, Next.js 16 App Router, React 19, TanStack Query, Supabase Realtime, shadcn/ui, Tailwind v4, `@smartout/telemetry`

**Spec:** `docs/superpowers/specs/2026-03-22-channel-communications-design.md`

---

## Prerequisites

Before starting Task 1, verify:

1. **Helper functions exist:** Run `SELECT proname FROM pg_proc WHERE proname IN ('get_workspace_ids_for_user', 'is_admin_in_workspace', 'get_api_workspace_id', 'set_updated_at');` — all 4 must exist.
2. **Profile role enum:** `profile_role` is `employee | manager | admin | owner`. No `system` value exists. Botsson needs a different approach (see Task 5).
3. **Existing chat tables:** `chat_conversation`, `chat_participant`, `chat_message` exist and remain untouched.

---

## File Structure

### Database

```
supabase/migrations/
  YYYYMMDDHHMMSS_channel_communications.sql       -- Enums, tables, indexes, constraints, triggers
  YYYYMMDDHHMMSS_channel_rls_policies.sql          -- All RLS policies (separate for readability)
  YYYYMMDDHHMMSS_channel_functions.sql             -- create_channel(), read-model RPCs
  YYYYMMDDHHMMSS_channel_seed_botsson.sql          -- Botsson profile seed
  YYYYMMDDHHMMSS_channel_auto_create_triggers.sql  -- Dept/team auto-create triggers
```

### Telemetry

```
packages/telemetry/src/
  registry.ts                     -- ADD: channel entity types, action verbs, event interfaces
```

### Types

```
packages/supabase/src/
  database.types.ts               -- REGENERATE after migration
```

### Web UI — Hooks

```
apps/web/src/app/dashboard/channels/
  _hooks/
    channel-keys.ts               -- TanStack Query key factory
    channel-types.ts              -- TypeScript types from database.types.ts
    use-channels.ts               -- Channel list via RPC
    use-channel-messages.ts       -- Messages via RPC with cursor pagination
    use-channel-realtime.ts       -- Supabase Realtime subscription
    use-send-message.ts           -- Send message mutation (optimistic + idempotent)
    use-reactions.ts              -- Toggle reaction mutation
    use-mark-as-read.ts           -- Mark channel as read
    use-create-channel.ts         -- Create channel via create_channel() RPC
    use-channel-members.ts        -- Members query + add/remove
    use-unread-counts.ts          -- Unread counts via RPC
```

### Web UI — Components

```
apps/web/src/app/dashboard/channels/
  page.tsx                        -- Server component wrapper
  loading.tsx                     -- Suspense fallback
  _components/
    ChannelsPageClient.tsx        -- "use client" entry (consumes DashboardContext)
    ChannelShell.tsx              -- 3-column layout
    ChannelList.tsx               -- Left panel: grouped by type
    ChannelItem.tsx               -- Single row in list
    ChannelHeader.tsx             -- Title bar + actions
    MessageTimeline.tsx           -- Scrollable message area
    MessageBubble.tsx             -- Single user message
    SystemMessage.tsx             -- Brief/handoff/reminder/summary
    MessageInput.tsx              -- Text input + send
    ReplyPreview.tsx              -- "Replying to..." banner
    MemberPanel.tsx               -- Right panel: member list
    CreateChannel.tsx             -- Modal: create custom/direct
```

---

## Task Breakdown

### Task 1: Database Migration — Enums

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql`

- [ ] **Step 1: Create migration file with all 16 enum definitions**

All enums from spec Section 3.1. Each wrapped in `DO $$ BEGIN IF NOT EXISTS ... END $$;` guard. The 16 enums: `comm_channel_type`, `channel_message_type`, `channel_origin_type`, `channel_delivery_mode`, `channel_message_visibility`, `channel_audio_policy`, `channel_video_policy`, `channel_recording_policy`, `channel_ai_voice_policy`, `channel_member_role`, `channel_call_status`, `channel_presence_status`, `channel_integration_status`, `channel_ai_text_mode`, `channel_ai_voice_mode`, `channel_notification_priority`.

- [ ] **Step 2: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<filename>.sql`
Verify: `SELECT typname FROM pg_type WHERE typname LIKE 'channel%' OR typname LIKE 'comm_%';` returns 16 rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql
git commit -m "feat(channels): add 16 channel communication enums"
```

---

### Task 2: Database Migration — Core Tables + Constraints

**Files:**

- Modify: `supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql` (append)

**Context:** All FKs use `profile(profile_id)` and `workspace(workspace_id)` per spec convention. All tables with `updated_at` get `set_updated_at()` trigger.

- [ ] **Step 1: Add `channel` table**

Per spec Section 3.1. Include `direct_pair_hash text` column.

Uniqueness constraints (critical for trigger safety):

```sql
CREATE UNIQUE INDEX idx_channel_direct_pair
  ON channel(workspace_id, direct_pair_hash) WHERE direct_pair_hash IS NOT NULL;
CREATE UNIQUE INDEX idx_channel_one_per_department
  ON channel(department_id) WHERE department_id IS NOT NULL AND is_archived = false;
CREATE UNIQUE INDEX idx_channel_one_per_team
  ON channel(team_id) WHERE team_id IS NOT NULL AND is_archived = false;
CREATE UNIQUE INDEX idx_channel_one_per_session
  ON channel(session_id) WHERE session_id IS NOT NULL AND is_archived = false;
```

- [ ] **Step 2: Add `channel_member` table**

Per spec. Include `workspace_id` for API key RLS. `UNIQUE(channel_id, profile_id)`.

Note: `last_read_message_id` FK added after `channel_message` exists (Step 3). Integrity trigger added in Task 3.

- [ ] **Step 3: Add `channel_message` table**

Per spec. Include `channel_id` as denormalized FK. Include `client_message_id` with partial unique index.

Add deferred FK for `channel_member.last_read_message_id`:

```sql
ALTER TABLE channel_member
  ADD CONSTRAINT channel_member_last_read_fk
  FOREIGN KEY (last_read_message_id) REFERENCES channel_message(id) ON DELETE SET NULL;
```

- [ ] **Step 4: Add `last_read_message_id` integrity trigger**

Ensures `last_read_message_id` references a message in the same channel:

```sql
CREATE OR REPLACE FUNCTION validate_last_read_same_channel()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.last_read_message_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM channel_message
      WHERE id = NEW.last_read_message_id
        AND channel_id = NEW.channel_id
    ) THEN
      RAISE EXCEPTION 'last_read_message_id must reference a message in the same channel';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_last_read
  BEFORE INSERT OR UPDATE OF last_read_message_id ON channel_member
  FOR EACH ROW EXECUTE FUNCTION validate_last_read_same_channel();
```

- [ ] **Step 5: Run migration and verify**

Verify tables exist. Verify uniqueness constraints work (try inserting duplicate department channel — should fail).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql
git commit -m "feat(channels): add channel, channel_member, channel_message with constraints"
```

---

### Task 3: Database Migration — Supporting Tables

**Files:**

- Modify: `supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql` (append)

- [ ] **Step 1: Add `channel_event`**

Per spec. Immutable (no updated_at). Idempotency key with partial unique index. No back-reference to channel_message.

- [ ] **Step 2: Add `channel_message_reaction`**

Per spec. **Include `channel_id`** (denormalized from parent message) for Realtime filter and RLS. `workspace_id` for API key RLS.

```sql
CREATE TABLE IF NOT EXISTS channel_message_reaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES channel_message(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, profile_id, emoji)
);
```

- [ ] **Step 3: Add `channel_message_attachment`**

Per spec. **Include `channel_id`** (same reasoning as reactions).

- [ ] **Step 4: Add `channel_message_read`**

Per spec. Only used when `channel.read_receipts_enabled = true`.

- [ ] **Step 5: Add `event_id` FK on `channel_message`**

```sql
ALTER TABLE channel_message
  ADD CONSTRAINT channel_message_event_fk
  FOREIGN KEY (event_id) REFERENCES channel_event(id) ON DELETE SET NULL;
CREATE INDEX idx_channel_message_event ON channel_message(event_id) WHERE event_id IS NOT NULL;
```

- [ ] **Step 6: Add Subsystem 3 policy tables**

`channel_integration`, `channel_notification_policy`, `channel_ai_policy`, `channel_retention_policy`. All per spec Section 3.3. All have `workspace_id`, `set_updated_at()` triggers, RLS enabled.

- [ ] **Step 7: Run migration and verify**

All tables present. Reactions have `channel_id`. Attachments have `channel_id`.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql
git commit -m "feat(channels): add event, reaction, attachment, read, policy tables"
```

---

### Task 4: Database Migration — RLS Policies

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_channel_rls_policies.sql`

**Critical rule:** Child tables (reaction, attachment, read, presence, call participant) must authorize via **channel membership**, not generic workspace membership. Workspace-level policies only for admin/config tables (integration, notification_policy, ai_policy, retention_policy).

- [ ] **Step 1: `channel` policies**

Per spec Section 3.4:

- `channel_jwt_select`: active member check
- `channel_jwt_insert`: restricted to `custom`/`direct` types + workspace member (all other types created by system/triggers)
- `channel_jwt_update`: channel admin only
- `channel_api_select`: workspace-scoped

- [ ] **Step 2: `channel_member` policies**

Per spec:

- SELECT: members of channels you belong to
- INSERT: channel admin
- UPDATE: own record only (mute, read pointer)
- DELETE: self or admin
- API key: workspace-scoped

- [ ] **Step 3: `channel_message` policies**

Per spec. SELECT includes visibility_scope check. INSERT requires membership + sender = self. UPDATE/DELETE on own messages only.

- [ ] **Step 4: `channel_event` policies**

SELECT: channel member. INSERT: service role only.

- [ ] **Step 5: Channel-child table policies (membership-scoped)**

For `channel_message_reaction`, `channel_message_attachment`, `channel_message_read`:

```sql
-- Example: reaction SELECT requires membership in the parent channel
CREATE POLICY "reaction_jwt_select" ON channel_message_reaction FOR SELECT USING (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

-- INSERT: member of channel + own profile
CREATE POLICY "reaction_jwt_insert" ON channel_message_reaction FOR INSERT WITH CHECK (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
  AND profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- DELETE: own reactions only
CREATE POLICY "reaction_jwt_delete" ON channel_message_reaction FOR DELETE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- API key
CREATE POLICY "reaction_api_select" ON channel_message_reaction FOR SELECT
  USING (workspace_id = get_api_workspace_id());
```

Same pattern for attachment and read tables.

- [ ] **Step 6: Admin/config table policies (workspace-scoped)**

For `channel_integration`, `channel_notification_policy`, `channel_ai_policy`, `channel_retention_policy`:

- JWT SELECT: `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))`
- JWT INSERT/UPDATE: workspace admin check via `is_admin_in_workspace()`
- API key: workspace-scoped

- [ ] **Step 7: Run migration and test**

Test: with a JWT, `SELECT * FROM channel;` returns empty (no membership). Insert a member, then SELECT works.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_rls_policies.sql
git commit -m "feat(channels): add membership-scoped RLS for all channel tables"
```

---

### Task 5: Database Functions — create_channel() + Botsson Seed

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_channel_functions.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_channel_seed_botsson.sql`

**Critical rule:** ALL user-created channels go through `create_channel()`. No raw INSERT from client.

- [ ] **Step 1: Write `create_channel()` SECURITY DEFINER function**

```sql
CREATE OR REPLACE FUNCTION create_channel(
  p_workspace_id uuid,
  p_channel_type public.comm_channel_type,
  p_name text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_member_profile_ids uuid[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_channel_id uuid;
  v_pair_hash text;
  v_pid uuid;
  v_creator_role text;
BEGIN
  -- Permission checks by type
  IF p_channel_type = 'custom' THEN
    SELECT role::text INTO v_creator_role FROM public.profile
      WHERE profile_id = p_created_by AND workspace_id = p_workspace_id;
    IF v_creator_role NOT IN ('manager', 'admin', 'owner') THEN
      RAISE EXCEPTION 'Only manager/admin/owner can create custom channels';
    END IF;
  ELSIF p_channel_type = 'direct' THEN
    -- Validate exactly 2 distinct members
    IF p_member_profile_ids IS NULL OR array_length(p_member_profile_ids, 1) != 2 THEN
      RAISE EXCEPTION 'Direct channels require exactly 2 members';
    END IF;
    IF p_member_profile_ids[1] = p_member_profile_ids[2] THEN
      RAISE EXCEPTION 'Direct channel members must be distinct';
    END IF;
    -- Caller must be one of the two members
    IF p_created_by != p_member_profile_ids[1] AND p_created_by != p_member_profile_ids[2] THEN
      RAISE EXCEPTION 'Caller must be a member of the direct channel';
    END IF;
    -- Both must belong to same workspace
    IF NOT EXISTS (
      SELECT 1 FROM public.profile WHERE profile_id = p_member_profile_ids[1] AND workspace_id = p_workspace_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.profile WHERE profile_id = p_member_profile_ids[2] AND workspace_id = p_workspace_id
    ) THEN
      RAISE EXCEPTION 'Both members must belong to the workspace';
    END IF;
    -- Compute pair hash (sorted for determinism)
    IF p_member_profile_ids[1]::text < p_member_profile_ids[2]::text THEN
      v_pair_hash := p_member_profile_ids[1]::text || ':' || p_member_profile_ids[2]::text;
    ELSE
      v_pair_hash := p_member_profile_ids[2]::text || ':' || p_member_profile_ids[1]::text;
    END IF;
    -- Idempotent: return existing (even if archived — reactivate)
    SELECT id INTO v_channel_id FROM public.channel
      WHERE workspace_id = p_workspace_id AND direct_pair_hash = v_pair_hash;
    IF v_channel_id IS NOT NULL THEN
      UPDATE public.channel SET is_archived = false, updated_at = now()
        WHERE id = v_channel_id AND is_archived = true;
      RETURN jsonb_build_object('channel_id', v_channel_id, 'created', false);
    END IF;
  ELSIF p_channel_type IN ('department', 'team', 'session', 'skill', 'news') THEN
    RAISE EXCEPTION 'Channel type % can only be created by system triggers or admin functions', p_channel_type;
  END IF;

  -- Insert channel
  INSERT INTO public.channel (workspace_id, channel_type, name, created_by, direct_pair_hash)
  VALUES (p_workspace_id, p_channel_type, p_name, p_created_by, v_pair_hash)
  RETURNING id INTO v_channel_id;

  -- Add creator as admin
  IF p_created_by IS NOT NULL THEN
    INSERT INTO public.channel_member (channel_id, workspace_id, profile_id, role)
    VALUES (v_channel_id, p_workspace_id, p_created_by, 'admin')
    ON CONFLICT (channel_id, profile_id) DO NOTHING;
  END IF;

  -- Add specified members
  IF p_member_profile_ids IS NOT NULL THEN
    FOREACH v_pid IN ARRAY p_member_profile_ids LOOP
      INSERT INTO public.channel_member (channel_id, workspace_id, profile_id, role)
      VALUES (v_channel_id, p_workspace_id, v_pid, 'member')
      ON CONFLICT (channel_id, profile_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('channel_id', v_channel_id, 'created', true);
END;
$$;
```

- [ ] **Step 2: Write Botsson seed migration**

`profile_role` enum does not have `system`. Two options:

- **Option A:** `ALTER TYPE profile_role ADD VALUE IF NOT EXISTS 'system';` then seed with role=system
- **Option B:** Use role=`employee` with a dedicated `is_system_profile boolean DEFAULT false` column

**Choose Option A** (cleaner, role is semantic).

**Before running:** Search for exhaustive `profile_role` matches in the codebase — UI role badges, permission checks, switch statements. If any assume the enum is only `employee | manager | admin | owner`, they must be updated to handle `system`. Run: `grep -r "profile_role\|ProfileRole\|role.*employee.*manager.*admin.*owner" apps/ packages/ --include="*.ts" --include="*.tsx" -l`

Then seed:

```sql
ALTER TYPE profile_role ADD VALUE IF NOT EXISTS 'system';

-- Botsson needs a deterministic unique identity per workspace.
-- Use a well-known UUID namespace for Botsson user_id.
-- Actual auth.users entry created via admin API or existing service user.
-- This migration only creates profile rows for workspaces that lack one.

DO $$
DECLARE
  ws RECORD;
  v_botsson_user_id uuid;
BEGIN
  -- Look up existing Botsson service user (created during infra setup)
  SELECT id INTO v_botsson_user_id FROM auth.users
    WHERE email = 'botsson@system.smartout.ai' LIMIT 1;

  IF v_botsson_user_id IS NULL THEN
    RAISE NOTICE 'Botsson service user not found in auth.users. Create it via admin API first.';
    RETURN;
  END IF;

  FOR ws IN SELECT workspace_id FROM workspace LOOP
    INSERT INTO profile (workspace_id, user_id, full_name, display_name, role, is_active)
    VALUES (ws.workspace_id, v_botsson_user_id, 'Mr. Botsson', 'Mr. Botsson', 'system', true)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END LOOP;
END $$;
```

Note: `ON CONFLICT (workspace_id, user_id)` requires this unique constraint to exist on profile. Verify before running. If not, use a guard query instead.

- [ ] **Step 3: Run migrations and verify**

Verify `create_channel()` exists. Test: `SELECT create_channel(ws_id, 'custom', '#test', profile_id);`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_functions.sql
git add supabase/migrations/YYYYMMDDHHMMSS_channel_seed_botsson.sql
git commit -m "feat(channels): add create_channel() function + Botsson seed"
```

---

### Task 6: Regenerate Types + Telemetry Events

**Files:**

- Regenerate: `packages/supabase/src/database.types.ts`
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Regenerate database types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Verify: File contains `channel`, `channel_member`, `channel_message`, `comm_channel_type`.

- [ ] **Step 2: Add channel entity types to telemetry registry**

Add to `EntityType`: `"channel" | "channel_member" | "channel_message" | "channel_event"`
Add to `ActionVerb`: `"joined" | "left" | "pinned" | "unpinned" | "reacted" | "unreacted" | "read"`
Add `EventCategory`: `"channels"`

- [ ] **Step 3: Add event interfaces**

Use **dotted event names** consistently (e.g., `channel.created`, not `channel created`):

```typescript
export interface ChannelCreated extends BaseEvent {
  event: "channel.created";
  properties: { channel_type: string; name: string | null };
  entity: EntityRef;
}
export interface MessageSent extends BaseEvent {
  event: "message.sent";
  properties: { channel_id: string; origin_type: string; message_type: string };
  entity: EntityRef;
}
// ... all events from spec Section 7.2
```

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/database.types.ts packages/telemetry/src/registry.ts
git commit -m "feat(channels): regenerate types + add channel telemetry events"
```

---

### Task 7: Read-Model RPCs

**Files:**

- Modify: `supabase/migrations/YYYYMMDDHHMMSS_channel_functions.sql` (append)

**Context:** Complex queries (channel list with preview, messages with sender/reactions, unread counts) belong in DB RPCs, not ad-hoc Supabase selects. This keeps hooks simple and enables mobile reuse.

- [ ] **Step 1: `get_my_channels()` RPC**

Returns channel list for current user with last message preview and unread count. **Derives profile from `auth.uid()` internally** — caller cannot request another user's channels.

```sql
CREATE OR REPLACE FUNCTION get_my_channels(p_workspace_id uuid)
RETURNS TABLE (
  channel_id uuid,
  workspace_id uuid,
  channel_type comm_channel_type,
  name text,
  description text,
  avatar_url text,
  is_read_only boolean,
  is_archived boolean,
  audio_policy channel_audio_policy,
  video_policy channel_video_policy,
  member_count bigint,
  unread_count bigint,
  last_message_content text,
  last_message_at timestamptz,
  last_message_sender_name text,
  last_message_sender_avatar text
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  -- Derive caller's profile_id from auth.uid() — cannot query another user's channels
  WITH caller AS (
    SELECT profile_id FROM profile
    WHERE user_id = auth.uid() AND workspace_id = p_workspace_id
    LIMIT 1
  )
  SELECT
    c.id AS channel_id,
    c.workspace_id,
    c.channel_type,
    c.name,
    c.description,
    c.avatar_url,
    c.is_read_only,
    c.is_archived,
    c.audio_policy,
    c.video_policy,
    (SELECT count(*) FROM channel_member cm2
      WHERE cm2.channel_id = c.id AND cm2.left_at IS NULL) AS member_count,
    (SELECT count(*) FROM channel_message msg
      WHERE msg.channel_id = c.id
        AND msg.deleted_at IS NULL
        AND msg.delivery_mode = 'timeline'
        AND (cm.last_read_message_id IS NULL
          OR msg.created_at > (SELECT created_at FROM channel_message WHERE id = cm.last_read_message_id))
    ) AS unread_count,
    lm.content AS last_message_content,
    lm.created_at AS last_message_at,
    sp.display_name AS last_message_sender_name,
    sp.avatar_url AS last_message_sender_avatar
  FROM channel c
  JOIN channel_member cm ON cm.channel_id = c.id
    AND cm.profile_id = (SELECT profile_id FROM caller) AND cm.left_at IS NULL
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id FROM channel_message
    WHERE channel_id = c.id AND deleted_at IS NULL AND delivery_mode = 'timeline'
    ORDER BY created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN profile sp ON sp.profile_id = lm.sender_id
  WHERE c.is_archived = false
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
$$;
```

- [ ] **Step 2: `get_channel_messages()` RPC**

Cursor-based pagination. Returns messages with sender profile, reaction aggregation, and attachment list:

```sql
CREATE OR REPLACE FUNCTION get_channel_messages(
  p_channel_id uuid,
  p_cursor timestamptz DEFAULT now(),
  p_limit int DEFAULT 50
) RETURNS TABLE (
  message_id uuid,
  channel_id uuid,
  sender_id uuid,
  sender_name text,
  sender_avatar text,
  sender_role text,
  content text,
  message_type channel_message_type,
  origin_type channel_origin_type,
  visibility_scope channel_message_visibility,
  reply_to_id uuid,
  reply_to_content text,
  reply_to_sender_name text,
  system_data jsonb,
  is_pinned boolean,
  edited_at timestamptz,
  deleted_at timestamptz,
  client_message_id uuid,
  created_at timestamptz,
  reactions jsonb,
  attachments jsonb
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    m.id AS message_id,
    m.channel_id,
    m.sender_id,
    sp.display_name AS sender_name,
    sp.avatar_url AS sender_avatar,
    sp.role::text AS sender_role,
    m.content,
    m.message_type,
    m.origin_type,
    m.visibility_scope,
    m.reply_to_id,
    rt.content AS reply_to_content,
    rtp.display_name AS reply_to_sender_name,
    m.system_data,
    m.is_pinned,
    m.edited_at,
    m.deleted_at,
    m.client_message_id,
    m.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('emoji', r.emoji, 'profile_id', r.profile_id))
      FROM channel_message_reaction r WHERE r.message_id = m.id
    ), '[]'::jsonb) AS reactions,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'file_type', a.file_type, 'url', a.url,
        'filename', a.filename, 'size_bytes', a.size_bytes
      ))
      FROM channel_message_attachment a WHERE a.message_id = m.id
    ), '[]'::jsonb) AS attachments
  FROM channel_message m
  JOIN profile sp ON sp.profile_id = m.sender_id
  LEFT JOIN channel_message rt ON rt.id = m.reply_to_id
  LEFT JOIN profile rtp ON rtp.profile_id = rt.sender_id
  WHERE m.channel_id = p_channel_id
    AND m.created_at < p_cursor
    AND m.delivery_mode = 'timeline'
  ORDER BY m.created_at DESC
  LIMIT p_limit;
$$;
```

- [ ] **Step 3: `get_unread_counts()` RPC**

```sql
CREATE OR REPLACE FUNCTION get_unread_counts(p_workspace_id uuid)
RETURNS TABLE (channel_id uuid, unread_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  -- Derive caller's profile from auth.uid()
  WITH caller AS (
    SELECT profile_id FROM profile
    WHERE user_id = auth.uid() AND workspace_id = p_workspace_id
    LIMIT 1
  )
  SELECT
    cm.channel_id,
    count(msg.id) AS unread_count
  FROM channel_member cm
  JOIN channel c ON c.id = cm.channel_id AND c.is_archived = false
  LEFT JOIN channel_message msg ON msg.channel_id = cm.channel_id
    AND msg.deleted_at IS NULL
    AND msg.delivery_mode = 'timeline'
    AND (cm.last_read_message_id IS NULL
      OR msg.created_at > (SELECT created_at FROM channel_message WHERE id = cm.last_read_message_id))
  WHERE cm.profile_id = (SELECT profile_id FROM caller) AND cm.left_at IS NULL
  GROUP BY cm.channel_id
  HAVING count(msg.id) > 0;
$$;
```

- [ ] **Step 4: Run migration and test RPCs**

Test with a JWT-authenticated session: `SELECT * FROM get_my_channels('some-workspace-id');` — should return empty (no channels yet). Profile derived from `auth.uid()` internally.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_functions.sql
git commit -m "feat(channels): add read-model RPCs (get_my_channels, get_channel_messages, get_unread_counts)"
```

---

### Task 8: Query Key Factory + Types

**Files:**

- Create: `apps/web/src/app/dashboard/channels/_hooks/channel-keys.ts`
- Create: `apps/web/src/app/dashboard/channels/_hooks/channel-types.ts`

- [ ] **Step 1: Create `channel-keys.ts`**

```typescript
export const channelKeys = {
  all: ["channels"] as const,
  list: (workspaceId: string) => ["channels", "list", workspaceId] as const,
  detail: (workspaceId: string, channelId: string) =>
    ["channels", "detail", workspaceId, channelId] as const,
  messages: (workspaceId: string, channelId: string) =>
    ["channels", "messages", workspaceId, channelId] as const,
  members: (workspaceId: string, channelId: string) =>
    ["channels", "members", workspaceId, channelId] as const,
  unread: (workspaceId: string) => ["channels", "unread", workspaceId] as const,
};
```

- [ ] **Step 2: Create `channel-types.ts`**

Derive from `database.types.ts` + define UI composite types (`ChannelWithPreview`, `MessageWithSender`). Follow existing `chat-types.ts` pattern.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_hooks/
git commit -m "feat(channels): add query key factory + TypeScript types"
```

---

### Task 9: Core Hooks

**Files:**

- Create all hooks listed in File Structure

**Critical rule:** All channel creation goes through `create_channel()` RPC. Never raw INSERT.

- [ ] **Step 1: `use-channels.ts`**

Calls `get_my_channels()` RPC via `supabase.rpc('get_my_channels', { p_workspace_id: workspaceId })`. Profile derived from `auth.uid()` inside the RPC — no profile_id parameter needed. Groups results by `channel_type` for the UI.

- [ ] **Step 2: `use-channel-messages.ts`**

Calls `get_channel_messages()` RPC with cursor pagination via `useInfiniteQuery`. `getNextPageParam` uses last message's `created_at`.

- [ ] **Step 3: `use-send-message.ts`**

Mutation: INSERT into `channel_message`. Generates `client_message_id = crypto.randomUUID()` before insert. Optimistic update: prepend to cache. On success: emit `message.sent`. On duplicate `client_message_id`: return existing (idempotent).

- [ ] **Step 4: `use-reactions.ts`**

Toggle: check if own reaction exists (DELETE) or create (INSERT). Must include `channel_id` in insert. Emit `reaction.added` / `reaction.removed`.

- [ ] **Step 5: `use-mark-as-read.ts`**

Update `channel_member.last_read_message_id`. Emit `channel.read`. Invalidate unread counts.

- [ ] **Step 6: `use-create-channel.ts`**

ALL types via `supabase.rpc('create_channel', { ... })`. Returns `{ channel_id, created }`. Emit `channel.created`.

- [ ] **Step 7: `use-channel-members.ts`**

Query members. Add/remove mutations with telemetry.

- [ ] **Step 8: `use-unread-counts.ts`**

Calls `get_unread_counts()` RPC via `supabase.rpc('get_unread_counts', { p_workspace_id: workspaceId })`. Profile derived internally from `auth.uid()`. Used for sidebar badges.

- [ ] **Step 9: Typecheck**

Run: `pnpm turbo typecheck`

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_hooks/
git commit -m "feat(channels): add all data hooks (channels, messages, send, react, read, create, members, unread)"
```

---

### Task 10: Realtime Hook

**Files:**

- Create: `apps/web/src/app/dashboard/channels/_hooks/use-channel-realtime.ts`

**Context:** Subscribe to `channel_message` and `channel_message_reaction` changes. Both tables now have `channel_id`, so we can filter directly. Note: Supabase Realtime requires explicit channel setup — subscriptions are not automatic from RLS.

- [ ] **Step 1: Write `use-channel-realtime.ts`**

```typescript
export function useChannelRealtime(
  workspaceId: string,
  channelId: string | null,
  supabase: SupabaseClient,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!channelId) return;

    const realtimeChannel = supabase
      .channel(`channel:${workspaceId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_message",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: channelKeys.messages(workspaceId, channelId),
          });
          queryClient.invalidateQueries({
            queryKey: channelKeys.list(workspaceId),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_message_reaction",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: channelKeys.messages(workspaceId, channelId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [workspaceId, channelId, supabase, queryClient]);
}
```

- [ ] **Step 2: Verify Supabase Realtime config**

Ensure `channel_message` and `channel_message_reaction` tables have Realtime enabled in Supabase Dashboard (or via migration: `ALTER PUBLICATION supabase_realtime ADD TABLE channel_message, channel_message_reaction;`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_hooks/use-channel-realtime.ts
git commit -m "feat(channels): add Supabase Realtime subscription hook"
```

---

### Task 11: UI — Page Entry + Shell + List

**Files:**

- Create: `apps/web/src/app/dashboard/channels/page.tsx`
- Create: `apps/web/src/app/dashboard/channels/loading.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/ChannelsPageClient.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/ChannelShell.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/ChannelList.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/ChannelItem.tsx`

- [ ] **Step 1: Create `page.tsx` as server wrapper**

```typescript
import { ChannelsPageClient } from "./_components/ChannelsPageClient";

export default function ChannelsPage() {
  return <ChannelsPageClient />;
}
```

- [ ] **Step 2: Create `ChannelsPageClient.tsx` as client entry**

```typescript
"use client";
import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ChannelShell } from "./ChannelShell";

export function ChannelsPageClient() {
  const { profileId } = useContext(DashboardContext);
  if (!profileId) {
    return <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground text-sm">Laster profil...</p>
    </div>;
  }
  return <ChannelShell profileId={profileId} />;
}
```

- [ ] **Step 3: Create `loading.tsx`**

Skeleton loader following existing chat pattern.

- [ ] **Step 4: Create `ChannelShell.tsx`**

3-column flex layout. Manages `activeChannelId` state. Wires all hooks.

- [ ] **Step 5: Create `ChannelList.tsx`**

Groups channels by type. Section headers: Avdelinger, Team, Sesjoner, Kanaler, Direktemeldinger, Nyheter, Ferdigheter. Shows unread badges via `use-unread-counts`.

- [ ] **Step 6: Create `ChannelItem.tsx`**

Row: avatar, name, last message preview, unread badge, timestamp. Active state: `bg-accent border-l-2 border-primary`.

- [ ] **Step 7: Verify renders**

Run: `pnpm --filter web dev`. Navigate to `/dashboard/channels`. Should render empty channel list.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/channels/
git commit -m "feat(channels): add page entry, shell, channel list components"
```

---

### Task 12: UI — Message Area

**Files:**

- Create: `ChannelHeader.tsx`, `MessageTimeline.tsx`, `MessageBubble.tsx`, `SystemMessage.tsx`, `MessageInput.tsx`, `ReplyPreview.tsx`

- [ ] **Step 1: `ChannelHeader.tsx`** — Channel name, member count, settings button. Voice/video buttons disabled (Phase 2 placeholder).

- [ ] **Step 2: `MessageTimeline.tsx`** — Infinite scroll container. Date group separators. "Nye meldinger" indicator.

- [ ] **Step 3: `MessageBubble.tsx`** — Sender avatar, name, content, timestamp, reaction bar, reply button.

- [ ] **Step 4: `SystemMessage.tsx`** — Distinct rendering per `message_type`: system, brief, handoff, announcement, reminder, summary. Muted styling with icon per type.

- [ ] **Step 5: `MessageInput.tsx`** — Text input, send button, attachment icon placeholder.

- [ ] **Step 6: `ReplyPreview.tsx`** — "Svarer [name]..." banner with close button.

- [ ] **Step 7: End-to-end verify** — Create channel via RPC, add messages via SQL, verify rendering.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_components/
git commit -m "feat(channels): add message area components"
```

---

### Task 13: UI — Members + Create Channel

**Files:**

- Create: `MemberPanel.tsx`, `CreateChannel.tsx`

- [ ] **Step 1: `MemberPanel.tsx`** — Right panel: member list, avatar, name, role badge, AI badge.

- [ ] **Step 2: `CreateChannel.tsx`** — Modal. Select type (custom/direct) -> name + description (custom) -> select members -> calls `create_channel()` RPC.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_components/
git commit -m "feat(channels): add MemberPanel + CreateChannel modal"
```

---

### Task 14: Auto-Create Triggers

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_channel_auto_create_triggers.sql`

**Context:** Triggers auto-create channels when departments/teams are created. Profile sync adds/removes members when department changes. Uniqueness constraints from Task 2 make upserts safe.

- [ ] **Step 1: Department channel trigger**

```sql
CREATE OR REPLACE FUNCTION auto_create_department_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
BEGIN
  -- Guarded insert: partial unique indexes cannot be used with ON CONFLICT ON CONSTRAINT
  INSERT INTO public.channel (workspace_id, channel_type, name, department_id)
  SELECT NEW.workspace_id, 'department'::public.comm_channel_type, '#' || lower(NEW.name), NEW.department_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.channel
    WHERE department_id = NEW.department_id
      AND is_archived = false
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_department_channel
  AFTER INSERT ON department
  FOR EACH ROW EXECUTE FUNCTION auto_create_department_channel();
```

- [ ] **Step 2: Team channel trigger**

Same guarded-insert pattern (WHERE NOT EXISTS on team_id + is_archived = false).

- [ ] **Step 3: Profile department-sync trigger**

When `profile.department_id` changes:

- Set `left_at = now()` on old department channel membership (soft-leave, not delete)
- Insert new membership (or reactivate: set `left_at = NULL`)

```sql
CREATE OR REPLACE FUNCTION sync_profile_department_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_old_channel_id uuid;
  v_new_channel_id uuid;
BEGIN
  -- Find old department channel
  IF OLD.department_id IS NOT NULL AND OLD.department_id != NEW.department_id THEN
    SELECT id INTO v_old_channel_id FROM public.channel
      WHERE department_id = OLD.department_id AND is_archived = false LIMIT 1;
    IF v_old_channel_id IS NOT NULL THEN
      UPDATE public.channel_member SET left_at = now()
        WHERE channel_id = v_old_channel_id AND profile_id = NEW.profile_id AND left_at IS NULL;
    END IF;
  END IF;

  -- Find new department channel
  IF NEW.department_id IS NOT NULL THEN
    SELECT id INTO v_new_channel_id FROM public.channel
      WHERE department_id = NEW.department_id AND is_archived = false LIMIT 1;
    IF v_new_channel_id IS NOT NULL THEN
      INSERT INTO public.channel_member (channel_id, workspace_id, profile_id, role)
      VALUES (v_new_channel_id, NEW.workspace_id, NEW.profile_id, 'member')
      ON CONFLICT (channel_id, profile_id) DO UPDATE SET left_at = NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_profile_department
  AFTER UPDATE OF department_id ON profile
  FOR EACH ROW EXECUTE FUNCTION sync_profile_department_channel();
```

- [ ] **Step 4: Run migration and test**

Create a department via SQL. Verify channel auto-created. Change a profile's department. Verify membership changes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_auto_create_triggers.sql
git commit -m "feat(channels): add auto-create triggers for dept/team channels + profile sync"
```

---

### Task 15: Integration — Sidebar Navigation + Manual Test

**Files:**

- Modify: sidebar/navigation component

- [ ] **Step 1: Add "Kanaler" to sidebar**

Find sidebar nav component. Add link to `/dashboard/channels` with `MessageSquare` icon (lucide).

- [ ] **Step 2: Manual integration test**

1. Navigate to `/dashboard/channels`
2. Create a custom channel via modal
3. Send a message
4. Open second browser tab — verify message appears via Realtime
5. React to a message — verify reaction appears
6. Mark as read — verify unread badge clears
7. Create a direct channel — verify idempotent (same pair returns same channel)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/
git commit -m "feat(channels): add sidebar navigation + verify integration"
```

---

### Task 16: Typecheck + Lint + Final Cleanup

- [ ] **Step 1:** Run `pnpm turbo typecheck` — 0 errors
- [ ] **Step 2:** Run `pnpm lint` — fix issues
- [ ] **Step 3:** Commit

```bash
git commit -m "chore(channels): typecheck + lint cleanup"
```

---

## Task Dependencies

```
Task 1 (enums) → Task 2 (core tables + constraints) → Task 3 (supporting tables)
     → Task 4 (RLS) → Task 5 (functions + seed)
     → Task 6 (types + telemetry) → Task 7 (RPCs)
     → Task 8 (keys + types) → Task 9 (hooks) → Task 10 (realtime)
     → Task 11 (shell) → Task 12 (messages) → Task 13 (members)
     → Task 15 (integration)

Task 14 (auto-create triggers) depends on Task 2 (constraints exist)
Task 16 depends on all other tasks
```

Tasks 1-7 are sequential (DB + types). Tasks 8-10 sequential (hooks). Tasks 11-13 sequential (UI). Task 14 can run in parallel with 8-13.

---

## What This Plan Does NOT Cover

- **Phase 2:** LiveKit voice/video
- **Phase 3:** AI participation (Botsson @mention, shift prep, summary pipelines)
- **Phase 4:** Integrations + old chat sunset
- **E2E Tests:** Playwright specs (separate task after stable)
- **Mobile:** React Native channel screens (after web proven)
- **Supabase Realtime authorization:** Private channel subscriptions (document + implement if needed)
