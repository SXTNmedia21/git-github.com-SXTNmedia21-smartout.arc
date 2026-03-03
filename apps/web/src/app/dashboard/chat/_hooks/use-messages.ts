"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { chatKeys } from "./chat-keys";
import type { MessageWithSender } from "./chat-types";
import { toast } from "sonner";

const PAGE_SIZE = 50;

/**
 * Fetch messages for a conversation with infinite scroll (load older on scroll up).
 */
export function useMessages(conversationId: string | null) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useInfiniteQuery({
    queryKey: chatKeys.messages(workspaceId, conversationId ?? "none"),
    enabled: !!conversationId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<MessageWithSender[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("chat_message")
        .select(
          `
          *,
          sender:profile!inner(profile_id, full_name, avatar_url, role),
          reply_to:chat_message!reply_to_id(
            id,
            content,
            sender:profile!inner(profile_id, full_name, avatar_url, role)
          )
        `,
        )
        .eq("conversation_id", conversationId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (error) throw error;
      return (data ?? []) as unknown as MessageWithSender[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
  });
}

/**
 * Send a message with optimistic update.
 */
export function useSendMessage(conversationId: string | null, profileId: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const queryKey = chatKeys.messages(workspaceId, conversationId ?? "none");

  return useMutation({
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      if (!conversationId) throw new Error("No conversation selected");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("chat_message")
        .insert({
          conversation_id: conversationId,
          sender_id: profileId,
          content,
          reply_to_id: replyToId ?? null,
        })
        .select(`*, sender:profile!inner(profile_id, full_name, avatar_url, role)`)
        .single();

      if (error) throw error;
      return data;
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      // Also refresh conversation list (new last_message)
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
    },

    onError: () => {
      toast.error("Kunne ikke sende melding");
    },
  });
}
