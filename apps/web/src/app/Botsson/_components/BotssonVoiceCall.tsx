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
