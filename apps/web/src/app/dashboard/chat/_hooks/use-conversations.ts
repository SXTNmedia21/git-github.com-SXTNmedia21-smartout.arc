"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { chatKeys } from "./chat-keys";
import type { ConversationWithPreview } from "./chat-types";

export function useConversations() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: chatKeys.conversations(workspaceId),
    queryFn: async (): Promise<ConversationWithPreview[]> => {
      const supabase = createClient();

      // Fetch conversations where user is active participant
      const { data: conversations, error } = await supabase
        .from("chat_conversation")
        .select(
          `
          *,
          participants:chat_participant!inner(
            role,
            last_read_at,
            profile:profile!inner(profile_id, full_name, avatar_url, role)
          )
        `,
        )
        .eq("workspace_id", workspaceId)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      if (!conversations) return [];

      // For each conversation, fetch last message + compute unread
      const withPreviews = await Promise.all(
        conversations.map(async (conv) => {
          const { data: lastMsg } = await supabase
            .from("chat_message")
            .select(
              "content, created_at, sender:profile!inner(profile_id, full_name, avatar_url, role)",
            )
            .eq("conversation_id", conv.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Find current user's participant record for unread calc
          const myParticipant = conv.participants.find(
            (p: { profile: { profile_id: string } }) => p.profile.profile_id !== undefined,
          );
          const lastReadAt = myParticipant?.last_read_at ?? conv.created_at;

          const { count } = await supabase
            .from("chat_message")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .is("deleted_at", null)
            .gt("created_at", lastReadAt);

          return {
            ...conv,
            last_message: lastMsg ?? null,
            unread_count: count ?? 0,
          } as ConversationWithPreview;
        }),
      );

      return withPreviews;
    },
  });
}
