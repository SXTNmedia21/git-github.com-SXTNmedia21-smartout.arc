/**
 * Mutation hook for sending chat messages via channel_message table.
 *
 * Inserts directly to Supabase `channel_message` for correctness (new schema).
 * Performs an optimistic update: the message appears immediately in the
 * conversation with a "pending" indicator. When Realtime delivers the INSERT
 * event, the pending state clears.
 *
 * The message ID is generated client-side (UUID) for dedup via client_message_id.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { supabase } from "@/lib/supabase";
import type { MessageWithSender } from "@/hooks/queries/use-messages";

type SendMessageParams = {
  channelId: string;
  content: string;
  /** Current user's profile ID — needed for sender info */
  senderProfileId: string;
  /** Current user's display name — for optimistic display */
  senderName: string;
  /** Current user's avatar URL — for optimistic display */
  senderAvatarUrl?: string | null;
  /** If replying to a message, its ID */
  replyToId?: string | null;
  /** Workspace ID — required for channel_message insert */
  workspaceId: string;
};

/**
 * Hook: sends a chat message by inserting into channel_message.
 *
 * Returns a `sendMessage` function that:
 * 1. Generates a client-side UUID for dedup (client_message_id)
 * 2. Optimistically adds it to the query cache (with pending state)
 * 3. Inserts directly to Supabase channel_message table
 *
 * The optimistic message has `_isPending: true` for the UI to show
 * a clock icon. When Supabase Realtime delivers the INSERT event,
 * the cache is updated with the server version (without _isPending).
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  const sendMessage = useCallback(
    async (params: SendMessageParams) => {
      const {
        channelId,
        content,
        senderProfileId,
        senderName,
        senderAvatarUrl,
        replyToId,
        workspaceId,
      } = params;

      const clientMessageId = randomUUID();
      const now = new Date().toISOString();

      // Build the optimistic message for immediate display
      const optimisticMessage: MessageWithSender & { _isPending: boolean } = {
        id: clientMessageId,
        channel_id: channelId,
        content,
        sender_id: senderProfileId,
        senderName,
        senderAvatarUrl: senderAvatarUrl ?? null,
        created_at: now,
        reply_to_id: replyToId ?? null,
        reply_to_content: null,
        reply_to_sender_name: null,
        reactions: [],
        attachments: [],
        is_pinned: false,
        message_type: "text",
        origin_type: "user",
        visibility_scope: "everyone",
        sender_role: null,
        system_data: null,
        edited_at: null,
        deleted_at: null,
        client_message_id: clientMessageId,
        conversation_id: channelId,
        is_system: false,
        updated_at: now,
        _isPending: true,
      };

      // Optimistic update: prepend message to the first page of the infinite query
      queryClient.setQueryData(
        ["channel-messages", channelId],
        (old: { pages: MessageWithSender[][]; pageParams: (string | undefined)[] } | undefined) => {
          if (!old) {
            return {
              pages: [[optimisticMessage]],
              pageParams: [undefined],
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

      // Invalidate the channels list so it refetches with the new last message
      void queryClient.invalidateQueries({ queryKey: ["channels"] });

      // Insert directly to channel_message table (bypasses old sync queue)
      const { error } = await supabase.from("channel_message").insert({
        channel_id: channelId,
        workspace_id: workspaceId,
        content,
        sender_id: senderProfileId,
        client_message_id: clientMessageId,
        reply_to_id: replyToId ?? null,
      });

      if (error) {
        // Remove the optimistic message on failure
        queryClient.setQueryData(
          ["channel-messages", channelId],
          (
            old: { pages: MessageWithSender[][]; pageParams: (string | undefined)[] } | undefined,
          ) => {
            if (!old) return old;
            const newPages = old.pages.map((page) =>
              page.filter((msg) => msg.client_message_id !== clientMessageId),
            );
            return { ...old, pages: newPages };
          },
        );
        throw error;
      }

      return clientMessageId;
    },
    [queryClient],
  );

  return { sendMessage };
}
