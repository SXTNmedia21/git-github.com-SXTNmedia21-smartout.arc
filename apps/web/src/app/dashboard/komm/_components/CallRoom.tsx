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
import { Button } from "@/components/ui/button";
import { PhoneOff, Minimize2, Maximize2, Users } from "lucide-react";
import { useState } from "react";
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
};

export function CallRoom({
  serverUrl,
  token,
  channelId,
  profileId,
  audioPolicy,
  onDisconnect,
  onParticipantCountChange,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      onDisconnected={onDisconnect}
      audio={true}
      video={false}
      onConnected={() => onParticipantCountChange?.(1)}
    >
      <CallRoomInner
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
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
  channelId,
  profileId,
  audioPolicy,
  onDisconnect,
  onParticipantCountChange,
}: {
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  channelId: string;
  profileId: string;
  audioPolicy: string;
  onDisconnect: () => void;
  onParticipantCountChange?: (count: number) => void;
}) {
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const participantCount = participants.length;
  if (onParticipantCountChange) {
    queueMicrotask(() => onParticipantCountChange(participantCount));
  }

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
          <span className="text-sm font-medium">Samtale aktiv</span>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Users className="h-3 w-3" />
            {participantCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Minimer" : "Utvid"}
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
            aria-label="Avslutt samtale"
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main area — video + chat side by side when expanded */}
      {isExpanded ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Video */}
          <div className="flex flex-1 flex-col">
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

          {/* Right: Chat (reusing existing Komm components) */}
          <div className="flex w-96 flex-col border-l">
            <div className="border-b px-3 py-2">
              <span className="text-sm font-medium">Chat</span>
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
