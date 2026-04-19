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
import { cn } from "@/lib/utils";

type Props = {
  serverUrl: string;
  token: string;
  channelId: string;
  channelName?: string;
  profileId: string;
  audioPolicy: string;
  onDisconnect: () => void;
  onParticipantCountChange?: (count: number) => void;
  startWithVideo?: boolean;
};

type RoomMode = "pip" | "focused";

/**
 * CallRoom renders as a fixed-position overlay so the call keeps running
 * while the user scrolls messages, switches channels, or navigates within
 * the dashboard. Two modes:
 *   - pip     : small bottom-right tile, minimal controls
 *   - focused : centered modal, full controls + chat panel
 */
export function CallRoom({
  serverUrl,
  token,
  channelId,
  channelName,
  profileId,
  audioPolicy,
  onDisconnect,
  onParticipantCountChange,
  startWithVideo = false,
}: Props) {
  const [mode, setMode] = useState<RoomMode>(startWithVideo ? "focused" : "pip");
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
        mode={mode}
        setMode={setMode}
        showChat={showChat}
        setShowChat={setShowChat}
        channelId={channelId}
        channelName={channelName}
        profileId={profileId}
        audioPolicy={audioPolicy}
        onDisconnect={onDisconnect}
        onParticipantCountChange={onParticipantCountChange}
      />
    </LiveKitRoom>
  );
}

function CallRoomInner({
  mode,
  setMode,
  showChat,
  setShowChat,
  channelId,
  channelName,
  profileId,
  audioPolicy,
  onDisconnect,
  onParticipantCountChange,
}: {
  mode: RoomMode;
  setMode: (v: RoomMode) => void;
  showChat: boolean;
  setShowChat: (v: boolean) => void;
  channelId: string;
  channelName?: string;
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

  const isFocused = mode === "focused";

  return (
    <>
      {/* Backdrop only in focused mode */}
      {isFocused && (
        <div
          className="animate-in fade-in fixed inset-0 z-40 bg-black/60 backdrop-blur-sm duration-150"
          onClick={() => setMode("pip")}
          aria-hidden
        />
      )}

      <div
        className={cn(
          "bg-card fixed z-50 flex flex-col overflow-hidden rounded-2xl border shadow-2xl",
          isFocused ? "inset-4 md:inset-8" : "right-4 bottom-4 w-[360px] max-w-[calc(100vw-2rem)]",
        )}
      >
        {/* Header — prominent LIVE indicator always visible */}
        <div className="bg-background/95 flex items-center justify-between gap-2 border-b px-3 py-2 backdrop-blur">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* Pulsing LIVE badge */}
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-bold tracking-wider text-red-500 uppercase">
              {t("call.live")}
            </span>
            {channelName && (
              <span className="text-foreground/80 truncate text-sm font-medium">
                · {channelName}
              </span>
            )}
            <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
              <Users className="h-3 w-3" />
              {participantCount}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isFocused && (
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
              onClick={() => setMode(isFocused ? "pip" : "focused")}
              aria-label={isFocused ? t("call.minimize") : t("call.expand")}
            >
              {isFocused ? (
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

        {/* Body — video + (optional) chat */}
        {isFocused ? (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
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

            {showChat && (
              <div className="flex h-1/2 flex-col border-t md:h-auto md:w-80 md:border-t-0 md:border-l lg:w-96">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-sm font-medium">{t("call.chat_panel")}</span>
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
            {/* PiP video tile only when someone has video on */}
            {hasVideoTracks && (
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
    </>
  );
}
