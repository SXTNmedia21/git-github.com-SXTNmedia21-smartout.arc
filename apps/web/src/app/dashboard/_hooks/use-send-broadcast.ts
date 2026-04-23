"use client";

/**
 * useSendBroadcast — Resolves or creates the workspace news channel, then
 * inserts an announcement message with a target recipient list.
 *
 * Why a "news" channel: broadcasts are one-directional operational announcements.
 * Re-using a persistent news channel keeps history in one place and avoids
 * creating a new channel per broadcast.
 *
 * Invalidates all dashboard queries on success so the broadcast count widget refreshes.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit, nonEmpty } from "@smartout/telemetry";
type BroadcastInput = {
  content: string;
  recipientIds: string[];
  profileId: string;
};

export function useSendBroadcast() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const wsId = workspace.workspace_id;

  return useMutation({
    mutationFn: async (input: BroadcastInput) => {
      const supabase = createClient();

      // Resolve the workspace-level news channel, creating it on first use
      let channelId: string;
      const { data: existing } = await supabase
        .from("channel")
        .select("id")
        .eq("workspace_id", wsId)
        .eq("channel_type", "news")
        .limit(1)
        .maybeSingle();

      if (existing) {
        channelId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from("channel")
          .insert({
            workspace_id: wsId,
            channel_type: "news",
            name: "Driftsmeldinger",
            created_by: input.profileId,
          })
          .select("id")
          .single();

        if (createErr) throw createErr;
        channelId = created.id;
      }

      const { error } = await supabase.from("channel_message").insert({
        channel_id: channelId,
        workspace_id: wsId,
        sender_id: input.profileId,
        content: input.content,
        message_type: "announcement",
        delivery_mode: "notification_only",
        target_profile_ids: input.recipientIds,
      });

      if (error) throw error;
      return { channelId, recipientCount: input.recipientIds.length };
    },
    onSuccess: (result, input) => {
      void emit({
        event: "communication.broadcast_sent",
        workspace_id: nonEmpty(wsId, "workspace_id"),
        actor_id: nonEmpty(input.profileId, "actor_id"),
        properties: {
          metadata: {
            source: "dashboard_broadcast",
            recipient_count: result.recipientCount,
            channel_id: result.channelId,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
