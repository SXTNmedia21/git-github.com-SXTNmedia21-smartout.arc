"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  AgentConfig,
  AgentSession,
  AgentStatus,
  TranscriptEntry,
  DebugEntry,
  VoiceSession,
  VoiceProvider,
} from "../types";
import { createUltravoxProvider } from "../providers/ultravox";
import { createLiveKitProvider } from "../providers/livekit";
import { buildSessionRequest } from "../context/session-context";

// ---------------------------------------------------------------------------
// Connected status set
// ---------------------------------------------------------------------------

const CONNECTED_STATUSES = new Set<AgentStatus>(["listening", "thinking", "speaking"]);

// ---------------------------------------------------------------------------
// Provider cache — avoid re-creating providers on every render
// ---------------------------------------------------------------------------

const providerCache = new Map<string, VoiceProvider>();

function getProvider(name: "ultravox" | "livekit"): VoiceProvider {
  let provider = providerCache.get(name);
  if (!provider) {
    provider = name === "livekit" ? createLiveKitProvider() : createUltravoxProvider();
    providerCache.set(name, provider);
  }
  return provider;
}

// ---------------------------------------------------------------------------
// useAgent — the ONE hook to rule them all
// ---------------------------------------------------------------------------

/**
 * Unified hook for all agent interactions (voice/chat).
 *
 * Replaces:
 * - `useBotsson` (onboarding)
 * - `VoiceAssistant` inline session management (web dashboard)
 * - `VoiceAssistant` inline session management (landing page)
 *
 * @example
 * ```tsx
 * const agent = useAgent({
 *   missionId: "onboarding-interview",
 *   tools: onboardingToolKit,
 *   autoStart: true,
 * });
 *
 * // agent.status, agent.isConnected, agent.startSession(), etc.
 * ```
 */
export function useAgent(config: AgentConfig): AgentSession {
  const {
    missionId,
    provider: providerName = "ultravox",
    autoStart = false,
    apiEndpoint = "/api/wizard/start",
    apiParams,
    onDebug,
    onStatusChange,
    onTranscript,
  } = config;

  // State
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);

  // Refs
  const sessionRef = useRef<VoiceSession | null>(null);
  const startingRef = useRef(false);
  const configRef = useRef(config);

  // Keep config ref in sync
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Debug helper
  const addDebug = useCallback(
    (type: DebugEntry["type"], content: string) => {
      const entry: DebugEntry = { timestamp: Date.now(), type, content };
      setDebugLog((prev) => [...prev, entry]);
      onDebug?.(entry);
    },
    [onDebug],
  );

  // Start session
  const startSession = useCallback(async () => {
    if (sessionRef.current || startingRef.current) return;
    startingRef.current = true;

    setStatus("connecting");
    onStatusChange?.("connecting");

    try {
      const provider = getProvider(providerName);
      const session = provider.createSession();
      sessionRef.current = session;

      // Register client tool implementations
      const currentTools = configRef.current.tools;
      if (currentTools?.implementations) {
        for (const [name, impl] of Object.entries(currentTools.implementations)) {
          session.registerTool(name, impl);
        }
      }

      // Listen for status changes
      session.on("status", (data) => {
        if (sessionRef.current !== session) return;
        const newStatus = data as AgentStatus;
        setStatus(newStatus);
        onStatusChange?.(newStatus);
        addDebug("status", String(newStatus));

        // Update isMuted from mic events
        if (newStatus === "disconnected" || newStatus === "idle") {
          setIsMuted(false);
        }
      });

      // Listen for transcript updates
      session.on("transcript", (data) => {
        if (sessionRef.current !== session) return;
        const entries = data as TranscriptEntry[];
        setTranscript(entries);
        onTranscript?.(entries);

        // Update current text from last agent message
        const lastAgent = [...entries].reverse().find((m) => m.role === "agent");
        if (lastAgent) {
          setCurrentText(lastAgent.text);
        }
      });

      // Listen for mic state changes
      session.on("mic", (data) => {
        if (sessionRef.current !== session) return;
        const { muted } = data as { muted: boolean };
        setIsMuted(muted);
      });

      // Listen for data messages (tool calls, etc.)
      session.on("data", (data) => {
        if (sessionRef.current !== session) return;
        const msg = data as Record<string, unknown>;
        const msgType = String(msg.type ?? "unknown");

        if (msgType === "client_tool_invocation") {
          const toolName = String(msg.toolName ?? msg.tool_name ?? "unknown");
          const params = msg.parameters ?? msg.invocationId ?? "";
          addDebug(
            "tool_call",
            `${toolName}(${typeof params === "string" ? params : JSON.stringify(params)})`,
          );
        } else if (msgType !== "state" && msgType !== "transcript") {
          addDebug("event", `${msgType}: ${JSON.stringify(msg).slice(0, 200)}`);
        }
      });

      // Fetch joinUrl from API
      const body = buildSessionRequest({
        missionId,
        tools: currentTools,
        extraParams: apiParams,
      });

      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({ error: "Unknown error" }))) as {
          error?: string;
        };
        const errorMsg = errorData.error ?? "Failed to start agent session";
        console.error("[useAgent] Failed to start session:", res.status, errorMsg);
        sessionRef.current = null;
        startingRef.current = false;
        setStatus("idle");
        onStatusChange?.("idle");
        throw new Error(errorMsg);
      }

      const responseData = (await res.json()) as { joinUrl?: string };
      const joinUrl = responseData.joinUrl;

      if (joinUrl && sessionRef.current === session) {
        session.join(joinUrl);
      } else {
        sessionRef.current = null;
        startingRef.current = false;
        setStatus("idle");
        onStatusChange?.("idle");
      }
    } catch (error) {
      console.error("[useAgent] Failed to start session:", error);
      sessionRef.current = null;
      startingRef.current = false;
      setStatus("idle");
      onStatusChange?.("idle");
    }
  }, [missionId, providerName, apiEndpoint, apiParams, addDebug, onStatusChange, onTranscript]);

  // End session
  const endSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.leave();
      sessionRef.current = null;
    }
    startingRef.current = false;
    setStatus("idle");
    setCurrentText("");
    setDebugLog([]);
    onStatusChange?.("idle");
  }, [onStatusChange]);

  // Toggle mic
  const toggleMic = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    if (isMuted) {
      session.unmuteMic();
      setIsMuted(false);
    } else {
      session.muteMic();
      setIsMuted(true);
    }
  }, [isMuted]);

  // Send context text to the agent
  const sendContext = useCallback(
    (text: string) => {
      const session = sessionRef.current;
      if (!session || !CONNECTED_STATUSES.has(status)) return;

      addDebug("context_push", text);
      session.sendText(text);
    },
    [status, addDebug],
  );

  // Auto-start
  useEffect(() => {
    if (!autoStart) return;
    const timer = setTimeout(() => {
      void startSession();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line -- only fire on autoStart change
  }, [autoStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.leave();
        sessionRef.current = null;
      }
    };
  }, []);

  // Derived state
  const isConnected = CONNECTED_STATUSES.has(status);
  const isSpeaking = status === "speaking";

  return {
    status,
    isConnected,
    isSpeaking,
    isMuted,
    currentText,
    transcript,
    debugLog,
    startSession,
    endSession,
    toggleMic,
    sendContext,
  };
}
