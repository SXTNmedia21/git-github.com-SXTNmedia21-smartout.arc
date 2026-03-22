---
title: "Plan — Komm Redesign Implementation"
status: draft
updated: 2026-03-22
created: 2026-03-22
module: communications
tags: [komm, channels, chat, nyheter, telemetry, api, ai-tools, mobile, web]
---

# Komm Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the channel communications UI as "Komm" — a single tab with Kanaler/Chat/Nyheter sub-tabs, WhatsApp-style chat, knowledge sharing cards, help desk, telemetry coverage, API endpoints, and AI tool integration.

**Architecture:** Mobile-first redesign reusing the existing Phase 1 DB schema (11 tables, 16 enums, RPCs). Web routes move from `/dashboard/channels` to `/dashboard/komm`. Mobile routes from `(channels)` to `(komm)`. New: `help_request` table, `channels:read/write` API scope, AI tools for channel context, knowledge card rendering, performance-optimized RPCs.

**Tech Stack:** PostgreSQL 17 (Supabase), TypeScript strict, Next.js 16 App Router, React 19, TanStack Query, Supabase Realtime, shadcn/ui, Tailwind v4, React Native + Expo, `@smartout/telemetry`, `@smartout/ai`

**Spec:** `docs/superpowers/specs/2026-03-22-komm-redesign.md`

---

## Prerequisites

Before starting Task 1, verify:

1. **Phase 1 DB exists:** `SELECT count(*) FROM channel;` returns > 0
2. **Seed data loaded:** `SELECT count(*) FROM channel_message;` returns > 0
3. **Packages built:** `npx turbo build --filter='./packages/*'` passes
4. **Branch:** Working on `feat/walkie-talkie` in wt-2

---

## File Structure

### Database

```
supabase/migrations/
  20260422300600_help_request_table.sql       -- help_request table + RLS
  20260422300700_optimize_channel_rpcs.sql    -- Rewrite RPCs for performance
  20260422300800_channel_realtime_publication.sql -- Ensure realtime on all needed tables
```

### API (Edge Functions)

```
supabase/functions/workspace-api/
  handlers/channels.ts                        -- NEW: channels API handler
```

### Telemetry

```
packages/telemetry/src/
  registry.ts                                 -- ADD: help desk events, knowledge share events
```

### AI Tools

```
packages/ai/src/tools/
  channels.ts                                 -- NEW: channel context tool for Botsson
```

### Web — Komm (replaces /dashboard/channels)

```
apps/web/src/app/dashboard/komm/
  page.tsx                                    -- Server component wrapper
  loading.tsx                                 -- Suspense fallback
  _hooks/
    channel-keys.ts                           -- MOVE from channels/_hooks/
    channel-types.ts                          -- MOVE + extend with knowledge card types
    use-channels.ts                           -- MOVE, update staleTime
    use-channel-messages.ts                   -- MOVE
    use-channel-realtime.ts                   -- MOVE
    use-send-message.ts                       -- MOVE
    use-reactions.ts                           -- MOVE
    use-mark-as-read.ts                       -- MOVE
    use-create-channel.ts                     -- MOVE
    use-channel-members.ts                    -- MOVE
    use-unread-counts.ts                      -- MOVE, add staleTime
    use-workspace-members.ts                  -- NEW: people directory for Chat tab
    use-news-posts.ts                         -- NEW: news feed query
    use-help-requests.ts                      -- NEW: help desk tickets
  _components/
    KommPageClient.tsx                        -- Client entry with sub-tab state
    KommShell.tsx                             -- Sub-tab container (Kanaler | Chat | Nyheter)
    SubTabs.tsx                               -- Sub-tab bar component
    -- Kanaler sub-tab
    ChannelList.tsx                            -- REWRITE: clean grouped list
    ChannelRow.tsx                             -- REWRITE: WhatsApp-style row
    -- Chat sub-tab
    ChatList.tsx                               -- NEW: DMs + people directory
    PersonRow.tsx                              -- NEW: person in directory
    -- Nyheter sub-tab
    NewsFeed.tsx                               -- NEW: social post feed
    NewsCard.tsx                               -- NEW: single news post
    -- Conversation (shared by channels + DMs)
    ConversationView.tsx                       -- REWRITE: WhatsApp-style messages
    ConversationHeader.tsx                     -- REWRITE: walkie button + members
    MessageBubble.tsx                          -- REWRITE: cleaner design
    SystemMessage.tsx                          -- KEEP (minor update)
    MessageInput.tsx                           -- REWRITE: 📎 popup dele-meny
    AttachmentPopup.tsx                        -- NEW: share menu grid
    KnowledgeCard.tsx                          -- NEW: rich card for shared content
    ReplyPreview.tsx                           -- KEEP
    -- Settings
    ChannelSettings.tsx                        -- NEW: settings screen
    MemberList.tsx                             -- REWRITE from MemberPanel
    CreateChannel.tsx                          -- KEEP (already has people picker)
    -- Help
    HelpDesk.tsx                               -- NEW: help desk screen
    TicketCard.tsx                             -- NEW: ticket display
```

### Mobile — Komm (replaces (channels))

```
apps/mobile/
  app/(app)/(komm)/
    _layout.tsx                               -- Stack navigator
    index.tsx                                 -- Sub-tab container
    [channelId].tsx                            -- Conversation screen
    create.tsx                                -- Create channel
    help.tsx                                  -- Help desk
    settings/[channelId].tsx                  -- Channel settings
    members/[channelId].tsx                   -- Member list
  src/components/komm/
    SubTabs.tsx                               -- Sub-tab bar
    ChannelRow.tsx                            -- MOVE from channels/
    ChatRow.tsx                               -- NEW: DM/person row
    NewsCard.tsx                              -- NEW: news post card
    ConversationBubble.tsx                    -- MOVE from channels/
    AttachmentPopup.tsx                       -- NEW: share menu
    KnowledgeCard.tsx                         -- NEW: shared content card
    HelpGrid.tsx                              -- NEW: help desk quick actions
    TicketCard.tsx                            -- NEW: ticket row
  src/hooks/queries/
    use-channels.ts                           -- KEEP (already uses RPC)
    use-channel-messages.ts                   -- KEEP
    use-news-posts.ts                         -- NEW
    use-help-requests.ts                      -- NEW
    use-workspace-members.ts                  -- NEW
  src/hooks/mutations/
    use-send-channel-message.ts               -- KEEP
    use-create-help-request.ts                -- NEW
```

---

## Task Breakdown

### Task 1: Database — help_request table + optimized RPCs

**Files:**

- Create: `supabase/migrations/20260422300600_help_request_table.sql`
- Create: `supabase/migrations/20260422300700_optimize_channel_rpcs.sql`

- [ ] **Step 1: Create help_request table**

```sql
CREATE TABLE IF NOT EXISTS help_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  resolved_by uuid REFERENCES profile(profile_id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE help_request ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON help_request
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- JWT: workspace member can see own + leader can see all in workspace
CREATE POLICY "help_request_jwt_select" ON help_request FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "help_request_jwt_insert" ON help_request FOR INSERT WITH CHECK (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
  AND workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "help_request_jwt_update" ON help_request FOR UPDATE USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (SELECT 1 FROM profile WHERE user_id = auth.uid()
    AND workspace_id = help_request.workspace_id AND role IN ('manager', 'admin', 'owner'))
);
CREATE POLICY "help_request_api_select" ON help_request FOR SELECT
  USING (workspace_id = get_api_workspace_id());
```

- [ ] **Step 2: Rewrite get_my_channels() for performance**

Replace correlated subqueries with CTE-based aggregation:

```sql
CREATE OR REPLACE FUNCTION get_my_channels(p_workspace_id uuid)
RETURNS TABLE (
  channel_id uuid, workspace_id uuid, channel_type comm_channel_type,
  name text, description text, avatar_url text,
  is_read_only boolean, is_archived boolean,
  audio_policy channel_audio_policy, video_policy channel_video_policy,
  member_count bigint, unread_count bigint,
  last_message_content text, last_message_at timestamptz,
  last_message_sender_name text, last_message_sender_avatar text,
  other_member_name text, other_member_avatar text
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH caller AS (
    SELECT profile_id FROM profile
    WHERE user_id = auth.uid() AND workspace_id = p_workspace_id LIMIT 1
  ),
  my_channels AS (
    SELECT cm.channel_id, cm.last_read_message_id
    FROM channel_member cm
    WHERE cm.profile_id = (SELECT profile_id FROM caller) AND cm.left_at IS NULL
  ),
  member_counts AS (
    SELECT channel_id, count(*) AS cnt
    FROM channel_member WHERE left_at IS NULL
    GROUP BY channel_id
  ),
  unread AS (
    SELECT mc.channel_id, count(msg.id) AS cnt
    FROM my_channels mc
    JOIN channel_message msg ON msg.channel_id = mc.channel_id
      AND msg.deleted_at IS NULL AND msg.delivery_mode = 'timeline'
      AND (mc.last_read_message_id IS NULL
        OR msg.created_at > (SELECT created_at FROM channel_message WHERE id = mc.last_read_message_id))
    GROUP BY mc.channel_id
  ),
  last_msgs AS (
    SELECT DISTINCT ON (m.channel_id)
      m.channel_id, m.content, m.created_at, m.sender_id
    FROM channel_message m
    WHERE m.deleted_at IS NULL AND m.delivery_mode = 'timeline'
      AND m.channel_id IN (SELECT channel_id FROM my_channels)
    ORDER BY m.channel_id, m.created_at DESC
  ),
  dm_other AS (
    SELECT cm.channel_id, p.display_name, p.avatar_url
    FROM channel_member cm
    JOIN profile p ON p.profile_id = cm.profile_id
    WHERE cm.channel_id IN (
      SELECT mc.channel_id FROM my_channels mc
      JOIN channel c ON c.id = mc.channel_id AND c.channel_type = 'direct'
    )
    AND cm.profile_id != (SELECT profile_id FROM caller)
    AND cm.left_at IS NULL
  )
  SELECT
    c.id, c.workspace_id, c.channel_type, c.name, c.description, c.avatar_url,
    c.is_read_only, c.is_archived, c.audio_policy, c.video_policy,
    COALESCE(mc2.cnt, 0),
    COALESCE(u.cnt, 0),
    lm.content, lm.created_at,
    sp.display_name, sp.avatar_url,
    dmo.display_name, dmo.avatar_url
  FROM channel c
  JOIN my_channels mc ON mc.channel_id = c.id
  LEFT JOIN member_counts mc2 ON mc2.channel_id = c.id
  LEFT JOIN unread u ON u.channel_id = c.id
  LEFT JOIN last_msgs lm ON lm.channel_id = c.id
  LEFT JOIN profile sp ON sp.profile_id = lm.sender_id
  LEFT JOIN dm_other dmo ON dmo.channel_id = c.id
  WHERE c.is_archived = false
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
$$;
```

Note: Added `other_member_name` and `other_member_avatar` for DM display names.

- [ ] **Step 3: Run migrations**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422300600_help_request_table.sql
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422300700_optimize_channel_rpcs.sql
```

- [ ] **Step 4: Regenerate types**

```bash
npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026042230060* supabase/migrations/2026042230070* packages/supabase/src/database.types.ts
git commit -m "feat(komm): add help_request table + optimize get_my_channels RPC"
```

---

### Task 2: Telemetry — Add Komm events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add help desk + knowledge sharing events**

Add to entity types: `"help_request"`, `"news_post"`
Add to action verbs: `"shared"`, `"requested_help"`

Add event interfaces:

```typescript
export interface HelpRequestCreated extends BaseEvent {
  event: "help_request.created";
  properties: { title: string };
  entity: EntityRef;
}
export interface HelpRequestResolved extends BaseEvent {
  event: "help_request.resolved";
  properties: { resolved_by: string };
  entity: EntityRef;
}
export interface KnowledgeShared extends BaseEvent {
  event: "knowledge.shared";
  properties: { channel_id: string; shared_type: string; shared_id: string; title: string };
  entity: EntityRef;
}
export interface NewsPostCreated extends BaseEvent {
  event: "news.post.created";
  properties: { channel_id: string };
  entity: EntityRef;
}
export interface NewsPostReacted extends BaseEvent {
  event: "news.post.reacted";
  properties: { channel_id: string; emoji: string };
  entity: EntityRef;
}
```

Add to SmartoutEvent union and EVENT_ROUTING map.

- [ ] **Step 2: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(komm): add help desk + knowledge sharing telemetry events"
```

---

### Task 3: API — Add channels scope to workspace-api

**Files:**

- Create: `supabase/functions/workspace-api/handlers/channels.ts`
- Modify: `supabase/functions/workspace-api/index.ts`

- [ ] **Step 1: Create channels handler**

```typescript
// handlers/channels.ts
export async function handleGetChannels(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  // Uses service role to query channels for the workspace
  // Returns: channel list with member counts and last message
}

export async function handleGetChannelMessages(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  // Pagination via ?cursor=&limit= params
  // Returns: messages with sender info, reactions, attachments
}
```

- [ ] **Step 2: Register routes in workspace-api/index.ts**

Add routes:

- `GET /channels` → `handleGetChannels` (scope: `channels:read`)
- `GET /channels/:id/messages` → `handleGetChannelMessages` (scope: `channels:read`)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/workspace-api/
git commit -m "feat(komm): add channels:read API scope with channel + message handlers"
```

---

### Task 4: AI Tools — Channel context for Botsson

**Files:**

- Create: `packages/ai/src/tools/channels.ts`

- [ ] **Step 1: Create channel context tool**

Tool that gives Botsson context about the channel being discussed in:

```typescript
export const channelContextTool = {
  name: "get_channel_context",
  description: "Get context about a channel: recent messages, members, shared content",
  parameters: {
    channel_id: { type: "string", description: "Channel ID" },
    workspace_id: { type: "string", description: "Workspace ID" },
  },
  handler: async ({ channel_id, workspace_id }: { channel_id: string; workspace_id: string }) => {
    // Fetch last 10 messages, member list, channel type
    // Return structured context for AI reasoning
  },
};
```

- [ ] **Step 2: Create knowledge search tool**

Tool that lets Botsson search for and share knowledge content:

```typescript
export const knowledgeSearchTool = {
  name: "search_knowledge",
  description: "Search procedures, manuals, training modules, quizzes in the workspace",
  parameters: {
    query: { type: "string" },
    workspace_id: { type: "string" },
    types: {
      type: "array",
      items: { type: "string" },
      description: "Filter by type: procedure, manual, training, quiz",
    },
  },
  handler: async ({ query, workspace_id, types }) => {
    // Search workspace_doc_chunk + protocol + knowledge_test tables
    // Return matching items with titles, descriptions, IDs
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/tools/channels.ts
git commit -m "feat(komm): add AI tools for channel context + knowledge search"
```

---

### Task 5: Web — Rename routes + KommShell with sub-tabs

**Files:**

- Move: `apps/web/src/app/dashboard/channels/` → `apps/web/src/app/dashboard/komm/`
- Rewrite: `KommPageClient.tsx`, `KommShell.tsx`
- Create: `SubTabs.tsx`
- Modify: `DashboardShell.tsx` (sidebar: rename Kanaler → Komm)

- [ ] **Step 1: Move directory**

```bash
mv apps/web/src/app/dashboard/channels apps/web/src/app/dashboard/komm
```

- [ ] **Step 2: Rewrite KommPageClient.tsx**

Server wrapper unchanged. Client component manages sub-tab state (`kanaler` | `chat` | `nyheter`).

- [ ] **Step 3: Create SubTabs.tsx**

Three tabs with badge counts. Orange underline on active tab. Uses existing channel unread + DM unread for badges.

- [ ] **Step 4: Rewrite KommShell.tsx**

Replaces 3-column layout with:

- Mobile: full-width sub-tab content
- Desktop: left panel (sub-tabs + list) + center (conversation) + right panel (context)

- [ ] **Step 5: Update DashboardShell.tsx sidebar**

Change `/dashboard/channels` → `/dashboard/komm`, label "Kanaler" → "Komm".

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/komm/ apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(komm): rename routes + add sub-tab shell (Kanaler/Chat/Nyheter)"
```

---

### Task 6: Web — Rewrite ChannelList + ChannelRow (WhatsApp-style)

**Files:**

- Rewrite: `apps/web/src/app/dashboard/komm/_components/ChannelList.tsx`
- Rewrite: `apps/web/src/app/dashboard/komm/_components/ChannelRow.tsx`

- [ ] **Step 1: Rewrite ChannelRow with SVG icons**

Replace emoji icons with lucide SVG icons. Colored backgrounds per type. Show `other_member_name` for DMs (from updated RPC).

- [ ] **Step 2: Rewrite ChannelList**

Grouped by type with section headers. No search bar by default (search behind button). Clean WhatsApp-style rows.

- [ ] **Step 3: Add staleTime to use-channels hook**

```typescript
staleTime: 30_000, // 30 seconds before refetch
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/komm/_components/ChannelList.tsx apps/web/src/app/dashboard/komm/_components/ChannelRow.tsx apps/web/src/app/dashboard/komm/_hooks/use-channels.ts
git commit -m "feat(komm): rewrite channel list with WhatsApp-style rows + SVG icons"
```

---

### Task 7: Web — Chat sub-tab (DMs + people directory)

**Files:**

- Create: `apps/web/src/app/dashboard/komm/_components/ChatList.tsx`
- Create: `apps/web/src/app/dashboard/komm/_components/PersonRow.tsx`
- Create: `apps/web/src/app/dashboard/komm/_hooks/use-workspace-members.ts`

- [ ] **Step 1: Create use-workspace-members hook**

Query all active profiles in workspace (exclude self, exclude system). Group by department.

- [ ] **Step 2: Create PersonRow component**

Initials avatar (colored), name, department + role. Tap starts DM via `create_channel()`.

- [ ] **Step 3: Create ChatList component**

Two sections: active DMs (from channels with `channel_type = 'direct'`) + "Alle medarbeidere" directory. Filter input at top.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/komm/_components/ChatList.tsx apps/web/src/app/dashboard/komm/_components/PersonRow.tsx apps/web/src/app/dashboard/komm/_hooks/use-workspace-members.ts
git commit -m "feat(komm): add Chat sub-tab with DMs + people directory"
```

---

### Task 8: Web — Nyheter sub-tab (social feed)

**Files:**

- Create: `apps/web/src/app/dashboard/komm/_components/NewsFeed.tsx`
- Create: `apps/web/src/app/dashboard/komm/_components/NewsCard.tsx`
- Create: `apps/web/src/app/dashboard/komm/_hooks/use-news-posts.ts`

- [ ] **Step 1: Create use-news-posts hook**

Query messages from channels with `channel_type = 'news'` and `message_type IN ('announcement', 'text')`. Include reactions. Order by created_at DESC.

- [ ] **Step 2: Create NewsCard component**

Social post card: author avatar + name + timestamp, body text, reaction pills + comment count.

- [ ] **Step 3: Create NewsFeed component**

Scrollable feed of NewsCards. Admin-only "Create post" button.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/komm/_components/NewsFeed.tsx apps/web/src/app/dashboard/komm/_components/NewsCard.tsx apps/web/src/app/dashboard/komm/_hooks/use-news-posts.ts
git commit -m "feat(komm): add Nyheter sub-tab with social announcement feed"
```

---

### Task 9: Web — Rewrite conversation view + dele-meny

**Files:**

- Rewrite: `ConversationView.tsx` (replaces MessageTimeline)
- Rewrite: `ConversationHeader.tsx` (replaces ChannelHeader)
- Rewrite: `MessageInput.tsx` (add 📎 popup)
- Create: `AttachmentPopup.tsx`
- Create: `KnowledgeCard.tsx`

- [ ] **Step 1: Rewrite ConversationHeader**

Back button + channel icon/name + walkie button (green, disabled for Phase 2) + members button + more menu.

- [ ] **Step 2: Create AttachmentPopup**

8-item grid: Bilder, Oppgave, Prosedyre, Lenke, Opplæring, Quiz, Veikart, Snarvei. Each with colored icon circle. Appears above input on 📎 press.

- [ ] **Step 3: Rewrite MessageInput**

📎 button toggles AttachmentPopup. Text input + send button.

- [ ] **Step 4: Create KnowledgeCard**

Rich preview card for shared content (procedure, manual, quiz, training). Rendered inline in message timeline when `system_data.shared_type` exists.

- [ ] **Step 5: Rewrite ConversationView**

WhatsApp-style: sender name (colored), bubbles, reactions, date separators. Render KnowledgeCard for shared content messages. Emit telemetry on knowledge share.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/komm/_components/
git commit -m "feat(komm): rewrite conversation view with dele-meny + knowledge cards"
```

---

### Task 10: Web — Help desk + channel settings

**Files:**

- Create: `HelpDesk.tsx`, `TicketCard.tsx`
- Create: `ChannelSettings.tsx`
- Rewrite: `MemberList.tsx` (from MemberPanel)
- Create: `use-help-requests.ts`

- [ ] **Step 1: Create use-help-requests hook**

Query `help_request` for current user's workspace. Include resolver profile name.

- [ ] **Step 2: Create TicketCard component**

Status badge (Åpen/Løst), title, description, meta (when + resolver).

- [ ] **Step 3: Create HelpDesk component**

2x2 grid: Spør Botsson, Meld problem, Finn manual, Ring leder. "Mine henvendelser" section below with TicketCards.

- [ ] **Step 4: Create ChannelSettings component**

Settings form: notifications, audio policy, read-only toggle, read receipts, member count, invite, leave channel.

- [ ] **Step 5: Rewrite MemberList**

Full-screen member list with filter, role badges, add button. Replaces collapsible MemberPanel.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/komm/
git commit -m "feat(komm): add help desk + channel settings + member list"
```

---

### Task 11: Web — Performance + cleanup

**Files:**

- Multiple hook files (add staleTime)
- Remove old `apps/web/src/app/dashboard/channels/` if not already moved

- [ ] **Step 1: Add staleTime to all hooks**

`use-channels.ts`: `staleTime: 30_000`
`use-unread-counts.ts`: `staleTime: 30_000` (remove `refetchInterval`)
`use-channel-messages.ts`: `staleTime: 10_000`

- [ ] **Step 2: Surgical cache updates in Realtime hook**

Instead of invalidating all queries on every Realtime event, do surgical cache prepend for new messages.

- [ ] **Step 3: Remove old channels directory if remnants exist**

- [ ] **Step 4: Run typecheck**

```bash
npx turbo typecheck --filter=web
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "perf(komm): optimize query caching + surgical realtime updates"
```

---

### Task 12: Mobile — Rename (channels) → (komm) + sub-tabs

**Files:**

- Move: `apps/mobile/app/(app)/(channels)/` → `apps/mobile/app/(app)/(komm)/`
- Move: `apps/mobile/src/components/channels/` → `apps/mobile/src/components/komm/`
- Create: `apps/mobile/src/components/komm/SubTabs.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx` (rename tab)
- Modify: `apps/mobile/src/components/navigation/TabBar.tsx` (rename tab)

- [ ] **Step 1: Move directories**

- [ ] **Step 2: Create SubTabs component**

Three-tab bar: Kanaler | Chat | Nyheter with badge counts and orange underline.

- [ ] **Step 3: Rewrite index.tsx**

Sub-tab container that renders ChannelList, ChatList, or NewsFeed based on active tab.

- [ ] **Step 4: Update TabBar + \_layout.tsx**

Rename `(channels)` → `(komm)`, label "Kanaler" → "Komm", icon stays MessageSquare.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/
git commit -m "feat(komm): rename mobile routes + add sub-tab shell"
```

---

### Task 13: Mobile — Chat sub-tab + Nyheter + Help + Knowledge cards

**Files:**

- Create: `ChatRow.tsx`, `NewsCard.tsx`, `HelpGrid.tsx`, `TicketCard.tsx`, `KnowledgeCard.tsx`, `AttachmentPopup.tsx`
- Create: `use-workspace-members.ts`, `use-news-posts.ts`, `use-help-requests.ts`, `use-create-help-request.ts`

- [ ] **Step 1: Create mobile hooks** (queries + mutations for new features)

- [ ] **Step 2: Create Chat sub-tab components** (ChatRow, ChatList in index.tsx)

- [ ] **Step 3: Create Nyheter components** (NewsCard, feed in index.tsx)

- [ ] **Step 4: Create Help desk screen** (help.tsx + HelpGrid + TicketCard)

- [ ] **Step 5: Create KnowledgeCard + AttachmentPopup for conversation**

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/
git commit -m "feat(komm): add mobile Chat, Nyheter, Help, Knowledge cards"
```

---

### Task 14: Final — Typecheck + lint + worklog update

- [ ] **Step 1: Run typecheck**

```bash
npx turbo typecheck
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

- [ ] **Step 3: Update WORKLOG**

- [ ] **Step 4: Update decision + learning logs**

- [ ] **Step 5: Final commit**

```bash
git add docs/
git commit -m "docs(komm): update worklog + decision/learning logs"
```

---

## Task Dependencies

```
Task 1 (DB) → Task 2 (Telemetry) → Task 3 (API) → Task 4 (AI Tools)
                                                         ↓
Task 5 (Web routes) → Task 6 (Channel list) → Task 7 (Chat) → Task 8 (Nyheter)
         ↓                                                          ↓
Task 9 (Conversation) → Task 10 (Help + Settings) → Task 11 (Performance)
                                                          ↓
Task 12 (Mobile routes) → Task 13 (Mobile features) → Task 14 (Final)
```

Tasks 1-4 are sequential (backend). Tasks 5-11 are sequential (web). Tasks 12-13 are sequential (mobile). Task 14 depends on all.

---

## What This Plan Does NOT Cover

- **WebRTC/LiveKit implementation** — Walkie button is UI-only (disabled), Phase 2
- **Botsson AI responses in channels** — Phase 3
- **File upload to Supabase Storage** — Attachment pipeline
- **Push notifications** — Cross-cutting concern
- **Old chat_conversation sunset** — Phase 4
- **E2E/Playwright tests** — Separate task
