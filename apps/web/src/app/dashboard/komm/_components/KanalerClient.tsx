"use client";

import { useState, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useChannels } from "../_hooks/use-channels";
import { useChannelRealtime } from "../_hooks/use-channel-realtime";
import { useCallSignaling } from "../_hooks/use-call-signaling";
import { useCallRealtime } from "../_hooks/use-call-realtime";
import { useCallInvite } from "../_hooks/use-call-invite";
import { useMuteParticipant } from "../_hooks/use-mute-participant";
import { getLiveKitToken } from "@smartout/walkie-talkie";
import { createClient } from "@smartout/supabase/client";
import { ChannelList } from "./ChannelList";
import { ChannelHeader } from "./ChannelHeader";
import { MessageTimeline } from "./MessageTimeline";
import { MessageInput } from "./MessageInput";
import { MemberPanel } from "./MemberPanel";
import { IncomingCallOverlay } from "./IncomingCallOverlay";
import { MinKoSection } from "./MinKoSection";
import { useActiveCall } from "@/components/dashboard/ActiveCallProvider";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";

/**
 * Channels page — 2-panel layout: channel list (left) + message timeline/input (right).
 * The live call itself is owned by ActiveCallProvider at the dashboard shell
 * level so it survives route changes — this component only has to call
 * joinCall() with a fresh LiveKit token.
 */
export function KanalerClient({ profileId }: { profileId: string }) {
  const { t } = useTranslation("komm");
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);

  const { activeCall, joinCall } = useActiveCall();
  const isCallActiveHere = activeCall?.channelId === activeChannelId;

  const { data: channelGroups, isLoading } = useChannels();
  useChannelRealtime(workspaceId, activeChannelId);

  const { incomingCall, dismissIncoming } = useCallSignaling(profileId, activeChannelId);
  useCallRealtime(activeChannelId);
  const callInvite = useCallInvite();
  const muteParticipant = useMuteParticipant(profileId);

  // Kanaler view covers groups only — DMs live under /dashboard/komm/chat
  const groupChannelGroups = (channelGroups ?? []).filter((g) => g.type !== "direct");
  const allChannels = groupChannelGroups.flatMap((g) => g.channels);
  const activeChannel = allChannels.find((ch) => ch.channel_id === activeChannelId);

  const handleJoinCall = useCallback(
    async (opts?: { withVideo?: boolean }) => {
      if (!activeChannelId || !activeChannel) return;
      try {
        const supabase = createClient();
        const { token, serverUrl } = await getLiveKitToken(supabase, {
          channelId: activeChannelId,
          workspaceId,
        });
        joinCall({
          channelId: activeChannelId,
          channelName: activeChannel.name ?? activeChannel.other_member_name ?? "",
          serverUrl,
          token,
          audioPolicy: activeChannel.audio_policy,
          startWithVideo: opts?.withVideo ?? false,
        });
      } catch {
        toast.error(t("shell.connection_error"));
      }
    },
    [activeChannelId, activeChannel, workspaceId, joinCall, t],
  );

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
      const incomingChannel = allChannels.find((c) => c.channel_id === incomingCall.channelId);
      joinCall({
        channelId: incomingCall.channelId,
        channelName:
          incomingChannel?.name ??
          incomingChannel?.other_member_name ??
          incomingCall.callerName ??
          "",
        serverUrl,
        token,
        audioPolicy: incomingChannel?.audio_policy ?? "open_mic",
        startWithVideo: false,
      });
    } catch {
      toast.error(t("shell.connection_error"), {
        action: {
          label: t("shell.retry"),
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
    allChannels,
    joinCall,
    handleJoinCall,
    t,
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

  const handleSelectChannel = (channelId: string) => {
    setActiveChannelId(channelId);
    setReplyToId(null);
    setShowMembers(false);
  };

  return (
    <div className="border-border/50 flex h-full overflow-hidden rounded-lg border">
      {/* Left panel: channel sidebar (w-72) */}
      <div className="bg-background/80 border-border/50 flex w-72 flex-shrink-0 flex-col border-r backdrop-blur-xl">
        <div className="border-border/50 flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="font-heading text-base font-semibold">{t("channel.header")}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <MinKoSection
            profileId={profileId}
            activeChannelId={activeChannelId}
            onSelectChannel={handleSelectChannel}
          />
          <ChannelList
            channelGroups={groupChannelGroups}
            isLoading={isLoading}
            activeChannelId={activeChannelId}
            onSelectChannel={handleSelectChannel}
            profileId={profileId}
          />
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
              liveParticipantCount={isCallActiveHere ? 1 : 0}
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
          isCallActive={isCallActiveHere}
          onMuteParticipant={isCallActiveHere ? handleMuteParticipant : undefined}
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
