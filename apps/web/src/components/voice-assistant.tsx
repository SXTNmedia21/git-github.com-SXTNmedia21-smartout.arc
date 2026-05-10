"use client";

/**
 * voice-assistant.tsx — Provider-agnostic voice surface (Phase E rewrite).
 *
 * ADR-0282 Phase E T3.1: voice-provider rewritten. LiveKit Room is now the session.
 *
 * Exports:
 *   - InterviewSurface — persona-bearing surface (Lise, onboarding interview).
 *     missionId defaults to "lise-interview". Receives persona + prompt props.
 *
 *   - VoiceAssistant (default) — generic Botsson voice panel, used by
 *     DashboardShell. Thin wrapper around InterviewSurface with mission
 *     routing from props. The component stays in this file for backward-compat
 *     until Task 8 (Ultravox deletion sweep) cleans up the import chain.
 *
 * Lise persona (KRIT-6): voice = coral (OpenAI Realtime). Mission = lise-interview.
 * System prompt is carried by the mission registry (packages/ai/src/missions/),
 * not hardcoded here — agent-side instruction, not client-side.
 */

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";
import { usePostHog } from "posthog-js/react";
import { Mic, MicOff, Sparkles, X, Bot, Loader2, Activity } from "lucide-react";
import { MISSION_MANIFEST } from "@smartout/ai/missions";
import type { MissionId } from "@smartout/ai/missions";
import type { ClientTools } from "./voice-tools-context";

// ── Types ────────────────────────────────────────────────────────────────────

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "disconnecting"
  | "disconnected";

export type Persona = {
  name: string;
  /** LiveKit / OpenAI voice slug, e.g. "coral" */
  voice: string;
  avatarUrl?: string;
  /** Agent-side system prompt (passed as context.system_prompt to voice-agent). */
  systemPrompt?: string;
};

export type InterviewSurfaceProps = {
  persona: Persona;
  prompt: string;
  missionId?: string;
  onTranscript?: (text: string, speaker: "agent" | "user") => void;
  onComplete?: () => void;
  /** Optional close handler */
  onClose?: () => void;
};

// ── LISE_PERSONA constant ────────────────────────────────────────────────────

/**
 * Default Lise persona for the onboarding interview.
 * Voice = coral (KRIT-6 / ADR-0282). Mission = lise-interview.
 * System prompt lives in the mission registry — this is UI metadata only.
 */
export const LISE_PERSONA: Persona = {
  name: "Lise",
  voice: "coral",
  avatarUrl: "/personas/lise.png",
};

// ── InterviewSurface ─────────────────────────────────────────────────────────

export function InterviewSurface({
  persona,
  prompt,
  missionId = "lise-interview",
  onTranscript,
  onComplete: _onComplete,
  onClose,
}: InterviewSurfaceProps) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([]);
  const [isMuted, setIsMuted] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const startingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (startingRef.current) return;
      startingRef.current = true;
      setStatus("connecting");

      try {
        const res = await fetch("/api/wizard/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mission_id: missionId,
            voice: persona.voice,
            language: "no",
            first_speaker: "agent",
            context: { system_prompt: persona.systemPrompt, prompt },
          }),
        });

        if (!res.ok || cancelled) {
          setStatus("idle");
          startingRef.current = false;
          return;
        }

        const { roomUrl, token } = (await res.json()) as { roomUrl: string; token: string };
        if (!roomUrl || !token || cancelled) {
          setStatus("idle");
          startingRef.current = false;
          return;
        }

        const room = new Room({ adaptiveStream: true, disconnectOnPageLeave: false });
        if (cancelled) {
          startingRef.current = false;
          return;
        }
        roomRef.current = room;

        room.on(RoomEvent.Connected, () => {
          if (!cancelled) setStatus("listening");
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) {
            setStatus("idle");
            roomRef.current = null;
          }
        });
        room.on(RoomEvent.ActiveSpeakersChanged, () => {
          if (cancelled) return;
          const speakers = room.activeSpeakers;
          if (speakers.length === 0) {
            setStatus("thinking");
          } else {
            const localId = room.localParticipant.identity;
            if (speakers.some((p) => p.identity !== localId)) {
              setStatus("speaking");
            } else {
              setStatus("listening");
            }
          }
        });
        room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
          if (cancelled) return;
          const speaker = participant?.isLocal ? "user" : "agent";
          for (const seg of segments) {
            if (seg.final) {
              setTranscript((prev) => [...prev, { speaker, text: seg.text }]);
              onTranscript?.(seg.text, speaker as "agent" | "user");
            }
          }
        });

        await room.connect(roomUrl, token);
        if (!cancelled) {
          await room.localParticipant.setMicrophoneEnabled(true);
          setIsMuted(false);
        } else {
          void room.disconnect();
        }
      } catch {
        if (!cancelled) setStatus("idle");
      } finally {
        startingRef.current = false;
      }
    }

    void start();

    return () => {
      cancelled = true;
      const room = roomRef.current;
      if (room) {
        void room.disconnect();
        roomRef.current = null;
      }
    };
  }, []); // eslint-disable-line -- mount-only effect: roomRef is a stable ref, not a dep

  const toggleMic = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    void room.localParticipant.setMicrophoneEnabled(!enabled);
    setIsMuted(enabled);
  }, []);

  const isConnected = status === "listening" || status === "thinking" || status === "speaking";
  const isConnecting = status === "connecting" || status === "disconnecting";

  return (
    <div className="interview-surface border-border bg-card/80 pointer-events-auto relative flex h-[600px] w-[350px] flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl">
      <div className="border-border bg-muted/50 flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          {persona.avatarUrl ? (
            <img
              src={persona.avatarUrl}
              alt={persona.name}
              className="size-10 rounded-full object-cover"
            />
          ) : (
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${isConnected ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`}
            >
              <Bot className="h-5 w-5" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-white">{persona.name}</h3>
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              {isConnected ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Aktiv
                </>
              ) : isConnecting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-orange-500" /> Kobler til...
                </>
              ) : (
                <>
                  <span className="bg-muted-foreground h-1.5 w-1.5 rounded-full" /> Inaktiv
                </>
              )}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg p-2 transition"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {transcript.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="border-border bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full border">
              <Sparkles className="h-8 w-8 text-orange-500/50" />
            </div>
            <h4 className="text-foreground mb-2 font-semibold">{persona.name}</h4>
            <p className="text-muted-foreground max-w-xs text-sm">
              {status === "connecting" ? "Kobler til..." : prompt}
            </p>
          </div>
        ) : (
          transcript.map((t, i) => (
            <div
              key={i}
              className={`animate-in fade-in slide-in-from-bottom-2 flex flex-col duration-200 ${t.speaker === "user" ? "items-end" : "items-start"}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  {t.speaker === "user" ? "Du" : persona.name}
                </span>
                {t.speaker === "agent" && isConnected && i === transcript.length - 1 && (
                  <Activity className="h-3 w-3 animate-pulse text-orange-500" />
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${t.speaker === "user" ? "rounded-br-none bg-orange-500 text-white" : "border-border/50 bg-muted text-foreground rounded-bl-none border"}`}
              >
                {t.text}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-border bg-muted/50 flex flex-col items-center gap-3 border-t p-4">
        {isConnected && (
          <button
            onClick={toggleMic}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
              isMuted
                ? "border border-red-500/20 bg-red-500/20 text-red-500"
                : "border border-emerald-300 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
            }`}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
        {status === "idle" && (
          <p className="text-muted-foreground text-xs">Klar til å starte samtale</p>
        )}
      </div>
    </div>
  );
}

// ── VoiceAssistant (DashboardShell backward-compat default export) ───────────
// Default export so DashboardShell's dynamic(() => import("@/components/voice-assistant"))
// still resolves to the right component. Wraps InterviewSurface.

interface VoiceAssistantProps {
  onClose?: () => void;
  autoStart?: boolean;
  missionId?: MissionId;
  sessionContext?: {
    page: string;
    story: string;
    workingElements: string[];
    availableInputs: string[];
  };
  clientTools?: ClientTools | null;
}

export function VoiceAssistant({
  onClose,
  autoStart = false,
  missionId = "mr-botsson",
  sessionContext,
}: VoiceAssistantProps) {
  const posthog = usePostHog();
  const manifest = useMemo(
    () => MISSION_MANIFEST[missionId] ?? MISSION_MANIFEST["mr-botsson"],
    [missionId],
  );

  const persona: Persona = {
    name: manifest.agentDisplayName,
    // Use manifest.voice so non-Lise missions (e.g. mr-botsson voice="mark")
    // are not silently overridden. D3 R4 fix — was hardcoded to "coral".
    // Fall back to "coral" only when mission has no voice set (rare; protects Persona.voice: string).
    voice: manifest.voice ?? "coral",
    systemPrompt: sessionContext
      ? `Page: ${sessionContext.page}. ${sessionContext.story}`
      : undefined,
  };

  const handleTranscript = useCallback(
    (_text: string, speaker: "agent" | "user") => {
      if (speaker === "agent") {
        posthog?.capture("voice_transcript_logged", {
          role: "agent",
          mission_id: missionId,
        });
      }
    },
    [posthog, missionId],
  );

  if (!autoStart) {
    // Not auto-started — render idle state with mission info
    return (
      <div className="border-border bg-card/80 pointer-events-auto relative flex h-[600px] w-[350px] flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl">
        <div className="border-border bg-muted/50 flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{manifest.agentDisplayName}</h3>
              <p className="text-muted-foreground text-xs">{manifest.uiDescription}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg p-2 transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="border-border bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full border">
            <Sparkles className="h-8 w-8 text-orange-500/50" />
          </div>
          <p className="text-muted-foreground text-sm">{manifest.uiDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <InterviewSurface
      persona={persona}
      prompt={manifest.uiDescription}
      missionId={missionId}
      onTranscript={handleTranscript}
      onClose={onClose}
    />
  );
}

export default VoiceAssistant;
