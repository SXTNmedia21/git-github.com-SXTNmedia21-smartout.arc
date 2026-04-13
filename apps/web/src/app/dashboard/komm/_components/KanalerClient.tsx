"use client";

import { useState, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useChannels } from "../_hooks/use-channels";
import { useUnreadCounts } from "../_hooks/use-unread-counts";
import { useChannelRealtime } from "../_hooks/use-channel-realtime";
import { useCallSignaling } from "../_hooks/use-call-signaling";
import { useCallRealtime } from "../_hooks/use-call-realtime";
import { useCallInvite } from "../_hooks/use-call-invite";
import { useStartCall } from "../_hooks/use-start-call";
import { useMuteParticipant } from "../_hooks/use-mute-participant";
import { getLiveKitToken } from "@smartout/walkie-talkie";
import { createClient } from "@smartout/supabase/client";
import { ChannelList } from "./ChannelList";
import { ChannelHeader } from "./ChannelHeader";
import { MessageTimeline } from "./MessageTimeline";
import { MessageInput } from "./MessageInput";
import { MemberPanel } from "./MemberPanel";
import { IncomingCallOverlay } from "./IncomingCallOverlay";
import { CallRoom } from "./CallRoom";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";

type LiveKitConnection = {
  serverUrl: string;
  token: string;
};

/**
 * Channels-only view — KommShell minus SubTabs.
 * Shows channel list (left) + message timeline/input (right) + call room.
 */
export function KanalerClient({ profileId }: { profileId: string }) {
  const { t } = useTranslation("komm");
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);

  // LiveKit connection state — set when joining a call, cleared on disconnect
  const [livekitConnection, setLivekitConnection] = useState<LiveKitConnection | null>(null);
  const [liveParticipantCount, setLiveParticipantCount] = useState(0);

  const { data: channelGroups, isLoading } = useChannels();
  const { data: unreadCounts } = useUnreadCounts();
  useChannelRealtime(workspaceId, activeChannelId);

  // Voice call hooks
  const { incomingCall, dismissIncoming } = useCallSignaling(profileId, activeChannelId);
  useCallRealtime(activeChannelId);
  const callInvite = useCallInvite();
  const startCall = useStartCall();
  const muteParticipant = useMuteParticipant(profileId);

  // Suppress unused variable warnings for hooks that are needed for side effects
  void startCall;
  void unreadCounts;

  const handleJoinCall = useCallback(async () => {
    if (!activeChannelId) return;
    try {
      const supabase = createClient();
      const { token, serverUrl } = await getLiveKitToken(supabase, {
        channelId: activeChannelId,
        workspaceId,
      });
      setLivekitConnection({ serverUrl, token });
    } catch {
      toast.error(t("shell.connection_error"));
    }
  }, [activeChannelId, workspaceId, t]);

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
      setLivekitConnection({ serverUrl, token });
    } catch {
      toast.error(t("shell.connection_error"), {
        action: {
          label: t("shell.retry"),
          onClick: () => void handleJoinCall(),
        },
      });
    }
  }, [incomingCall, callInvite, profileId, dismissIncoming, workspaceId, handleJoinCall, t]);

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

  const handleDisconnect = useCallback(() => {
    setLivekitConnection(null);
  }, []);

  const handleMuteParticipant = useCallback(
    (targetProfileId: string) => {
      if (!activeChannelId) return;
      muteParticipant.mutate({
        channelId: activeChannelId,
        targetIdentity: targetProfileId,
        muted: true,
      });
    },
    [activeChannelId, muteParticipant.mutate],
  );

  const allChannels = channelGroups?.flatMap((g) => g.channels) ?? [];
  const activeChannel = allChannels.find((ch) => ch.channel_id === activeChannelId);

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setReplyToId(null);
    setShowMembers(false);
  };

  return (
    <div className="flex h-full overflow-hidden rounded-lg border">
      {/* Left panel: channel list */}
      <div className="bg-card flex w-80 flex-shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-base font-semibold">{t("shell.title")}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ChannelList
            channelGroups={channelGroups ?? []}
            isLoading={isLoading}
            activeChannelId={activeChannelId}
            onSelectChannel={handleSelectChannel}
            profileId={profileId}
          />
        </div>
      </div>

      {/* Center: Messages + Call */}
      <div className="flex min-w-0 flex-1 flex-col">
        {activeChannel ? (
          <>
            <ChannelHeader
              channel={activeChannel}
              profileId={profileId}
              showMembers={showMembers}
              onToggleMembers={() => setShowMembers(!showMembers)}
              onJoinCall={handleJoinCall}
              liveParticipantCount={liveParticipantCount}
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
                pttProps={undefined}
              />
            )}

            {/* LiveKit Call Room */}
            {livekitConnection && (
              <CallRoom
                serverUrl={livekitConnection.serverUrl}
                token={livekitConnection.token}
                channelId={activeChannelId!}
                profileId={profileId}
                audioPolicy={activeChannel.audio_policy}
                onDisconnect={handleDisconnect}
                onParticipantCountChange={setLiveParticipantCount}
              />
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <MessageSquare className="text-muted-foreground/40 h-12 w-12" />
            <p className="text-muted-foreground text-sm">{t("shell.empty_state")}</p>
          </div>
        )}
      </div>

      {/* Right: Member panel */}
      {showMembers && activeChannelId && (
        <MemberPanel
          channelId={activeChannelId}
          profileId={profileId}
          onClose={() => setShowMembers(false)}
          isCallActive={!!livekitConnection}
          onMuteParticipant={livekitConnection ? handleMuteParticipant : undefined}
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
