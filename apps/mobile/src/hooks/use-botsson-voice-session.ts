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

import type React from "react";
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
import { emit, nonEmpty } from "@smartout/telemetry";
import { supabase } from "@/lib/supabase";
import { getLiveKitToken } from "@smartout/walkie-talkie";
import { getProfileContext } from "@/lib/profile-context";
import {
  publishBotssonContext,
  publishBotssonToolsRegister,
  publishBotssonToolResult,
} from "@/lib/livekit-data-publish";
import { executeMobileTool, getToolDefinitionsForRegistration } from "@/lib/botsson-tools";
import { useVoiceTranscripts, type AgentResponse } from "@/hooks/use-voice-transcripts";
import type { ResolvedSnapshot } from "@/hooks/use-voice-transcripts";

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
  /**
   * ADR-0297: current workforce snapshot held by BotssonProvider.
   * On `RoomEvent.Connected`, if this is non-null and its version differs
   * from the last published version, the hook publishes it on the
   * "botsson-context" data channel so voice-agent's `setSessionContext()`
   * fires. Deduped by version so reconnects don't re-publish unchanged data.
   */
  currentSnapshot?: ResolvedSnapshot | null;
  /**
   * Called when the transcript hook surfaces a new snapshot from the BFF.
   * The hook itself does NOT mutate provider state — it calls back upward so
   * BotssonProvider can lift the snapshot to canonical context state.
   */
  onSnapshot?: (snapshot: ResolvedSnapshot) => void;
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
   * Last final user utterance text delivered by the ASR pipeline.
   * Empty string until the first turn. Updated before `status` transitions
   * to `thinking` so subscribers can capture it synchronously.
   */
  lastUserTranscript: string;
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
    currentSnapshot,
    onSnapshot,
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
  const [lastUserTranscript, setLastUserTranscript] = useState<string>("");

  // Refs keep async handlers stable so React-state churn doesn't re-subscribe.
  const roomRef = useRef<Room | null>(null);
  const speechAdapterRef = useRef(speechAdapter);
  const onErrorRef = useRef(onError);
  const onSnapshotRef = useRef(onSnapshot);
  const ttsLanguageRef = useRef(ttsLanguage);
  const startingRef = useRef(false);
  const stoppedRef = useRef(false);
  /**
   * ADR-0297: version of the last snapshot we successfully published on the
   * "botsson-context" data channel. Prevents re-publishing the same version
   * on reconnects. Empty string = nothing published yet this session.
   */
  const lastPublishedVersionRef = useRef<string>("");
  /**
   * ADR-0297: stable ref to the current snapshot so the RoomEvent.Connected
   * handler can read it without being re-registered on every snapshot change.
   */
  const currentSnapshotRef = useRef<ResolvedSnapshot | null | undefined>(currentSnapshot);
  /**
   * Workspace id ref for use inside RoomEvent handlers (stable, no re-subscribe).
   */
  const workspaceIdRef = useRef<string | null>(workspaceId);

  /**
   * P4 (L-0234): Dedup set for botsson-tool-call events. Prevents double-
   * execution if voice-agent re-delivers the same call_id on reconnect.
   * Cleared on explicit stop() so the next session starts with a clean slate.
   */
  const seenCallIdsRef = useRef<Set<string>>(new Set());

  /**
   * Stable snapshot handler ref — used as `onSnapshot` in useVoiceTranscripts.
   * Reading from roomRef + onSnapshotRef + lastPublishedVersionRef avoids
   * the exhaustive-deps trap of useCallback with an empty dep array.
   * The function identity is stable across renders (same ref object).
   */
  const onSnapshotStableRef = useRef((snapshot: ResolvedSnapshot) => {
    // Lift to BotssonProvider so it updates currentSnapshot state.
    onSnapshotRef.current?.(snapshot);
    // Also attempt immediate publish if room is already connected.
    const activeRoom = roomRef.current;
    if (!activeRoom) return;
    if (snapshot.version === lastPublishedVersionRef.current) return;
    void publishSnapshotToRoom(
      activeRoom,
      snapshot,
      workspaceIdRef.current,
      lastPublishedVersionRef,
    );
  });

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
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);
  useEffect(() => {
    ttsLanguageRef.current = ttsLanguage;
  }, [ttsLanguage]);
  useEffect(() => {
    currentSnapshotRef.current = currentSnapshot;
  }, [currentSnapshot]);
  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

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
   *
   * ADR-0297: `currentSnapshotVersion` lets the BFF skip re-assembly when
   * the snapshot hasn't changed. `onSnapshot` lifts new snapshots upward
   * to BotssonProvider, which triggers data-channel publish via the
   * RoomEvent.Connected effect below.
   */
  useVoiceTranscripts({
    room,
    livekitRoomId,
    workspaceId,
    channelId,
    initialSessionId,
    asrProvider,
    currentSnapshotVersion: currentSnapshotRef.current?.version ?? null,
    disabled: disabled || voiceParticipation === "listen_only",
    onTranscript: useCallback((text: string) => {
      // User finished an utterance — capture the text then await the agent.
      if (text && text.trim().length > 0) {
        setLastUserTranscript(text.trim());
      }
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
    // onSnapshot: ref-stable callback — reads latest roomRef + onSnapshotRef
    // via refs so we avoid useCallback with stale closures. Not a hook call.
    onSnapshot: onSnapshotStableRef.current,
  });

  /** Track LiveKit Room connection + mic lifecycle events + P4 RPC listener. */
  useEffect(() => {
    if (!room) return;

    const handleConnected = () => {
      setIsConnected(true);
      // ADR-0297: publish botsson-context snapshot on (re)connect.
      // Guard: skip if no snapshot or same version already published.
      const snapshot = currentSnapshotRef.current;
      if (!snapshot) return;
      if (snapshot.version === lastPublishedVersionRef.current) return;
      // P4 (L-0234): after snapshot publish, also register mobile tools.
      // Both publishes are fire-and-forget; errors are telemetry-only.
      void publishSnapshotToRoom(
        room,
        snapshot,
        workspaceIdRef.current,
        lastPublishedVersionRef,
      ).then(() => {
        void publishToolsToRoom(room, workspaceIdRef.current);
      });
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

    /**
     * P4 (L-0234): DataReceived handler for botsson-tool-call events.
     *
     * Voice-agent publishes { type:"tool_call", call_id, name, arguments }
     * on topic "botsson-tool-call". Mobile dispatches via executeMobileTool()
     * and replies with { call_id, result } on "botsson-tool-result".
     *
     * Dedup: same call_id on reconnect is dropped silently.
     * Concurrency: each call executes independently (no serialization needed —
     *   call_ids are globally unique UUIDs).
     */
    const handleDataReceived = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string,
    ) => {
      if (topic !== "botsson-tool-call") return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        console.warn("[useBotssonVoiceSession] botsson-tool-call: invalid JSON");
        return;
      }

      // Validate envelope: { type: "tool_call", call_id: string, name: string, arguments: object }
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        typeof (parsed as Record<string, unknown>)["call_id"] !== "string" ||
        typeof (parsed as Record<string, unknown>)["name"] !== "string" ||
        typeof (parsed as Record<string, unknown>)["arguments"] !== "object"
      ) {
        console.warn("[useBotssonVoiceSession] botsson-tool-call: unexpected shape", parsed);
        return;
      }

      const {
        call_id,
        name,
        arguments: args,
      } = parsed as {
        call_id: string;
        name: string;
        arguments: Record<string, unknown>;
      };

      // Dedup — drop if same call_id seen before (stale event from prior session).
      if (seenCallIdsRef.current.has(call_id)) {
        console.warn(
          "[useBotssonVoiceSession] botsson-tool-call: duplicate call_id dropped",
          call_id,
        );
        return;
      }
      seenCallIdsRef.current.add(call_id);

      const t0 = Date.now();

      // Execute the tool and publish result — all async, no await in handler.
      void (async () => {
        let resultStr: string;
        let toolOk = true;
        try {
          resultStr = await executeMobileTool(name, args as Record<string, string>);
        } catch (e) {
          toolOk = false;
          resultStr = e instanceof Error ? e.message : "Tool execution failed";
        }

        // Always publish result (even on tool error) so voice-agent Promise resolves.
        const publishRes = await publishBotssonToolResult(room, {
          call_id,
          result: resultStr,
        });

        const latency_ms = Date.now() - t0;

        // Telemetry — swallow if profile context unavailable (L-0177: fail-fast
        // on empty IDs, but don't abort the RPC path for missing profile context).
        try {
          const { profileId } = await getProfileContext();
          const wid = workspaceIdRef.current;
          if (!wid) return;

          if (publishRes.ok && toolOk) {
            void emit({
              event: "voice.bootstrap.rpc_completed",
              workspace_id: nonEmpty(wid, "workspace_id"),
              actor_id: nonEmpty(profileId, "actor_id"),
              properties: {
                entity: { entity_type: "agent_session", entity_id: room.name },
                data: { tool: name, call_id, latency_ms, device_type: "mobile" },
              },
            });
          } else {
            void emit({
              event: "voice.bootstrap.rpc_failed",
              workspace_id: nonEmpty(wid, "workspace_id"),
              actor_id: nonEmpty(profileId, "actor_id"),
              properties: {
                entity: { entity_type: "agent_session", entity_id: room.name },
                data: {
                  tool: name,
                  call_id,
                  // Never include raw tool output — may contain PII (ADR-0078).
                  // Tool name + call_id are sufficient for diagnosability.
                  reason: publishRes.ok
                    ? "tool_execution_failed"
                    : (publishRes.reason ?? "publish failed"),
                  device_type: "mobile",
                },
              },
            });
          }
        } catch {
          // Profile context unavailable — skip telemetry. RPC already completed.
        }
      })();
    };

    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackMuted);
    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackMuted);
      room.off(RoomEvent.DataReceived, handleDataReceived);
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
    // ADR-0297: reset published version on explicit stop so the next session
    // always publishes a fresh snapshot (version may be stale by reconnect time).
    lastPublishedVersionRef.current = "";
    // P4 (L-0234): clear dedup set so the next session accepts fresh call_ids.
    seenCallIdsRef.current.clear();
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
    setLastUserTranscript("");
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
    lastUserTranscript,
    start,
    stop,
    toggleMic,
  };
}

/**
 * Internal: publish mobile tool definitions on "botsson-tools-register" so
 * voice-agent can build stub llm.tool() entries. Emits telemetry on success
 * or failure via getProfileContext().
 *
 * Called immediately after publishSnapshotToRoom succeeds (P4 ordering ensures
 * voice-agent has user/workspace context when it builds tool stubs).
 *
 * Telemetry: ADR-0134 L-0177 — getProfileContext() throws if IDs are missing.
 * We catch and skip telemetry rather than abort. Voice session health must NOT
 * depend on telemetry availability.
 */
async function publishToolsToRoom(room: Room, workspaceId: string | null): Promise<void> {
  const definitions = getToolDefinitionsForRegistration();
  const result = await publishBotssonToolsRegister(room, { definitions });

  try {
    const { profileId } = await getProfileContext();
    if (!workspaceId) return; // L-0177 fail-fast

    if (result.ok) {
      void emit({
        event: "voice.bootstrap.tool_registered",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "agent_session", entity_id: room.name },
          data: { tool_count: definitions.length, device_type: "mobile" },
        },
      });
    } else {
      console.warn(
        `[useBotssonVoiceSession] botsson-tools-register publish failed: ${result.reason}`,
      );
      void emit({
        event: "voice.bootstrap.tool_register_failed",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "agent_session", entity_id: room.name },
          data: { reason: result.reason, device_type: "mobile" },
        },
      });
    }
  } catch {
    // getProfileContext() threw — skip telemetry. Session proceeds regardless.
    if (!result.ok) {
      console.warn(
        `[useBotssonVoiceSession] botsson-tools-register publish failed (no telemetry): ${result.reason}`,
      );
    }
  }
}

/**
 * Internal: encode the snapshot as a `context_init` message and publish on
 * the "botsson-context" LiveKit data channel. Updates `lastPublishedVersionRef`
 * on success. Emits telemetry (success or failure) via getProfileContext().
 *
 * This is a module-level function (not a hook) so it can be called both from
 * the RoomEvent.Connected handler and from the onSnapshot callback — neither
 * of which is in a React render cycle.
 *
 * Telemetry: ADR-0134 L-0177 — getProfileContext() throws if IDs are missing.
 * We catch that and skip telemetry rather than abort the publish result. Voice
 * session health is not allowed to depend on telemetry availability.
 */
async function publishSnapshotToRoom(
  room: Room,
  snapshot: ResolvedSnapshot,
  workspaceId: string | null,
  lastPublishedVersionRef: React.MutableRefObject<string>,
): Promise<void> {
  // Build the context_init payload the voice-agent expects.
  const payload = {
    type: "context_init" as const,
    user: (snapshot.payload["user"] as Record<string, unknown>) ?? {},
    workspace: (snapshot.payload["workspace"] as Record<string, unknown>) ?? {},
    workforce: (snapshot.payload["workforce"] as Record<string, unknown>) ?? undefined,
  };

  const result = await publishBotssonContext(room, payload);

  if (result.ok) {
    lastPublishedVersionRef.current = snapshot.version;
    // Emit telemetry — swallow if profile context is unavailable.
    try {
      const { profileId } = await getProfileContext();
      if (!workspaceId) return; // no workspace = no telemetry (L-0177 — fail-fast on empty IDs)
      void emit({
        event: "voice.bootstrap.snapshot_published",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "agent_session", entity_id: room.name },
          data: {
            version: snapshot.version,
            payload_bytes: result.payload_bytes,
            latency_ms: result.latency_ms,
            device_type: "mobile",
          },
        },
      });
    } catch {
      // getProfileContext() threw — skip telemetry. Never abort publish path.
    }
  } else {
    // Publish failed after retry — emit failure telemetry + log.
    console.warn(`[useBotssonVoiceSession] botsson-context publish failed: ${result.reason}`);
    try {
      const { profileId } = await getProfileContext();
      if (!workspaceId) return;
      void emit({
        event: "voice.bootstrap.publish_failed",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "agent_session", entity_id: room.name },
          data: {
            version: snapshot.version,
            reason: result.reason,
            attempts: result.attempts,
            device_type: "mobile",
          },
        },
      });
    } catch {
      // Profile context unavailable — skip telemetry.
    }
    // Continue — session proceeds in degraded mode. Voice-agent falls back to
    // query_smartout tool roundtrip per existing behavior (ADR-0297 §Error-paths).
  }
}
