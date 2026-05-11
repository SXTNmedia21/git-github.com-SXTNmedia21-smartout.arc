"use client";

/**
 * useBotsson — Onboarding voice hook (Phase E rewrite).
 *
 * ADR-0282 Phase E T2.3: voice-provider rewritten to LiveKit Room. 13 server-bound
 * temporaryTool registrations stripped — they are now live as onboarding
 * capability tools in packages/ai/src/capabilities/onboarding/ (Track 1,
 * PR #342).
 *
 * The ONLY client-side tool retained: advanceToNextSection. It's a pure UI
 * side-effect (scroll to next wizard section) — cannot be a backend tool.
 * Triggered via LiveKit data channel message (topic "botsson-tool-call").
 *
 * The hook maintains the existing BotssonState return shape so WizardContext
 * callers (isConnected, sendContext, status, etc.) need no changes.
 *
 * Memory: memory writes happen via the memory.save_memory capability tool
 * (packages/ai/src/capabilities/) — no client-side saveMemory call.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Room, RoomEvent } from "livekit-client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "disconnecting"
  | "disconnected";

/**
 * Callbacks the agent can invoke via data-channel to update the onboarding UI.
 * Only advanceToNextSection remains as a client-side action — all data
 * mutations (updateBusiness, addDepartments, etc.) are now capability tools.
 */
export interface BotssonActions {
  advanceToNextSection: () => void;
  // Legacy: kept in signature so WizardContext compiles without changes.
  // These are no longer called by this hook — they exist as backend capability
  // tools (onboarding capability, Track 1 PR #342).
  getState?: () => Record<string, unknown>;
  updateBusiness?: (partial: Record<string, unknown>) => void;
  updateSeason?: (partial: Record<string, unknown>) => void;
  addDepartments?: (names: string[]) => void;
  addLocations?: (locs: { name: string; type?: string }[]) => void;
  addZones?: (locationName: string, zones: { name: string }[]) => void;
  addProcedures?: (names: string[]) => void;
  triggerScrape?: (
    url: string,
    orgNumber: string,
    companyName?: string,
    city?: string,
  ) => Promise<void>;
  searchCompany?: (name: string, city?: string) => Promise<unknown[]>;
  identifyCompany?: (orgNumber: string) => Promise<unknown>;
  scrapeWebsite?: (url: string) => Promise<{ scrapedData: Record<string, unknown> | null } | null>;
  addKeyFact?: (label: string, value: string) => void;
  saveMemory?: (content: string, memoryType: string, expiresAt?: string) => Promise<void>;
  finalizeOnboarding?: () => Promise<{ success: boolean; slug?: string; error?: string }>;
}

export interface DebugEntry {
  timestamp: number;
  type: "status" | "tool_call" | "tool_result" | "context_push" | "inference" | "event";
  content: string;
}

interface BotssonState {
  status: VoiceStatus;
  isConnected: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  currentText: string;
  transcript: { role: string; text: string }[];
  contextLog: string[];
  debugLog: DebugEntry[];
  startSession: () => Promise<void>;
  endSession: () => void;
  toggleMic: () => void;
  sendContext: (text: string) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useBotsson(actions?: BotssonActions): BotssonState {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [contextLog, setContextLog] = useState<string[]>([]);
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);
  const roomRef = useRef<Room | null>(null);
  const startingRef = useRef(false);
  const actionsRef = useRef(actions);

  const addDebug = useCallback((type: DebugEntry["type"], content: string) => {
    setDebugLog((prev) => [...prev, { timestamp: Date.now(), type, content }]);
  }, []);

  // Keep ref in sync so async handlers always see fresh actions
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const startSession = useCallback(async () => {
    if (roomRef.current || startingRef.current) return;
    startingRef.current = true;
    setStatus("connecting");

    try {
      // Mint LiveKit token via wizard/start — no Ultravox create-call
      const res = await fetch("/api/wizard/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: "onboarding-interview",
          voice: "coral",
          language: "no",
          first_speaker: "agent",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Ukjent feil" }));
        const msg = errorData.error ?? "Kunne ikke starte stemmeassistenten";
        console.error("[useBotsson] Failed to start session:", res.status, msg);
        toast.error(msg);
        startingRef.current = false;
        setStatus("idle");
        return;
      }

      const data = await res.json();
      const { roomUrl, token } = data as { roomUrl: string; token: string };

      if (!roomUrl || !token) {
        console.error("[useBotsson] Missing roomUrl or token in response");
        startingRef.current = false;
        setStatus("idle");
        return;
      }

      const room = new Room({ adaptiveStream: true, disconnectOnPageLeave: false });
      roomRef.current = room;

      // LiveKit connection events → status
      room.on(RoomEvent.Connected, () => {
        if (roomRef.current !== room) return;
        setStatus("listening");
        addDebug("status", "connected");
      });

      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) {
          roomRef.current = null;
          setStatus("idle");
          addDebug("status", "disconnected");
        }
      });

      // Active-speaker heuristic for status
      room.on(RoomEvent.ActiveSpeakersChanged, () => {
        if (roomRef.current !== room) return;
        const speakers = room.activeSpeakers;
        if (speakers.length === 0) {
          setStatus("thinking");
          return;
        }
        const localId = room.localParticipant.identity;
        const agentSpeaking = speakers.some((p) => p.identity !== localId);
        const userSpeaking = speakers.some((p) => p.identity === localId);
        if (agentSpeaking) {
          setStatus("speaking");
          setCurrentText(""); // reset on new agent turn
        } else if (userSpeaking) {
          setStatus("listening");
        } else {
          setStatus("thinking");
        }
      });

      // Transcript via LiveKit Transcription API (Agents 1.3.0+)
      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        if (roomRef.current !== room) return;
        const role = participant?.isLocal ? "user" : "agent";
        for (const seg of segments) {
          if (seg.final) {
            const text = seg.text;
            setTranscript((prev) => [...prev, { role, text }]);
            if (role === "agent") setCurrentText(text);
            addDebug("event", `transcript[${role}]: ${text.slice(0, 100)}`);
          }
        }
      });

      // Data channel: voice-agent publishes tool calls over "botsson-tool-call"
      // The only client-side tool: advanceToNextSection
      const decoder = new TextDecoder();
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, _participant, _kind, topic) => {
        if (topic !== "botsson-tool-call") return;
        try {
          const msg = JSON.parse(decoder.decode(payload)) as { tool: string };
          addDebug("tool_call", msg.tool);
          if (msg.tool === "advanceToNextSection") {
            actionsRef.current?.advanceToNextSection();
          }
        } catch {
          // malformed data-channel message — ignore
        }
      });

      await room.connect(roomUrl, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setIsMuted(false);
    } catch (error) {
      console.error("[useBotsson] Failed to start session:", error);
      roomRef.current = null;
      startingRef.current = false;
      setStatus("idle");
    } finally {
      startingRef.current = false;
    }
  }, [addDebug]);

  const endSession = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      void room.disconnect();
      roomRef.current = null;
    }
    startingRef.current = false;
    setStatus("idle");
    setCurrentText("");
    setContextLog([]);
    setDebugLog([]);
  }, []);

  const toggleMic = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    void room.localParticipant.setMicrophoneEnabled(!enabled);
    setIsMuted(enabled); // if was enabled → now muted
  }, []);

  const sendContext = useCallback(
    (text: string) => {
      const room = roomRef.current;
      if (!room) return;
      const connected = status === "listening" || status === "thinking" || status === "speaking";
      if (connected) {
        setContextLog((prev) => [...prev, text]);
        addDebug("context_push", text);
        // Send as data-channel message for voice-agent to inject into context
        const encoder = new TextEncoder();
        void room.localParticipant.publishData(
          encoder.encode(JSON.stringify({ type: "context_push", text })),
          { reliable: true, topic: "botsson-context" },
        );
      }
    },
    [status, addDebug],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const room = roomRef.current;
      if (room) {
        void room.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  const isConnected = status === "listening" || status === "thinking" || status === "speaking";
  const isSpeaking = status === "speaking";

  return {
    status,
    isConnected,
    isSpeaking,
    isMuted,
    currentText,
    transcript,
    contextLog,
    debugLog,
    startSession,
    endSession,
    toggleMic,
    sendContext,
  };
}
