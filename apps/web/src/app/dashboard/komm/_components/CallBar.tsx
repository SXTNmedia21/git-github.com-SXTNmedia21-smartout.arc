"use client";

import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Users } from "lucide-react";
import { ActiveSpeakerIndicator } from "./ActiveSpeakerIndicator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { RemoteParticipant } from "livekit-client";

type Props = {
  remoteParticipants: RemoteParticipant[];
  activeSpeakers: string[];
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenShareEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
};

export function CallBar({
  remoteParticipants,
  activeSpeakers,
  isMicEnabled,
  isCameraEnabled,
  isScreenShareEnabled,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
}: Props) {
  return (
    <div className="bg-card/95 animate-in slide-in-from-bottom-2 border-t backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Participants */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span>{remoteParticipants.length + 1}</span>
          </div>
          <div className="flex -space-x-2">
            {remoteParticipants.slice(0, 5).map((p) => {
              const isSpeaking = activeSpeakers.includes(p.identity);
              const initials = (p.name ?? p.identity).slice(0, 2).toUpperCase();
              return (
                <ActiveSpeakerIndicator key={p.identity} isSpeaking={isSpeaking} size="sm">
                  <Avatar className="border-background h-7 w-7 border-2">
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                </ActiveSpeakerIndicator>
              );
            })}
            {remoteParticipants.length > 5 && (
              <Avatar className="border-background h-7 w-7 border-2">
                <AvatarFallback className="text-[10px]">
                  +{remoteParticipants.length - 5}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={isMicEnabled ? "secondary" : "destructive"}
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onToggleMic}
            title={isMicEnabled ? "Skru av mikrofon" : "Skru på mikrofon"}
          >
            {isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          <Button
            variant={isCameraEnabled ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onToggleCamera}
            title={isCameraEnabled ? "Skru av kamera" : "Skru på kamera"}
          >
            {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
          <Button
            variant={isScreenShareEnabled ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onToggleScreenShare}
            title={isScreenShareEnabled ? "Stopp skjermdeling" : "Del skjerm"}
          >
            <MonitorUp className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onEndCall}
            title="Avslutt samtale"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
