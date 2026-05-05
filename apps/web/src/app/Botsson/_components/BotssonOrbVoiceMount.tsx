"use client";

/**
 * BotssonOrbVoiceMount — LiveKit voice session wired to the Botsson Orb.
 *
 * Manages the connection lifecycle for a direct user ↔ Mr. Botsson room.
 * The voice-agent worker (services/voice-agent) is configured as automatic-
 * dispatch, so it autojoins `botsson-orb:<profileId>` rooms when they open.
 *
 * This component is intentionally thin — no visible UI (the Orb is the UI).
 * It:
 *   1. Fetches a token from /api/botsson/voice/token
 *   2. Connects to LiveKit Cloud
 *   3. Enables the user's microphone
 *   4. Renders a hidden <audio> element for Botsson's audio track
 *   5. Infers call status from participant speaking state and exposes it upward
 *
 * Mount / unmount = call start / end. Parent controls via the `active` prop.
 *
 * Status inference:
 *   speaking  — agent participant is an active speaker
 *   listening — only the user is an active speaker
 *   thinking  — connected but nobody is speaking (agent processing)
 *   connecting — token fetch or connect in progress
 *   idle      — disconnected or not yet started
 *
 * ADR-0078: voice is not used for PII-sensitive operations here. The
 * voice-agent adapter enforces channel: "voice" restrictions at the tool level.
 */

import { Room, RoomEvent, Track } from "livekit-client";
import type { RemoteTrack, RemoteTrackPublication, RemoteParticipant } from "livekit-client";
import { useCallback, useEffect, useRef } from "react";

export type VoiceCallStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking";

/**
 * Activity event published by the voice-agent adapter over the LiveKit data
 * channel (topic="botsson-activity"). Renders in the activity panel so the
 * user can see who's talking and which tools are firing.
 */
export type BotssonActivityEvent =
  | {
      type: "connected";
      roomName: string;
      agent: string;
      provider: string;
      voice: string;
      ts: number;
    }
  | { type: "tool_call"; tool: string; label: string; query: string; ts: number }
  | {
      type: "tool_response";
      tool: string;
      label: string;
      durationMs: number;
      response: string;
      ts: number;
    }
  | { type: "intent"; capability: string; confidence: number; ts: number }
  | { type: "navigate"; path: string; ts: number };

type Props = {
  /** When true the call connects. Flip to false (or unmount) to disconnect. */
  active: boolean;
  workspaceId: string;
  onStatusChange?: (status: VoiceCallStatus) => void;
  /** Receives activity events streamed from the voice-agent adapter */
  onActivity?: (event: BotssonActivityEvent) => void;
  /** Called with a user-visible error message when something goes wrong */
  onError?: (message: string) => void;
};

type TokenResponse = {
  token: string;
  serverUrl: string;
  roomName: string;
  profileId: string;
};

export function BotssonOrbVoiceMount({
  active,
  workspaceId,
  onStatusChange,
  onActivity,
  onError,
}: Props) {
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stable refs so event handlers don't capture stale callback props
  const onStatusChangeRef = useRef(onStatusChange);
  const onActivityRef = useRef(onActivity);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);
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

      // Subscribe to adapter activity events (tool calls, intents, etc).
      // Voice-agent publishes JSON over data channel topic="botsson-activity".
      const decoder = new TextDecoder();
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, _participant, _kind, topic) => {
        if (topic !== "botsson-activity") return;
        try {
          const event = JSON.parse(decoder.decode(payload)) as BotssonActivityEvent;
          onActivityRef.current?.(event);
        } catch (err) {
          console.warn("[BotssonOrbVoiceMount] activity decode failed:", err);
        }
      });

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
