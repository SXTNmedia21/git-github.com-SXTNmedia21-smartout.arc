/**
 * BotssonProvider — Context for Botsson voice/text AI sessions.
 *
 * Manages session lifecycle and provides mobile-specific context
 * (shift phase, channel, device type) to the AI agent.
 *
 * Voice mode uses Ultravox WebRTC (browser context via Expo Web).
 * Text mode connects to Stage Engine via useAgentChat.
 *
 * ADR-0107: `channel` is a SessionChannel ('chat' | 'voice' | 'system' | ...).
 * It MUST be derived from `mode` — never a device/platform label like
 * "mobile" or "web". Device type is surfaced separately on `device_type`
 * for telemetry only. The security defence-in-depth declared by ADR-0077,
 * ADR-0078 and the ADR-0099 gate_action RPC all read this field verbatim.
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
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";
import { useBotssonVoiceSession } from "@/hooks/use-botsson-voice-session";
import type { BotssonVoiceStatus } from "@/hooks/use-botsson-voice-session";
import { useBotssonSettingsStore } from "@/hooks/stores/use-botsson-settings-store";
import type {
  BotssonLanguage,
  BotssonInteractionMode,
} from "@/hooks/stores/use-botsson-settings-store";
import {
  deriveBotssonChannel,
  type BotssonDeviceType,
  type BotssonMode,
  type BotssonSessionChannel,
} from "./botsson-channel";

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
   * Accumulated conversation transcript for the current voice session.
   * Alternates user → agent turns in chronological order. Reset when a new
   * session starts (`startVoiceSession`) or the session ends (`endSession`).
   * Empty array when no session has been started or in text/chat mode.
   */
  voiceTranscript: TranscriptEntry[];
  sessionContext: BotssonSessionContext;
  /** Intent to consume when the next session starts (one-shot). */
  pendingIntent: BotssonIntent | null;
  startVoiceSession: () => Promise<void>;
  startTextSession: () => void;
  endSession: () => void;
  /**
   * Mute or unmute the microphone in the active Ultravox session.
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
  }, []);

  const voice = useBotssonVoiceSession({
    workspaceId,
    channelId: botssonChannelId,
    disabled: mode !== "voice",
    onError: handleVoiceError,
  });

  // Accumulated voice transcript for the current session.
  const [voiceTranscript, setVoiceTranscript] = useState<TranscriptEntry[]>([]);

  // Append a user turn when a new ASR utterance arrives.
  // Guard against duplicate appends: only fire when the text actually changes
  // and is non-empty (the hook resets to "" on stop, which we skip).
  useEffect(() => {
    const text = voice.lastUserTranscript;
    if (!text || mode !== "voice") return;
    setVoiceTranscript((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text, timestamp: Date.now() },
    ]);
  }, [voice.lastUserTranscript, mode]);

  // Append an agent turn when the BFF response arrives.
  useEffect(() => {
    const text = voice.lastResponse;
    if (!text || mode !== "voice") return;
    setVoiceTranscript((prev) => [
      ...prev,
      { id: `agent-${Date.now()}`, role: "agent", text, timestamp: Date.now() },
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
    setVoiceTranscript([]);
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
    setStatus("active");
    setMode("text");
  }, []);

  const endSession = useCallback(() => {
    voiceSessionRef.current?.leave();
    voiceSessionRef.current = null;
    // Tear down the new C1.b voice session too. `stop()` is idempotent.
    void voice.stop();
    setStatus("idle");
    setMode(null);
    setError(null);
    setVoiceTranscript([]);
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
      voiceTranscript,
      sessionContext,
      pendingIntent,
      startVoiceSession,
      startTextSession,
      endSession,
      setMicrophoneMuted,
      openWithIntent,
      clearIntent,
      error,
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
      voiceTranscript,
      sessionContext,
      pendingIntent,
      startVoiceSession,
      startTextSession,
      endSession,
      setMicrophoneMuted,
      openWithIntent,
      clearIntent,
      error,
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
