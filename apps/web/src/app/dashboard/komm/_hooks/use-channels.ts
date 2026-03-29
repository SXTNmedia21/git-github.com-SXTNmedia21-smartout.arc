"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { channelKeys } from "./channel-keys";
import type { ChannelWithPreview, ChannelGroup, ChannelType } from "./channel-types";

const TYPE_LABEL_KEYS: Record<ChannelType, string> = {
  department: "channel_type.department",
  team: "channel_type.team",
  session: "channel_type.session",
  custom: "channel_type.channel",
  direct: "channel_type.direct",
  news: "channel_type.news",
  skill: "channel_type.skill",
};

const TYPE_ORDER: ChannelType[] = [
  "department",
  "team",
  "session",
  "custom",
  "direct",
  "news",
  "skill",
];

export function useChannels() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: channelKeys.list(workspaceId),
    staleTime: 30_000,
    queryFn: async (): Promise<ChannelGroup[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_my_channels", {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;

      const channels = (data ?? []) as ChannelWithPreview[];

      // Group by type, preserving order
      const grouped = new Map<ChannelType, ChannelWithPreview[]>();
      for (const ch of channels) {
        const existing = grouped.get(ch.channel_type) ?? [];
        existing.push(ch);
        grouped.set(ch.channel_type, existing);
      }

      return TYPE_ORDER.filter((t) => grouped.has(t)).map((t) => ({
        type: t,
        labelKey: TYPE_LABEL_KEYS[t],
        channels: grouped.get(t)!,
      }));
    },
  });
}
