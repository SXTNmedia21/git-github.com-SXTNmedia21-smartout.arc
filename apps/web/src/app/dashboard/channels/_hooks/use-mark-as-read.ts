"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { channelKeys } from "./channel-keys";

export function useMarkAsRead(channelId: string | null, profileId: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({ messageId }: { messageId: string }) => {
      if (!channelId) throw new Error("No channel selected");
      const supabase = createClient();

      const { error } = await supabase
        .from("channel_member")
        .update({ last_read_message_id: messageId })
        .eq("channel_id", channelId)
        .eq("profile_id", profileId);

      if (error) throw error;
      return { messageId };
    },

    onSuccess: (_data, variables) => {
      void emit({
        event: "channel.read",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          channel_id: channelId ?? "",
          message_id: variables.messageId,
        },
        entity: {
          entity_type: "channel",
          entity_id: channelId ?? "",
        },
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.unread(workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: channelKeys.list(workspaceId),
      });
    },
  });
}
