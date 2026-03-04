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
