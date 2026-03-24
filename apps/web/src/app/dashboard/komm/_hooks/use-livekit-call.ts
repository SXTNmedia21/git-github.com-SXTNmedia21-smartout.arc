"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type RemoteParticipant,
  type LocalParticipant,
  type Participant,
} from "livekit-client";

type LiveKitCallState = {
  room: Room | null;
  connectionState: ConnectionState;
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  activeSpeakers: string[];
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenShareEnabled: boolean;
};

type UseLiveKitCallReturn = LiveKitCallState & {
  connect: (serverUrl: string, token: string) => Promise<void>;
  disconnect: () => void;
  toggleMic: () => Promise<void>;
  setMicEnabled: (enabled: boolean) => Promise<void>;
  toggleCamera: () => Promise<void>;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  toggleScreenShare: () => Promise<void>;
};

export function useLiveKitCall(): UseLiveKitCallReturn {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<LiveKitCallState>({
    room: null,
    connectionState: ConnectionState.Disconnected,
    localParticipant: null,
    remoteParticipants: [],
    activeSpeakers: [],
    isMicEnabled: false,
    isCameraEnabled: false,
    isScreenShareEnabled: false,
  });

  const updateParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    setState((prev) => ({
      ...prev,
      localParticipant: room.localParticipant,
      remoteParticipants: Array.from(room.remoteParticipants.values()),
      isMicEnabled: room.localParticipant.isMicrophoneEnabled,
      isCameraEnabled: room.localParticipant.isCameraEnabled,
      isScreenShareEnabled: room.localParticipant.isScreenShareEnabled,
    }));
  }, []);

  const connect = useCallback(
    async (serverUrl: string, token: string) => {
      const room = new Room({
        audioCaptureDefaults: { autoGainControl: true, noiseSuppression: true },
        videoCaptureDefaults: { resolution: { width: 1280, height: 720, frameRate: 30 } },
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      room.on(RoomEvent.ConnectionStateChanged, (connectionState: ConnectionState) => {
        setState((prev) => ({ ...prev, connectionState }));
      });

      room.on(RoomEvent.ParticipantConnected, () => updateParticipants());
      room.on(RoomEvent.ParticipantDisconnected, () => updateParticipants());
      room.on(RoomEvent.TrackSubscribed, () => updateParticipants());
      room.on(RoomEvent.TrackUnsubscribed, () => updateParticipants());
      room.on(RoomEvent.LocalTrackPublished, () => updateParticipants());
      room.on(RoomEvent.LocalTrackUnpublished, () => updateParticipants());
      room.on(RoomEvent.TrackMuted, () => updateParticipants());
      room.on(RoomEvent.TrackUnmuted, () => updateParticipants());

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        setState((prev) => ({
          ...prev,
          activeSpeakers: speakers.map((s) => s.identity),
        }));
      });

      room.on(RoomEvent.Disconnected, () => {
        setState((prev) => ({
          ...prev,
          room: null,
          connectionState: ConnectionState.Disconnected,
          localParticipant: null,
          remoteParticipants: [],
          activeSpeakers: [],
          isMicEnabled: false,
          isCameraEnabled: false,
          isScreenShareEnabled: false,
        }));
        roomRef.current = null;
      });

      await room.connect(serverUrl, token);

      // Enable microphone after connecting (camera stays off by default)
      await room.localParticipant.setMicrophoneEnabled(true);

      setState((prev) => ({
        ...prev,
        room,
        localParticipant: room.localParticipant,
        remoteParticipants: Array.from(room.remoteParticipants.values()),
        isMicEnabled: room.localParticipant.isMicrophoneEnabled,
        isCameraEnabled: room.localParticipant.isCameraEnabled,
        isScreenShareEnabled: room.localParticipant.isScreenShareEnabled,
      }));
    },
    [updateParticipants],
  );

  const disconnect = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.disconnect();
      roomRef.current = null;
    }
  }, []);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    setState((prev) => ({ ...prev, isMicEnabled: enabled }));
  }, []);

  const setMicEnabled = useCallback(async (enabled: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    setState((prev) => ({ ...prev, isMicEnabled: enabled }));
  }, []);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(enabled);
    setState((prev) => ({ ...prev, isCameraEnabled: enabled }));
  }, []);

  const setCameraEnabled = useCallback(async (enabled: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setCameraEnabled(enabled);
    setState((prev) => ({ ...prev, isCameraEnabled: enabled }));
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = !room.localParticipant.isScreenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(enabled);
    setState((prev) => ({ ...prev, isScreenShareEnabled: enabled }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    toggleMic,
    setMicEnabled,
    toggleCamera,
    setCameraEnabled,
    toggleScreenShare,
  };
}
