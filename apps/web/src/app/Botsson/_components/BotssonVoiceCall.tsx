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

import { useEffect, useRef, useCallback } from "react";
import type { DataPacket_Kind } from "livekit-client";
import { Room, RoomEvent } from "livekit-client";
import { useBotsson } from "./BotssonProvider";
import type { OrbStatus, BotssonPosition } from "./types";
import { DENSITY_DIMENSIONS, EDGE_GAP } from "./types";

// ---------------------------------------------------------------------------
// Orb command type — mirrors services/voice-agent/src/tools-orb.ts
// (not imported from there — voice-agent is a Node process, not a browser pkg)
// ---------------------------------------------------------------------------

type OrbAction = "expand" | "collapse" | "pulse" | "pin" | "unpin" | "move" | "set_state";

type OrbCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type OrbCommandEvent = {
  type: "orb_command";
  action: OrbAction;
  args: Record<string, unknown>;
  ts: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map agent-controlled orb states → existing OrbStatus enum values */
function mapOrbState(state: string): OrbStatus {
  switch (state) {
    case "working":
      return "thinking";
    case "alert":
      return "notification";
    case "celebrating":
      return "speaking";
    case "idle":
      return "idle";
    default:
      return "idle";
  }
}

/** Map a corner name → { x, y } pixel position using current viewport */
function cornerToPosition(corner: OrbCorner): BotssonPosition {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
  const orbW = DENSITY_DIMENSIONS.orb.width;
  const orbH = DENSITY_DIMENSIONS.orb.height;

  switch (corner) {
    case "top-left":
      return { x: EDGE_GAP, y: EDGE_GAP };
    case "top-right":
      return { x: vw - orbW - EDGE_GAP, y: EDGE_GAP };
    case "bottom-left":
      return { x: EDGE_GAP, y: vh - orbH - EDGE_GAP };
    case "bottom-right":
      return { x: vw - orbW - EDGE_GAP, y: vh - orbH - EDGE_GAP };
  }
}

// ---------------------------------------------------------------------------
// Pulse helper — sets status to notification, reverts after duration
// ---------------------------------------------------------------------------

function usePulseTimer() {
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePulse = useCallback((setOrbStatus: (s: OrbStatus) => void, durationMs: number) => {
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    setOrbStatus("notification");
    pulseTimer.current = setTimeout(() => {
      setOrbStatus("idle");
      pulseTimer.current = null;
    }, durationMs);
  }, []);

  useEffect(
    () => () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    },
    [],
  );

  return schedulePulse;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type BotssonVoiceCallProps = {
  /**
   * LiveKit server WebSocket URL, e.g. "wss://your-project.livekit.cloud".
   * When absent, the component is inert (no connection attempted).
   */
  serverUrl?: string | null;
  /**
   * LiveKit room access token.
   * When absent, the component is inert (no connection attempted).
   */
  token?: string | null;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * BotssonVoiceCall — invisible bridge between the LiveKit voice-agent's data
 * channel and the BotssonProvider context.
 *
 * Must be mounted inside <BotssonProvider>. Renders nothing.
 *
 * @example
 * <BotssonVoiceCall serverUrl={lkServerUrl} token={lkToken} />
 */
export function BotssonVoiceCall({ serverUrl, token }: BotssonVoiceCallProps) {
  const { expand, collapse, setOrbStatus, setPosition, pinned, setPinned } = useBotsson();

  const schedulePulse = usePulseTimer();

  // Keep stable refs so the RoomEvent handler is not stale
  const expandRef = useRef(expand);
  const collapseRef = useRef(collapse);
  const setOrbStatusRef = useRef(setOrbStatus);
  const setPositionRef = useRef(setPosition);
  const pinnedRef = useRef(pinned);
  const setPinnedRef = useRef(setPinned);

  useEffect(() => {
    expandRef.current = expand;
  }, [expand]);
  useEffect(() => {
    collapseRef.current = collapse;
  }, [collapse]);
  useEffect(() => {
    setOrbStatusRef.current = setOrbStatus;
  }, [setOrbStatus]);
  useEffect(() => {
    setPositionRef.current = setPosition;
  }, [setPosition]);
  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);
  useEffect(() => {
    setPinnedRef.current = setPinned;
  }, [setPinned]);

  // Stable pulse scheduler ref
  const schedulePulseRef = useRef(schedulePulse);
  useEffect(() => {
    schedulePulseRef.current = schedulePulse;
  }, [schedulePulse]);

  /**
   * handleVoiceActivity — routes incoming orb_command events to
   * BotssonProvider actions.
   *
   * Called from the LiveKit DataReceived event handler. All state reads use
   * refs to avoid stale closures inside the event listener.
   */
  const handleVoiceActivity = useCallback((raw: unknown) => {
    // Type-narrow: only handle orb_command events
    if (
      typeof raw !== "object" ||
      raw === null ||
      (raw as Record<string, unknown>).type !== "orb_command"
    ) {
      return;
    }

    const ev = raw as OrbCommandEvent;

    switch (ev.action) {
      case "expand":
        expandRef.current();
        break;

      case "collapse":
        // Respect pinned — don't collapse while pinned
        if (!pinnedRef.current) {
          collapseRef.current();
        }
        break;

      case "pulse": {
        const durationSec =
          typeof ev.args.duration_seconds === "number" ? ev.args.duration_seconds : 3;
        schedulePulseRef.current(setOrbStatusRef.current, durationSec * 1000);
        break;
      }

      case "pin":
        setPinnedRef.current(true);
        break;

      case "unpin":
        setPinnedRef.current(false);
        break;

      case "move": {
        const corner = ev.args.corner as OrbCorner | undefined;
        if (
          corner === "top-left" ||
          corner === "top-right" ||
          corner === "bottom-left" ||
          corner === "bottom-right"
        ) {
          setPositionRef.current(cornerToPosition(corner));
        }
        break;
      }

      case "set_state": {
        const state = typeof ev.args.state === "string" ? ev.args.state : "idle";
        setOrbStatusRef.current(mapOrbState(state));
        break;
      }

      default:
        // Unknown action — log + ignore. Forward-compatible.
        console.debug("[BotssonVoiceCall] unknown orb action:", ev.action);
    }
  }, []); // Stable — all mutations via refs

  // --------------------------------------------------------------------------
  // LiveKit Room — listen-only connection for data channel
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!serverUrl || !token) return;

    // Listen-only Room — no audio capture, no video
    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
      // Suppress automatic microphone/camera capture
      audioCaptureDefaults: { autoGainControl: false },
    });

    room.on(
      RoomEvent.DataReceived,
      (payload: Uint8Array, _participant?: unknown, _kind?: DataPacket_Kind, topic?: string) => {
        if (topic !== "botsson-activity") return;
        try {
          const event = JSON.parse(new TextDecoder().decode(payload)) as unknown;
          handleVoiceActivity(event);
        } catch (err) {
          console.warn("[BotssonVoiceCall] failed to parse activity event:", err);
        }
      },
    );

    void room
      .connect(serverUrl, token, {
        // Listen-only — do not publish audio
        autoSubscribe: true,
      })
      .catch((err) => {
        console.warn("[BotssonVoiceCall] connect failed:", err);
      });

    return () => {
      room.disconnect();
    };
  }, [serverUrl, token, handleVoiceActivity]);

  // Renders nothing — purely a side-effect component
  return null;
}

/**
 * BotssonVoiceCall — LiveKit voice session wired to the Botsson Orb.
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
