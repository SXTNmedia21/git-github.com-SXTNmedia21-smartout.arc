"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  FocusLayoutContainer,
  GridLayout,
  CarouselLayout,
  ParticipantTile,
  ControlBar,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import { PhoneOff, Minimize2, Maximize2, Users, MessageSquare } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { MessageTimeline } from "./MessageTimeline";
import { MessageInput } from "./MessageInput";

type Props = {
  serverUrl: string;
  token: string;
  channelId: string;
  profileId: string;
  audioPolicy: string;
  onDisconnect: () => void;
  onParticipantCountChange?: (count: number) => void;
  startWithVideo?: boolean;
};

export function CallRoom({
  serverUrl,
  token,
  channelId,
  profileId,
  audioPolicy,
  onDisconnect,
  onParticipantCountChange,
  startWithVideo = false,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(startWithVideo);
  const [showChat, setShowChat] = useState(true);

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      onDisconnected={onDisconnect}
      audio={true}
      video={startWithVideo}
      onConnected={() => onParticipantCountChange?.(1)}
    >
      <CallRoomInner
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        showChat={showChat}
        setShowChat={setShowChat}
        channelId={channelId}
        profileId={profileId}
        audioPolicy={audioPolicy}
        onDisconnect={onDisconnect}
        onParticipantCountChange={onParticipantCountChange}
      />
    </LiveKitRoom>
  );
}

function CallRoomInner({
  isExpanded,
  setIsExpanded,
  showChat,
  setShowChat,
  channelId,
  profileId,
  audioPolicy,
  onDisconnect,
  onParticipantCountChange,
}: {
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  showChat: boolean;
  setShowChat: (v: boolean) => void;
  channelId: string;
  profileId: string;
  audioPolicy: string;
  onDisconnect: () => void;
  onParticipantCountChange?: (count: number) => void;
}) {
  const { t } = useTranslation("komm");
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const participantCount = participants.length;

  useEffect(() => {
    onParticipantCountChange?.(participantCount);
  }, [participantCount, onParticipantCountChange]);

  // Track participant joins/leaves and show toasts
  const prevIdentitiesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentIdentities = new Set(participants.map((p) => p.identity));
    const prev = prevIdentitiesRef.current;

    // Skip first render (initial connect)
    if (prev.size > 0) {
      for (const p of participants) {
        if (!prev.has(p.identity)) {
          toast.info(t("call.participant_joined", { name: p.name || p.identity }));
        }
      }
      for (const identity of prev) {
        if (!currentIdentities.has(identity)) {
          toast.info(t("call.participant_left", { name: identity }));
        }
      }
    }

    prevIdentitiesRef.current = currentIdentities;
  }, [participants]);

  const hasVideoTracks = tracks.some(
    (t) => t.publication?.isSubscribed && t.publication.track?.kind === Track.Kind.Video,
  );
  const showVideo = isExpanded || hasVideoTracks;

  return (
    <div
      className={isExpanded ? "bg-background fixed inset-0 z-40 flex flex-col" : "bg-card border-t"}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("call.header")}</span>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Users className="h-3 w-3" />
            {participantCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isExpanded && (
            <Button
              variant={showChat ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowChat(!showChat)}
              aria-label={showChat ? t("call.hide_chat") : t("call.show_chat")}
              aria-pressed={showChat}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? t("call.minimize") : t("call.expand")}
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onDisconnect}
            aria-label={t("call.disconnect")}
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main area — video + chat, stacked on mobile, side-by-side on desktop */}
      {isExpanded ? (
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* Video area */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 bg-black">
              {tracks.length <= 2 ? (
                <GridLayout tracks={tracks}>
                  <ParticipantTile />
                </GridLayout>
              ) : (
                <FocusLayoutContainer>
                  <CarouselLayout tracks={tracks}>
                    <ParticipantTile />
                  </CarouselLayout>
                </FocusLayoutContainer>
              )}
            </div>
            <ControlBar
              variation="minimal"
              controls={{
                microphone: true,
                camera: true,
                screenShare: true,
                leave: false,
                chat: false,
                settings: false,
              }}
            />
          </div>

          {/* Chat panel — full width on mobile, fixed width on desktop */}
          {showChat && (
            <div className="flex h-1/2 flex-col border-t md:h-auto md:w-80 md:border-t-0 md:border-l lg:w-96">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-sm font-medium">{t("call.chat_panel")}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 md:hidden"
                  onClick={() => setShowChat(false)}
                  aria-label={t("call.close_chat")}
                >
                  <Minimize2 className="h-3 w-3" />
                </Button>
              </div>
              <MessageTimeline channelId={channelId} profileId={profileId} onReply={() => {}} />
              <MessageInput
                channelId={channelId}
                profileId={profileId}
                replyToId={null}
                onCancelReply={() => {}}
                audioPolicy={audioPolicy}
                pttProps={undefined}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Collapsed: show video only if someone has camera on */}
          {showVideo && (
            <div className="h-48 bg-black">
              {tracks.length <= 2 ? (
                <GridLayout tracks={tracks}>
                  <ParticipantTile />
                </GridLayout>
              ) : (
                <FocusLayoutContainer>
                  <CarouselLayout tracks={tracks}>
                    <ParticipantTile />
                  </CarouselLayout>
                </FocusLayoutContainer>
              )}
            </div>
          )}
          <ControlBar
            variation="minimal"
            controls={{
              microphone: true,
              camera: true,
              screenShare: true,
              leave: false,
              chat: false,
              settings: false,
            }}
          />
        </>
      )}

      <RoomAudioRenderer />
    </div>
  );
}
