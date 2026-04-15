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

type BotssonContextValue = {
  status: BotssonStatus;
  mode: BotssonMode | null;
  /** Whether the microphone is currently muted in the active voice session */
  isMuted: boolean;
  sessionContext: BotssonSessionContext;
  startVoiceSession: () => Promise<void>;
  startTextSession: () => void;
  endSession: () => void;
  /**
   * Mute or unmute the microphone in the active Ultravox session.
   * No-op if there is no active voice session.
   */
  setMicrophoneMuted: (muted: boolean) => void;
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

  const value = useMemo<BotssonContextValue>(
    () => ({
      status,
      mode,
      isMuted,
      sessionContext,
      startVoiceSession,
      startTextSession,
      endSession,
      setMicrophoneMuted,
      error,
    }),
    [
      status,
      mode,
      isMuted,
      sessionContext,
      startVoiceSession,
      startTextSession,
      endSession,
      setMicrophoneMuted,
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
