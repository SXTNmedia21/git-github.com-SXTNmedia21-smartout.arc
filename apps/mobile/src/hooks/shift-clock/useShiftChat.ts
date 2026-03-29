/**
 * useShiftChat — Shift-scoped chat with offline message sending.
 *
 * Each shift can have a shift conversation (conversation_type = 'shift') that
 * employees and managers use during the shift. This hook:
 *   - Queries the conversation_id for the given shift
 *   - Loads the most recent messages (newest-first for inverted FlatList)
 *   - Subscribes to Realtime when online so new messages appear instantly
 *   - Sends messages via the sync queue (works offline)
 *
 * Message sending follows the same optimistic pattern as useSendMessage:
 * client-side UUID, optimistic cache prepend, then enqueue("send_message").
 */

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";

import { supabase } from "@/lib/supabase";
import { enqueue } from "@/lib/sync/queue";
import type { Database } from "@smartout/supabase/database.types";

type ChatMessage = Database["public"]["Tables"]["chat_message"]["Row"];

/** A chat message enriched with sender display info for bubble rendering */
export type ShiftChatMessage = ChatMessage & {
  senderName: string;
  senderAvatarUrl: string | null;
  /** True while the message is queued but not yet confirmed by Supabase */
  _isPending?: boolean;
};

const PAGE_SIZE = 30;
const STALE_TIME_MS = 60 * 1_000;

/** Builds the query key for the shift chat message list */
function shiftChatKey(shiftId: string) {
  return ["shift-chat", shiftId] as const;
}

/** Builds the query key for the shift conversation lookup */
function shiftConversationKey(shiftId: string) {
  return ["shift-conversation", shiftId] as const;
}

async function fetchShiftConversationId(shiftId: string): Promise<string | null> {
  // Conversations are scoped by source_id = shift_id when type = 'shift'
  const { data, error } = await supabase
    .from("chat_conversation")
    .select("id")
    .eq("source_id", shiftId)
    .eq("source_type", "shift")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

async function fetchShiftMessages(
  conversationId: string,
  profileIds: string[],
): Promise<ShiftChatMessage[]> {
  const { data: messages, error } = await supabase
    .from("chat_message")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (error) throw error;
  if (!messages || messages.length === 0) return [];

  const senderIds = [...new Set(messages.map((m) => m.sender_id))];

  const { data: profiles, error: profileError } = await supabase
    .from("profile")
    .select("profile_id, display_name, avatar_url")
    .in("profile_id", senderIds);

  if (profileError) throw profileError;

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.profile_id,
      { name: p.display_name ?? "Ukjent", avatarUrl: p.avatar_url },
    ]),
  );

  return messages.map((msg) => {
    const sender = profileMap.get(msg.sender_id);
    return {
      ...msg,
      senderName: sender?.name ?? "Ukjent",
      senderAvatarUrl: sender?.avatarUrl ?? null,
    };
  });
}

export type ShiftChatActions = {
  /** Ordered newest-first — suitable for inverted FlatList */
  messages: ShiftChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  isLoadingConversation: boolean;
  /**
   * Send a message on the shift conversation.
   * Works offline — enqueues to sync queue with optimistic cache update.
   */
  sendMessage: (params: {
    content: string;
    senderProfileId: string;
    senderName: string;
    senderAvatarUrl?: string | null;
  }) => Promise<void>;
};

/**
 * Hook: provides shift-scoped chat with offline message sending.
 *
 * Pass shiftId to load the conversation and messages for that shift.
 * Realtime subscription is set up when online to receive incoming messages.
 */
export function useShiftChat(shiftId: string): ShiftChatActions {
  const queryClient = useQueryClient();

  // Step 1: look up the conversation_id for this shift
  const { data: conversationId, isLoading: isLoadingConversation } = useQuery<string | null>({
    queryKey: shiftConversationKey(shiftId),
    queryFn: () => fetchShiftConversationId(shiftId),
    staleTime: Infinity, // conversation_id is stable once created
    enabled: !!shiftId,
    retry: 1,
  });

  // Step 2: load messages once conversation_id is known
  const { data: messages, isLoading } = useQuery<ShiftChatMessage[]>({
    queryKey: shiftChatKey(shiftId),
    queryFn: () => fetchShiftMessages(conversationId!, []),
    staleTime: STALE_TIME_MS,
    enabled: !!conversationId,
    retry: 1,
  });

  // Step 3: Realtime subscription — updates cache when new messages arrive
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`shift-chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_message",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // When Supabase confirms the INSERT (including our own synced messages),
          // prepend it to the cache. The optimistic _isPending version is replaced
          // because the id matches the client-generated UUID.
          const newMsg = payload.new as ChatMessage;
          queryClient.setQueryData<ShiftChatMessage[]>(shiftChatKey(shiftId), (old) => {
            if (!old) return [{ ...newMsg, senderName: "Ukjent", senderAvatarUrl: null }];

            // Replace the optimistic version if it exists, otherwise prepend
            const exists = old.some((m) => m.id === newMsg.id);
            if (exists) {
              return old.map((m) =>
                m.id === newMsg.id
                  ? { ...newMsg, senderName: m.senderName, senderAvatarUrl: m.senderAvatarUrl }
                  : m,
              );
            }
            return [{ ...newMsg, senderName: "Ukjent", senderAvatarUrl: null }, ...old];
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, shiftId, queryClient]);

  /**
   * Sends a message on the shift conversation.
   *
   * 1. Generates a client-side UUID for the message
   * 2. Optimistically prepends it to the cache with _isPending = true
   * 3. Enqueues a send_message action in the SQLite sync queue
   *
   * If no conversation exists yet for this shift, the send is a no-op —
   * the conversation must be created server-side first.
   */
  const sendMessage = useCallback(
    async (params: {
      content: string;
      senderProfileId: string;
      senderName: string;
      senderAvatarUrl?: string | null;
    }) => {
      if (!conversationId) return;

      const { content, senderProfileId, senderName, senderAvatarUrl } = params;
      const messageId = randomUUID();
      const now = new Date().toISOString();

      const optimistic: ShiftChatMessage = {
        id: messageId,
        conversation_id: conversationId,
        content,
        sender_id: senderProfileId,
        reply_to_id: null,
        is_system: false,
        attachments: [],
        reactions: [],
        created_at: now,
        updated_at: now,
        edited_at: null,
        deleted_at: null,
        senderName,
        senderAvatarUrl: senderAvatarUrl ?? null,
        _isPending: true,
      };

      queryClient.setQueryData<ShiftChatMessage[]>(shiftChatKey(shiftId), (old) => {
        return old ? [optimistic, ...old] : [optimistic];
      });

      await enqueue("send_message", {
        id: messageId,
        conversation_id: conversationId,
        content,
        sender_id: senderProfileId,
        reply_to_id: null,
        is_system: false,
        attachments: [],
        reactions: [],
      });
    },
    [conversationId, shiftId, queryClient],
  );

  return {
    messages: messages ?? [],
    conversationId: conversationId ?? null,
    isLoading,
    isLoadingConversation,
    sendMessage,
  };
}
