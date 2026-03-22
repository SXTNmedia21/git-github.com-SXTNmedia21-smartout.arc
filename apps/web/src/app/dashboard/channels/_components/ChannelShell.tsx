"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useChannels } from "../_hooks/use-channels";
import { useChannelRealtime } from "../_hooks/use-channel-realtime";
import { ChannelList } from "./ChannelList";
import { ChannelHeader } from "./ChannelHeader";
import { MessageTimeline } from "./MessageTimeline";
import { MessageInput } from "./MessageInput";
import { MemberPanel } from "./MemberPanel";
import { MessageSquare } from "lucide-react";

export function ChannelShell({ profileId }: { profileId: string }) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);

  const { data: channelGroups, isLoading } = useChannels();
  useChannelRealtime(workspaceId, activeChannelId);

  // Find active channel data
  const activeChannel = channelGroups
    ?.flatMap((g) => g.channels)
    .find((ch) => ch.channel_id === activeChannelId);

  return (
    <div className="flex h-full overflow-hidden rounded-lg border">
      {/* Left: Channel list */}
      <ChannelList
        channelGroups={channelGroups ?? []}
        isLoading={isLoading}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
        profileId={profileId}
      />

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
              Velg en kanal for å starte
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
