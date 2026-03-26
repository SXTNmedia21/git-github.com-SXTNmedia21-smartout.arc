/**
 * WalkAiProvider — Context for WalkAi voice/text AI sessions.
 *
 * Manages session lifecycle and provides mobile-specific context
 * (shift phase, channel, device type) to the AI agent.
 *
 * Voice mode uses Ultravox WebRTC (browser context via Expo Web).
 * Text mode connects to Stage Engine via useAgentChat.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";

export type WalkAiStatus = "idle" | "connecting" | "active" | "error";
export type WalkAiMode = "voice" | "text";

type WalkAiSessionContext = {
  /** Current channel: mobile context info for the agent */
  channel: "mobile";
  device_type: "phone";
  shift_phase: string;
  language: string;
  pending_tasks_count: number;
};

type WalkAiContextValue = {
  status: WalkAiStatus;
  mode: WalkAiMode | null;
  sessionContext: WalkAiSessionContext;
  startVoiceSession: () => Promise<void>;
  startTextSession: () => void;
  endSession: () => void;
  /** Error message if status is "error" */
  error: string | null;
};

const WalkAiContext = createContext<WalkAiContextValue | null>(null);

type WalkAiProviderProps = {
  children: ReactNode;
};

export function WalkAiProvider({ children }: WalkAiProviderProps) {
  const [status, setStatus] = useState<WalkAiStatus>("idle");
  const [mode, setMode] = useState<WalkAiMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { phase } = useShiftPhase();
  const { data: profile } = useMyProfile();
  const { data: tasks } = useMyTasks();

  // Build mobile context for AI agent — passed as session params
  const sessionContext = useMemo<WalkAiSessionContext>(
    () => ({
      channel: "mobile",
      device_type: "phone",
      shift_phase: phase ?? "no_shift",
      language: "nb",
      pending_tasks_count: tasks?.length ?? 0,
    }),
    [phase, tasks],
  );

  const startVoiceSession = useCallback(async () => {
    try {
      setError(null);
      setStatus("connecting");
      setMode("voice");
      // Voice session initialization will be wired in T12 (WalkAiSheet)
      // when Ultravox WebRTC is integrated. For now, set to active.
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
    setStatus("idle");
    setMode(null);
    setError(null);
  }, []);

  const value = useMemo<WalkAiContextValue>(
    () => ({
      status,
      mode,
      sessionContext,
      startVoiceSession,
      startTextSession,
      endSession,
      error,
    }),
    [status, mode, sessionContext, startVoiceSession, startTextSession, endSession, error],
  );

  return <WalkAiContext.Provider value={value}>{children}</WalkAiContext.Provider>;
}

export function useWalkAi(): WalkAiContextValue {
  const context = useContext(WalkAiContext);
  if (!context) {
    throw new Error("useWalkAi must be used within a WalkAiProvider");
  }
  return context;
}
