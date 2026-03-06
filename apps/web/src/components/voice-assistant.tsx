"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Mic, MicOff, Sparkles, X, Activity, Bot, Loader2 } from "lucide-react";
import { UltravoxSession, UltravoxSessionStatus, Role } from "ultravox-client";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { MISSION_MANIFEST } from "@smartout/ai/missions";
import type { MissionId } from "@smartout/ai/missions";
import type { ClientTools } from "./voice-tools-context";

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

export default function VoiceAssistant({
  onClose,
  autoStart = false,
  missionId = "mr-botsson",
  sessionContext,
  clientTools,
}: VoiceAssistantProps) {
  const [status, setStatus] = useState<UltravoxSessionStatus | "idle">("idle");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [agentSpeaksEnabled, setAgentSpeaksEnabled] = useState(false);
  const [startErrorMessage, setStartErrorMessage] = useState<string | null>(null);
  const sessionRef = useRef<UltravoxSession | null>(null);
  const isStartingRef = useRef(false);
  const pendingOutputMediumRef = useRef<"voice" | "text" | null>(null);
  const connectedReadyCapturedRef = useRef(false);
  const connectWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posthog = usePostHog();

  const manifest = useMemo(
    () => MISSION_MANIFEST[missionId] ?? MISSION_MANIFEST["mr-botsson"],
    [missionId],
  );

  type UltravoxSpeakerControls = UltravoxSession & {
    muteSpeaker?: () => void;
    unmuteSpeaker?: () => void;
    setOutputMedium?: (medium: "voice" | "text") => void;
  };

  const isConnectedStatus = (currentStatus: UltravoxSessionStatus | "idle" | undefined) => {
    return (
      currentStatus === UltravoxSessionStatus.LISTENING ||
      currentStatus === UltravoxSessionStatus.THINKING ||
      currentStatus === UltravoxSessionStatus.SPEAKING
    );
  };

  const trackVoiceEvent = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      posthog?.capture(event, {
        mission_id: missionId,
        ...payload,
      });
    },
    [posthog, missionId],
  );

  const clearConnectWatchdog = useCallback(() => {
    if (connectWatchdogRef.current) {
      clearTimeout(connectWatchdogRef.current);
      connectWatchdogRef.current = null;
    }
  }, []);

  /**
   * Applies the desired speaker/output mode when session is connected.
   * If still connecting, we queue the desired medium and flush once ready.
   */
  const applyAgentAudioState = useCallback(
    (enabled: boolean, source: string) => {
      const desiredMedium = enabled ? "voice" : "text";
      pendingOutputMediumRef.current = desiredMedium;

      const session = sessionRef.current as UltravoxSpeakerControls | null;
      if (!session) return;
      if (!isConnectedStatus(session.status)) return;

      try {
        if (enabled) {
          session.unmuteSpeaker?.();
        } else {
          session.muteSpeaker?.();
        }
        session.setOutputMedium?.(desiredMedium);
        pendingOutputMediumRef.current = null;
        trackVoiceEvent("output_mode_applied", {
          source,
          medium: desiredMedium,
          status: String(session.status ?? "unknown"),
        });
      } catch (error) {
        // Keep pending value for next connected status tick.
        console.debug("[VoiceAssistant] Deferring speaker state change", error);
      }
    },
    [trackVoiceEvent],
  );

  const startSession = useCallback(async () => {
    if (isStartingRef.current) return;
    if (sessionRef.current && status !== "idle") return;

    isStartingRef.current = true;
    connectedReadyCapturedRef.current = false;
    setStartErrorMessage(null);
    setStatus(UltravoxSessionStatus.CONNECTING);
    trackVoiceEvent("session_start_requested", {
      context_page: sessionContext?.page ?? "unknown",
      selected_tool_count: clientTools?.definitions?.length ?? 0,
    });

    try {
      const currentSession = new UltravoxSession();
      sessionRef.current = currentSession;
      // Chat-first behavior: keep mic muted until user explicitly presses "Snakk".
      currentSession.muteMic();
      setIsMuted(true);

      // Register client tool implementations BEFORE joinCall
      if (clientTools?.implementations) {
        for (const [name, impl] of Object.entries(clientTools.implementations)) {
          currentSession.registerToolImplementation(name, impl);
        }
      }

      currentSession.addEventListener("status", () => {
        if (sessionRef.current === currentSession) {
          const nextStatus = currentSession.status || "idle";
          setStatus(nextStatus);

          if (isConnectedStatus(nextStatus)) {
            clearConnectWatchdog();
            setStartErrorMessage(null);
            if (!connectedReadyCapturedRef.current) {
              connectedReadyCapturedRef.current = true;
              trackVoiceEvent("connected_ready", {
                status: String(nextStatus),
              });
            }
            applyAgentAudioState(agentSpeaksEnabled, "connected_status");
          }

          if (
            nextStatus === UltravoxSessionStatus.DISCONNECTED &&
            !connectedReadyCapturedRef.current
          ) {
            clearConnectWatchdog();
            sessionRef.current = null;
            setStatus("idle");
            setStartErrorMessage("Kunne ikke koble til tale. Prøv igjen om noen sekunder.");
            toast.error("Kunne ikke koble til tale. Prøv igjen om noen sekunder.");
            trackVoiceEvent("session_connect_failed", {
              status: String(nextStatus),
              reason: "disconnected_before_ready",
            });
          }
        }
      });

      currentSession.addEventListener("transcripts", () => {
        if (sessionRef.current === currentSession) {
          const transcripts = currentSession.transcripts;
          if (transcripts) {
            const formatted = transcripts.map((t) => ({
              role: t.speaker === Role.USER ? "user" : "agent",
              text: t.text,
            }));
            setMessages(formatted);

            const lastTranscript = transcripts[transcripts.length - 1];
            if (lastTranscript && lastTranscript.isFinal) {
              posthog?.capture("voice_transcript_logged", {
                role: lastTranscript.speaker === Role.USER ? "user" : "agent",
                text: lastTranscript.text,
                mission_id: missionId,
              });
            }
          }
        }
      });

      currentSession.addEventListener("mic", () => {
        if (sessionRef.current === currentSession) {
          setIsMuted(!currentSession.isMicMuted);
        }
      });

      let joinUrl = "";
      try {
        const res = await fetch("/api/wizard/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mission_id: missionId,
            // User should always start the conversation.
            first_speaker: "user",
            context: sessionContext,
            selected_tools: clientTools?.definitions ?? [],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          joinUrl = data.joinUrl;
          trackVoiceEvent("join_url_received", {
            mission_fallback_used: Boolean(data.missionFallbackUsed),
            voice_fallback_used: Boolean(data.voiceFallbackUsed),
          });
          if (data.voiceFallbackUsed) {
            posthog?.capture("voice_fallback_used", {
              mission_id: missionId,
              source: "voice-assistant",
            });
          }
        } else {
          const errorData = await res
            .json()
            .catch(() => ({ error: "Failed to start voice session" }));
          setStartErrorMessage(errorData.error ?? "Kunne ikke starte stemmesesjon");
          toast.error(errorData.error ?? "Kunne ikke starte stemmesesjon");
          trackVoiceEvent("join_url_failed", {
            status_code: res.status,
            error: errorData.error ?? "unknown_error",
          });
        }
      } catch (err) {
        console.warn("[VoiceAssistant] Could not fetch joinUrl:", err);
        setStartErrorMessage("Nettverksfeil ved oppstart av stemmesesjon");
        toast.error("Nettverksfeil ved oppstart av stemmesesjon");
        trackVoiceEvent("join_url_failed", {
          error: err instanceof Error ? err.message : "unknown_error",
        });
      }

      if (joinUrl && sessionRef.current === currentSession) {
        currentSession.joinCall(joinUrl);
        // Enforce muted mic after connect as well.
        currentSession.muteMic();
        setIsMuted(true);
        clearConnectWatchdog();
        connectWatchdogRef.current = setTimeout(() => {
          if (sessionRef.current !== currentSession || connectedReadyCapturedRef.current) return;
          try {
            currentSession.leaveCall();
          } catch {
            // no-op cleanup
          }
          sessionRef.current = null;
          setStatus("idle");
          setStartErrorMessage("Tilkobling tok for lang tid. Prøv igjen.");
          toast.error("Tilkobling tok for lang tid. Prøv igjen.");
          trackVoiceEvent("session_connect_timeout", { timeout_ms: 15000 });
        }, 15000);
        trackVoiceEvent("join_call_invoked", { has_join_url: true });
        posthog?.capture("voice_session_started", { mission_id: missionId });
      } else if (!joinUrl && sessionRef.current === currentSession) {
        sessionRef.current = null;
        setStatus("idle");
        setMessages([
          { role: "agent", text: manifest.greeting },
          {
            role: "agent",
            text: "Voice is unavailable right now. You can retry, or continue with guided text actions.",
          },
        ]);
        toast.error("Kunne ikke starte stemme. Sjekk at Stage Engine/Ultravox er tilgjengelig.");
      }
    } catch (error) {
      console.error("[VoiceAssistant] Failed to start session:", error);
      setStartErrorMessage("Kunne ikke starte stemmesesjon");
      if (sessionRef.current) setStatus("idle");
      trackVoiceEvent("session_start_failed", {
        error: error instanceof Error ? error.message : "unknown_error",
      });
    } finally {
      isStartingRef.current = false;
    }
  }, [
    status,
    missionId,
    manifest.greeting,
    sessionContext,
    clientTools,
    trackVoiceEvent,
    applyAgentAudioState,
    posthog,
    agentSpeaksEnabled,
    clearConnectWatchdog,
  ]);

  const endSession = useCallback(
    (reason: string) => {
      isStartingRef.current = false;
      pendingOutputMediumRef.current = null;
      connectedReadyCapturedRef.current = false;
      clearConnectWatchdog();

      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) {
        try {
          session.leaveCall();
        } catch (error) {
          console.debug("[VoiceAssistant] leaveCall failed", error);
        }
        posthog?.capture("voice_session_ended", { mission_id: missionId });
      }
      setStatus("idle");
      trackVoiceEvent("session_end_reason", { reason });
    },
    [posthog, missionId, trackVoiceEvent, clearConnectWatchdog],
  );

  const handleClose = () => {
    endSession("close_button");
    if (onClose) onClose();
  };

  const toggleMicMute = () => {
    const session = sessionRef.current;
    if (!session || !isConnectedStatus(session.status)) return;
    if (isMuted) {
      session.unmuteMic();
      setIsMuted(false);
      return;
    }
    session.muteMic();
    setIsMuted(true);
  };

  const toggleAgentSpeaks = () => {
    const nextEnabled = !agentSpeaksEnabled;
    setAgentSpeaksEnabled(nextEnabled);
    applyAgentAudioState(nextEnabled, "toggle_button");
  };

  useEffect(() => {
    if (autoStart) {
      setTimeout(() => {
        void startSession();
      }, 0);
    }
    return () => {
      endSession("component_unmount");
    };
  }, [autoStart, endSession, startSession]);

  useEffect(() => {
    applyAgentAudioState(agentSpeaksEnabled, "state_effect");
  }, [agentSpeaksEnabled, applyAgentAudioState]);

  const isConnected = ["listening", "thinking", "speaking"].includes(status);

  return (
    <div className="pointer-events-auto relative flex h-[600px] w-[350px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-2xl shadow-[0_0_50px_rgba(249,115,22,0.15)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-900/50 p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isConnected ? "bg-orange-500 text-white" : "bg-zinc-800 text-zinc-400"}`}
            >
              <Bot className="h-5 w-5" />
            </div>
            {isConnected && (
              <span className="absolute -right-0.5 -bottom-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-zinc-950 bg-orange-500"></span>
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{manifest.agentDisplayName}</h3>
            <p className="flex items-center gap-1 text-xs text-zinc-400">
              {isConnected ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Chat aktiv
                </>
              ) : status === UltravoxSessionStatus.CONNECTING ||
                status === UltravoxSessionStatus.DISCONNECTING ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-orange-500" /> Kobler til...
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" /> {manifest.uiDescription}
                </>
              )}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Transcript Area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
              <Sparkles className="h-8 w-8 text-orange-500/50" />
            </div>
            <h4 className="mb-2 font-semibold text-zinc-200">
              Hei, jeg er {manifest.agentDisplayName}!
            </h4>
            <p className="max-w-xs text-sm text-zinc-400">{manifest.uiDescription}</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`animate-in fade-in slide-in-from-bottom-2 flex flex-col duration-200 ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                  {msg.role === "user" ? "Du" : manifest.agentDisplayName}
                </span>
                {msg.role === "agent" && isConnected && idx === messages.length - 1 && (
                  <Activity className="h-3 w-3 animate-pulse text-orange-500" />
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "rounded-br-none bg-orange-500 text-white" : "rounded-bl-none border border-zinc-700/50 bg-zinc-800 text-zinc-200"}`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3 border-t border-zinc-800 bg-zinc-900/50 p-4">
        {status === "idle" ? (
          <div className="flex w-full flex-col gap-2">
            <button
              onClick={() => void startSession()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-400"
            >
              <Mic className="h-5 w-5" /> {startErrorMessage ? "Prøv igjen" : "Start chat"}
            </button>
            {startErrorMessage ? (
              <p className="text-center text-xs text-amber-300">{startErrorMessage}</p>
            ) : null}
          </div>
        ) : (
          <div className="flex w-full flex-col items-stretch gap-2">
            <button
              onClick={toggleAgentSpeaks}
              className={`rounded-full p-4 transition-all ${
                agentSpeaksEnabled
                  ? "border border-orange-300 bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                  : "border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wide uppercase">Agent speaks</span>
                <span className="text-xs font-black">{agentSpeaksEnabled ? "ON" : "OFF"}</span>
              </div>
            </button>
            <button
              onClick={toggleMicMute}
              className={`rounded-full p-4 transition-all ${
                isMuted
                  ? "border border-red-500/20 bg-red-500/20 text-red-500 hover:bg-red-500/30"
                  : "border border-emerald-300 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wide uppercase">Mute mic</span>
                <span className="flex items-center gap-2 text-xs font-black">
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isMuted ? "ON" : "OFF"}
                </span>
              </div>
            </button>

            <button
              onClick={handleClose}
              className="rounded-full border border-red-400 bg-red-500 p-4 text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
