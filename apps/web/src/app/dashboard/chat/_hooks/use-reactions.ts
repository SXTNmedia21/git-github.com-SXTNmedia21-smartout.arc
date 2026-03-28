"use client";

// FROZEN: Chat module is superseded by Komm (ADR-0063).
// Only bug fixes and telemetry backfill permitted. No new features.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
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

      const action = current.includes(profileId) ? ("removed" as const) : ("added" as const);

      if (action === "removed") {
        reactions[emoji] = current.filter((id) => id !== profileId);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...current, profileId];
      }

      const { error: updateError } = await supabase
        .from("chat_message")
        .update({ reactions })
        .eq("id", messageId);

      if (updateError) throw updateError;
      return { action, emoji, messageId, profileId };
    },

    onSuccess: (result) => {
      if (!result) return;
      void emit({
        event: "chat.reaction.toggled",
        workspace_id: workspaceId,
        actor_id: result.profileId,
        properties: {
          conversation_id: conversationId ?? "",
          message_id: result.messageId,
          emoji: result.emoji,
          action: result.action,
        },
        entity: {
          entity_type: "chat_message",
          entity_id: result.messageId,
        },
      });
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
