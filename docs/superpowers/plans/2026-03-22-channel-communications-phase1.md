---
title: "Plan — Channel Communications Phase 1: Messaging"
status: draft
updated: 2026-03-22
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

## File Structure

### Database

```
supabase/migrations/
  YYYYMMDDHHMMSS_channel_communications.sql     -- All enums, tables, indexes, RLS, triggers
  YYYYMMDDHHMMSS_channel_seed_botsson.sql        -- Seed Botsson system profile per workspace
  YYYYMMDDHHMMSS_channel_auto_create_triggers.sql -- Triggers for auto-creating dept/team channels
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
    channel-types.ts              -- TypeScript types derived from database.types.ts
    use-channels.ts               -- Channel list query (grouped by type)
    use-channel-messages.ts       -- Infinite query with cursor pagination
    use-channel-realtime.ts       -- Supabase Realtime subscription (messages + reactions)
    use-send-message.ts           -- Send message mutation with optimistic update
    use-reactions.ts              -- Toggle reaction mutation
    use-mark-as-read.ts           -- Mark channel as read mutation
    use-create-channel.ts         -- Create custom/direct channel mutation
    use-channel-members.ts        -- Members query + add/remove mutations
    use-unread-counts.ts          -- Unread counts for sidebar badges
```

### Web UI — Components

```
apps/web/src/app/dashboard/channels/
  page.tsx                        -- Server component entry point
  loading.tsx                     -- Suspense fallback
  _components/
    ChannelShell.tsx              -- "use client" main 3-column layout
    ChannelList.tsx               -- Left panel: channels grouped by type
    ChannelItem.tsx               -- Single row in channel list
    ChannelHeader.tsx             -- Channel title bar + actions
    MessageTimeline.tsx           -- Scrollable message area
    MessageBubble.tsx             -- Single user message
    SystemMessage.tsx             -- Brief/handoff/reminder/summary display
    MessageInput.tsx              -- Text input + attachment + send
    ReplyPreview.tsx              -- "Replying to..." banner
    MemberPanel.tsx               -- Right panel: member list
    CreateChannel.tsx             -- Modal: create custom/direct channel
```

---

## Task Breakdown

### Task 1: Database Migration — Enums

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql`

**Context:** Check existing enums first: `SELECT typname FROM pg_type WHERE typname LIKE 'channel%' OR typname LIKE 'comm_%';`. The spec defines 14 new enums. All must use `IF NOT EXISTS` or a DO block guard.

- [ ] **Step 1: Create migration file with all enum definitions**

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql
-- Part 1: Enums

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comm_channel_type') THEN
    CREATE TYPE comm_channel_type AS ENUM (
      'department', 'team', 'session', 'custom', 'direct', 'news', 'skill'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_message_type') THEN
    CREATE TYPE channel_message_type AS ENUM (
      'text', 'image', 'file', 'voice_clip', 'system', 'brief',
      'handoff', 'announcement', 'reminder', 'summary'
    );
  END IF;
END $$;

-- Repeat for all 14 enums from spec Section 3.1
-- channel_origin_type, channel_delivery_mode, channel_message_visibility,
-- channel_audio_policy, channel_video_policy, channel_recording_policy,
-- channel_ai_voice_policy, channel_member_role, channel_call_status,
-- channel_presence_status, channel_integration_status,
-- channel_ai_text_mode, channel_ai_voice_mode, channel_notification_priority
```

- [ ] **Step 2: Run migration against local Supabase**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<filename>.sql`
Expected: No errors. Verify: `SELECT typname FROM pg_type WHERE typname LIKE 'channel%' OR typname LIKE 'comm_%';` returns 14 rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql
git commit -m "feat(channels): add 14 channel communication enums"
```

---

### Task 2: Database Migration — Core Tables (channel, channel_member, channel_message)

**Files:**

- Modify: `supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql` (append)

**Context:** Read spec Section 3.1 for exact column definitions. All FKs use `profile(profile_id)` and `workspace(workspace_id)`. All tables with `updated_at` get `set_updated_at()` trigger.

- [ ] **Step 1: Add channel table**

```sql
CREATE TABLE IF NOT EXISTS channel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  channel_type comm_channel_type NOT NULL,
  name text,
  description text,
  avatar_url text,
  created_by uuid REFERENCES profile(profile_id),
  department_id uuid REFERENCES department(department_id),
  team_id uuid REFERENCES team(team_id),
  session_id uuid REFERENCES department_session(department_session_id),
  is_read_only boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  read_receipts_enabled boolean NOT NULL DEFAULT false,
  audio_policy channel_audio_policy NOT NULL DEFAULT 'disabled',
  video_policy channel_video_policy NOT NULL DEFAULT 'disabled',
  recording_policy channel_recording_policy NOT NULL DEFAULT 'off',
  ai_voice_policy channel_ai_voice_policy NOT NULL DEFAULT 'disabled',
  allow_user_override boolean NOT NULL DEFAULT true,
  direct_pair_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_channel_workspace ON channel(workspace_id);
CREATE INDEX idx_channel_department ON channel(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_channel_team ON channel(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_channel_session ON channel(session_id) WHERE session_id IS NOT NULL;
CREATE UNIQUE INDEX idx_channel_direct_pair ON channel(workspace_id, direct_pair_hash)
  WHERE direct_pair_hash IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2: Add channel_member table**

```sql
CREATE TABLE IF NOT EXISTS channel_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  role channel_member_role NOT NULL DEFAULT 'member',
  is_ai boolean NOT NULL DEFAULT false,
  last_read_message_id uuid,  -- FK added after channel_message exists
  is_muted boolean NOT NULL DEFAULT false,
  muted_until timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE(channel_id, profile_id)
);

ALTER TABLE channel_member ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_channel_member_channel_active ON channel_member(channel_id) WHERE left_at IS NULL;
CREATE INDEX idx_channel_member_profile_active ON channel_member(profile_id) WHERE left_at IS NULL;
CREATE INDEX idx_channel_member_workspace ON channel_member(workspace_id);
```

- [ ] **Step 3: Add channel_message table**

```sql
CREATE TABLE IF NOT EXISTS channel_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channel(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  sender_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  content text NOT NULL,
  message_type channel_message_type NOT NULL DEFAULT 'text',
  origin_type channel_origin_type NOT NULL DEFAULT 'human',
  origin_id text,
  delivery_mode channel_delivery_mode NOT NULL DEFAULT 'timeline',
  visibility_scope channel_message_visibility NOT NULL DEFAULT 'all_members',
  target_profile_ids uuid[],
  event_id uuid,  -- FK added after channel_event exists
  reply_to_id uuid REFERENCES channel_message(id) ON DELETE SET NULL,
  system_data jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  pinned_by uuid REFERENCES profile(profile_id),
  pinned_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  client_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel_message ENABLE ROW LEVEL SECURITY;

-- Add deferred FK from channel_member
ALTER TABLE channel_member
  ADD CONSTRAINT channel_member_last_read_fk
  FOREIGN KEY (last_read_message_id) REFERENCES channel_message(id) ON DELETE SET NULL;

CREATE INDEX idx_channel_message_channel_created ON channel_message(channel_id, created_at DESC);
CREATE INDEX idx_channel_message_workspace ON channel_message(workspace_id);
CREATE INDEX idx_channel_message_reply_to ON channel_message(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE UNIQUE INDEX idx_channel_message_client_id ON channel_message(channel_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON channel_message
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 4: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<filename>.sql`
Expected: No errors. Verify tables exist: `\dt channel*`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql
git commit -m "feat(channels): add channel, channel_member, channel_message tables"
```

---

### Task 3: Database Migration — Supporting Tables

**Files:**

- Modify: `supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql` (append)

**Context:** `channel_event`, `channel_message_reaction`, `channel_message_attachment`, `channel_message_read`. Plus Subsystem 3 policy tables.

- [ ] **Step 1: Add channel_event**

Per spec Section 3.1. No `updated_at` (immutable). Idempotency key with partial unique index.

- [ ] **Step 2: Add channel_message_reaction**

Per spec. Includes `workspace_id` for API key RLS. `UNIQUE(message_id, profile_id, emoji)`.

- [ ] **Step 3: Add channel_message_attachment**

Per spec. Includes `workspace_id`.

- [ ] **Step 4: Add channel_message_read**

Per spec. Only used when `channel.read_receipts_enabled = true`. `UNIQUE(message_id, profile_id)`.

- [ ] **Step 5: Add event_id FK on channel_message**

```sql
ALTER TABLE channel_message
  ADD CONSTRAINT channel_message_event_fk
  FOREIGN KEY (event_id) REFERENCES channel_event(id) ON DELETE SET NULL;

CREATE INDEX idx_channel_message_event ON channel_message(event_id) WHERE event_id IS NOT NULL;
```

- [ ] **Step 6: Add Subsystem 3 policy tables**

`channel_integration`, `channel_notification_policy`, `channel_ai_policy`, `channel_retention_policy`. All per spec Section 3.3. All have `workspace_id`, `set_updated_at()` triggers, RLS enabled.

- [ ] **Step 7: Run migration and verify**

Run migration. Verify all tables: `\dt channel*` should show 11 tables + `call_log` (Phase 2).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql
git commit -m "feat(channels): add event, reaction, attachment, read, policy tables"
```

---

### Task 4: Database Migration — RLS Policies

**Files:**

- Modify: `supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql` (append)

**Context:** Read spec Section 3.4 for complete SQL. Every table needs JWT SELECT + API key SELECT. Core tables (channel, channel_member, channel_message) need INSERT/UPDATE/DELETE too.

- [ ] **Step 1: Add channel RLS policies**

Copy exact SQL from spec Section 3.4: `channel_jwt_select`, `channel_jwt_insert` (gated to custom/direct), `channel_jwt_update` (admin only), `channel_api_select`.

- [ ] **Step 2: Add channel_member RLS policies**

`member_jwt_select`, `member_jwt_insert`, `member_jwt_update`, `member_jwt_delete`, `member_api_select`.

- [ ] **Step 3: Add channel_message RLS policies**

`message_jwt_select` (with visibility_scope check), `message_jwt_insert`, `message_jwt_update`, `message_jwt_delete`, `message_api_select`.

- [ ] **Step 4: Add channel_event RLS policies**

`event_jwt_select`, `event_api_select`. Insert is service_role only.

- [ ] **Step 5: Add remaining table RLS policies**

For `channel_message_reaction`, `channel_message_attachment`, `channel_message_read`, `channel_integration`, `channel_notification_policy`, `channel_ai_policy`, `channel_retention_policy`:

- JWT SELECT: `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))`
- JWT INSERT/DELETE: own profile scoped
- API key SELECT: `workspace_id = get_api_workspace_id()`

- [ ] **Step 6: Run migration and test RLS**

Run migration. Test with a JWT: `SELECT * FROM channel;` should return empty (no membership yet).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql
git commit -m "feat(channels): add RLS policies for all channel tables"
```

---

### Task 5: Database Migration — create_channel() Function + Botsson Seed

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_channel_seed_botsson.sql`
- Modify: `supabase/migrations/YYYYMMDDHHMMSS_channel_communications.sql` (append create_channel function)

**Context:** `create_channel()` is a SECURITY DEFINER function that enforces channel creation rules (spec Section 12). Direct channels compute `direct_pair_hash` for uniqueness. Botsson needs a system profile per workspace.

- [ ] **Step 1: Write create_channel() function**

```sql
CREATE OR REPLACE FUNCTION create_channel(
  p_workspace_id uuid,
  p_channel_type comm_channel_type,
  p_name text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_member_profile_ids uuid[] DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_channel_id uuid;
  v_pair_hash text;
  v_pid uuid;
BEGIN
  -- Direct channel: enforce exactly 2 members + compute pair hash
  IF p_channel_type = 'direct' THEN
    IF array_length(p_member_profile_ids, 1) != 2 THEN
      RAISE EXCEPTION 'Direct channels require exactly 2 members';
    END IF;
    -- Sort for deterministic hash
    IF p_member_profile_ids[1]::text < p_member_profile_ids[2]::text THEN
      v_pair_hash := p_member_profile_ids[1]::text || ':' || p_member_profile_ids[2]::text;
    ELSE
      v_pair_hash := p_member_profile_ids[2]::text || ':' || p_member_profile_ids[1]::text;
    END IF;

    -- Check for existing
    SELECT id INTO v_channel_id FROM channel
      WHERE workspace_id = p_workspace_id AND direct_pair_hash = v_pair_hash;
    IF v_channel_id IS NOT NULL THEN
      RETURN v_channel_id;  -- Idempotent: return existing
    END IF;
  END IF;

  INSERT INTO channel (workspace_id, channel_type, name, created_by, direct_pair_hash)
  VALUES (p_workspace_id, p_channel_type, p_name, p_created_by, v_pair_hash)
  RETURNING id INTO v_channel_id;

  -- Add creator as admin (if human-created)
  IF p_created_by IS NOT NULL THEN
    INSERT INTO channel_member (channel_id, workspace_id, profile_id, role)
    VALUES (v_channel_id, p_workspace_id, p_created_by, 'admin');
  END IF;

  -- Add specified members
  IF p_member_profile_ids IS NOT NULL THEN
    FOREACH v_pid IN ARRAY p_member_profile_ids LOOP
      INSERT INTO channel_member (channel_id, workspace_id, profile_id, role)
      VALUES (v_channel_id, p_workspace_id, v_pid, 'member')
      ON CONFLICT (channel_id, profile_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_channel_id;
END;
$$;
```

- [ ] **Step 2: Write Botsson seed migration**

```sql
-- For each existing workspace, create a Botsson system profile if not exists
-- This is a one-time seed. New workspaces get Botsson during onboarding finalization.
DO $$
DECLARE
  ws RECORD;
  v_user_id uuid;
BEGIN
  -- Find or create the Botsson service user
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'botsson@system.smartout.ai';
  IF v_user_id IS NULL THEN
    -- Service user creation should be done via Supabase admin API
    -- For seed: skip if no service user exists yet
    RAISE NOTICE 'Botsson service user not found. Skipping seed.';
    RETURN;
  END IF;

  FOR ws IN SELECT workspace_id FROM workspace LOOP
    INSERT INTO profile (workspace_id, user_id, full_name, display_name, role, is_active)
    VALUES (ws.workspace_id, v_user_id, 'Mr. Botsson', 'Mr. Botsson', 'system', true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
```

- [ ] **Step 3: Run migrations and verify**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(channels): add create_channel() function + Botsson seed"
```

---

### Task 6: Regenerate Types + Add Telemetry Events

**Files:**

- Regenerate: `packages/supabase/src/database.types.ts`
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Regenerate database types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

Verify: File contains `channel`, `channel_member`, `channel_message`, `comm_channel_type` etc.

- [ ] **Step 2: Add channel entity types to telemetry registry**

In `packages/telemetry/src/registry.ts`, add to `EntityType`:

```typescript
| "channel"
| "channel_member"
| "channel_message"
| "channel_event"
```

Add to `ActionVerb`:

```typescript
| "joined"
| "left"
| "pinned"
| "unpinned"
| "reacted"
| "unreacted"
| "read"
```

Add `EventCategory`: `"channels"` (separate from existing `"communication"` which covers notifications).

- [ ] **Step 3: Add channel event interfaces**

Add event type interfaces following existing pattern (e.g., `AuthSignedUp`):

```typescript
export interface ChannelCreated extends BaseEvent {
  event: "channel created";
  properties: { channel_type: string; name: string | null };
  entity: EntityRef;
}
// ... for all events in spec Section 7.2
```

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/database.types.ts packages/telemetry/src/registry.ts
git commit -m "feat(channels): regenerate types + add channel telemetry events"
```

---

### Task 7: Query Key Factory + Types

**Files:**

- Create: `apps/web/src/app/dashboard/channels/_hooks/channel-keys.ts`
- Create: `apps/web/src/app/dashboard/channels/_hooks/channel-types.ts`

- [ ] **Step 1: Create channel-keys.ts**

Follow pattern from `chat-keys.ts`:

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

- [ ] **Step 2: Create channel-types.ts**

Derive types from regenerated `database.types.ts`:

```typescript
import type { Database } from "@smartout/supabase/database.types";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type ChannelRow = Tables["channel"]["Row"];
export type ChannelMemberRow = Tables["channel_member"]["Row"];
export type ChannelMessageRow = Tables["channel_message"]["Row"];
export type ChannelEventRow = Tables["channel_event"]["Row"];
export type ChannelType = Enums["comm_channel_type"];
export type ChannelMessageType = Enums["channel_message_type"];

export type ChannelProfile = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

export type ChannelWithPreview = ChannelRow & {
  member_count: number;
  last_message: {
    content: string;
    created_at: string;
    sender: ChannelProfile;
  } | null;
  unread_count: number;
};

export type MessageWithSender = ChannelMessageRow & {
  sender: ChannelProfile;
  reply_to: {
    id: string;
    content: string;
    sender: ChannelProfile;
  } | null;
  reactions: Array<{ emoji: string; count: number; reacted_by_me: boolean }>;
  attachments: Array<{
    id: string;
    file_type: string;
    url: string;
    filename: string;
  }>;
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_hooks/
git commit -m "feat(channels): add query key factory + TypeScript types"
```

---

### Task 8: Core Hooks — useChannels + useChannelMessages

**Files:**

- Create: `apps/web/src/app/dashboard/channels/_hooks/use-channels.ts`
- Create: `apps/web/src/app/dashboard/channels/_hooks/use-channel-messages.ts`

**Context:** Follow pattern from existing `use-conversations.ts` and `use-messages.ts`. Use `@tanstack/react-query` with `useQuery` and `useInfiniteQuery`.

- [ ] **Step 1: Write use-channels.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { channelKeys } from "./channel-keys";
import type { ChannelWithPreview } from "./channel-types";
// Query: fetch channels with last_message, member_count, unread_count
// Group by channel_type for the UI list
```

Supabase query pattern:

```typescript
const { data } = await supabase
  .from("channel")
  .select(
    `
    *,
    members:channel_member!inner(count),
    last_message:channel_message(content, created_at, sender:profile!sender_id(profile_id, display_name, avatar_url))
  `,
  )
  .eq("is_archived", false)
  .order("updated_at", { ascending: false });
```

- [ ] **Step 2: Write use-channel-messages.ts**

```typescript
import { useInfiniteQuery } from "@tanstack/react-query";
// Cursor-based pagination: 50 messages per page, ordered by created_at DESC
// Join sender profile, reply_to message + sender, reactions (aggregated), attachments
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm turbo typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_hooks/use-channels.ts
git add apps/web/src/app/dashboard/channels/_hooks/use-channel-messages.ts
git commit -m "feat(channels): add useChannels + useChannelMessages hooks"
```

---

### Task 9: Mutation Hooks — useSendMessage + useReactions + useMarkAsRead

**Files:**

- Create: `apps/web/src/app/dashboard/channels/_hooks/use-send-message.ts`
- Create: `apps/web/src/app/dashboard/channels/_hooks/use-reactions.ts`
- Create: `apps/web/src/app/dashboard/channels/_hooks/use-mark-as-read.ts`
- Create: `apps/web/src/app/dashboard/channels/_hooks/use-create-channel.ts`
- Create: `apps/web/src/app/dashboard/channels/_hooks/use-channel-members.ts`
- Create: `apps/web/src/app/dashboard/channels/_hooks/use-unread-counts.ts`

**Context:** Every mutation emits via `@smartout/telemetry`. Follow pattern from existing chat hooks. `useSendMessage` includes optimistic update. `client_message_id` generated client-side as UUID for idempotent retry.

- [ ] **Step 1: Write use-send-message.ts with optimistic update**

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emit } from "@smartout/telemetry";
import { v4 as uuid } from "uuid";
// Generate client_message_id = uuid() before insert
// Optimistic: prepend to cache immediately
// onSuccess: emit("message.sent", ...)
// onError: rollback
// onSettled: invalidate messages + channels
```

- [ ] **Step 2: Write use-reactions.ts**

Toggle reaction: check if exists (DELETE) or create (INSERT). Emit `reaction.added` / `reaction.removed`.

- [ ] **Step 3: Write use-mark-as-read.ts**

Update `channel_member.last_read_message_id` for current profile. Emit `channel.read`.

- [ ] **Step 4: Write use-create-channel.ts**

Call `create_channel()` RPC for direct channels (idempotent). For custom: standard INSERT. Emit `channel.created`.

- [ ] **Step 5: Write use-channel-members.ts**

Query members + add/remove mutations. Emit `channel.member_joined` / `channel.member_left`.

- [ ] **Step 6: Write use-unread-counts.ts**

Query unread count per channel: `SELECT count(*) FROM channel_message WHERE created_at > (SELECT cm.last_read_message_id...)`.

- [ ] **Step 7: Typecheck**

Run: `pnpm turbo typecheck`

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_hooks/
git commit -m "feat(channels): add mutation hooks (send, react, read, create, members)"
```

---

### Task 10: Realtime Hook

**Files:**

- Create: `apps/web/src/app/dashboard/channels/_hooks/use-channel-realtime.ts`

**Context:** Follow pattern from `use-chat-realtime.ts`. Subscribe to `channel_message` and `channel_message_reaction` changes for the active channel. Invalidate TanStack Query cache on events.

- [ ] **Step 1: Write use-channel-realtime.ts**

```typescript
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { channelKeys } from "./channel-keys";

export function useChannelRealtime(
  workspaceId: string,
  channelId: string | null,
  supabase: SupabaseClient,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
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
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_message_reaction",
          // Reactions don't have channel_id — invalidate via message cache
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: channelKeys.messages(workspaceId, channelId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, channelId, supabase, queryClient]);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_hooks/use-channel-realtime.ts
git commit -m "feat(channels): add Supabase Realtime subscription hook"
```

---

### Task 11: UI Components — ChannelShell + ChannelList + ChannelItem

**Files:**

- Create: `apps/web/src/app/dashboard/channels/page.tsx`
- Create: `apps/web/src/app/dashboard/channels/loading.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/ChannelShell.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/ChannelList.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/ChannelItem.tsx`

**Context:** Follow existing patterns from `dashboard/chat/`. Use `DashboardContext` for `profileId`. Use shadcn/ui components. CSS variables for colors (never hardcoded). The shell is a 3-column layout: list | messages | member panel.

- [ ] **Step 1: Create page.tsx**

```typescript
"use client";
import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ChannelShell } from "./_components/ChannelShell";

export default function ChannelsPage() {
  const { profileId } = useContext(DashboardContext);
  if (!profileId) {
    return <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground text-sm">Laster profil...</p>
    </div>;
  }
  return <ChannelShell profileId={profileId} />;
}
```

- [ ] **Step 2: Create loading.tsx**

Skeleton loader following existing pattern.

- [ ] **Step 3: Create ChannelShell.tsx**

3-column flex layout. Manages active channel state. Wires all hooks.

- [ ] **Step 4: Create ChannelList.tsx**

Groups channels by type (department, team, session, custom, direct, news, skill). Shows unread badges. Search/filter.

- [ ] **Step 5: Create ChannelItem.tsx**

Single row: avatar, name, last message preview, unread badge, timestamp. Active state highlighting.

- [ ] **Step 6: Verify renders**

Run: `pnpm --filter web dev`
Navigate to `/dashboard/channels`. Should show empty channel list.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/channels/
git commit -m "feat(channels): add ChannelShell, ChannelList, ChannelItem components"
```

---

### Task 12: UI Components — Message Area

**Files:**

- Create: `apps/web/src/app/dashboard/channels/_components/ChannelHeader.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/MessageTimeline.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/MessageBubble.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/SystemMessage.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/MessageInput.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/ReplyPreview.tsx`

**Context:** Evolve from existing chat components. MessageTimeline uses infinite scroll (load more on scroll up). MessageBubble shows sender, content, time, reactions, reply preview. SystemMessage has distinct styling for briefs/handoffs/reminders/summaries.

- [ ] **Step 1: Create ChannelHeader.tsx**

Channel name, member count, settings button. Phone/video buttons placeholder (disabled, Phase 2).

- [ ] **Step 2: Create MessageTimeline.tsx**

Infinite scroll container. Date group separators. "New messages" indicator.

- [ ] **Step 3: Create MessageBubble.tsx**

User message: sender avatar, name, content (markdown), timestamp, reaction bar, reply button.

- [ ] **Step 4: Create SystemMessage.tsx**

Distinct rendering for `message_type` in: system, brief, handoff, announcement, reminder, summary. Muted styling, icon per type.

- [ ] **Step 5: Create MessageInput.tsx**

Text input, send button, attachment icon (placeholder), emoji quick-react.

- [ ] **Step 6: Create ReplyPreview.tsx**

"Replying to [name]..." banner with close button.

- [ ] **Step 7: Verify end-to-end**

Create a test channel via SQL, add test messages, verify they render.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_components/
git commit -m "feat(channels): add message area components (timeline, bubble, input, system)"
```

---

### Task 13: UI Components — Members + Create Channel

**Files:**

- Create: `apps/web/src/app/dashboard/channels/_components/MemberPanel.tsx`
- Create: `apps/web/src/app/dashboard/channels/_components/CreateChannel.tsx`

- [ ] **Step 1: Create MemberPanel.tsx**

Right panel: member list with avatar, name, role badge, AI badge for Botsson. Online/offline indicator (placeholder for Phase 2 presence).

- [ ] **Step 2: Create CreateChannel.tsx**

Modal with steps: select type (custom/direct) -> name + description (custom only) -> select members -> create. Uses `create_channel()` RPC for direct channels.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/channels/_components/
git commit -m "feat(channels): add MemberPanel + CreateChannel components"
```

---

### Task 14: Auto-Create Triggers

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_channel_auto_create_triggers.sql`

**Context:** When a department or team is created, auto-create the corresponding channel. When a profile joins a department, auto-add them to the department channel.

- [ ] **Step 1: Write department channel auto-create trigger**

```sql
CREATE OR REPLACE FUNCTION auto_create_department_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO channel (workspace_id, channel_type, name, department_id)
  VALUES (NEW.workspace_id, 'department', '#' || NEW.name, NEW.department_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_department_channel
  AFTER INSERT ON department
  FOR EACH ROW EXECUTE FUNCTION auto_create_department_channel();
```

- [ ] **Step 2: Write team channel auto-create trigger**

Same pattern for team.

- [ ] **Step 3: Write profile -> channel_member sync trigger**

When `profile.department_id` changes, add to new department channel, remove from old.

- [ ] **Step 4: Run migration and test**

Create a department via SQL, verify channel auto-created.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_channel_auto_create_triggers.sql
git commit -m "feat(channels): add auto-create triggers for dept/team channels"
```

---

### Task 15: Integration Test + Navigation

**Files:**

- Modify: sidebar/navigation to add Channels link

**Context:** Add `/dashboard/channels` to the dashboard sidebar navigation. Verify the full flow: navigate -> see channels -> select channel -> see messages -> send message -> see it appear via realtime.

- [ ] **Step 1: Add Channels to sidebar navigation**

Find the sidebar component (likely `DashboardShell.tsx` or a nav component) and add a "Kanaler" link to `/dashboard/channels` with a MessageSquare icon.

- [ ] **Step 2: Manual integration test**

1. Navigate to `/dashboard/channels`
2. Create a custom channel via CreateChannel modal
3. Send a message
4. Open a second browser tab — verify message appears via Realtime
5. React to a message — verify reaction appears
6. Mark as read — verify unread count clears

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/
git commit -m "feat(channels): add sidebar navigation + integration verification"
```

---

### Task 16: Typecheck + Final Cleanup

- [ ] **Step 1: Run full typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Fix any issues.

- [ ] **Step 3: Final commit**

```bash
git commit -m "chore(channels): typecheck + lint cleanup"
```

---

## Dependencies Between Tasks

```
Task 1 (enums) -> Task 2 (core tables) -> Task 3 (supporting tables) -> Task 4 (RLS)
                                                                            |
Task 5 (functions + seed) -------------------------------------------------+
                                                                            |
Task 6 (types + telemetry) ------------------------------------------------+
                                                                            |
Task 7 (keys + types) -> Task 8 (query hooks) -> Task 9 (mutation hooks) -> Task 10 (realtime)
                                                                            |
Task 11 (shell + list) -> Task 12 (messages) -> Task 13 (members + create) -> Task 15 (integration)
                                                                            |
Task 14 (auto-create triggers) --------------------------------------------+
                                                                            |
Task 16 (typecheck + cleanup) <--------------------------------------------+
```

Tasks 1-5 are sequential (DB). Tasks 7-10 are sequential (hooks). Tasks 11-13 are sequential (UI). Task 6 can run in parallel with Task 5. Task 14 can run in parallel with Tasks 7-13.

---

## What This Plan Does NOT Cover (Future Plans)

- **Phase 2:** LiveKit voice/video (call tables, PTT, video grid, Agent SDK provider)
- **Phase 3:** AI participation (Botsson channel member, @mention routing, pipelines)
- **Phase 4:** Integrations + old chat sunset
- **E2E Tests:** Playwright specs for channel flows (separate task after Phase 1 is stable)
- **Mobile:** React Native channel screens (after web is proven)
