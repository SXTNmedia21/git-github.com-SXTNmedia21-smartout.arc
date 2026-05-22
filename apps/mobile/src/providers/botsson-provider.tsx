/**
 * BotssonProvider — Context for Botsson voice/text AI sessions.
 *
 * Manages session lifecycle and provides mobile-specific context
 * (shift phase, channel, device type) to the AI agent.
 *
 * Voice mode uses LiveKit (ADR-0282 / ADR-0135).
 * Text mode POSTs typed messages to /api/emma/chat via useEmmaChat.
 *
 * ADR-0107: `channel` is a SessionChannel ('chat' | 'voice' | 'system' | ...).
 * It MUST be derived from `mode` — never a device/platform label like
 * "mobile" or "web". Device type is surfaced separately on `device_type`
 * for telemetry only. The security defence-in-depth declared by ADR-0077,
 * ADR-0078 and the ADR-0099 gate_action RPC all read this field verbatim.
 *
 * Transcript: voice and text turns share a single `transcript` array. Mode
 * switching voice ↔ text mid-session preserves transcript history — neither
 * startVoiceSession nor startTextSession clears it. Only endSession resets.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { randomUUID } from "expo-crypto";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";
import {
  useBotssonVoiceSession,
  MIC_PERMISSION_DENIED_CODE,
} from "@/hooks/use-botsson-voice-session";
import type { BotssonVoiceStatus, ReconnectPhase } from "@/hooks/use-botsson-voice-session";
import type { ResolvedSnapshot } from "@/hooks/use-voice-transcripts";
import { useBotssonSettingsStore } from "@/hooks/stores/use-botsson-settings-store";
import type {
  BotssonLanguage,
  BotssonInteractionMode,
} from "@/hooks/stores/use-botsson-settings-store";
import { useEmmaChat } from "@/hooks/use-emma-chat";
import type { ChatTurnResponse } from "@/hooks/use-emma-chat";
import {
  deriveBotssonChannel,
  type BotssonDeviceType,
  type BotssonMode,
  type BotssonSessionChannel,
} from "./botsson-channel";
import type { RoutineDraft } from "@/hooks/use-routine-extract";

export { deriveBotssonChannel } from "./botsson-channel";
export type { BotssonMode, BotssonSessionChannel, BotssonDeviceType } from "./botsson-channel";
export type {
  BotssonLanguage,
  BotssonInteractionMode,
} from "@/hooks/stores/use-botsson-settings-store";

/**
 * A single turn in a voice or text transcript. Role follows the AI convention:
 * `user` = the person speaking/typing, `agent` = Botsson's response.
 */
export type TranscriptEntry = {
  id: string;
  role: "agent" | "user";
  text: string;
  timestamp: number;
};

/** Minimal voice session interface — matches UltravoxVoiceSession from @smartout/agent-sdk */
type VoiceSession = {
  muteMic(): void;
  unmuteMic(): void;
  leave(): void;
};

export type BotssonStatus = "idle" | "connecting" | "active" | "error";

/**
 * Re-export of the C1.b voice state machine for UI consumers (BotssonSheet
 * orb, status label). `BotssonStatus` stays coarse-grained for callers that
 * only care about session lifecycle; `voiceStatus` exposes the richer
 * listening/thinking/speaking progression so the orb can show distinct
 * animations per phase (C1.b handoff § Orb-state mapping).
 */
export type { BotssonVoiceStatus } from "@/hooks/use-botsson-voice-session";

type BotssonSessionContext = {
  /**
   * ADR-0107: SessionChannel derived from `mode`. NEVER a device label.
   * 'voice' when mode === 'voice', 'chat' otherwise (including when mode
   * is null — 'chat' is the safest default for pre-session readers because
   * it denies voice-PII tools by default).
   */
  channel: BotssonSessionChannel;
  /** Device/platform metadata. Telemetry only — no security meaning. */
  device_type: BotssonDeviceType;
  shift_phase: string;
  language: string;
  pending_tasks_count: number;
};

/**
 * Intent handed to Botsson when opened from another surface (e.g. a
 * deviation badge on the shift timeline). Council 6.4 rejected AsyncStorage
 * as the deep-link mechanism — the intent lives in provider state so the
 * session starts with it already wired into sessionContext.
 */
export type BotssonIntent = {
  kind: "deviation" | "help";
  shift_id: string;
  deviation_id?: string | null;
  phase?: string | null;
};

type BotssonContextValue = {
  status: BotssonStatus;
  mode: BotssonMode | null;
  /** Whether the microphone is currently muted in the active voice session */
  isMuted: boolean;
  /**
   * C1.b: fine-grained voice state machine, sourced from
   * `useBotssonVoiceSession`. UI orb maps each value to a distinct visual
   * rhythm (see C1.b handoff § Orb-state mapping). When mode !== 'voice' or
   * a voice session has not been started, `voiceStatus` is 'idle'.
   */
  voiceStatus: BotssonVoiceStatus;
  /**
   * C1.b: most recent Botsson text response for the transcript panel.
   * Updated on every BFF response arrival (also spoken via Expo Speech TTS).
   */
  lastVoiceResponse: string;
  /**
   * Shared conversation transcript for the current session — covers BOTH
   * voice and text turns. Alternates user → agent turns in chronological
   * order. Mode switching voice ↔ text preserves history (no clear).
   * Reset only on endSession().
   *
   * `voiceTranscript` is kept as an alias for backwards-compat callers
   * (BotssonSheet) — it exposes the same array.
   */
  voiceTranscript: TranscriptEntry[];
  /** P5: unified transcript exposed under its canonical name. */
  transcript: TranscriptEntry[];
  sessionContext: BotssonSessionContext;
  /** Intent to consume when the next session starts (one-shot). */
  pendingIntent: BotssonIntent | null;
  startVoiceSession: () => Promise<void>;
  startTextSession: () => void;
  endSession: () => void;
  /**
   * P5: Send a typed message in text mode. Performs optimistic append to
   * transcript, posts to /api/emma/chat, appends agent response.
   * Rolls back optimistic entry on network failure.
   * Returns false when the hook is not ready (no workspaceId).
   */
  sendTextMessage: (text: string) => Promise<boolean>;
  /** True while a text message is in flight to the BFF. */
  isSendingText: boolean;
  /** Friendly error string from last text send failure, or null. */
  textError: string | null;
  /**
   * Mute or unmute the microphone in the active voice session.
   * No-op if there is no active voice session.
   */
  setMicrophoneMuted: (muted: boolean) => void;
  /**
   * Open Botsson with a pre-populated intent. Council 6.4: replaces the
   * AsyncStorage / route-param deep-link pattern. The caller stages an
   * intent, the provider starts a text session with that intent attached.
   *
   * Voice interlock (ADR-0078): if a voice session is active when a caller
   * invokes openWithIntent, we call endSession() first so the intent opens
   * in a fresh text session. Callers that want to refuse instead (the
   * timeline does, because voice-PII is a security boundary) should check
   * `status === 'active' && mode === 'voice'` themselves and emit a toast
   * before calling openWithIntent.
   */
  openWithIntent: (intent: BotssonIntent) => void;
  /** Clear any pending intent without opening a session. */
  clearIntent: () => void;
  /** Error message if status is "error" */
  error: string | null;
  /**
   * Routine draft extracted from a photo — set by the image button in
   * BotssonSheet after upload + BFF extraction. Cleared on endSession().
   */
  routineDraft: { draft: RoutineDraft; storagePath: string } | null;
  setRoutineDraft: (draft: { draft: RoutineDraft; storagePath: string } | null) => void;
  /**
   * D2: True when voice session start failed due to OS mic permission denial.
   * BotssonSheet renders `MicPermissionDialog` when this is true.
   * Cleared on next `startVoiceSession()` attempt or explicit `endSession()`.
   */
  micPermissionDenied: boolean;
  /**
   * D3: Current reconnect phase from the voice session hook. Surfaces the
   * exponential-backoff reconnect state so BotssonSheet can render the
   * `NetworkRetryBanner`.
   */
  reconnectPhase: ReconnectPhase;
  /** D3: Current retry attempt (1–3). 0 when reconnectPhase is 'idle'. */
  reconnectAttempt: number;
  /**
   * D4: True when the workspace voice policy was disabled mid-session.
   * BotssonSheet renders the policy-flip banner. Cleared on mode switch.
   */
  policyFlipped: boolean;
  /** User-configurable AI preferences — persisted via MMKV. */
  voiceEnabled: boolean;
  language: BotssonLanguage;
  interactionMode: BotssonInteractionMode;
  setVoiceEnabled: (enabled: boolean) => void;
  setLanguage: (language: BotssonLanguage) => void;
  setInteractionMode: (mode: BotssonInteractionMode) => void;
};

const BotssonContext = createContext<BotssonContextValue | null>(null);

type BotssonProviderProps = {
  children: ReactNode;
};

export function BotssonProvider({ children }: BotssonProviderProps) {
  const [status, setStatus] = useState<BotssonStatus>("idle");
  const [mode, setMode] = useState<BotssonMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<BotssonIntent | null>(null);
  /** D2: Set when voice start fails with MIC_PERMISSION_DENIED. */
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  /** D4: Set when voice policy is revoked mid-session (403 from token or transcript BFF). */
  const [policyFlipped, setPolicyFlipped] = useState(false);
  /**
   * Routine draft from photo extraction. Set by the BotssonSheet image button
   * after upload + BFF vision extraction. Cleared on endSession().
   */
  const [routineDraft, setRoutineDraft] = useState<{
    draft: RoutineDraft;
    storagePath: string;
  } | null>(null);
  /**
   * ADR-0297: canonical snapshot state. Set when the BFF returns a new or
   * refreshed snapshot. Cleared on endSession(). Passed to voice session hook
   * so it can publish on data channel at session start and on snapshot refresh.
   * Dedup is by version — if incoming version matches stored, skip.
   */
  const [currentSnapshot, setCurrentSnapshot] = useState<ResolvedSnapshot | null>(null);

  /**
   * P5 text-session state.
   * session_id from the BFF is persisted here so subsequent text turns
   * continue the same engine_sessions row (warm turns).
   */
  const [textSessionId, setTextSessionId] = useState<string | null>(null);

  // AI settings — user preferences persisted via MMKV.
  const {
    voiceEnabled,
    language,
    interactionMode,
    setVoiceEnabled,
    setLanguage,
    setInteractionMode,
  } = useBotssonSettingsStore();

  // Holds the legacy Ultravox session handle (web/SDK path). Kept for
  // backwards compatibility while C1.b mobile voice runs via the new hook.
  const voiceSessionRef = useRef<VoiceSession | null>(null);

  const { phase } = useShiftPhase();
  const { data: profile } = useMyProfile();
  const { data: tasks } = useMyTasks();

  // C1.b: resolve workspace scope for the voice hook. Profile may not yet
  // be loaded on first render — the hook will gate `start()` on non-null.
  const workspaceId: string | null = profile?.workspace_id ?? null;

  // C1.b: the Botsson voice channel is a workspace-scoped singleton (one
  // row in `channel_ai_policy` per workspace). Until a dedicated field lands
  // in the profile schema we key off the profile's `workspace_id`; the
  // handoff documents the follow-up to surface an explicit `botsson_channel_id`.
  //
  // Two recommended strategies live in the handoff § Decisions:
  //   (a) workspace-wide singleton channel (recommended, implemented here),
  //   (b) per-session ad-hoc rooms (needs a workspace-level default policy
  //       in the edge function — not yet supported).
  //
  // For now callers that run this provider under a workspace with no
  // Botsson channel will see `channelId === null` and `start()` will
  // short-circuit with MISSING_IDS.
  const botssonChannelId: string | null =
    (profile as { botsson_channel_id?: string | null } | null | undefined)?.botsson_channel_id ??
    null;

  const handleVoiceError = useCallback((err: { code: string; message: string }) => {
    setError(err.message);
    // D2: Mic permission denial — surface the dedicated dialog state.
    if (err.code === MIC_PERMISSION_DENIED_CODE) {
      setMicPermissionDenied(true);
      // Keep status as error but do NOT set mode to null — the sheet stays open
      // so the user can see the MicPermissionDialog and choose an action.
    }
  }, []);

  /**
   * D4: Voice policy flipped mid-session. Auto-switch to text mode.
   *
   * Called by useBotssonVoiceSession when fail() fires with code='VOICE_POLICY_DISABLED'.
   * The voice session is in error state at this point — we tear it down cleanly
   * (stop() is idempotent) then switch to text mode so the user can continue.
   * Transcript history is preserved — endSession() is NOT called.
   */
  const handlePolicyFlipped = useCallback(() => {
    setPolicyFlipped(true);
    setStatus("active");
    setMode("text");
    setError(null);
    // Telemetry: mobile.voice.policy_flipped — ADR-0134 L-0177.
    void (async () => {
      try {
        const { profileId } = await getProfileContext();
        if (!workspaceId) return; // L-0177 fail-fast
        void emit({
          event: "mobile.voice.policy_flipped",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity: {
              entity_type: "agent_session",
              entity_id: botssonChannelId ?? "unknown",
            },
            data: {
              workspace_id: workspaceId,
              status_code: 403,
              device_type: "mobile",
            },
          },
        });
      } catch {
        /* getProfileContext unavailable — skip telemetry per L-0177 */
      }
    })();
  }, [workspaceId, botssonChannelId]);

  /**
   * ADR-0297: lift snapshot from transcript hook to provider context.
   * Dedup by version — if the incoming version matches what we already hold,
   * skip the state update (prevents unnecessary re-renders + re-publishes).
   */
  const handleSnapshot = useCallback((snapshot: ResolvedSnapshot) => {
    setCurrentSnapshot((prev) => {
      if (prev?.version === snapshot.version) return prev;
      return snapshot;
    });
  }, []);

  const voice = useBotssonVoiceSession({
    workspaceId,
    channelId: botssonChannelId,
    disabled: mode !== "voice",
    onError: handleVoiceError,
    onPolicyFlipped: handlePolicyFlipped,
    currentSnapshot,
    onSnapshot: handleSnapshot,
  });

  /**
   * P5 — unified transcript for both voice and text turns.
   * Never cleared on mode switch — only on endSession().
   */
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  /**
   * P5 — text chat hook. Active regardless of mode so session continuity
   * (textSessionId) persists across voice ↔ text switches within one
   * BotssonProvider lifetime.
   */
  const emmaChatOnResponse = useCallback((response: ChatTurnResponse) => {
    // Agent turn appended here (after network round-trip).
    setTranscript((prev) => [
      ...prev,
      {
        id: `agent-text-${response.sessionId}-${Date.now()}`,
        role: "agent",
        text: response.text,
        timestamp: Date.now(),
      },
    ]);
    // Persist session id for warm turns.
    setTextSessionId(response.sessionId);
  }, []);

  const emmaChat = useEmmaChat({
    workspaceId,
    sessionId: textSessionId,
    onResponse: emmaChatOnResponse,
  });

  // Append a user turn when a new ASR utterance arrives.
  // Guard against duplicate appends: only fire when the text actually changes
  // and is non-empty (the hook resets to "" on stop, which we skip).
  useEffect(() => {
    const text = voice.lastUserTranscript;
    if (!text || mode !== "voice") return;
    setTranscript((prev) => [
      ...prev,
      { id: `user-voice-${Date.now()}`, role: "user", text, timestamp: Date.now() },
    ]);
  }, [voice.lastUserTranscript, mode]);

  // Append an agent turn when the BFF voice response arrives.
  useEffect(() => {
    const text = voice.lastResponse;
    if (!text || mode !== "voice") return;
    setTranscript((prev) => [
      ...prev,
      { id: `agent-voice-${Date.now()}`, role: "agent", text, timestamp: Date.now() },
    ]);
  }, [voice.lastResponse, mode]);

  // Build mobile context for AI agent — passed as session params.
  // ADR-0107: channel is derived from mode, device_type is separate.
  const sessionContext = useMemo<BotssonSessionContext>(
    () => ({
      channel: deriveBotssonChannel(mode),
      device_type: "mobile",
      shift_phase: phase ?? "no_shift",
      // Sourced from user preference — previously hardcoded "nb" (P2-b).
      language,
      pending_tasks_count: tasks?.length ?? 0,
    }),
    [mode, phase, tasks, language],
  );

  /**
   * Map the fine-grained voice state (idle/connecting/listening/thinking/
   * speaking/error) onto the coarse `BotssonStatus` surface the existing
   * BotssonSheet consumes. Keeps the visual orb backwards-compatible while
   * new consumers (C1.b orb polish by frontend-designer) can read the
   * detailed state via `voiceStatus` directly.
   */
  useEffect(() => {
    if (mode !== "voice") return;
    switch (voice.status) {
      case "idle":
        setStatus("idle");
        break;
      case "connecting":
        setStatus("connecting");
        break;
      case "listening":
      case "thinking":
      case "speaking":
        setStatus("active");
        break;
      case "error":
        setStatus("error");
        break;
    }
  }, [mode, voice.status]);

  useEffect(() => {
    if (voice.error) setError(voice.error.message);
  }, [voice.error]);

  const setMicrophoneMuted = useCallback(
    (muted: boolean) => {
      // New voice path (C1.b) — delegate to LiveKit participant control.
      if (mode === "voice" && voice.isConnected) {
        // Mute state is derived from LiveKit; if caller's intent differs
        // from current state, flip it via toggleMic.
        if (muted !== voice.isMuted) {
          void voice.toggleMic();
        }
        return;
      }
      // Legacy Ultravox path — keep for the web bundle.
      const session = voiceSessionRef.current;
      if (!session) return;
      if (muted) {
        session.muteMic();
      } else {
        session.unmuteMic();
      }
    },
    [mode, voice],
  );

  const startVoiceSession = useCallback(async () => {
    setError(null);
    // D2: clear mic-permission-denied on each new attempt (user may have granted
    // permission in settings since the last failure).
    setMicPermissionDenied(false);
    // D4: clear policy-flip flag on re-attempt (policy may have been re-enabled).
    setPolicyFlipped(false);
    // Transcript is NOT cleared — mode switching preserves history.
    setMode("voice");
    setStatus("connecting");
    try {
      await voice.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
    }
  }, [voice]);

  const startTextSession = useCallback(() => {
    setError(null);
    // Transcript is NOT cleared — mode switching preserves history.
    setStatus("active");
    setMode("text");
  }, []);

  /**
   * P5: Send a typed message in text mode.
   *
   * Optimistic flow:
   * 1. Immediately append user entry to transcript (visible within one render).
   * 2. POST to BFF via useEmmaChat.
   * 3a. On success: agent entry appended by emmaChatOnResponse callback.
   * 3b. On failure: rollback optimistic entry + return false.
   *
   * Returns true on success, false on any failure (network, 4xx, 5xx).
   */
  const sendTextMessage = useCallback(
    async (text: string): Promise<boolean> => {
      if (!workspaceId) return false;
      const trimmed = text.trim();
      if (!trimmed) return false;

      // Optimistic user entry — appended BEFORE the network call so the
      // user sees their message within one render cycle.
      // UUID prevents same-millisecond id collision if two messages fire back-to-back.
      const optimisticId = `user-text-opt-${randomUUID()}`;
      const optimisticEntry: TranscriptEntry = {
        id: optimisticId,
        role: "user",
        text: trimmed,
        timestamp: Date.now(),
      };
      setTranscript((prev) => [...prev, optimisticEntry]);

      const result = await emmaChat.send(trimmed);

      if (result === null) {
        // Rollback: remove the optimistic entry. Keep any other turns that
        // may have been appended after ours (e.g. from voice concurrently —
        // unlikely, but safe via id-match rollback).
        setTranscript((prev) => prev.filter((entry) => entry.id !== optimisticId));
        return false;
      }

      return true;
    },
    [workspaceId, emmaChat.send],
  );

  const endSession = useCallback(() => {
    voiceSessionRef.current?.leave();
    voiceSessionRef.current = null;
    // Tear down the C1.b voice session. `stop()` is idempotent.
    void voice.stop();
    setStatus("idle");
    setMode(null);
    setError(null);
    // D2/D4: clear error dialog states on full session end.
    setMicPermissionDenied(false);
    setPolicyFlipped(false);
    // Clear unified transcript and text session id on full session end.
    setTranscript([]);
    setTextSessionId(null);
    // ADR-0297: clear snapshot on session end so the next session always
    // gets a fresh cold-start snapshot from the BFF.
    setCurrentSnapshot(null);
    // Clear routine draft on session end.
    setRoutineDraft(null);
  }, [voice]);

  /**
   * Stage a one-shot intent and start a text session. If a voice session
   * is active we end it first so the intent doesn't leak into voice (ADR-
   * 0078). The pending intent is cleared by consumers via `clearIntent`
   * after they read it.
   */
  const openWithIntent = useCallback(
    (intent: BotssonIntent) => {
      setPendingIntent(intent);
      voiceSessionRef.current?.leave();
      voiceSessionRef.current = null;
      // ADR-0078 voice interlock: tear down the C1.b voice session before
      // opening in text mode. `stop()` is idempotent and safe even when
      // no session is active.
      void voice.stop();
      setError(null);
      setStatus("active");
      setMode("text");
    },
    [voice],
  );

  const clearIntent = useCallback(() => {
    setPendingIntent(null);
  }, []);

  const value = useMemo<BotssonContextValue>(
    () => ({
      status,
      mode,
      isMuted: voice.isMuted,
      voiceStatus: voice.status,
      lastVoiceResponse: voice.lastResponse,
      // voiceTranscript kept as alias for backwards-compat callers.
      voiceTranscript: transcript,
      // P5: canonical unified transcript surface.
      transcript,
      sessionContext,
      pendingIntent,
      startVoiceSession,
      startTextSession,
      endSession,
      sendTextMessage,
      isSendingText: emmaChat.isSending,
      textError: emmaChat.error?.message ?? null,
      setMicrophoneMuted,
      openWithIntent,
      clearIntent,
      error,
      routineDraft,
      setRoutineDraft,
      // D2/D3/D4: error dialog + reconnect state.
      micPermissionDenied,
      reconnectPhase: voice.reconnectPhase,
      reconnectAttempt: voice.reconnectAttempt,
      policyFlipped,
      // AI settings — user preferences from the MMKV-backed store.
      voiceEnabled,
      language,
      interactionMode,
      setVoiceEnabled,
      setLanguage,
      setInteractionMode,
    }),
    [
      status,
      mode,
      voice.isMuted,
      voice.status,
      voice.lastResponse,
      voice.reconnectPhase,
      voice.reconnectAttempt,
      transcript,
      sessionContext,
      pendingIntent,
      startVoiceSession,
      startTextSession,
      endSession,
      sendTextMessage,
      emmaChat.isSending,
      emmaChat.error,
      setMicrophoneMuted,
      openWithIntent,
      clearIntent,
      error,
      routineDraft,
      setRoutineDraft,
      micPermissionDenied,
      policyFlipped,
      voiceEnabled,
      language,
      interactionMode,
      setVoiceEnabled,
      setLanguage,
      setInteractionMode,
    ],
  );

  return <BotssonContext.Provider value={value}>{children}</BotssonContext.Provider>;
}

export function useBotsson(): BotssonContextValue {
  const context = useContext(BotssonContext);
  if (!context) {
    throw new Error("useBotsson must be used within a BotssonProvider");
  }
  return context;
}
