/**
 * Mutation hook for sending chat messages with offline support.
 *
 * Enqueues the message via the sync queue (SQLite) so it works offline.
 * Performs an optimistic update: the message appears immediately in the
 * conversation with a "pending" indicator. When the sync worker processes
 * it successfully, the pending state clears.
 *
 * The message ID is generated client-side (UUID) so it can be matched
 * after syncing.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { enqueue } from "@/lib/sync/queue";
import type { MessageWithSender } from "@/hooks/queries/use-messages";

type SendMessageParams = {
  conversationId: string;
  content: string;
  /** Current user's profile ID — needed for sender info */
  senderProfileId: string;
  /** Current user's display name — for optimistic display */
  senderName: string;
  /** Current user's avatar URL — for optimistic display */
  senderAvatarUrl?: string | null;
  /** If replying to a message, its ID */
  replyToId?: string | null;
};

/**
 * Hook: sends a chat message via the offline sync queue.
 *
 * Returns a `sendMessage` function that:
 * 1. Generates a client-side UUID for the message
 * 2. Optimistically adds it to the query cache (with pending state)
 * 3. Enqueues it in the SQLite write queue for background sync
 *
 * The optimistic message has `_isPending: true` for the UI to show
 * a clock icon. When Supabase Realtime delivers the INSERT event,
 * the cache is updated with the server version (without _isPending).
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  const sendMessage = useCallback(
    async (params: SendMessageParams) => {
      const { conversationId, content, senderProfileId, senderName, senderAvatarUrl, replyToId } =
        params;

      const messageId = randomUUID();
      const now = new Date().toISOString();

      // Build the optimistic message for immediate display
      const optimisticMessage: MessageWithSender & { _isPending: boolean } = {
        id: messageId,
        conversation_id: conversationId,
        content,
        sender_id: senderProfileId,
        reply_to_id: replyToId ?? null,
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

      // Optimistic update: prepend message to the first page of the infinite query
      queryClient.setQueryData(
        ["messages", conversationId],
        (old: { pages: MessageWithSender[][]; pageParams: number[] } | undefined) => {
          if (!old) {
            return {
              pages: [[optimisticMessage]],
              pageParams: [0],
            };
          }

          // Messages are newest-first, so prepend to the first page
          const newPages = [...old.pages];
          newPages[0] = [optimisticMessage, ...(newPages[0] ?? [])];

          return {
            ...old,
            pages: newPages,
          };
        },
      );

      // Also update the conversations list to show this as the latest message
      queryClient.setQueryData(["conversations"], (old: unknown[] | undefined) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((conv: Record<string, unknown>) => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              lastMessage: {
                content,
                created_at: now,
                sender_id: senderProfileId,
              },
              lastMessageSenderName: senderName,
            };
          }
          return conv;
        });
      });

      // Enqueue in the SQLite write queue for background sync
      await enqueue("send_message", {
        id: messageId,
        conversation_id: conversationId,
        content,
        sender_id: senderProfileId,
        reply_to_id: replyToId ?? null,
        is_system: false,
        attachments: [],
        reactions: [],
      });

      return messageId;
    },
    [queryClient],
  );

  return { sendMessage };
}
