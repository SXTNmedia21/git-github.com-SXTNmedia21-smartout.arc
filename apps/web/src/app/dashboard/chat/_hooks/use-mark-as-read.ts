"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
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
      return { conversationId, profileId };
    },

    onSuccess: (result) => {
      if (!result) return;
      void emit({
        event: "chat.read",
        workspace_id: workspaceId,
        actor_id: result.profileId,
        properties: {
          conversation_id: result.conversationId,
          profile_id: result.profileId,
        },
        entity: {
          entity_type: "chat_message",
          entity_id: result.conversationId,
        },
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
    },
  });
}
