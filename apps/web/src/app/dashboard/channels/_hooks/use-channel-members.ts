"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { channelKeys } from "./channel-keys";
import type { ChannelMemberWithProfile } from "./channel-types";
import { toast } from "sonner";

export function useChannelMembers(channelId: string | null) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: channelKeys.members(workspaceId, channelId ?? "none"),
    enabled: !!channelId,
    queryFn: async (): Promise<ChannelMemberWithProfile[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("channel_member")
        .select(
          `*, profile:profile!inner(profile_id, display_name, avatar_url, role)`,
        )
        .eq("channel_id", channelId!)
        .is("left_at", null)
        .order("joined_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ChannelMemberWithProfile[];
    },
  });
}

export function useAddChannelMember(
  channelId: string | null,
  profileId: string,
) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({ memberProfileId }: { memberProfileId: string }) => {
      if (!channelId) throw new Error("No channel selected");
      const supabase = createClient();
      const { error } = await supabase.from("channel_member").insert({
        channel_id: channelId,
        workspace_id: workspaceId,
        profile_id: memberProfileId,
      });
      if (error) throw error;
      return { memberProfileId };
    },

    onSuccess: (_data, variables) => {
      void emit({
        event: "channel.member.joined",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: { channel_id: channelId ?? "", role: "member" },
        entity: {
          entity_type: "channel_member",
          entity_id: variables.memberProfileId,
        },
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.members(workspaceId, channelId ?? "none"),
      });
    },

    onError: () => {
      toast.error("Kunne ikke legge til medlem");
    },
  });
}

export function useRemoveChannelMember(
  channelId: string | null,
  profileId: string,
) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({ memberProfileId }: { memberProfileId: string }) => {
      if (!channelId) throw new Error("No channel selected");
      const supabase = createClient();
      const { error } = await supabase
        .from("channel_member")
        .update({ left_at: new Date().toISOString() })
        .eq("channel_id", channelId)
        .eq("profile_id", memberProfileId);
      if (error) throw error;
      return { memberProfileId };
    },

    onSuccess: (_data, variables) => {
      void emit({
        event: "channel.member.left",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: { channel_id: channelId ?? "" },
        entity: {
          entity_type: "channel_member",
          entity_id: variables.memberProfileId,
        },
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: channelKeys.members(workspaceId, channelId ?? "none"),
      });
    },

    onError: () => {
      toast.error("Kunne ikke fjerne medlem");
    },
  });
}
