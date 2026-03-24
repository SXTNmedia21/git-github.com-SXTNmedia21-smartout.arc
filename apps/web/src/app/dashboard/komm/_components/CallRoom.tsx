"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { Button } from "@/components/ui/button";
import { PhoneOff, Minimize2, Maximize2 } from "lucide-react";

type Props = {
  serverUrl: string;
  token: string;
  onDisconnect: () => void;
};

export function CallRoom({ serverUrl, token, onDisconnect }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      onDisconnected={onDisconnect}
      audio={true}
      video={false}
      style={{ height: isExpanded ? "100%" : "auto" }}
    >
      <div className={`bg-card border-t ${isExpanded ? "fixed inset-0 z-40 flex flex-col" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Samtale aktiv</span>
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

        {/* Video grid — only shown when expanded or when someone has video */}
        <VideoGrid isExpanded={isExpanded} />

        {/* Audio renderer — always active (plays remote audio) */}
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
          }}
        />
      </div>
    </LiveKitRoom>
  );
}

/** Shows video tiles when there are video tracks, otherwise stays collapsed */
function VideoGrid({ isExpanded }: { isExpanded: boolean }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const videoTracks = tracks.filter(
    (t) => t.publication?.track || t.source === Track.Source.ScreenShare,
  );

  // Don't render grid if no video and not expanded
  if (!isExpanded && videoTracks.length === 0) return null;

  return (
    <div className={`${isExpanded ? "flex-1" : "h-48"} bg-black`}>
      <GridLayout tracks={tracks}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}
