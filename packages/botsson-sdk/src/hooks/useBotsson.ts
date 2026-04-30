"use client";

// useBotsson — Unified hook combining LiveKit voice + Smartout chat.
//
// This is the primary public API of the botsson-sdk. Consumers mount
// this hook and get back:
//   - Voice controls (startVoice, endVoice, toggleMic)
//   - Chat controls (sendChat)
//   - Unified status + mode
//   - Activity stream (from voice-agent data channel)
//   - Chat transcript
//
// Both surfaces share the same sessionId once chat has started — so
// voice and chat turns are threaded on stage-engine.
//
// OPEN GAP (Phase A3): engine_memory writer not yet live. Voice sessions
// with "remembers" context only persist until Phase A3 merges.

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  BotssonAgentConfig,
  BotssonStatus,
  BotssonMode,
  BotssonActivityEvent,
  ChatTurn,
} from "../types";
import { LiveKitVoiceSession } from "../providers/livekit-voice";
import type { LiveKitVoiceSessionEvents } from "../providers/livekit-voice";
import { mintLiveKitToken } from "../context/token";
import { createChatClient } from "../clients/chat";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export type BotssonSession = {
  /** Current interaction mode */
  mode: BotssonMode;
  /** Granular lifecycle status */
  status: BotssonStatus;
  /** Activity events streamed from voice-agent over data channel */
  activity: BotssonActivityEvent[];
  /** Full chat transcript (user + assistant turns) */
  transcript: ChatTurn[];
  /** True while a chat request is in-flight */
  isChatLoading: boolean;
  /** Whether the mic is currently muted (voice mode only) */
  isMicMuted: boolean;
  /** Start a LiveKit voice session */
  startVoice: () => Promise<void>;
  /** End the current voice session */
  endVoice: () => void;
  /** Toggle mic mute (no-op outside voice mode) */
  toggleMic: () => void;
  /** Send a chat message */
  sendChat: (text: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// useBotsson
// ---------------------------------------------------------------------------

/**
 * Unified Botsson harness hook.
 *
 * @example
 * ```tsx
 * const botsson = useBotsson({ workspaceId: "..." });
 *
 * // Voice
 * <button onClick={() => void botsson.startVoice()}>Start voice</button>
 * <button onClick={botsson.endVoice}>End voice</button>
 *
 * // Chat
 * <button onClick={() => void botsson.sendChat("hva er mine vakter?")}>Ask</button>
 * ```
 */
export function useBotsson(config: BotssonAgentConfig): BotssonSession {
  const {
    workspaceId,
    tokenEndpoint = "/api/botsson/voice/token",
    chatEndpoint = "/api/emma/chat",
    pageContext,
    onStatusChange,
  } = config;

  // ── State ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<BotssonMode>("idle");
  const [status, setStatus] = useState<BotssonStatus>("idle");
  const [activity, setActivity] = useState<BotssonActivityEvent[]>([]);
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const voiceSessionRef = useRef<LiveKitVoiceSession | null>(null);
  const startingVoiceRef = useRef(false);
  /** Session ID shared with stage-engine — threaded across chat turns */
  const sessionIdRef = useRef<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const modeRef = useRef<BotssonMode>("idle");

  // Keep modeRef in sync with mode state
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  /** Stable chat client — recreated only if endpoint changes */
  const chatClientRef = useRef(createChatClient({ endpoint: chatEndpoint }));
  useEffect(() => {
    chatClientRef.current = createChatClient({ endpoint: chatEndpoint });
  }, [chatEndpoint]);

  // ── Status helper ─────────────────────────────────────────────────────────

  const applyStatus = useCallback(
    (next: BotssonStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  // ── Voice event handlers (stable ref — avoids recreating LiveKitVoiceSession) ──

  const voiceEventHandlers = useRef<LiveKitVoiceSessionEvents>({
    onStatus: applyStatus,
    onActivity: (event) => setActivity((prev) => [...prev, event]),
    onMicStateChange: setIsMicMuted,
    onDisconnect: () => {
      voiceSessionRef.current = null;
      startingVoiceRef.current = false;
      setMode("idle");
      setIsMicMuted(false);
      applyStatus("idle");
    },
  });

  // Keep handlers in sync without recreating the session
  useEffect(() => {
    voiceEventHandlers.current = {
      onStatus: applyStatus,
      onActivity: (event) => setActivity((prev) => [...prev, event]),
      onMicStateChange: setIsMicMuted,
      onDisconnect: () => {
        voiceSessionRef.current = null;
        startingVoiceRef.current = false;
        setMode("idle");
        setIsMicMuted(false);
        applyStatus("idle");
      },
    };
  }, [applyStatus]);

  // ── startVoice ────────────────────────────────────────────────────────────

  const startVoice = useCallback(async () => {
    if (voiceSessionRef.current || startingVoiceRef.current) return;
    startingVoiceRef.current = true;
    applyStatus("connecting");
    setMode("voice");

    try {
      // Request mic permission before any async work — keeps the user-gesture
      // window open so getUserMedia() inside Room.connect() succeeds.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        console.error("[useBotsson] Mic permission denied");
        applyStatus("idle");
        setMode("idle");
        startingVoiceRef.current = false;
        return;
      }

      // Mint a LiveKit token for this workspace
      const { token, serverUrl } = await mintLiveKitToken({
        workspaceId,
        tokenEndpoint,
      });

      // Create a proxy so the session always calls the latest handlers
      const handlerProxy: LiveKitVoiceSessionEvents = {
        onStatus: (s) => voiceEventHandlers.current.onStatus(s),
        onActivity: (e) => voiceEventHandlers.current.onActivity(e),
        onMicStateChange: (m) => voiceEventHandlers.current.onMicStateChange(m),
        onDisconnect: () => voiceEventHandlers.current.onDisconnect(),
      };

      const session = new LiveKitVoiceSession(handlerProxy);
      voiceSessionRef.current = session;

      await session.connect(token, serverUrl);
      // session fires onStatus("listening") after connect completes
    } catch (err) {
      console.error("[useBotsson] startVoice failed:", err);
      voiceSessionRef.current = null;
      startingVoiceRef.current = false;
      applyStatus("idle");
      setMode("idle");
    }
  }, [workspaceId, tokenEndpoint, applyStatus]);

  // ── endVoice ──────────────────────────────────────────────────────────────

  const endVoice = useCallback(() => {
    const session = voiceSessionRef.current;
    if (session) {
      session.disconnect();
      // onDisconnect handler resets voiceSessionRef + state
    } else {
      // Defensive: reset if session was never fully connected
      setMode("idle");
      applyStatus("idle");
      startingVoiceRef.current = false;
      setIsMicMuted(false);
    }
  }, [applyStatus]);

  // ── toggleMic ─────────────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    const session = voiceSessionRef.current;
    if (!session) return;
    if (isMicMuted) {
      session.unmute();
    } else {
      session.mute();
    }
  }, [isMicMuted]);

  // ── sendChat ──────────────────────────────────────────────────────────────

  const sendChat = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Cancel any pending chat request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Append user turn immediately (optimistic UI)
      const userTurn: ChatTurn = {
        role: "user",
        text: trimmed,
        timestamp: new Date().toISOString(),
      };
      setTranscript((prev) => [...prev, userTurn]);
      setIsChatLoading(true);
      setMode("chat");
      applyStatus("thinking");

      try {
        const reply = await chatClientRef.current.askSmartout({
          workspaceId,
          message: trimmed,
          sessionId: sessionIdRef.current,
          pageContext,
          signal: controller.signal,
        });

        // Thread future turns through the same stage-engine session
        if (reply.sessionId) {
          sessionIdRef.current = reply.sessionId;
        }

        const assistantTurn: ChatTurn = {
          role: "assistant",
          text: reply.text,
          timestamp: new Date().toISOString(),
        };
        setTranscript((prev) => [...prev, assistantTurn]);
        applyStatus("idle");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[useBotsson] sendChat failed:", err);
        applyStatus("idle");
      } finally {
        setIsChatLoading(false);
        // Return to idle if we are not in an active voice session
        if (modeRef.current !== "voice") {
          setMode("idle");
        }
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [workspaceId, pageContext, applyStatus],
  );

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      voiceSessionRef.current?.disconnect();
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    mode,
    status,
    activity,
    transcript,
    isChatLoading,
    isMicMuted,
    startVoice,
    endVoice,
    toggleMic,
    sendChat,
  };
}
