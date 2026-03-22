"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { channelKeys } from "./channel-keys";

export function useToggleReaction(channelId: string | null, profileId: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!channelId) throw new Error("No channel selected");
      const supabase = createClient();

      // Check if reaction exists
      const { data: existing } = await supabase
        .from("channel_message_reaction")
        .select("id")
        .eq("message_id", messageId)
        .eq("profile_id", profileId)
        .eq("emoji", emoji)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("channel_message_reaction")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return { action: "removed" as const, emoji };
      }

      const { error } = await supabase.from("channel_message_reaction").insert({
        message_id: messageId,
        channel_id: channelId,
        workspace_id: workspaceId,
        profile_id: profileId,
        emoji,
      });
      if (error) throw error;
      return { action: "added" as const, emoji };
    },

    onSuccess: (result, variables) => {
      const event =
        result.action === "added"
          ? "channel.reaction.added"
          : ("channel.reaction.removed" as const);
      void emit({
        event,
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          channel_id: channelId ?? "",
          message_id: variables.messageId,
          emoji: result.emoji,
        },
        entity: {
          entity_type: "channel_message",
          entity_id: variables.messageId,
        },
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.messages(workspaceId, channelId ?? "none"),
      });
    },
  });
}
