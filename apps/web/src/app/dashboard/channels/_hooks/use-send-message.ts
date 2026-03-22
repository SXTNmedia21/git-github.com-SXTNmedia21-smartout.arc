"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { channelKeys } from "./channel-keys";
import { toast } from "sonner";

export function useSendMessage(channelId: string | null, profileId: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({
      content,
      replyToId,
    }: {
      content: string;
      replyToId?: string;
    }) => {
      if (!channelId) throw new Error("No channel selected");
      const supabase = createClient();
      const clientMessageId = crypto.randomUUID();

      const { data, error } = await supabase
        .from("channel_message")
        .insert({
          channel_id: channelId,
          workspace_id: workspaceId,
          sender_id: profileId,
          content,
          reply_to_id: replyToId ?? null,
          client_message_id: clientMessageId,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: () => {
      void emit({
        event: "channel.message.sent",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          channel_id: channelId ?? "",
          origin_type: "human",
          message_type: "text",
        },
        entity: {
          entity_type: "channel_message",
          entity_id: channelId ?? "",
        },
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.messages(workspaceId, channelId ?? "none"),
      });
      queryClient.invalidateQueries({
        queryKey: channelKeys.list(workspaceId),
      });
    },

    onError: () => {
      toast.error("Kunne ikke sende melding");
    },
  });
}
