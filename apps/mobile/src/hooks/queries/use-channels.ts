/**
 * Fetches all channels the current user belongs to via the get_my_channels() RPC.
 * Groups channels into sections for display in SectionList.
 * Uses the new channel schema (not chat_conversation).
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type ChannelType = Database["public"]["Enums"]["comm_channel_type"];

export type ChannelWithPreview = {
  channel_id: string;
  workspace_id: string;
  channel_type: ChannelType;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  is_read_only: boolean;
  is_archived: boolean;
  audio_policy: string;
  video_policy: string;
  member_count: number;
  unread_count: number;
  last_message_content: string | null;
  last_message_at: string | null;
  last_message_sender_name: string | null;
  last_message_sender_avatar: string | null;
};

export type ChannelSection = {
  title: string;
  data: ChannelWithPreview[];
};

const TYPE_LABELS: Record<ChannelType, string> = {
  department: "Avdelinger",
  team: "Team",
  session: "Aktiv vakt",
  custom: "Kanaler",
  direct: "Direktemeldinger",
  news: "Nyheter",
  skill: "Ferdigheter",
  desk: "Helpdesk", // ADR-0161 — rendered in dedicated desk admin, NOT the Kanaler sidebar (not in TYPE_ORDER)
  query_thread: "Henvendelser", // ADR-0161 — dedicated type for helpdesk conversations, filtered out of Kanaler
};

const TYPE_ORDER: ChannelType[] = [
  "session",
  "department",
  "team",
  "custom",
  "direct",
  "news",
  "skill",
];

async function fetchChannels(workspaceId: string): Promise<ChannelWithPreview[]> {
  const { data, error } = await supabase.rpc("get_my_channels", {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  return (data ?? []) as ChannelWithPreview[];
}

export function useChannels(workspaceId: string | null) {
  return useQuery({
    queryKey: ["channels", "list", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchChannels(workspaceId!),
  });
}

export function useGroupedChannels(workspaceId: string | null, isDuringShift: boolean) {
  const { data, ...rest } = useChannels(workspaceId);

  const sections = useMemo((): ChannelSection[] => {
    if (!data) return [];

    const grouped = new Map<ChannelType, ChannelWithPreview[]>();
    for (const ch of data) {
      const existing = grouped.get(ch.channel_type) ?? [];
      existing.push(ch);
      grouped.set(ch.channel_type, existing);
    }

    return TYPE_ORDER.filter((t) => {
      if (t === "session" && !isDuringShift) return false;
      return grouped.has(t);
    }).map((t) => ({
      title: TYPE_LABELS[t],
      data: grouped.get(t)!,
    }));
  }, [data, isDuringShift]);

  return { sections, data, ...rest };
}
