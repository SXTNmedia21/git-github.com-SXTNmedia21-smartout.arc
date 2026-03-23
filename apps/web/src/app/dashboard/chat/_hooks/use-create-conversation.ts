"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { chatKeys } from "./chat-keys";
import type { ChatConversationType } from "./chat-types";
import { toast } from "sonner";

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({
      type,
      name,
      description,
      createdBy,
      participantIds,
    }: {
      type: ChatConversationType;
      name?: string;
      description?: string;
      createdBy: string;
      participantIds: string[];
    }) => {
      const supabase = createClient();

      // 1. Create conversation
      const { data: conv, error: convError } = await supabase
        .from("chat_conversation")
        .insert({
          workspace_id: workspaceId,
          type,
          name: name ?? null,
          description: description ?? null,
          created_by: createdBy,
        })
        .select()
        .single();

      if (convError) throw convError;

      // 2. Add all participants (including creator as admin)
      const allIds = [...new Set([createdBy, ...participantIds])];
      const participants = allIds.map((profileId) => ({
        conversation_id: conv.id,
        profile_id: profileId,
        role: profileId === createdBy ? "admin" : "member",
      }));

      const { error: partError } = await supabase.from("chat_participant").insert(participants);

      if (partError) throw partError;

      return conv;
    },

    onSuccess: (data, { type, createdBy }) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
      toast.success("Samtale opprettet");

      void emit({
        event: "conversation created",
        workspace_id: workspaceId,
        actor_id: createdBy,
        properties: { data: { conversation_id: data?.id ?? "", type: type ?? "" } },
      });
    },

    onError: () => {
      toast.error("Kunne ikke opprette samtale");
    },
  });
}
