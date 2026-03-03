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
