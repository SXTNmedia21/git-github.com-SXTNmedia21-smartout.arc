/**
 * LiveKit call adapter for React Native.
 * Manages Room lifecycle, AudioSession, mic toggle, and active speaker detection.
 * Platform-specific: uses @livekit/react-native AudioSession for audio routing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Room, RoomEvent, type Participant } from "livekit-client";
import type { CallSession } from "@smartout/walkie-talkie";

// AudioSession uses native WebRTC modules — only available on iOS/Android, crashes on web
const AudioSession =
  Platform.OS !== "web"
    ? require("@livekit/react-native").AudioSession
    : { startAudioSession: async () => {}, stopAudioSession: async () => {} };

type UseLiveKitCallParams = {
  token: string | null;
  serverUrl: string | null;
  callSession: CallSession | null;
  onDisconnected?: () => void;
};

type LiveKitCallState = {
  room: Room | null;
  isConnected: boolean;
  isMicEnabled: boolean;
  activeSpeakers: string[];
  participantCount: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMic: () => Promise<void>;
};

export function useLiveKitCall({
  token,
  serverUrl,
  callSession,
  onDisconnected,
}: UseLiveKitCallParams): LiveKitCallState {
  const [room] = useState(() => new Room());
  const [isConnected, setIsConnected] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const onDisconnectedRef = useRef(onDisconnected);
  onDisconnectedRef.current = onDisconnected;

  // Start/stop AudioSession with component lifecycle
  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  // Room event listeners
  useEffect(() => {
    const updateParticipantCount = () => {
      setParticipantCount(room.remoteParticipants.size + 1);
    };

    const handleActiveSpeakers = (speakers: Participant[]) => {
      setActiveSpeakers(speakers.map((s) => s.identity));
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setIsMicEnabled(false);
      setActiveSpeakers([]);
      setParticipantCount(0);
      onDisconnectedRef.current?.();
    };

    const handleTrackMuted = (_publication: unknown, participant: Participant) => {
      if (participant === room.localParticipant) {
        setIsMicEnabled(participant.isMicrophoneEnabled);
      }
    };

    room.on(RoomEvent.ParticipantConnected, updateParticipantCount);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipantCount);
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackMuted);

    return () => {
      room.off(RoomEvent.ParticipantConnected, updateParticipantCount);
      room.off(RoomEvent.ParticipantDisconnected, updateParticipantCount);
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackMuted);
    };
  }, [room]);

  const connect = useCallback(async () => {
    if (!token || !serverUrl) return;

    const shouldPublishMic = callSession?.audioPolicy !== "listen_only";

    await room.connect(serverUrl, token, {
      autoSubscribe: true,
    });

    if (shouldPublishMic) {
      await room.localParticipant.setMicrophoneEnabled(true);
      setIsMicEnabled(true);
    }

    setIsConnected(true);
    setParticipantCount(room.remoteParticipants.size + 1);
  }, [token, serverUrl, callSession?.audioPolicy, room]);

  const disconnect = useCallback(async () => {
    await room.disconnect();
    setIsConnected(false);
    setIsMicEnabled(false);
  }, [room]);

  const toggleMic = useCallback(async () => {
    if (!room.localParticipant) return;
    const newState = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(newState);
    setIsMicEnabled(newState);
  }, [room]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      room.disconnect();
    };
  }, [room]);

  return {
    room,
    isConnected,
    isMicEnabled,
    activeSpeakers,
    participantCount,
    connect,
    disconnect,
    toggleMic,
  };
}
