"use client";

/**
 * useSendBroadcast — Resolves or creates the workspace news channel, then
 * posts a targeted announcement via publish_announcement_atomic RPC (Track C M4).
 *
 * Why a "news" channel: broadcasts are one-directional operational announcements.
 * Re-using a persistent news channel keeps history in one place and avoids
 * creating a new channel per broadcast.
 *
 * V2 RPC migration: channel-resolution logic preserved (RPC takes a single
 * channel_id so we resolve first, then hand off to the atomic RPC). The RPC
 * handles channel_message insert + announcement_meta sidecar atomically.
 *
 * Invalidates all dashboard queries on success so the broadcast count widget refreshes.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit, nonEmpty } from "@smartout/telemetry";
import { emitAnnouncementPublished } from "@smartout/ai/capabilities/communication/emit-announcement-events";

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

      // Resolve the workspace-level news channel, creating it on first use.
      // Channel resolution stays client-side; only the message write goes through RPC.
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

      // V2: delegate to publish_announcement_atomic RPC (Track C M4).
      // Atomically inserts channel_message + announcement_meta sidecar.
      const { data, error } = await supabase.rpc("publish_announcement_atomic", {
        p_workspace_id: wsId,
        p_actor_profile_id: input.profileId,
        p_channel_id: channelId,
        p_content: input.content,
        p_visibility_scope: input.recipientIds.length > 0 ? "targeted_members" : "all_members",
        p_target_profile_ids: input.recipientIds,
        p_system_data: { source: "dashboard_broadcast" },
        p_kind: "general",
        p_tier: "work",
        p_tags: [],
        p_linked_entity_type: null,
        p_linked_entity_id: null,
        p_client_message_id: crypto.randomUUID(),
      });

      if (error) throw error;
      return { channelId, messageId: data as string, recipientCount: input.recipientIds.length };
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
      // V2 channel.message.sent with announcement properties via shared helper (spec §9.b).
      // Broadcast path defaults to kind='general' (formerly workspace_news), tier='work' per §9 table.
      void emitAnnouncementPublished({
        workspace_id: nonEmpty(wsId, "workspace_id"),
        actor_id: nonEmpty(input.profileId, "actor_id"),
        message_id: result.messageId,
        channel_id: result.channelId,
        origin_type: "human",
        kind: "general",
        tier: "work",
        target_profile_count: result.recipientCount,
        visibility_scope: result.recipientCount > 0 ? "targeted_members" : "all_members",
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
