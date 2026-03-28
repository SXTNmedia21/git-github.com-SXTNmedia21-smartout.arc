/**
 * useCallTracks — Tracks participants, video/audio tracks, and active speaker
 * from a LiveKit Room instance.
 *
 * Read-only hook (no mutations). Lives outside hooks/mutations/ because
 * it subscribes to room events, not Supabase.
 */
import { useState, useEffect, useCallback } from "react";
import {
  RoomEvent,
  Track,
  type Room,
  type Participant,
  type RemoteTrackPublication,
  type LocalTrackPublication,
} from "livekit-client";

export type ParticipantTrackInfo = {
  identity: string;
  name: string;
  avatarUrl: string | null;
  isLocal: boolean;
  isAi: boolean;
  isSpeaking: boolean;
  isMicEnabled: boolean;
  videoTrack: Track | null;
};

type UseCallTracksResult = {
  participants: ParticipantTrackInfo[];
  activeSpeakerIdentity: string | null;
  hasAnyVideo: boolean;
};

function extractParticipantInfo(
  participant: Participant,
  isLocal: boolean,
  activeSpeakers: Set<string>,
): ParticipantTrackInfo {
  let metadata: { display_name?: string; avatar_url?: string; is_ai?: boolean } = {};
  try {
    metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
  } catch {
    // Metadata may not be JSON
  }

  let videoTrack: Track | null = null;
  for (const pub of participant.trackPublications.values()) {
    const p = pub as RemoteTrackPublication | LocalTrackPublication;
    if (p.track && p.source === Track.Source.Camera && !p.isMuted) {
      videoTrack = p.track;
      break;
    }
  }

  return {
    identity: participant.identity,
    name: metadata.display_name ?? participant.name ?? participant.identity,
    avatarUrl: metadata.avatar_url ?? null,
    isLocal,
    isAi: metadata.is_ai === true || participant.identity.startsWith("botsson:"),
    isSpeaking: activeSpeakers.has(participant.identity),
    isMicEnabled: participant.isMicrophoneEnabled,
    videoTrack,
  };
}

export function useCallTracks(room: Room | null): UseCallTracksResult {
  const [participants, setParticipants] = useState<ParticipantTrackInfo[]>([]);
  const [activeSpeakerIdentity, setActiveSpeakerIdentity] = useState<string | null>(null);
  const [activeSpeakerSet, setActiveSpeakerSet] = useState<Set<string>>(new Set());

  const rebuild = useCallback(() => {
    if (!room) {
      setParticipants([]);
      return;
    }

    const list: ParticipantTrackInfo[] = [];
    list.push(extractParticipantInfo(room.localParticipant, true, activeSpeakerSet));

    const remotes = Array.from(room.remoteParticipants.values()).sort((a, b) =>
      (a.name ?? a.identity).localeCompare(b.name ?? b.identity),
    );
    for (const remote of remotes) {
      list.push(extractParticipantInfo(remote, false, activeSpeakerSet));
    }

    setParticipants(list);
  }, [room, activeSpeakerSet]);

  useEffect(() => {
    if (!room) return;

    const handleActiveSpeakers = (speakers: Participant[]) => {
      const newSet = new Set(speakers.map((s) => s.identity));
      setActiveSpeakerSet(newSet);
      setActiveSpeakerIdentity(speakers[0]?.identity ?? null);
    };

    room.on(RoomEvent.TrackSubscribed, rebuild);
    room.on(RoomEvent.TrackUnsubscribed, rebuild);
    room.on(RoomEvent.TrackMuted, rebuild);
    room.on(RoomEvent.TrackUnmuted, rebuild);
    room.on(RoomEvent.ParticipantConnected, rebuild);
    room.on(RoomEvent.ParticipantDisconnected, rebuild);
    room.on(RoomEvent.ParticipantMetadataChanged, rebuild);
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);

    rebuild();

    return () => {
      room.off(RoomEvent.TrackSubscribed, rebuild);
      room.off(RoomEvent.TrackUnsubscribed, rebuild);
      room.off(RoomEvent.TrackMuted, rebuild);
      room.off(RoomEvent.TrackUnmuted, rebuild);
      room.off(RoomEvent.ParticipantConnected, rebuild);
      room.off(RoomEvent.ParticipantDisconnected, rebuild);
      room.off(RoomEvent.ParticipantMetadataChanged, rebuild);
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    };
  }, [room, rebuild]);

  useEffect(() => {
    rebuild();
  }, [activeSpeakerSet, rebuild]);

  const hasAnyVideo = participants.some((p) => p.videoTrack !== null);

  return { participants, activeSpeakerIdentity, hasAnyVideo };
}
