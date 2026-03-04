"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { chatKeys } from "./chat-keys";

/**
 * Subscribe to realtime changes for a conversation.
 * Invalidates message cache on INSERT/UPDATE, conversation list on changes.
 */
export function useChatRealtime(conversationId: string | null) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`chat:${workspaceId}:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_message",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: chatKeys.messages(workspaceId, conversationId),
          });
          // Also refresh conversation list (new last_message / unread)
          queryClient.invalidateQueries({
            queryKey: chatKeys.conversations(workspaceId),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_participant",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: chatKeys.participants(workspaceId, conversationId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, conversationId, queryClient]);
}
