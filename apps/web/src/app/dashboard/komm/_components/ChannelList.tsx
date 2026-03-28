"use client";

import { useState } from "react";
import { useUnreadCounts } from "../_hooks/use-unread-counts";
import { ChannelItem } from "./ChannelItem";
import { CreateChannel } from "./CreateChannel";
import type { ChannelGroup } from "../_hooks/channel-types";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@smartout/i18n";

type Props = {
  channelGroups: ChannelGroup[];
  isLoading: boolean;
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  profileId: string;
};

export function ChannelList({
  channelGroups,
  isLoading,
  activeChannelId,
  onSelectChannel,
  profileId,
}: Props) {
  const { t } = useTranslation("komm");
  const { data: unreadCounts } = useUnreadCounts();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const unreadMap = new Map((unreadCounts ?? []).map((u) => [u.channel_id, u.unread_count]));

  const filtered = search
    ? channelGroups
        .map((g) => ({
          ...g,
          channels: g.channels.filter(
            (ch) => ch.name?.toLowerCase().includes(search.toLowerCase()) ?? false,
          ),
        }))
        .filter((g) => g.channels.length > 0)
    : channelGroups;

  return (
    <div className="bg-card flex w-80 flex-shrink-0 flex-col border-r">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">{t("channel.header")}</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="border-b p-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
          <Input
            placeholder={t("channel.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Channel groups */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
                <div className="bg-muted h-4 w-32 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6">
            <p className="text-muted-foreground text-xs">{t("channel.empty")}</p>
          </div>
        ) : (
          filtered.map((group) => (
            <div key={group.type}>
              <div className="text-muted-foreground px-3 pt-3 pb-1 text-[11px] font-medium tracking-wider uppercase">
                {t(group.labelKey)}
              </div>
              {group.channels.map((ch) => (
                <ChannelItem
                  key={ch.channel_id}
                  channel={ch}
                  isActive={ch.channel_id === activeChannelId}
                  unreadCount={unreadMap.get(ch.channel_id) ?? 0}
                  onClick={() => onSelectChannel(ch.channel_id)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Create channel modal */}
      {showCreate && (
        <CreateChannel
          profileId={profileId}
          onClose={() => setShowCreate(false)}
          onCreated={(channelId) => {
            setShowCreate(false);
            onSelectChannel(channelId);
          }}
        />
      )}
    </div>
  );
}
