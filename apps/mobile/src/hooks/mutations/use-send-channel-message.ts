/**
 * Send a message to a channel with optimistic update.
 * Uses client_message_id for idempotent retry.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ChannelMessageWithSender } from "@/hooks/queries/use-channel-messages";

type SendParams = {
  channelId: string;
  workspaceId: string;
  content: string;
  senderProfileId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  replyToId?: string | null;
};

export function useSendChannelMessage() {
  const queryClient = useQueryClient();

  const sendMessage = useCallback(
    async ({
      channelId,
      workspaceId,
      content,
      senderProfileId,
      senderName,
      senderAvatarUrl,
      replyToId,
    }: SendParams) => {
      const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Optimistic update: prepend to first page
      const optimisticMessage: ChannelMessageWithSender & { _isPending?: boolean } = {
        message_id: clientMessageId,
        channel_id: channelId,
        sender_id: senderProfileId,
        sender_name: senderName,
        sender_avatar: senderAvatarUrl,
        sender_role: null,
        content,
        message_type: "text",
        origin_type: "human",
        visibility_scope: "all_members",
        reply_to_id: replyToId ?? null,
        reply_to_content: null,
        reply_to_sender_name: null,
        system_data: null,
        is_pinned: false,
        edited_at: null,
        deleted_at: null,
        client_message_id: clientMessageId,
        created_at: new Date().toISOString(),
        reactions: [],
        attachments: [],
        _isPending: true,
      };

      queryClient.setQueryData(
        ["channels", "messages", channelId],
        (old: { pages: ChannelMessageWithSender[][]; pageParams: string[] } | undefined) => {
          if (!old) return { pages: [[optimisticMessage]], pageParams: [new Date().toISOString()] };
          const newPages = [...old.pages];
          newPages[0] = [optimisticMessage, ...(newPages[0] ?? [])];
          return { ...old, pages: newPages };
        },
      );

      const { error } = await supabase.from("channel_message").insert({
        channel_id: channelId,
        workspace_id: workspaceId,
        sender_id: senderProfileId,
        content,
        reply_to_id: replyToId ?? null,
        client_message_id: clientMessageId,
      });

      if (error) {
        // Revert optimistic update
        queryClient.invalidateQueries({ queryKey: ["channels", "messages", channelId] });
        throw error;
      }

      // Refresh to get server-confirmed data
      queryClient.invalidateQueries({ queryKey: ["channels", "messages", channelId] });
      queryClient.invalidateQueries({ queryKey: ["channels", "list"] });
    },
    [queryClient],
  );

  return { sendMessage };
}
