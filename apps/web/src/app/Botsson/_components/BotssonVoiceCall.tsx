"use client";

// BotssonVoiceCall — LiveKit data-channel bridge for the Botsson Shell.
//
// WHY THIS FILE EXISTS:
// The main BotssonProvider uses Ultravox for the chat/voice overlay. The
// LiveKit voice-agent (services/voice-agent) is a separate server-side worker
// that joins its own room and communicates via the "botsson-activity" data
// channel. This component bridges the two: it connects to a LiveKit room,
// subscribes to activity events, and routes "orb_command" events to the
// BotssonProvider actions (expand, collapse, setOrbStatus, setPosition, etc.).
//
// ARCHITECTURE (per spec feat/orb-as-agent-tool):
//   Voice-agent → publishActivity({ type: "orb_command", action, args })
//     → LiveKit data channel (topic: "botsson-activity")
//       → DataReceived event in this component
//         → handleVoiceActivity() → dispatch to BotssonProvider context
//
// CONSTRAINTS:
//   - Uses livekit-client directly (already in apps/web deps).
//   - Reads BotssonProvider context via useBotsson() — must be mounted inside
//     <BotssonProvider>.
//   - Does NOT touch the Ultravox session or BotssonProvider internals.
//   - Does NOT mount a mic or publish any audio — listen-only mode.
//   - "pinned" behaviour relies on BotssonProvider exposing setPinned/pinned
//     (added in the same sortie).
//
// MOUNTING:
//   <BotssonVoiceCall serverUrl="wss://..." token="..." />
//   Mount once, inside BotssonProvider, wherever the shell is mounted.
//   If serverUrl/token are absent, the component renders nothing and is inert.
//
// OrbStatus mapping (new states → existing OrbStatus values):
//   "working"      → "thinking"     (pulsing, active — closest existing)
//   "alert"        → "notification" (orange glow — existing notification state)
//   "celebrating"  → "speaking"     (animated, energetic — closest existing)
//   "idle"         → "idle"
//
// Nordic Split animation: pulse uses the existing notification glow.
// No new CSS added — all states map to existing OrbStatus values.

import { Room, RoomEvent, Track } from "livekit-client";
import type { RemoteTrack, RemoteTrackPublication, RemoteParticipant } from "livekit-client";
import { useCallback, useEffect, useRef } from "react";

export type VoiceCallStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking";

type Props = {
  /** When true the call connects. Flip to false (or unmount) to disconnect. */
  active: boolean;
  workspaceId: string;
  onStatusChange?: (status: VoiceCallStatus) => void;
  /** Called with a user-visible error message when something goes wrong */
  onError?: (message: string) => void;
};

type TokenResponse = {
  token: string;
  serverUrl: string;
  roomName: string;
  profileId: string;
};

export function BotssonVoiceCall({ active, workspaceId, onStatusChange, onError }: Props) {
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stable refs so event handlers don't capture stale callback props
  const onStatusChangeRef = useRef(onStatusChange);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const updateStatus = useCallback((next: VoiceCallStatus) => {
    onStatusChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    if (!active) {
      if (roomRef.current) {
        void roomRef.current.disconnect();
        roomRef.current = null;
      }
      updateStatus("idle");
      return;
    }

    let cancelled = false;

    async function connect() {
      updateStatus("connecting");

      // Fetch token from BFF — profile_id resolved server-side (ADR-0151)
      let tokenData: TokenResponse;
      try {
        const res = await fetch("/api/botsson/voice/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Token request failed: ${res.status}`);
        }
        tokenData = (await res.json()) as TokenResponse;
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to start voice call";
        onErrorRef.current?.(message);
        updateStatus("idle");
        return;
      }

      if (cancelled) return;

      const room = new Room({
        adaptiveStream: true,
        disconnectOnPageLeave: false,
      });
      roomRef.current = room;

      // Wire agent audio to the hidden <audio> element so the user hears Botsson.
      // Agent participant metadata has is_ai: true; user metadata has is_ai: false.
      // We attach any remote audio track — the only remote participant is the agent.
      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
          if (track.kind !== Track.Kind.Audio) return;
          const audioEl = audioRef.current;
          if (audioEl) {
            track.attach(audioEl);
          }
        },
      );

      // Unattach audio when agent track unsubscribes
      room.on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
          if (track.kind !== Track.Kind.Audio) return;
          const audioEl = audioRef.current;
          if (audioEl) {
            track.detach(audioEl);
          }
        },
      );

      // Infer status from active speakers list
      room.on(RoomEvent.ActiveSpeakersChanged, () => {
        const speakers = room.activeSpeakers;
        if (speakers.length === 0) {
          updateStatus("thinking");
          return;
        }
        const localId = room.localParticipant.identity;
        const agentSpeaking = speakers.some((p) => p.identity !== localId);
        const userSpeaking = speakers.some((p) => p.identity === localId);

        if (agentSpeaking) {
          updateStatus("speaking");
        } else if (userSpeaking) {
          updateStatus("listening");
        } else {
          updateStatus("thinking");
        }
      });

      room.on(RoomEvent.Connected, () => {
        updateStatus("listening");
      });

      room.on(RoomEvent.Disconnected, () => {
        updateStatus("idle");
        roomRef.current = null;
      });

      try {
        await room.connect(tokenData.serverUrl, tokenData.token);
        if (cancelled) {
          void room.disconnect();
          return;
        }
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Connection failed";
        onErrorRef.current?.(message);
        updateStatus("idle");
        roomRef.current = null;
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (roomRef.current) {
        void roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
    // workspaceId captured in the closure once at mount — intentionally stable.
    // Reconnecting on every workspaceId identity change would interrupt active calls.
  }, [active, updateStatus]);

  return (
    // Hidden audio element — Botsson's voice plays through this
    <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} aria-hidden />
  );
}

/**
 * Map VoiceCallStatus → OrbStatus so BotssonShell can drive the Orb.
 * Exported to keep the mapping co-located with the status type definition.
 */
export function voiceStatusToOrb(
  status: VoiceCallStatus,
): "idle" | "listening" | "thinking" | "speaking" {
  switch (status) {
    case "connecting":
      return "thinking";
    case "listening":
      return "listening";
    case "thinking":
      return "thinking";
    case "speaking":
      return "speaking";
    default:
      return "idle";
  }
}
