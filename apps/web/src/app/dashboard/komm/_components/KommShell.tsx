"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useChannels } from "../_hooks/use-channels";
import { useUnreadCounts } from "../_hooks/use-unread-counts";
import { useChannelRealtime } from "../_hooks/use-channel-realtime";
import { SubTabs, type KommTab } from "./SubTabs";
import { ChannelList } from "./ChannelList";
import { ChatList } from "./ChatList";
import { NewsFeed } from "./NewsFeed";
import { ChannelHeader } from "./ChannelHeader";
import { MessageTimeline } from "./MessageTimeline";
import { MessageInput } from "./MessageInput";
import { MemberPanel } from "./MemberPanel";
import { MessageSquare } from "lucide-react";

export function KommShell({ profileId }: { profileId: string }) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const [activeTab, setActiveTab] = useState<KommTab>("kanaler");
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);

  const { data: channelGroups, isLoading } = useChannels();
  const { data: unreadCounts } = useUnreadCounts();
  useChannelRealtime(workspaceId, activeChannelId);

  // Calculate unread totals for sub-tab badges
  const allChannels = channelGroups?.flatMap((g) => g.channels) ?? [];
  const unreadMap = new Map((unreadCounts ?? []).map((u) => [u.channel_id, u.unread_count]));
  const channelUnread = allChannels
    .filter((ch) => ch.channel_type !== "direct")
    .reduce((sum, ch) => sum + (unreadMap.get(ch.channel_id) ?? 0), 0);
  const chatUnread = allChannels
    .filter((ch) => ch.channel_type === "direct")
    .reduce((sum, ch) => sum + (unreadMap.get(ch.channel_id) ?? 0), 0);

  const activeChannel = allChannels.find((ch) => ch.channel_id === activeChannelId);

  // When selecting a channel, switch to conversation view
  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setReplyToId(null);
    setShowMembers(false);
  };

  return (
    <div className="flex h-full overflow-hidden rounded-lg border">
      {/* Left panel: sub-tabs + list */}
      <div className="bg-card flex w-80 flex-shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-base font-semibold">Komm</h2>
        </div>
        <SubTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          channelUnread={channelUnread}
          chatUnread={chatUnread}
        />
        <div className="flex-1 overflow-y-auto">
          {activeTab === "kanaler" && (
            <ChannelList
              channelGroups={channelGroups ?? []}
              isLoading={isLoading}
              activeChannelId={activeChannelId}
              onSelectChannel={handleSelectChannel}
              profileId={profileId}
            />
          )}
          {activeTab === "chat" && (
            <ChatList
              channels={allChannels}
              activeChannelId={activeChannelId}
              onSelectChannel={handleSelectChannel}
              profileId={profileId}
            />
          )}
          {activeTab === "nyheter" && <NewsFeed channels={allChannels} profileId={profileId} />}
        </div>
      </div>

      {/* Center: Messages */}
      <div className="flex min-w-0 flex-1 flex-col">
        {activeChannel ? (
          <>
            <ChannelHeader
              channel={activeChannel}
              showMembers={showMembers}
              onToggleMembers={() => setShowMembers(!showMembers)}
            />
            <MessageTimeline
              channelId={activeChannelId!}
              profileId={profileId}
              onReply={setReplyToId}
            />
            {!activeChannel.is_read_only && (
              <MessageInput
                channelId={activeChannelId!}
                profileId={profileId}
                replyToId={replyToId}
                onCancelReply={() => setReplyToId(null)}
              />
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <MessageSquare className="text-muted-foreground/40 h-12 w-12" />
            <p className="text-muted-foreground text-sm">
              Velg en kanal eller person for å begynne
            </p>
          </div>
        )}
      </div>

      {/* Right: Member panel */}
      {showMembers && activeChannelId && (
        <MemberPanel
          channelId={activeChannelId}
          profileId={profileId}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );
}
