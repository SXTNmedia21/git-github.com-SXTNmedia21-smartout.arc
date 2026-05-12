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

import { Room, RoomEvent, Track, createLocalAudioTrack } from "livekit-client";
import type { RemoteTrack, RemoteTrackPublication, RemoteParticipant } from "livekit-client";
// @livekit/krisp-noise-filter instantiates a Worker at module-eval time.
// Static import causes Next.js SSR prerender of /Botsson to throw
// "ReferenceError: Worker is not defined" even though this is a "use client"
// component — Turbopack bundles it with a hashed specifier that bypasses
// serverExternalPackages matching. Lazy-import inside the effect (browser-only
// code path) avoids the issue entirely.
type KrispModule = typeof import("@livekit/krisp-noise-filter");
let _krispMod: KrispModule | null = null;
async function loadKrisp(): Promise<KrispModule | null> {
  if (typeof window === "undefined") return null;
  if (_krispMod) return _krispMod;
  _krispMod = await import("@livekit/krisp-noise-filter");
  return _krispMod;
}
import { usePathname, useSearchParams } from "next/navigation";
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
  | { type: "navigate"; path: string; ts: number }
  | { type: "shift_proposal_create"; payload: Record<string, unknown>; ts: number }
  | { type: "shift_proposal_update"; payload: Record<string, unknown>; ts: number }
  | { type: "shift_proposal_delete"; payload: Record<string, unknown>; ts: number };

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

// Voice-agent listens on topic="botsson-context" and accepts two message types:
// "context_init"  — workspace + user blocks (fetched from BFF after connect)
// "context_route" — current page + entity descriptors (published on every route change)
// Without these the agent ctx.user / ctx.workspace / ctx.route are null and every
// utterance early-returns "brukerdata mangler". See ADR audit C1 (2026-05-06).
const CONTEXT_TOPIC = "botsson-context";

type SessionContextResponse = {
  user: Record<string, unknown>;
  workspace: Record<string, unknown>;
  workforce?: Record<string, unknown>;
};

async function fetchSessionContext(
  workspaceId: string,
  signal: AbortSignal,
): Promise<SessionContextResponse | null> {
  try {
    const res = await fetch(
      `/api/botsson/voice/session-context?workspaceId=${encodeURIComponent(workspaceId)}`,
      { signal, credentials: "same-origin" },
    );
    if (!res.ok) {
      console.warn(`[BotssonOrbVoiceMount] session-context fetch failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as SessionContextResponse;
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") return null;
    console.warn("[BotssonOrbVoiceMount] session-context fetch error:", err);
    return null;
  }
}

function publishContextPayload(room: Room, payload: Record<string, unknown>): void {
  try {
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    void room.localParticipant.publishData(encoded, {
      topic: CONTEXT_TOPIC,
      reliable: true,
    });
  } catch (err) {
    console.warn("[BotssonOrbVoiceMount] publishContextPayload failed:", err);
  }
}

function buildRouteMessage(
  pathname: string,
  searchParams: URLSearchParams | ReadonlyURLSearchParamsLike | null,
): Record<string, unknown> {
  const query: Record<string, string> = {};
  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      query[key] = value;
    }
  }
  return {
    type: "context_route",
    path: pathname,
    query,
    entity_type: null,
    entity_id: null,
    entity_label: null,
  };
}

// Next.js useSearchParams returns ReadonlyURLSearchParams which has the same
// .entries() shape as URLSearchParams but isn't structurally identical in TS.
type ReadonlyURLSearchParamsLike = {
  entries: () => IterableIterator<[string, string]>;
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const isConnectedRef = useRef(false);

  // Pathname / searchParams watched in a separate effect that publishes
  // context_route whenever the user navigates (e.g. /dashboard/people →
  // /dashboard/schedule). The voice-agent path-gate uses this to decide
  // whether propose_* schedule tools are addressable.
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Stable refs so event handlers don't capture stale callback props
  const onStatusChangeRef = useRef(onStatusChange);
  const onActivityRef = useRef(onActivity);
  const onErrorRef = useRef(onError);
  // Pathname/searchParams refs — connect() is one-shot async and must read
  // the latest URL state at the moment of the initial publish, not a stale
  // closure capture from the mount tick.
  const pathnameRef = useRef(pathname);
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  const updateStatus = useCallback((next: VoiceCallStatus) => {
    onStatusChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    if (!active) {
      if (roomRef.current) {
        void roomRef.current.disconnect();
        roomRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      updateStatus("idle");
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

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

      // livekit-client 2.17 requires Room-owned AudioContext when a TrackProcessor
      // (Krisp NC) is attached to the local mic track. Passing webAudioMix.audioContext
      // here means tracks created later via setMicrophoneEnabled inherit it; without
      // this, setProcessor throws "Audio context needs to be set on LocalAudioTrack".
      const AudioContextCtor =
        typeof window !== "undefined"
          ? (window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
          : undefined;
      const audioContext = AudioContextCtor ? new AudioContextCtor() : undefined;
      if (audioContext) {
        audioContextRef.current = audioContext;
      }
      const room = new Room({
        adaptiveStream: true,
        disconnectOnPageLeave: false,
        ...(audioContext ? { webAudioMix: { audioContext } } : {}),
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
        isConnectedRef.current = false;
      });

      try {
        await room.connect(tokenData.serverUrl, tokenData.token);
        if (cancelled) {
          void room.disconnect();
          return;
        }
        // ADR-0282 R5: Krisp NC on local participant only.
        // voice-agent is NC-off (never double-process).
        //
        // livekit-client 2.17 createLocalTracks() instantiates LocalAudioTrack
        // with audioContext=undefined, then synchronously calls setProcessor
        // before LocalParticipant.createTracks gets a chance to seed
        // audioContext via AudioStreamAcquired. setProcessor throws.
        // Workaround: skip the setMicrophoneEnabled-with-processor path and
        // build the track manually — seed audioContext on the track itself
        // before setProcessor, then publishTrack.
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume();
        }
        const krisp = await loadKrisp();
        const krispProcessor = krisp?.isKrispNoiseFilterSupported()
          ? krisp.KrispNoiseFilter()
          : undefined;
        if (krispProcessor && audioContextRef.current) {
          const audioTrack = await createLocalAudioTrack();
          audioTrack.setAudioContext(audioContextRef.current);
          await audioTrack.setProcessor(krispProcessor);
          await room.localParticipant.publishTrack(audioTrack);
        } else {
          await room.localParticipant.setMicrophoneEnabled(true);
        }
        isConnectedRef.current = true;

        // Publish context_init so voice-agent populates ctx.user + ctx.workspace.
        // Failure here is degraded-mode (audit C1: log+continue) — agent will
        // still register, greet, and accept orb-only tools that don't require
        // ctx. Stage-engine-bound tools will early-return "brukerdata mangler"
        // until next route change re-attempts (or page reload).
        const ctxResponse = await fetchSessionContext(workspaceId, abortController.signal);
        if (cancelled) return;
        if (ctxResponse) {
          publishContextPayload(room, {
            type: "context_init",
            user: ctxResponse.user,
            workspace: ctxResponse.workspace,
            ...(ctxResponse.workforce ? { workforce: ctxResponse.workforce } : {}),
          });
        }

        // Publish initial route immediately. Subsequent route changes are
        // handled by the pathname-watching useEffect below.
        publishContextPayload(
          room,
          buildRouteMessage(pathnameRef.current, searchParamsRef.current),
        );
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Connection failed";
        onErrorRef.current?.(message);
        updateStatus("idle");
        roomRef.current = null;
        if (audioContextRef.current) {
          void audioContextRef.current.close();
          audioContextRef.current = null;
        }
        isConnectedRef.current = false;
      }
    }

    void connect();

    return () => {
      cancelled = true;
      abortController.abort();
      if (roomRef.current) {
        void roomRef.current.disconnect();
        roomRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      isConnectedRef.current = false;
    };
    // workspaceId captured in the closure once at mount — intentionally stable.
    // Reconnecting on every workspaceId identity change would interrupt active calls.
  }, [active, updateStatus]);

  // Republish context_route on every Next.js navigation while the room is live.
  // The voice-agent path-gate uses ctx.route?.path to decide which propose_*
  // tools are addressable; without this republish, navigating from /people
  // to /schedule would leave the gate stuck on the original mount path.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !isConnectedRef.current) return;
    publishContextPayload(room, buildRouteMessage(pathname, searchParams));
  }, [pathname, searchParams]);

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
