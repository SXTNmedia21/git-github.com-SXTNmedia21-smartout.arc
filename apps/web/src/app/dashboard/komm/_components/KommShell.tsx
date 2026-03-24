"use client";

import { useState, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useChannels } from "../_hooks/use-channels";
import { useUnreadCounts } from "../_hooks/use-unread-counts";
import { useChannelRealtime } from "../_hooks/use-channel-realtime";
import { useCallSignaling } from "../_hooks/use-call-signaling";
import { useCallRealtime } from "../_hooks/use-call-realtime";
import { useLiveKitCall } from "../_hooks/use-livekit-call";
import { useCallInvite } from "../_hooks/use-call-invite";
import { useStartCall } from "../_hooks/use-start-call";
import { getLiveKitToken } from "@smartout/walkie-talkie";
import { createClient } from "@smartout/supabase/client";
import { SubTabs, type KommTab } from "./SubTabs";
import { ChannelList } from "./ChannelList";
import { ChatList } from "./ChatList";
import { NewsFeed } from "./NewsFeed";
import { ChannelHeader } from "./ChannelHeader";
import { MessageTimeline } from "./MessageTimeline";
import { MessageInput } from "./MessageInput";
import { MemberPanel } from "./MemberPanel";
import { IncomingCallOverlay } from "./IncomingCallOverlay";
import { CallBar } from "./CallBar";
import { MessageSquare, Loader2 } from "lucide-react";
import { ConnectionState } from "livekit-client";
import { toast } from "sonner";

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

  // Voice call hooks
  const { incomingCall, dismissIncoming } = useCallSignaling(profileId, activeChannelId);
  useCallRealtime(activeChannelId);
  const livekit = useLiveKitCall();
  const callInvite = useCallInvite();
  const startCall = useStartCall();
  const isInCall = livekit.connectionState === ConnectionState.Connected;

  // H7: Destructure stable refs for useCallback deps (connect/disconnect are useCallback-wrapped)
  const { connect: livekitConnect, disconnect: livekitDisconnect } = livekit;

  const handleJoinCall = useCallback(async () => {
    if (!activeChannelId) return;
    try {
      const supabase = createClient();
      const { token, serverUrl } = await getLiveKitToken(supabase, {
        channelId: activeChannelId,
        workspaceId,
      });
      await livekitConnect(serverUrl, token);
    } catch {
      toast.error("Kunne ikke koble til samtale");
    }
  }, [activeChannelId, workspaceId, livekitConnect]);

  // H4: Accept-then-connect with recovery on connect failure
  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall) return;
    callInvite.mutate({
      callSessionId: incomingCall.callSessionId,
      channelId: incomingCall.channelId,
      responseAction: "accept",
      profileId,
    });
    dismissIncoming();
    try {
      const supabase = createClient();
      const { token, serverUrl } = await getLiveKitToken(supabase, {
        channelId: incomingCall.channelId,
        workspaceId,
      });
      await livekitConnect(serverUrl, token);
    } catch {
      // Connect failed after accepting — offer rejoin via toast action
      toast.error("Kunne ikke koble til samtale", {
        action: {
          label: "Prøv igjen",
          onClick: () => void handleJoinCall(),
        },
      });
    }
  }, [
    incomingCall,
    callInvite,
    profileId,
    dismissIncoming,
    workspaceId,
    livekitConnect,
    handleJoinCall,
  ]);

  const handleRejectCall = useCallback(() => {
    if (!incomingCall) return;
    callInvite.mutate({
      callSessionId: incomingCall.callSessionId,
      channelId: incomingCall.channelId,
      responseAction: "reject",
      profileId,
    });
    dismissIncoming();
  }, [incomingCall, callInvite, profileId, dismissIncoming]);

  const handleEndCall = useCallback(() => {
    livekitDisconnect();
  }, [livekitDisconnect]);

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
              profileId={profileId}
              showMembers={showMembers}
              onToggleMembers={() => setShowMembers(!showMembers)}
              onJoinCall={handleJoinCall}
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
                audioPolicy={activeChannel.audio_policy}
                pttProps={isInCall ? { setMicEnabled: livekit.setMicEnabled } : undefined}
              />
            )}

            {/* H5: Reconnection indicator */}
            {livekit.isReconnecting && (
              <div className="bg-warning/10 text-warning flex items-center justify-center gap-2 px-4 py-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Kobler til igjen...
              </div>
            )}

            {isInCall && (
              <CallBar
                remoteParticipants={livekit.remoteParticipants}
                activeSpeakers={livekit.activeSpeakers}
                isMicEnabled={livekit.isMicEnabled}
                isCameraEnabled={livekit.isCameraEnabled}
                isScreenShareEnabled={livekit.isScreenShareEnabled}
                onToggleMic={livekit.toggleMic}
                onToggleCamera={livekit.toggleCamera}
                onToggleScreenShare={livekit.toggleScreenShare}
                onEndCall={handleEndCall}
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

      {/* Incoming call overlay */}
      {incomingCall && (
        <IncomingCallOverlay
          call={incomingCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}
    </div>
  );
}
