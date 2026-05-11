/**
 * useBotssonVoiceSession — Phase C1.b orchestration hook.
 *
 * Owns the end-to-end "Jarvis moment" on mobile:
 *
 *   1. Mint a LiveKit token with `purpose='ai_voice'` (the C1 edge-function
 *      path that enforces `channel_ai_policy.voice_participation`).
 *   2. Create a LiveKit Room and connect with the token. Publish mic if
 *      policy allows; subscribe-only if policy is `listen_only`.
 *   3. Attach `useVoiceTranscripts` (C1 hook) so every final ASR transcript
 *      is POSTed to the BFF and the agent's text response comes back on
 *      the `onResponse` callback.
 *   4. On each response, invoke Expo Speech (`Speech.speak(..., { language:
 *      'nb-NO' })`) to close the voice loop — user hears Botsson.
 *
 * State machine exposed via `status`:
 *   idle       — no session
 *   connecting — token minted, Room connect in flight
 *   listening  — connected, mic live, no transcript in flight
 *   thinking   — transcript posted to BFF, awaiting agent response
 *   speaking   — TTS currently speaking the response
 *   error      — token / connect / auth / BFF failure (see `error` field)
 *
 * This hook is **room-agnostic on input**: callers provide `workspaceId`,
 * `profileId` and `channelId` (the "Botsson channel" for this workspace —
 * C1.b handoff documents the recommended default: one singleton per
 * workspace seeded at bootstrap). The hook owns its own Room instance and
 * tears it down on `stop()` or unmount.
 *
 * Architecture layers touched:
 *   L1 (mobile UI) ── this hook ──┐
 *                                 ├── LiveKit token edge fn (C1)  ← gate
 *                                 └── BFF /api/emma/voice/transcript (C1)
 *                                         ↳ stage-engine → capabilities
 *
 * ADR-0132 (thin client) — every agent call goes through BFF, never direct.
 * ADR-0078 (voice channel guard) — BFF pins `channel='voice'` server-side.
 * ADR-0134 (mobile telemetry) — voice.* events emitted with non-empty
 *   `workspace_id` + `actor_id` resolved via `getProfileContext()` upstream.
 * ADR-0135 (LiveKit) — token purpose + `channel_ai_policy` gate honoured.
 *
 * Why this is NOT a variant of `useLiveKitCall`:
 *   - Active-speaker / group-call semantics don't apply (one user + one AI).
 *   - The mic is always the local participant's — no "ring to answer".
 *   - `onDisconnected` fan-out is simpler — the hook owns the lifecycle.
 *   - Mixing the two concerns in one hook masked the C1 transcript glue.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Room, RoomEvent } from "livekit-client";
import type { AudioProcessorOptions, TrackProcessor, Track } from "livekit-client";
import * as Speech from "expo-speech";
// ADR-0282 R5: Krisp NC on local participant only — voice-agent is NC-off.
// require() is guarded by Platform.OS so bundler excludes it on web.
const KrispNativeNoiseFilter =
  Platform.OS !== "web"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (
        require("@livekit/react-native-krisp-noise-filter") as {
          KrispNoiseFilter: () => TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>;
        }
      ).KrispNoiseFilter
    : null;
import { supabase } from "@/lib/supabase";
import { getLiveKitToken } from "@smartout/walkie-talkie";
import { useVoiceTranscripts, type AgentResponse } from "@/hooks/use-voice-transcripts";

// AudioSession uses native WebRTC modules — only available on iOS/Android.
// Same shim pattern as use-livekit-call.ts so we stay mountable under web+jest.
const AudioSession =
  Platform.OS !== "web"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@livekit/react-native").AudioSession
    : { startAudioSession: async () => {}, stopAudioSession: async () => {} };

/**
 * Public state exposed to the BotssonProvider / UI orb.
 *
 * Maps 1:1 to the orb-colour contract in the C1.b handoff § Orb-state mapping.
 */
export type BotssonVoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export type BotssonVoiceError = {
  code: string;
  message: string;
};

export type UseBotssonVoiceSessionParams = {
  /** Workspace scope — required for telemetry + token. */
  workspaceId: string | null;
  /**
   * Channel id hosting the Botsson voice room. The LiveKit token edge
   * function reads `channel_ai_policy.voice_participation` for this channel.
   *
   * C1.b decision: a single workspace-scoped "Botsson" channel per workspace
   * is the recommended default (see handoff § Decisions). Per-session ad-hoc
   * rooms are an option but require a policy-resolution path that doesn't
   * exist yet in the edge function.
   */
  channelId: string | null;
  /** Stage-engine session id seed (rare — usually undefined on first turn). */
  initialSessionId?: string;
  /**
   * TTS language. Defaults to `nb-NO` — Botsson speaks Norwegian by default.
   * Override for English previews or future multi-lingual support.
   */
  ttsLanguage?: string;
  /**
   * ASR provider tag threaded to telemetry. Defaults to LiveKit's built-in
   * Whisper pipeline; overridable when another provider is introduced.
   */
  asrProvider?: string;
  /**
   * Disable the hook (e.g. to suspend during backgrounded app). The room
   * is not torn down automatically — caller must also call `stop()` if
   * they want the room to disconnect.
   */
  disabled?: boolean;
  /** Called whenever the orchestrator transitions into `error`. */
  onError?: (error: BotssonVoiceError) => void;
  /** Test seam — replaces expo-speech. Not documented in the public API. */
  speechAdapter?: SpeechAdapter;
  /** Test seam — replaces `new Room()`. Not documented in the public API. */
  roomFactory?: () => Room;
};

export type UseBotssonVoiceSessionResult = {
  status: BotssonVoiceStatus;
  error: BotssonVoiceError | null;
  /** True once the LiveKit Room transitions to connected. */
  isConnected: boolean;
  /**
   * True when the local participant's mic is enabled. Always false for
   * `listen_only` policy. Flipping via `toggleMic` is a no-op on
   * `listen_only` (mic cannot be unmuted against policy).
   */
  isMuted: boolean;
  /** Current voice-policy resolved by the edge function when the token was minted. */
  voiceParticipation: "listen_only" | "interactive" | null;
  /** Last final agent response text. Empty string until the first turn. */
  lastResponse: string;
  /**
   * Mint token, create Room, connect, wire transcripts. Resolves once the
   * Room is connected (even if TTS hasn't spoken yet). Rejects on failure.
   */
  start: () => Promise<void>;
  /** Disconnect Room, cancel TTS, reset to `idle`. Safe to call repeatedly. */
  stop: () => Promise<void>;
  /** Toggle mic (no-op on `listen_only` policy). */
  toggleMic: () => Promise<void>;
};

/** Minimal surface we use from expo-speech — matches Speech.speak + Speech.stop. */
export type SpeechAdapter = {
  speak: (
    text: string,
    options?: {
      language?: string;
      onStart?: () => void;
      onDone?: () => void;
      onStopped?: () => void;
      onError?: (e: unknown) => void;
    },
  ) => void;
  stop: () => void;
};

/** Default adapter that wraps expo-speech directly. */
const expoSpeechAdapter: SpeechAdapter = {
  speak: (text, options) => Speech.speak(text, options),
  stop: () => Speech.stop(),
};

/**
 * Pure response orchestrator — factored out of the hook so jest-node can
 * exercise it without a React renderer (no `@testing-library/react` in
 * `apps/mobile`). Given an agent response + side-effect dependencies, it
 * decides which status transitions to apply and whether to speak.
 *
 * Contract:
 *   - Empty / whitespace-only text → transition to 'listening', NO speak call.
 *   - Non-empty text → transition to 'speaking', call `speak()` with the
 *     resolved TTS options. The caller wires `onDone` / `onStopped` to
 *     return to 'listening' once TTS finishes.
 *   - If `speak()` throws synchronously (defensive), surface via `onError`
 *     and drop back to 'listening'.
 *
 * Returned value: the status the caller should set AFTER the handler runs.
 * Keeps the function pure w.r.t. its own state lookups.
 */
export type HandleAgentResponseDeps = {
  speak: SpeechAdapter["speak"];
  ttsLanguage: string;
  /** Invoked when TTS finishes or is interrupted — typically `setStatus('listening')`. */
  onSpeakComplete: () => void;
  /** Invoked on synchronous speak() throws. Receives { code, message }. */
  onError?: (err: BotssonVoiceError) => void;
};

export function handleAgentResponse(
  response: AgentResponse,
  deps: HandleAgentResponseDeps,
): { nextStatus: BotssonVoiceStatus; spoke: boolean } {
  const text = response.text ?? "";
  if (!text || text.trim().length === 0) {
    return { nextStatus: "listening", spoke: false };
  }
  try {
    deps.speak(text, {
      language: deps.ttsLanguage,
      onDone: deps.onSpeakComplete,
      onStopped: deps.onSpeakComplete,
      onError: deps.onSpeakComplete,
    });
    return { nextStatus: "speaking", spoke: true };
  } catch (e) {
    deps.onError?.({
      code: "TTS_FAILED",
      message: e instanceof Error ? e.message : "Speech synthesis failed",
    });
    return { nextStatus: "listening", spoke: false };
  }
}

/**
 * Pure session-start orchestrator — also jest-node testable. Calls
 * `mintToken`, then `roomFactory() + connect()`, then publishes mic if
 * policy allows. Returns the connected Room + resolved policy so the hook
 * can commit them to state, or throws a `BotssonVoiceError` on any step.
 *
 * The test seams (`mintToken`, `roomFactory`) let the acceptance tests
 * exercise the real flow: policy-disabled rejects cleanly without ever
 * calling `roomFactory`; happy-path verifies Room.connect was called with
 * the token.
 */
export type MintedToken = {
  token: string;
  serverUrl: string;
  voiceParticipation: "listen_only" | "interactive" | null;
};

export type PerformStartDeps = {
  mintToken: () => Promise<MintedToken>;
  roomFactory: () => Room;
  /** Optional — platform AudioSession shim. */
  audioSessionStart?: () => Promise<void>;
};

export type PerformStartResult = {
  room: Room;
  voiceParticipation: "listen_only" | "interactive";
  micEnabled: boolean;
};

export async function performStart(deps: PerformStartDeps): Promise<PerformStartResult> {
  try {
    await deps.audioSessionStart?.();
  } catch {
    // AudioSession failure shouldn't abort — Room.connect below will fail
    // loudly if media truly cannot start.
  }

  let token: MintedToken;
  try {
    token = await deps.mintToken();
  } catch (e) {
    throw {
      code: "TOKEN_FAILED",
      message: e instanceof Error ? e.message : "Failed to mint LiveKit token",
    } satisfies BotssonVoiceError;
  }

  const resolvedPolicy: "listen_only" | "interactive" =
    token.voiceParticipation === "listen_only" ? "listen_only" : "interactive";

  const room = deps.roomFactory();
  try {
    await room.connect(token.serverUrl, token.token, { autoSubscribe: true });
  } catch (e) {
    try {
      await room.disconnect();
    } catch {
      /* ignore */
    }
    throw {
      code: "CONNECT_FAILED",
      message: e instanceof Error ? e.message : "Failed to connect to LiveKit",
    } satisfies BotssonVoiceError;
  }

  let micEnabled = false;
  if (resolvedPolicy === "interactive") {
    try {
      const krispProcessor = KrispNativeNoiseFilter ? KrispNativeNoiseFilter() : undefined;
      await room.localParticipant.setMicrophoneEnabled(
        true,
        krispProcessor ? { processor: krispProcessor } : undefined,
      );
      micEnabled = true;
    } catch {
      // Mic enable failed — keep the session running in effective-mute.
      micEnabled = false;
    }
  }

  return { room, voiceParticipation: resolvedPolicy, micEnabled };
}

export function useBotssonVoiceSession(
  params: UseBotssonVoiceSessionParams,
): UseBotssonVoiceSessionResult {
  const {
    workspaceId,
    channelId,
    initialSessionId,
    ttsLanguage = "nb-NO",
    asrProvider,
    disabled = false,
    onError,
    speechAdapter = expoSpeechAdapter,
    roomFactory,
  } = params;

  const [room, setRoom] = useState<Room | null>(null);
  const [livekitRoomId, setLivekitRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<BotssonVoiceStatus>("idle");
  const [error, setError] = useState<BotssonVoiceError | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceParticipation, setVoiceParticipation] = useState<
    "listen_only" | "interactive" | null
  >(null);
  const [lastResponse, setLastResponse] = useState<string>("");

  // Refs keep async handlers stable so React-state churn doesn't re-subscribe.
  const roomRef = useRef<Room | null>(null);
  const speechAdapterRef = useRef(speechAdapter);
  const onErrorRef = useRef(onError);
  const ttsLanguageRef = useRef(ttsLanguage);
  const startingRef = useRef(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    speechAdapterRef.current = speechAdapter;
  }, [speechAdapter]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    ttsLanguageRef.current = ttsLanguage;
  }, [ttsLanguage]);

  /** Signal error once, route through onError callback, set state. */
  const fail = useCallback((err: BotssonVoiceError) => {
    setError(err);
    setStatus("error");
    onErrorRef.current?.(err);
  }, []);

  /**
   * Attach `useVoiceTranscripts` to the live Room. Response from BFF
   * triggers `speechAdapter.speak()`. Transcript posted → status
   * transitions to `thinking`; on response → `speaking` → `listening`.
   */
  useVoiceTranscripts({
    room,
    livekitRoomId,
    workspaceId,
    channelId,
    initialSessionId,
    asrProvider,
    disabled: disabled || voiceParticipation === "listen_only",
    onTranscript: useCallback(() => {
      // User finished an utterance — we're awaiting the agent.
      setStatus((prev) => (prev === "speaking" || prev === "listening" ? "thinking" : prev));
    }, []),
    onResponse: useCallback(
      (response: AgentResponse) => {
        const text = response.text ?? "";
        if (text && text.trim().length > 0) {
          setLastResponse(text);
        }
        const result = handleAgentResponse(response, {
          speak: speechAdapterRef.current.speak,
          ttsLanguage: ttsLanguageRef.current,
          onSpeakComplete: () => {
            if (stoppedRef.current) return;
            setStatus("listening");
          },
          onError: fail,
        });
        setStatus(result.nextStatus);
      },
      [fail],
    ),
  });

  /** Track LiveKit Room connection + mic lifecycle events. */
  useEffect(() => {
    if (!room) return;

    const handleConnected = () => {
      setIsConnected(true);
    };
    const handleDisconnected = () => {
      setIsConnected(false);
      setIsMuted(false);
      // Only transition status if we're not deliberately stopping.
      if (!stoppedRef.current) {
        setStatus("idle");
      }
    };
    const handleTrackMuted = () => {
      const enabled = room.localParticipant.isMicrophoneEnabled;
      setIsMuted(!enabled);
    };

    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackMuted);

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackMuted);
    };
  }, [room]);

  /**
   * Mint token → create Room → connect → publish mic (per policy).
   * Idempotent: concurrent `start()` calls coalesce. Delegates to the
   * pure `performStart()` orchestrator so the same flow is exercised in
   * jest-node tests (acceptance matrix rows 4–6).
   */
  const start = useCallback(async () => {
    if (startingRef.current) return;
    if (!workspaceId || !channelId) {
      fail({
        code: "MISSING_IDS",
        message: "workspaceId and channelId are required to start a voice session",
      });
      return;
    }

    startingRef.current = true;
    stoppedRef.current = false;
    setError(null);
    setStatus("connecting");

    try {
      const result = await performStart({
        mintToken: async () => {
          const t = await getLiveKitToken(supabase, {
            channelId,
            workspaceId,
            purpose: "ai_voice",
          });
          return {
            token: t.token,
            serverUrl: t.serverUrl,
            voiceParticipation: t.voiceParticipation ?? null,
          };
        },
        roomFactory: roomFactory ?? (() => new Room()),
        audioSessionStart: () => AudioSession.startAudioSession(),
      });

      // Stage-engine session IDs are `${workspaceId}:${channelId}` — stable
      // across reconnects. Matches the BFF + transcript-hook expectation.
      const roomId = `${workspaceId}:${channelId}`;

      setVoiceParticipation(result.voiceParticipation);
      setIsMuted(!result.micEnabled);
      setRoom(result.room);
      setLivekitRoomId(roomId);
      setIsConnected(true);
      setStatus("listening");
    } catch (e) {
      const err = e as BotssonVoiceError;
      if (err && typeof err === "object" && "code" in err) {
        fail(err);
      } else {
        fail({
          code: "UNKNOWN_ERROR",
          message: e instanceof Error ? e.message : "Voice session failed",
        });
      }
    } finally {
      startingRef.current = false;
    }
  }, [workspaceId, channelId, fail, roomFactory]);

  const stop = useCallback(async () => {
    stoppedRef.current = true;
    speechAdapterRef.current.stop();
    const activeRoom = roomRef.current;
    if (activeRoom) {
      try {
        await activeRoom.disconnect();
      } catch {
        /* swallow — disconnect should never throw but RN occasionally does */
      }
    }
    try {
      await AudioSession.stopAudioSession();
    } catch {
      /* ignore */
    }
    setRoom(null);
    setLivekitRoomId(null);
    setIsConnected(false);
    setIsMuted(false);
    setVoiceParticipation(null);
    setStatus("idle");
  }, []);

  const toggleMic = useCallback(async () => {
    const activeRoom = roomRef.current;
    if (!activeRoom?.localParticipant) return;
    if (voiceParticipation === "listen_only") return;
    const next = !activeRoom.localParticipant.isMicrophoneEnabled;
    try {
      await activeRoom.localParticipant.setMicrophoneEnabled(next);
      setIsMuted(!next);
    } catch {
      // Mic-toggle failure is visible to the user via the orb status, no throw.
    }
  }, [voiceParticipation]);

  // Cleanup on unmount — always disconnect + cancel TTS. Note we rely on
  // `stop()` for full teardown, but an unmounted component can't await a
  // promise; the fire-and-forget disconnect + speech.stop() is sufficient.
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      speechAdapterRef.current.stop();
      const activeRoom = roomRef.current;
      if (activeRoom) {
        void activeRoom.disconnect();
      }
    };
  }, []);

  return {
    status,
    error,
    isConnected,
    isMuted,
    voiceParticipation,
    lastResponse,
    start,
    stop,
    toggleMic,
  };
}
