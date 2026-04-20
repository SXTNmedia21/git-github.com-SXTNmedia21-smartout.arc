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
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";
import {
  deriveBotssonChannel,
  type BotssonDeviceType,
  type BotssonMode,
  type BotssonSessionChannel,
} from "./botsson-channel";

export { deriveBotssonChannel } from "./botsson-channel";
export type { BotssonMode, BotssonSessionChannel, BotssonDeviceType } from "./botsson-channel";

/** Minimal voice session interface — matches UltravoxVoiceSession from @smartout/agent-sdk */
type VoiceSession = {
  muteMic(): void;
  unmuteMic(): void;
  leave(): void;
};

export type BotssonStatus = "idle" | "connecting" | "active" | "error";

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
};

const BotssonContext = createContext<BotssonContextValue | null>(null);

type BotssonProviderProps = {
  children: ReactNode;
};

export function BotssonProvider({ children }: BotssonProviderProps) {
  const [status, setStatus] = useState<BotssonStatus>("idle");
  const [mode, setMode] = useState<BotssonMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<BotssonIntent | null>(null);

  // Holds the active Ultravox session so we can control mic state directly
  const voiceSessionRef = useRef<VoiceSession | null>(null);

  const { phase } = useShiftPhase();
  const { data: _profile } = useMyProfile();
  const { data: tasks } = useMyTasks();

  // Build mobile context for AI agent — passed as session params.
  // ADR-0107: channel is derived from mode, device_type is separate.
  const sessionContext = useMemo<BotssonSessionContext>(
    () => ({
      channel: deriveBotssonChannel(mode),
      device_type: "mobile",
      shift_phase: phase ?? "no_shift",
      language: "nb",
      pending_tasks_count: tasks?.length ?? 0,
    }),
    [mode, phase, tasks],
  );

  const setMicrophoneMuted = useCallback((muted: boolean) => {
    const session = voiceSessionRef.current;
    if (!session) return;

    if (muted) {
      session.muteMic();
    } else {
      session.unmuteMic();
    }
    setIsMuted(muted);
  }, []);

  const startVoiceSession = useCallback(async () => {
    try {
      setError(null);
      setIsMuted(false);
      setStatus("connecting");
      setMode("voice");
      // Voice session initialization will be wired in T12 (BotssonSheet)
      // when Ultravox WebRTC is integrated. For now, set to active.
      // voiceSessionRef.current will be populated when Ultravox join is called.
      setStatus("active");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
    }
  }, []);

  const startTextSession = useCallback(() => {
    setError(null);
    setStatus("active");
    setMode("text");
  }, []);

  const endSession = useCallback(() => {
    voiceSessionRef.current?.leave();
    voiceSessionRef.current = null;
    setStatus("idle");
    setMode(null);
    setError(null);
    setIsMuted(false);
  }, []);

  /**
   * Stage a one-shot intent and start a text session. If a voice session
   * is active we end it first so the intent doesn't leak into voice (ADR-
   * 0078). The pending intent is cleared by consumers via `clearIntent`
   * after they read it.
   */
  const openWithIntent = useCallback((intent: BotssonIntent) => {
    setPendingIntent(intent);
    voiceSessionRef.current?.leave();
    voiceSessionRef.current = null;
    setError(null);
    setIsMuted(false);
    setStatus("active");
    setMode("text");
  }, []);

  const clearIntent = useCallback(() => {
    setPendingIntent(null);
  }, []);

  const value = useMemo<BotssonContextValue>(
    () => ({
      status,
      mode,
      isMuted,
      sessionContext,
      pendingIntent,
      startVoiceSession,
      startTextSession,
      endSession,
      setMicrophoneMuted,
      openWithIntent,
      clearIntent,
      error,
    }),
    [
      status,
      mode,
      isMuted,
      sessionContext,
      pendingIntent,
      startVoiceSession,
      startTextSession,
      endSession,
      setMicrophoneMuted,
      openWithIntent,
      clearIntent,
      error,
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
