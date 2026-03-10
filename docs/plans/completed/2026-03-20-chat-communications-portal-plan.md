---
title: "Implementation Plan — Chat Communications Portal"
status: draft
updated: 2026-03-20
created: 2026-03-20
module: communications
tags: [chat, realtime, supabase, implementation]
---

# Chat Communications Portal — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 1282-line monolithic chat mock with a production-ready WhatsApp Business-style communications portal backed by Supabase with realtime.

**Architecture:** Three new database tables (`chat_conversation`, `chat_participant`, `chat_message`) with full RLS. Modular component tree under `dashboard/chat/` with TanStack Query hooks and Supabase Realtime subscriptions. Follows existing schedule module patterns exactly.

**Tech Stack:** Next.js 16 (App Router), React 19, TanStack Query v5, Supabase Realtime, Tailwind v4 (CSS variables), Framer Motion, shadcn/ui

**Design doc:** `docs/plans/2026-03-20-chat-communications-portal-design.md`

---

## Task 1: Database Migration

Create the chat schema: 1 enum, 3 tables, RLS policies, indexes, triggers.

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_chat_communications.sql`

**Step 1: Create migration file**

Use the current timestamp for the filename (e.g. `20260320120000`).

```sql
-- ============================================
-- Chat Communications Portal
-- Module: communications
-- Design: docs/plans/2026-03-20-chat-communications-portal-design.md
-- Connected files:
--   apps/web/src/app/dashboard/chat/ (all components + hooks)
--   packages/supabase/src/database.types.ts (regenerate after)
-- ============================================

-- ── Enum ─────────────────────────────────────────────────────
CREATE TYPE public.chat_conversation_type AS ENUM ('group', 'dm', 'ai');

-- ── chat_conversation ────────────────────────────────────────
CREATE TABLE public.chat_conversation (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  type               public.chat_conversation_type NOT NULL,
  name               TEXT,
  description        TEXT,
  avatar_url         TEXT,
  created_by         UUID NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  is_archived        BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_conversation IS 'Chat conversations: group channels, DMs, and AI assistant chats. Module: communications.';
COMMENT ON COLUMN public.chat_conversation.type IS 'group = team/dept channel, dm = 1:1, ai = AI assistant chat';
COMMENT ON COLUMN public.chat_conversation.name IS 'Display name. NULL for DM (derive from participants).';

-- ── chat_participant ─────────────────────────────────────────
CREATE TABLE public.chat_participant (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID NOT NULL REFERENCES public.chat_conversation(id) ON DELETE CASCADE,
  profile_id         UUID NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  role               TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  last_read_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_muted           BOOLEAN NOT NULL DEFAULT false,
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, profile_id)
);

COMMENT ON TABLE public.chat_participant IS 'Links profiles to conversations. left_at != NULL means inactive. Module: communications.';
COMMENT ON COLUMN public.chat_participant.last_read_at IS 'Timestamp of last read — used for unread badge calculation.';

-- ── chat_message ─────────────────────────────────────────────
CREATE TABLE public.chat_message (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID NOT NULL REFERENCES public.chat_conversation(id) ON DELETE CASCADE,
  sender_id          UUID NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
  content            TEXT NOT NULL,
  reply_to_id        UUID REFERENCES public.chat_message(id) ON DELETE SET NULL,
  reactions          JSONB NOT NULL DEFAULT '{}',
  attachments        JSONB NOT NULL DEFAULT '[]',
  is_system          BOOLEAN NOT NULL DEFAULT false,
  edited_at          TIMESTAMPTZ,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_message IS 'All chat messages with reactions, replies, and soft-delete. Module: communications.';
COMMENT ON COLUMN public.chat_message.reactions IS 'JSONB: {"emoji": ["profile_id_1", "profile_id_2"]}';
COMMENT ON COLUMN public.chat_message.reply_to_id IS 'Self-FK for threaded replies / quote-reply.';

-- ── RLS: chat_conversation ───────────────────────────────────
ALTER TABLE public.chat_conversation ENABLE ROW LEVEL SECURITY;

-- JWT: read if you are a participant
CREATE POLICY "jwt_read_chat_conversation"
  ON public.chat_conversation FOR SELECT
  USING (
    id IN (
      SELECT cp.conversation_id FROM public.chat_participant cp
      WHERE cp.profile_id IN (SELECT p.id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp.left_at IS NULL
    )
  );

-- JWT: insert if workspace member
CREATE POLICY "jwt_insert_chat_conversation"
  ON public.chat_conversation FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- JWT: update if conversation admin
CREATE POLICY "jwt_update_chat_conversation"
  ON public.chat_conversation FOR UPDATE
  USING (
    id IN (
      SELECT cp.conversation_id FROM public.chat_participant cp
      WHERE cp.profile_id IN (SELECT p.id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp.role = 'admin'
      AND cp.left_at IS NULL
    )
  );

-- API key: read
CREATE POLICY "api_key_read_chat_conversation"
  ON public.chat_conversation FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- ── RLS: chat_participant ────────────────────────────────────
ALTER TABLE public.chat_participant ENABLE ROW LEVEL SECURITY;

-- JWT: read if you are in the same conversation
CREATE POLICY "jwt_read_chat_participant"
  ON public.chat_participant FOR SELECT
  USING (
    conversation_id IN (
      SELECT cp2.conversation_id FROM public.chat_participant cp2
      WHERE cp2.profile_id IN (SELECT p.id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp2.left_at IS NULL
    )
  );

-- JWT: insert (add participants) if conversation admin or conversation creator
CREATE POLICY "jwt_insert_chat_participant"
  ON public.chat_participant FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT cp.conversation_id FROM public.chat_participant cp
      WHERE cp.profile_id IN (SELECT p.id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp.role = 'admin'
      AND cp.left_at IS NULL
    )
    OR conversation_id IN (
      SELECT cc.id FROM public.chat_conversation cc
      WHERE cc.created_by IN (SELECT p.id FROM public.profile p WHERE p.user_id = auth.uid())
    )
  );

-- JWT: update own participant record (mute, last_read_at)
CREATE POLICY "jwt_update_chat_participant"
  ON public.chat_participant FOR UPDATE
  USING (
    profile_id IN (SELECT p.id FROM public.profile p WHERE p.user_id = auth.uid())
  );

-- API key: read
CREATE POLICY "api_key_read_chat_participant"
  ON public.chat_participant FOR SELECT
  USING (
    conversation_id IN (
      SELECT cc.id FROM public.chat_conversation cc
      WHERE cc.workspace_id = get_api_workspace_id()
    )
  );

-- ── RLS: chat_message ────────────────────────────────────────
ALTER TABLE public.chat_message ENABLE ROW LEVEL SECURITY;

-- JWT: read if participant in conversation
CREATE POLICY "jwt_read_chat_message"
  ON public.chat_message FOR SELECT
  USING (
    conversation_id IN (
      SELECT cp.conversation_id FROM public.chat_participant cp
      WHERE cp.profile_id IN (SELECT p.id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp.left_at IS NULL
    )
  );

-- JWT: insert if participant and sender is self
CREATE POLICY "jwt_insert_chat_message"
  ON public.chat_message FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT cp.conversation_id FROM public.chat_participant cp
      WHERE cp.profile_id IN (SELECT p.id FROM public.profile p WHERE p.user_id = auth.uid())
      AND cp.left_at IS NULL
    )
    AND sender_id IN (SELECT p.id FROM public.profile p WHERE p.user_id = auth.uid())
  );

-- JWT: update own messages (edit, soft-delete)
CREATE POLICY "jwt_update_chat_message"
  ON public.chat_message FOR UPDATE
  USING (
    sender_id IN (SELECT p.id FROM public.profile p WHERE p.user_id = auth.uid())
  );

-- API key: read
CREATE POLICY "api_key_read_chat_message"
  ON public.chat_message FOR SELECT
  USING (
    conversation_id IN (
      SELECT cc.id FROM public.chat_conversation cc
      WHERE cc.workspace_id = get_api_workspace_id()
    )
  );

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_chat_conversation_workspace
  ON public.chat_conversation (workspace_id);

CREATE INDEX idx_chat_participant_conversation
  ON public.chat_participant (conversation_id)
  WHERE left_at IS NULL;

CREATE INDEX idx_chat_participant_profile
  ON public.chat_participant (profile_id)
  WHERE left_at IS NULL;

CREATE INDEX idx_chat_message_conversation_created
  ON public.chat_message (conversation_id, created_at DESC);

CREATE INDEX idx_chat_message_reply_to
  ON public.chat_message (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- ── Triggers ─────────────────────────────────────────────────
CREATE TRIGGER set_chat_conversation_updated_at
  BEFORE UPDATE ON public.chat_conversation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_chat_participant_updated_at
  BEFORE UPDATE ON public.chat_participant
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_chat_message_updated_at
  BEFORE UPDATE ON public.chat_message
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Enable Realtime ──────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participant;
```

**Step 2: Apply migration locally**

Run: `cd /home/sxtnl/dev/smartout.ai && npx supabase db reset`
Expected: Migration applies without errors.

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: New types include `chat_conversation`, `chat_participant`, `chat_message`, `chat_conversation_type`.

**Step 4: Commit**

```bash
git add supabase/migrations/*_chat_communications.sql packages/supabase/src/database.types.ts
git commit -m "feat(chat): add chat_conversation, chat_participant, chat_message tables with RLS"
```

---

## Task 2: Query Key Factory + Types

Create the TanStack Query key factory and TypeScript types for all chat data.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_hooks/chat-keys.ts`
- Create: `apps/web/src/app/dashboard/chat/_hooks/chat-types.ts`

**Step 1: Create chat-keys.ts**

Follow the pattern in `apps/web/src/app/dashboard/schedule/_hooks/schedule-keys.ts`.

```typescript
/**
 * TanStack Query key factory for all chat queries.
 * Structured for granular invalidation.
 * Connected to: all use-*.ts hooks in this folder.
 */
export const chatKeys = {
  all: ["chat"] as const,

  conversations: (workspaceId: string) => ["chat", "conversations", workspaceId] as const,

  conversation: (workspaceId: string, conversationId: string) =>
    ["chat", "conversation", workspaceId, conversationId] as const,

  messages: (workspaceId: string, conversationId: string) =>
    ["chat", "messages", workspaceId, conversationId] as const,

  participants: (workspaceId: string, conversationId: string) =>
    ["chat", "participants", workspaceId, conversationId] as const,

  unreadCounts: (workspaceId: string) => ["chat", "unread", workspaceId] as const,
};
```

**Step 2: Create chat-types.ts**

Derive types from `database.types.ts` where possible, add UI-specific types.

```typescript
import type { Database } from "@smartout/supabase/database.types";

// ── Database row types ───────────────────────────────────────
type Tables = Database["public"]["Tables"];

export type ChatConversationRow = Tables["chat_conversation"]["Row"];
export type ChatParticipantRow = Tables["chat_participant"]["Row"];
export type ChatMessageRow = Tables["chat_message"]["Row"];
export type ChatConversationType = Database["public"]["Enums"]["chat_conversation_type"];

// ── UI query result types ────────────────────────────────────

/** Profile info embedded in messages and participant lists */
export type ChatProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

/** A conversation with latest message preview and unread count */
export type ConversationWithPreview = ChatConversationRow & {
  participants: Array<{
    profile: ChatProfile;
    last_read_at: string;
    role: string;
  }>;
  last_message: {
    content: string;
    created_at: string;
    sender: ChatProfile;
  } | null;
  unread_count: number;
};

/** A message with sender profile and optional reply-to */
export type MessageWithSender = ChatMessageRow & {
  sender: ChatProfile;
  reply_to: {
    id: string;
    content: string;
    sender: ChatProfile;
  } | null;
};

/** Reaction map: emoji -> array of profile IDs */
export type ReactionMap = Record<string, string[]>;
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_hooks/chat-keys.ts apps/web/src/app/dashboard/chat/_hooks/chat-types.ts
git commit -m "feat(chat): add query key factory and TypeScript types"
```

---

## Task 3: useConversations Hook

Fetch conversation list with last message preview and unread count.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_hooks/use-conversations.ts`

**Step 1: Create the hook**

Follow `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts` pattern.

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { chatKeys } from "./chat-keys";
import type { ConversationWithPreview } from "./chat-types";

export function useConversations() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: chatKeys.conversations(workspaceId),
    queryFn: async (): Promise<ConversationWithPreview[]> => {
      const supabase = createClient();

      // Fetch conversations where user is active participant
      const { data: conversations, error } = await supabase
        .from("chat_conversation")
        .select(
          `
          *,
          participants:chat_participant!inner(
            role,
            last_read_at,
            profile:profile!inner(id, full_name, avatar_url, role)
          )
        `,
        )
        .eq("workspace_id", workspaceId)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      if (!conversations) return [];

      // For each conversation, fetch last message + compute unread
      const withPreviews = await Promise.all(
        conversations.map(async (conv) => {
          const { data: lastMsg } = await supabase
            .from("chat_message")
            .select("content, created_at, sender:profile!inner(id, full_name, avatar_url, role)")
            .eq("conversation_id", conv.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Find current user's participant record for unread calc
          const myParticipant = conv.participants.find(
            (p: { profile: { id: string } }) => p.profile.id !== undefined,
          );
          const lastReadAt = myParticipant?.last_read_at ?? conv.created_at;

          const { count } = await supabase
            .from("chat_message")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .is("deleted_at", null)
            .gt("created_at", lastReadAt);

          return {
            ...conv,
            last_message: lastMsg ?? null,
            unread_count: count ?? 0,
          } as ConversationWithPreview;
        }),
      );

      return withPreviews;
    },
  });
}
```

**Note:** The N+1 queries for last_message and unread_count are acceptable for MVP. If conversation count grows, optimize with a database view or RPC later.

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_hooks/use-conversations.ts
git commit -m "feat(chat): add useConversations hook with unread counts"
```

---

## Task 4: useMessages + useSendMessage Hooks

Fetch messages for a conversation (paginated) and send new messages with optimistic updates.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_hooks/use-messages.ts`

**Step 1: Create the hook file with both hooks**

```typescript
"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { chatKeys } from "./chat-keys";
import type { MessageWithSender } from "./chat-types";
import { toast } from "sonner";

const PAGE_SIZE = 50;

/**
 * Fetch messages for a conversation with infinite scroll (load older on scroll up).
 */
export function useMessages(conversationId: string | null) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useInfiniteQuery({
    queryKey: chatKeys.messages(workspaceId, conversationId ?? "none"),
    enabled: !!conversationId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<MessageWithSender[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("chat_message")
        .select(
          `
          *,
          sender:profile!inner(id, full_name, avatar_url, role),
          reply_to:chat_message!reply_to_id(
            id,
            content,
            sender:profile!inner(id, full_name, avatar_url, role)
          )
        `,
        )
        .eq("conversation_id", conversationId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (error) throw error;
      return (data ?? []) as unknown as MessageWithSender[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
  });
}

/**
 * Send a message with optimistic update.
 */
export function useSendMessage(conversationId: string | null, profileId: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const queryKey = chatKeys.messages(workspaceId, conversationId ?? "none");

  return useMutation({
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      if (!conversationId) throw new Error("No conversation selected");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("chat_message")
        .insert({
          conversation_id: conversationId,
          sender_id: profileId,
          content,
          reply_to_id: replyToId ?? null,
        })
        .select(`*, sender:profile!inner(id, full_name, avatar_url, role)`)
        .single();

      if (error) throw error;
      return data;
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      // Also refresh conversation list (new last_message)
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
    },

    onError: () => {
      toast.error("Kunne ikke sende melding");
    },
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_hooks/use-messages.ts
git commit -m "feat(chat): add useMessages (paginated) and useSendMessage hooks"
```

---

## Task 5: useReaction + useMarkAsRead Hooks

Toggle emoji reactions and update read cursor.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_hooks/use-reactions.ts`
- Create: `apps/web/src/app/dashboard/chat/_hooks/use-mark-as-read.ts`

**Step 1: Create use-reactions.ts**

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { chatKeys } from "./chat-keys";
import type { ReactionMap } from "./chat-types";

/**
 * Toggle an emoji reaction on a message.
 * Adds profileId if not present, removes if already reacted.
 */
export function useToggleReaction(conversationId: string | null) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({
      messageId,
      emoji,
      profileId,
    }: {
      messageId: string;
      emoji: string;
      profileId: string;
    }) => {
      const supabase = createClient();

      // Fetch current reactions
      const { data: msg, error: fetchError } = await supabase
        .from("chat_message")
        .select("reactions")
        .eq("id", messageId)
        .single();

      if (fetchError) throw fetchError;

      const reactions = (msg.reactions ?? {}) as ReactionMap;
      const current = reactions[emoji] ?? [];

      if (current.includes(profileId)) {
        // Remove reaction
        reactions[emoji] = current.filter((id) => id !== profileId);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        // Add reaction
        reactions[emoji] = [...current, profileId];
      }

      const { error: updateError } = await supabase
        .from("chat_message")
        .update({ reactions })
        .eq("id", messageId);

      if (updateError) throw updateError;
    },

    onSettled: () => {
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: chatKeys.messages(workspaceId, conversationId),
        });
      }
    },
  });
}
```

**Step 2: Create use-mark-as-read.ts**

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { chatKeys } from "./chat-keys";

/**
 * Update the current user's last_read_at for a conversation.
 * Call when opening a conversation or scrolling to bottom.
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({
      conversationId,
      profileId,
    }: {
      conversationId: string;
      profileId: string;
    }) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("chat_participant")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("profile_id", profileId);

      if (error) throw error;
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
    },
  });
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_hooks/use-reactions.ts apps/web/src/app/dashboard/chat/_hooks/use-mark-as-read.ts
git commit -m "feat(chat): add useToggleReaction and useMarkAsRead hooks"
```

---

## Task 6: Realtime Subscription Hook

Subscribe to new messages and reaction updates via Supabase Realtime.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_hooks/use-chat-realtime.ts`

**Step 1: Create the hook**

Follow `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-realtime.ts` exactly.

```typescript
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { chatKeys } from "./chat-keys";

/**
 * Subscribe to realtime changes for a conversation.
 * Invalidates message cache on INSERT/UPDATE, conversation list on changes.
 */
export function useChatRealtime(conversationId: string | null) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`chat:${workspaceId}:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_message",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: chatKeys.messages(workspaceId, conversationId),
          });
          // Also refresh conversation list (new last_message / unread)
          queryClient.invalidateQueries({
            queryKey: chatKeys.conversations(workspaceId),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_participant",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: chatKeys.participants(workspaceId, conversationId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, conversationId, queryClient]);
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_hooks/use-chat-realtime.ts
git commit -m "feat(chat): add Supabase Realtime subscription hook"
```

---

## Task 7: useCreateConversation Hook

Create new conversations (group, DM, AI) with initial participants.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_hooks/use-create-conversation.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { chatKeys } from "./chat-keys";
import type { ChatConversationType } from "./chat-types";
import { toast } from "sonner";

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({
      type,
      name,
      description,
      createdBy,
      participantIds,
    }: {
      type: ChatConversationType;
      name?: string;
      description?: string;
      createdBy: string;
      participantIds: string[];
    }) => {
      const supabase = createClient();

      // 1. Create conversation
      const { data: conv, error: convError } = await supabase
        .from("chat_conversation")
        .insert({
          workspace_id: workspaceId,
          type,
          name: name ?? null,
          description: description ?? null,
          created_by: createdBy,
        })
        .select()
        .single();

      if (convError) throw convError;

      // 2. Add all participants (including creator as admin)
      const allIds = [...new Set([createdBy, ...participantIds])];
      const participants = allIds.map((profileId) => ({
        conversation_id: conv.id,
        profile_id: profileId,
        role: profileId === createdBy ? "admin" : "member",
      }));

      const { error: partError } = await supabase.from("chat_participant").insert(participants);

      if (partError) throw partError;

      return conv;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
      toast.success("Samtale opprettet");
    },

    onError: () => {
      toast.error("Kunne ikke opprette samtale");
    },
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_hooks/use-create-conversation.ts
git commit -m "feat(chat): add useCreateConversation hook"
```

---

## Task 8: ConversationList + ConversationItem Components

Left sidebar: search, conversation list with avatars, unread badges, last message preview.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_components/ConversationList.tsx`
- Create: `apps/web/src/app/dashboard/chat/_components/ConversationItem.tsx`

**Step 1: Create ConversationItem.tsx**

```typescript
"use client";

import { cn } from "@/lib/utils";
import { MessageSquare, Sparkles, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ConversationWithPreview } from "../_hooks/chat-types";

type Props = {
  conversation: ConversationWithPreview;
  isActive: boolean;
  onClick: () => void;
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) {
    return date.toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "I gar";
  if (diffDays < 7) {
    return date.toLocaleDateString("nb-NO", { weekday: "long" });
  }
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

const typeIcons: Record<string, typeof MessageSquare> = {
  group: Users,
  dm: MessageSquare,
  ai: Sparkles,
};

export function ConversationItem({ conversation, isActive, onClick }: Props) {
  const Icon = typeIcons[conversation.type] ?? MessageSquare;
  const displayName =
    conversation.name ??
    conversation.participants
      .map((p) => p.profile.full_name)
      .filter(Boolean)
      .join(", ") ??
    "Uten navn";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
        "hover:bg-accent",
        isActive && "bg-accent border-l-2 border-primary",
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className={cn(
          "text-xs",
          conversation.type === "ai" && "bg-primary/20 text-primary",
        )}>
          {conversation.type === "ai" ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            getInitials(displayName)
          )}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium text-foreground">
            {displayName}
          </span>
          {conversation.last_message && (
            <span className="ml-2 shrink-0 text-xs text-muted-foreground">
              {formatTime(conversation.last_message.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="truncate text-xs text-muted-foreground">
            {conversation.last_message
              ? `${conversation.last_message.sender.full_name}: ${conversation.last_message.content}`
              : "Ingen meldinger enna"}
          </p>
          {conversation.unread_count > 0 && (
            <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {conversation.unread_count > 99
                ? "99+"
                : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
```

**Step 2: Create ConversationList.tsx**

```typescript
"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConversationItem } from "./ConversationItem";
import type { ConversationWithPreview } from "../_hooks/chat-types";

type Props = {
  conversations: ConversationWithPreview[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  isLoading: boolean;
};

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreateNew,
  isLoading,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? conversations.filter((c) =>
        (c.name ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : conversations;

  return (
    <div className="flex h-full w-72 flex-col border-r border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Meldinger</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onCreateNew}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Sok i samtaler..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-muted-foreground">Laster...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <span className="text-xs text-muted-foreground">
              {search ? "Ingen treff" : "Ingen samtaler enna"}
            </span>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              onClick={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_components/ConversationList.tsx apps/web/src/app/dashboard/chat/_components/ConversationItem.tsx
git commit -m "feat(chat): add ConversationList and ConversationItem components"
```

---

## Task 9: ChatHeader Component

Top bar showing conversation name, participant count, phone placeholder.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_components/ChatHeader.tsx`

**Step 1: Create ChatHeader.tsx**

```typescript
"use client";

import { MoreHorizontal, Phone, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConversationWithPreview } from "../_hooks/chat-types";

type Props = {
  conversation: ConversationWithPreview;
  onToggleMembers: () => void;
};

export function ChatHeader({ conversation, onToggleMembers }: Props) {
  const displayName =
    conversation.name ??
    conversation.participants
      .map((p) => p.profile.full_name)
      .filter(Boolean)
      .join(", ") ??
    "Uten navn";

  const participantCount = conversation.participants.length;

  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {displayName}
          </h3>
          <p className="text-xs text-muted-foreground">
            {participantCount} deltaker{participantCount !== 1 && "e"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
              <Phone className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Kommer snart</TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleMembers}
        >
          <Users className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_components/ChatHeader.tsx
git commit -m "feat(chat): add ChatHeader component with phone placeholder"
```

---

## Task 10: MessageBubble Component

Individual message with sender, timestamp, reactions, reply indicator.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_components/MessageBubble.tsx`

**Step 1: Create MessageBubble.tsx**

```typescript
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Reply, ThumbsUp, Heart, Laugh } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MessageWithSender, ReactionMap } from "../_hooks/chat-types";

type Props = {
  message: MessageWithSender;
  isMe: boolean;
  profileId: string;
  onReply: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
};

const QUICK_REACTIONS = [
  { emoji: "\ud83d\udc4d", icon: ThumbsUp },
  { emoji: "\u2764\ufe0f", icon: Heart },
  { emoji: "\ud83d\ude02", icon: Laugh },
];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  message,
  isMe,
  profileId,
  onReply,
  onReaction,
}: Props) {
  const [showActions, setShowActions] = useState(false);
  const reactions = (message.reactions ?? {}) as ReactionMap;
  const hasReactions = Object.keys(reactions).length > 0;

  if (message.is_system) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs italic text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn("group flex flex-col gap-1", isMe ? "items-end" : "items-start")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Reply reference */}
      {message.reply_to && (
        <div className={cn(
          "rounded-md border border-border/50 bg-muted/50 px-3 py-1.5 text-xs",
          isMe ? "mr-2" : "ml-2",
        )}>
          <span className="font-medium text-primary">
            {message.reply_to.sender.full_name}
          </span>
          <p className="truncate text-muted-foreground">
            {message.reply_to.content}
          </p>
        </div>
      )}

      {/* Sender name (not for own messages) */}
      {!isMe && (
        <span className="ml-2 text-xs text-muted-foreground">
          {message.sender.full_name}
        </span>
      )}

      {/* Message bubble */}
      <div className="relative">
        <div
          className={cn(
            "max-w-md rounded-2xl px-4 py-2 text-sm",
            isMe
              ? "bg-primary/10 text-foreground"
              : "bg-muted text-foreground",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <span
            className={cn(
              "mt-1 block text-[10px]",
              isMe ? "text-muted-foreground text-right" : "text-muted-foreground",
            )}
          >
            {formatTime(message.created_at)}
          </span>
        </div>

        {/* Hover actions */}
        {showActions && (
          <div
            className={cn(
              "absolute -top-8 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-sm",
              isMe ? "right-0" : "left-0",
            )}
          >
            {QUICK_REACTIONS.map(({ emoji, icon: Icon }) => (
              <Button
                key={emoji}
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onReaction(message.id, emoji)}
              >
                <Icon className="h-3 w-3" />
              </Button>
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onReply(message.id)}
            >
              <Reply className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Reactions */}
      {hasReactions && (
        <div className={cn("flex gap-1", isMe ? "mr-2" : "ml-2")}>
          {Object.entries(reactions).map(([emoji, ids]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReaction(message.id, emoji)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                ids.includes(profileId)
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-muted hover:bg-accent",
              )}
            >
              <span>{emoji}</span>
              <span className="text-muted-foreground">{ids.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_components/MessageBubble.tsx
git commit -m "feat(chat): add MessageBubble component with reactions and replies"
```

---

## Task 11: MessageList Component

Scrollable message area with day grouping and infinite scroll.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_components/MessageList.tsx`

**Step 1: Create MessageList.tsx**

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { MessageBubble } from "./MessageBubble";
import type { MessageWithSender } from "../_hooks/chat-types";

type Props = {
  pages: MessageWithSender[][];
  profileId: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onReply: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
};

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "I dag";
  if (diffDays === 1) return "I gar";
  return date.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function groupByDate(
  messages: MessageWithSender[],
): Map<string, MessageWithSender[]> {
  const groups = new Map<string, MessageWithSender[]>();
  for (const msg of messages) {
    const dateKey = new Date(msg.created_at).toDateString();
    const group = groups.get(dateKey) ?? [];
    group.push(msg);
    groups.set(dateKey, group);
  }
  return groups;
}

export function MessageList({
  pages,
  profileId,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onReply,
  onReaction,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // All messages flattened and reversed (newest last for display)
  const allMessages = pages.flat().reverse();
  const dateGroups = groupByDate(allMessages);

  // Auto-scroll to bottom on new messages (if already at bottom)
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages.length]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // At bottom?
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    isAtBottomRef.current = atBottom;

    // At top? Load more
    if (el.scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4"
      onScroll={handleScroll}
    >
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <span className="text-xs text-muted-foreground">
            Laster eldre meldinger...
          </span>
        </div>
      )}

      {Array.from(dateGroups.entries()).map(([dateKey, messages]) => (
        <div key={dateKey}>
          {/* Date separator */}
          <div className="flex items-center justify-center py-4">
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {formatDateHeader(messages[0].created_at)}
            </span>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isMe={msg.sender_id === profileId}
                profileId={profileId}
                onReply={onReply}
                onReaction={onReaction}
              />
            ))}
          </div>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_components/MessageList.tsx
git commit -m "feat(chat): add MessageList with day grouping and infinite scroll"
```

---

## Task 12: MessageInput + ReplyPreview Components

Text input with attachment icon, emoji icon, send/mic button, and reply banner.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_components/MessageInput.tsx`
- Create: `apps/web/src/app/dashboard/chat/_components/ReplyPreview.tsx`

**Step 1: Create ReplyPreview.tsx**

```typescript
"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  senderName: string;
  onCancel: () => void;
};

export function ReplyPreview({ senderName, onCancel }: Props) {
  return (
    <div className="flex items-center justify-between border-t border-border bg-muted/50 px-4 py-2">
      <span className="text-xs text-muted-foreground">
        Svarer <span className="font-medium text-primary">{senderName}</span>
        ...
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5"
        onClick={onCancel}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
```

**Step 2: Create MessageInput.tsx**

```typescript
"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { Paperclip, Smile, Send, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReplyPreview } from "./ReplyPreview";

type Props = {
  conversationName: string;
  replyTo: { id: string; senderName: string } | null;
  onCancelReply: () => void;
  onSend: (content: string, replyToId?: string) => void;
  isSending: boolean;
};

export function MessageInput({
  conversationName,
  replyTo,
  onCancelReply,
  onSend,
  isSending,
}: Props) {
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, replyTo?.id);
    setText("");
    onCancelReply();
  }, [text, replyTo, onSend, onCancelReply]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const hasText = text.trim().length > 0;

  return (
    <div className="border-t border-border bg-background">
      {replyTo && (
        <ReplyPreview
          senderName={replyTo.senderName}
          onCancel={onCancelReply}
        />
      )}

      <div className="flex items-center gap-2 px-4 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        </Button>

        <Input
          placeholder={
            replyTo
              ? "Ditt svar..."
              : `Skriv til ${conversationName}...`
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          className="flex-1"
        />

        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Smile className="h-4 w-4 text-muted-foreground" />
        </Button>

        <Button
          variant={hasText ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSend}
          disabled={isSending || !hasText}
        >
          {hasText ? (
            <Send className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_components/MessageInput.tsx apps/web/src/app/dashboard/chat/_components/ReplyPreview.tsx
git commit -m "feat(chat): add MessageInput and ReplyPreview components"
```

---

## Task 13: CreateConversation Modal

Dialog to create new group, DM, or AI assistant conversation.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_components/CreateConversation.tsx`

**Step 1: Create CreateConversation.tsx**

This component uses shadcn Dialog with a multi-step flow:

1. Choose type (group / DM / AI)
2. Enter name + select participants
3. Create

```typescript
"use client";

import { useState } from "react";
import { MessageSquare, Sparkles, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ChatConversationType } from "../_hooks/chat-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    type: ChatConversationType;
    name?: string;
    description?: string;
    participantIds: string[];
  }) => void;
  isCreating: boolean;
};

const TYPE_OPTIONS: Array<{
  type: ChatConversationType;
  label: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    type: "group",
    label: "Gruppe",
    description: "Avdeling, team eller prosjekt",
    icon: Users,
  },
  {
    type: "dm",
    label: "Direktemelding",
    description: "Privat 1-til-1 samtale",
    icon: MessageSquare,
  },
  {
    type: "ai",
    label: "AI Assistent",
    description: "Spor AI om hjelp med en oppgave",
    icon: Sparkles,
  },
];

export function CreateConversation({
  open,
  onOpenChange,
  onCreate,
  isCreating,
}: Props) {
  const [step, setStep] = useState<"type" | "details">("type");
  const [selectedType, setSelectedType] =
    useState<ChatConversationType | null>(null);
  const [name, setName] = useState("");

  const handleSelectType = (type: ChatConversationType) => {
    setSelectedType(type);
    if (type === "ai") {
      // AI conversations are created immediately with no extra details
      onCreate({ type: "ai", name: "AI Assistent", participantIds: [] });
      return;
    }
    setStep("details");
  };

  const handleCreate = () => {
    if (!selectedType) return;
    onCreate({
      type: selectedType,
      name: name.trim() || undefined,
      participantIds: [], // TODO: participant picker in future iteration
    });
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("type");
      setSelectedType(null);
      setName("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "type" ? "Ny samtale" : "Opprett samtale"}
          </DialogTitle>
        </DialogHeader>

        {step === "type" && (
          <div className="flex flex-col gap-2 pt-2">
            {TYPE_OPTIONS.map(({ type, label, description, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleSelectType(type)}
                disabled={isCreating}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors",
                  "hover:bg-accent",
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === "details" && (
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <Label htmlFor="conv-name">
                {selectedType === "dm" ? "Velg person" : "Gruppenavn"}
              </Label>
              <Input
                id="conv-name"
                placeholder={
                  selectedType === "dm"
                    ? "Sok etter navn..."
                    : "F.eks. Kjokkenet, Vaktansvarlige"
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("type");
                  setSelectedType(null);
                }}
              >
                Tilbake
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !name.trim()}
              >
                Opprett
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_components/CreateConversation.tsx
git commit -m "feat(chat): add CreateConversation dialog with type selection"
```

---

## Task 14: MemberPanel Component

Right sidebar showing conversation participants.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_components/MemberPanel.tsx`

**Step 1: Create MemberPanel.tsx**

```typescript
"use client";

import { X } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ConversationWithPreview } from "../_hooks/chat-types";

type Props = {
  conversation: ConversationWithPreview;
  onClose: () => void;
};

export function MemberPanel({ conversation, onClose }: Props) {
  const participants = conversation.participants;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col overflow-hidden border-l border-border bg-background"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Medlemmer ({participants.length})
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-1">
          {participants.map((p) => (
            <div
              key={p.profile.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {(p.profile.full_name ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm text-foreground">
                  {p.profile.full_name ?? "Ukjent"}
                </p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {p.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_components/MemberPanel.tsx
git commit -m "feat(chat): add MemberPanel component"
```

---

## Task 15: ChatShell — Main Layout Component

The glue component that wires everything together. Manages active conversation, reply state, member panel toggle.

**Files:**

- Create: `apps/web/src/app/dashboard/chat/_components/ChatShell.tsx`

**Step 1: Create ChatShell.tsx**

```typescript
"use client";

import { useState, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { useConversations } from "../_hooks/use-conversations";
import { useMessages, useSendMessage } from "../_hooks/use-messages";
import { useToggleReaction } from "../_hooks/use-reactions";
import { useMarkAsRead } from "../_hooks/use-mark-as-read";
import { useChatRealtime } from "../_hooks/use-chat-realtime";
import { useCreateConversation } from "../_hooks/use-create-conversation";
import { ConversationList } from "./ConversationList";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { MemberPanel } from "./MemberPanel";
import { CreateConversation } from "./CreateConversation";
import type { MessageWithSender } from "../_hooks/chat-types";

type Props = {
  profileId: string;
};

export function ChatShell({ profileId }: Props) {
  // ── State ────────────────────────────────────────────────
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
  } | null>(null);

  // ── Hooks ────────────────────────────────────────────────
  const conversations = useConversations();
  const messages = useMessages(activeConversationId);
  const sendMessage = useSendMessage(activeConversationId, profileId);
  const toggleReaction = useToggleReaction(activeConversationId);
  const markAsRead = useMarkAsRead();
  const createConversation = useCreateConversation();

  // Realtime subscription for active conversation
  useChatRealtime(activeConversationId);

  // ── Derived ──────────────────────────────────────────────
  const activeConversation = useMemo(
    () =>
      conversations.data?.find((c) => c.id === activeConversationId) ?? null,
    [conversations.data, activeConversationId],
  );

  // ── Handlers ─────────────────────────────────────────────
  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      setReplyTo(null);
      setShowMembers(false);
      // Mark as read
      markAsRead.mutate({ conversationId: id, profileId });
    },
    [profileId, markAsRead],
  );

  const handleSend = useCallback(
    (content: string, replyToId?: string) => {
      sendMessage.mutate({ content, replyToId });
    },
    [sendMessage],
  );

  const handleReply = useCallback(
    (messageId: string) => {
      const allMessages = messages.data?.pages.flat() ?? [];
      const msg = allMessages.find(
        (m: MessageWithSender) => m.id === messageId,
      );
      if (msg) {
        setReplyTo({
          id: msg.id,
          senderName: msg.sender.full_name ?? "Ukjent",
        });
      }
    },
    [messages.data],
  );

  const handleReaction = useCallback(
    (messageId: string, emoji: string) => {
      toggleReaction.mutate({ messageId, emoji, profileId });
    },
    [toggleReaction, profileId],
  );

  const handleCreate = useCallback(
    (data: {
      type: "group" | "dm" | "ai";
      name?: string;
      description?: string;
      participantIds: string[];
    }) => {
      createConversation.mutate(
        {
          ...data,
          createdBy: profileId,
        },
        {
          onSuccess: (conv) => {
            setShowCreate(false);
            setActiveConversationId(conv.id);
          },
        },
      );
    },
    [createConversation, profileId],
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden rounded-lg border border-border bg-background">
      {/* Left: Conversation list */}
      <ConversationList
        conversations={conversations.data ?? []}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onCreateNew={() => setShowCreate(true)}
        isLoading={conversations.isLoading}
      />

      {/* Center: Active conversation */}
      <div className="flex flex-1 flex-col">
        {activeConversation ? (
          <>
            <ChatHeader
              conversation={activeConversation}
              onToggleMembers={() => setShowMembers((s) => !s)}
            />
            <MessageList
              pages={messages.data?.pages ?? []}
              profileId={profileId}
              hasNextPage={!!messages.hasNextPage}
              isFetchingNextPage={messages.isFetchingNextPage}
              fetchNextPage={() => messages.fetchNextPage()}
              onReply={handleReply}
              onReaction={handleReaction}
            />
            <MessageInput
              conversationName={activeConversation.name ?? "samtalen"}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onSend={handleSend}
              isSending={sendMessage.isPending}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm">Velg en samtale for a starte</p>
          </div>
        )}
      </div>

      {/* Right: Member panel */}
      <AnimatePresence>
        {showMembers && activeConversation && (
          <MemberPanel
            conversation={activeConversation}
            onClose={() => setShowMembers(false)}
          />
        )}
      </AnimatePresence>

      {/* Create conversation dialog */}
      <CreateConversation
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={handleCreate}
        isCreating={createConversation.isPending}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_components/ChatShell.tsx
git commit -m "feat(chat): add ChatShell main layout component"
```

---

## Task 16: Replace page.tsx

Replace the 1282-line monolith with the new modular page.

**Files:**

- Modify: `apps/web/src/app/dashboard/chat/page.tsx` (replace entirely)

**Step 1: Back up the old file**

```bash
mv apps/web/src/app/dashboard/chat/page.tsx apps/web/src/app/dashboard/chat/page.tsx.bak
```

**Step 2: Create new page.tsx**

```typescript
"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ChatShell } from "./_components/ChatShell";

/**
 * Chat page — communications portal.
 * Design: docs/plans/2026-03-20-chat-communications-portal-design.md
 */
export default function ChatPage() {
  const { profileId } = useContext(DashboardContext);

  if (!profileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Laster profil...</p>
      </div>
    );
  }

  return <ChatShell profileId={profileId} />;
}
```

**Step 3: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors (may need minor type adjustments — fix any that arise).

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/chat/page.tsx
git commit -m "feat(chat): replace monolith page.tsx with modular ChatShell"
```

---

## Task 17: Seed Data

Add test conversations and messages for development.

**Files:**

- Create: `supabase/seed/chat-seed.sql`

**Step 1: Create seed file**

This depends on existing profile IDs in the workspace. Write an idempotent seed script that:

1. Looks up 2-3 existing profiles in the workspace
2. Creates 3 conversations (1 group, 1 DM, 1 AI)
3. Adds participants
4. Inserts 5-10 messages per conversation with varied timestamps, reactions, and a reply

Use `DO $$ ... $$` block with profile lookups. Check for existing data before inserting to be idempotent.

**Step 2: Test locally**

Run: `psql -f supabase/seed/chat-seed.sql`
Expected: Seed data visible in Supabase Studio > Table Editor.

**Step 3: Commit**

```bash
git add supabase/seed/chat-seed.sql
git commit -m "feat(chat): add seed data for development"
```

---

## Task 18: Enable Supabase Realtime + Verify

Verify that Realtime is working for chat tables.

**Step 1: Check Realtime publication**

The migration already added:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participant;
```

Verify in Supabase Studio > Database > Publications that `chat_message` and `chat_participant` appear under `supabase_realtime`.

**Step 2: Manual test**

1. Open the chat page in browser
2. Select a seeded conversation
3. Open Supabase Studio > SQL Editor
4. Insert a message: `INSERT INTO chat_message (conversation_id, sender_id, content) VALUES ('...', '...', 'Realtime test!');`
5. Verify message appears in browser without refresh

**Step 3: No commit needed (verification only)**

---

## Task 19: Typecheck + Final Verification

Full typecheck and visual verification.

**Step 1: Run full typecheck**

Run: `pnpm turbo typecheck`
Expected: All packages pass with 0 errors.

**Step 2: Start dev server and test**

Run: `pnpm --filter web dev`

Test:

- [ ] Chat page loads at `/dashboard/chat`
- [ ] Conversation list shows seeded conversations
- [ ] Clicking a conversation shows messages
- [ ] Sending a message works (appears in list)
- [ ] Reactions toggle correctly
- [ ] Reply works (shows preview, sends with reply_to)
- [ ] Create new conversation dialog works
- [ ] Member panel slides in/out
- [ ] Unread badges update
- [ ] Realtime: messages from another tab appear live

**Step 3: Clean up backup**

Run: `rm apps/web/src/app/dashboard/chat/page.tsx.bak`

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(chat): cleanup and final verification"
```

---

## Summary

| Task | Description                         | Files           |
| ---- | ----------------------------------- | --------------- |
| 1    | Database migration                  | 1 SQL migration |
| 2    | Query keys + types                  | 2 TS files      |
| 3    | useConversations                    | 1 hook          |
| 4    | useMessages + useSendMessage        | 1 hook file     |
| 5    | useReaction + useMarkAsRead         | 2 hooks         |
| 6    | useChatRealtime                     | 1 hook          |
| 7    | useCreateConversation               | 1 hook          |
| 8    | ConversationList + ConversationItem | 2 components    |
| 9    | ChatHeader                          | 1 component     |
| 10   | MessageBubble                       | 1 component     |
| 11   | MessageList                         | 1 component     |
| 12   | MessageInput + ReplyPreview         | 2 components    |
| 13   | CreateConversation                  | 1 component     |
| 14   | MemberPanel                         | 1 component     |
| 15   | ChatShell                           | 1 component     |
| 16   | Replace page.tsx                    | 1 file replace  |
| 17   | Seed data                           | 1 SQL file      |
| 18   | Verify Realtime                     | manual test     |
| 19   | Typecheck + final verification      | cleanup         |

**Total: 19 tasks, ~20 new files, 1 migration, 1 seed file.**
