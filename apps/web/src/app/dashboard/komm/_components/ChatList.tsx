"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "@smartout/i18n";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { ChannelWithPreview } from "../_hooks/channel-types";
import { ChannelItem } from "./ChannelItem";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type WorkspaceMember = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  department_name: string | null;
};

function useWorkspaceMembers(profileId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["workspace-members", workspace.workspace_id],
    staleTime: 60_000,
    queryFn: async (): Promise<WorkspaceMember[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, role, department:department!inner(name)")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .neq("profile_id", profileId)
        .neq("role", "system")
        .order("display_name");
      if (error) throw error;
      return (data ?? []).map((p: Record<string, unknown>) => ({
        profile_id: p.profile_id as string,
        display_name: p.display_name as string | null,
        avatar_url: p.avatar_url as string | null,
        role: p.role as string,
        department_name: (p.department as { name: string } | null)?.name ?? null,
      }));
    },
  });
}

const INITIALS_COLORS = [
  "bg-blue-500/15 text-blue-500",
  "bg-purple-500/15 text-purple-500",
  "bg-green-500/15 text-green-500",
  "bg-pink-500/15 text-pink-500",
  "bg-cyan-500/15 text-cyan-500",
  "bg-orange-500/15 text-orange-500",
  "bg-red-500/15 text-red-500",
];

function getColorClass(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return INITIALS_COLORS[hash % INITIALS_COLORS.length]!;
}

type Props = {
  channels: ChannelWithPreview[];
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  profileId: string;
};

export function ChatList({ channels, activeChannelId, onSelectChannel, profileId }: Props) {
  const { t } = useTranslation("komm");
  const [filter, setFilter] = useState("");
  const { data: members } = useWorkspaceMembers(profileId);
  const { workspace } = useWorkspace();

  // Active DM conversations
  const dmChannels = useMemo(
    () => channels.filter((ch) => ch.channel_type === "direct"),
    [channels],
  );

  // Filter members by name
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const lower = filter.toLowerCase();
    const filtered = lower
      ? members.filter((m) => m.display_name?.toLowerCase().includes(lower))
      : members;
    return filtered;
  }, [members, filter]);

  // Create DM by tapping a person
  const handleStartDM = async (memberProfileId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_channel", {
      p_workspace_id: workspace.workspace_id,
      p_channel_type: "direct",
      p_name: undefined,
      p_created_by: profileId,
      p_member_profile_ids: [profileId, memberProfileId],
    });
    if (error) return;
    const result = data as { channel_id: string; created: boolean };
    onSelectChannel(result.channel_id);
  };

  return (
    <div>
      {/* Filter */}
      <div className="p-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("chat_list.filter_placeholder")}
          className="h-8 text-xs"
        />
      </div>

      {/* Active DMs */}
      {dmChannels.length > 0 && (
        <>
          {dmChannels.map((ch) => (
            <ChannelItem
              key={ch.channel_id}
              channel={ch}
              isActive={ch.channel_id === activeChannelId}
              unreadCount={ch.unread_count}
              onClick={() => onSelectChannel(ch.channel_id)}
            />
          ))}
          <div className="bg-border mx-3 my-2 h-px" />
        </>
      )}

      {/* All team members directory */}
      <div className="text-muted-foreground px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase">
        {t("chat_list.all_members")}
      </div>
      {(filteredMembers ?? []).map((member) => (
        <button
          key={member.profile_id}
          onClick={() => handleStartDM(member.profile_id)}
          className="hover:bg-accent/50 flex w-full items-center gap-3 px-3 py-2 text-left opacity-60 transition-all hover:opacity-100"
        >
          <Avatar className="h-9 w-9">
            {member.avatar_url && <AvatarImage src={member.avatar_url} />}
            <AvatarFallback
              className={cn("text-xs font-semibold", getColorClass(member.display_name ?? "?"))}
            >
              {(member.display_name ?? "?")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {member.display_name ?? t("chat_list.unknown")}
            </p>
            <p className="text-muted-foreground text-xs">
              {member.department_name ?? ""} · {member.role}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
