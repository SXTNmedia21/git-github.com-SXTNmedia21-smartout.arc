"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  CarouselLayout,
  ParticipantTile,
  ControlBar,
  useParticipants,
  useLocalParticipant,
  useTracks,
  TrackRefContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, RoomEvent } from "livekit-client";
import { Button } from "@/components/ui/button";
import { PhoneOff, Minimize2, Maximize2, Users } from "lucide-react";
import { useState } from "react";

type Props = {
  serverUrl: string;
  token: string;
  onDisconnect: () => void;
  onParticipantCountChange?: (count: number) => void;
};

export function CallRoom({ serverUrl, token, onDisconnect, onParticipantCountChange }: Props) {
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
        onDisconnect={onDisconnect}
        onParticipantCountChange={onParticipantCountChange}
      />
    </LiveKitRoom>
  );
}

function CallRoomInner({
  isExpanded,
  setIsExpanded,
  onDisconnect,
  onParticipantCountChange,
}: {
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
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

  // Report participant count to parent for the banner
  const participantCount = participants.length;
  if (onParticipantCountChange) {
    // Use a microtask to avoid updating parent during render
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
      {/* Header bar */}
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

      {/* Video area — speaker view (focused speaker large, others in carousel) */}
      {showVideo && (
        <div className={isExpanded ? "flex-1 bg-black" : "h-64 bg-black"}>
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

      {/* Audio renderer — always active */}
      <RoomAudioRenderer />

      {/* Controls */}
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
  );
}
