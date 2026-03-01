"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Sparkles, X, Activity, Bot, Loader2 } from "lucide-react";
import { UltravoxSession, UltravoxSessionStatus, Role } from "ultravox-client";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { MISSION_MANIFEST } from "@smartout/ai/missions";
import type { MissionId } from "@smartout/ai/missions";

interface VoiceAssistantProps {
  onClose?: () => void;
  autoStart?: boolean;
  missionId?: MissionId;
}

export default function VoiceAssistant({
  onClose,
  autoStart = false,
  missionId = "mr-botsson",
}: VoiceAssistantProps) {
  const [status, setStatus] = useState<UltravoxSessionStatus | "idle">("idle");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const sessionRef = useRef<UltravoxSession | null>(null);
  const posthog = usePostHog();

  const manifest = useMemo(
    () => MISSION_MANIFEST[missionId] ?? MISSION_MANIFEST["mr-botsson"],
    [missionId],
  );

  const startSession = async () => {
    setStatus(UltravoxSessionStatus.CONNECTING);
    try {
      const currentSession = new UltravoxSession();
      sessionRef.current = currentSession;

      currentSession.addEventListener("status", () => {
        if (sessionRef.current === currentSession) {
          setStatus(currentSession.status || "idle");
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
          body: JSON.stringify({ mission_id: missionId }),
        });
        if (res.ok) {
          const data = await res.json();
          joinUrl = data.joinUrl;
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
          toast.error(errorData.error ?? "Kunne ikke starte stemmesesjon");
        }
      } catch (err) {
        console.warn("[VoiceAssistant] Could not fetch joinUrl:", err);
        toast.error("Nettverksfeil ved oppstart av stemmesesjon");
      }

      if (joinUrl && sessionRef.current === currentSession) {
        currentSession.joinCall(joinUrl);
        posthog?.capture("voice_session_started", { mission_id: missionId });
      } else if (!joinUrl && sessionRef.current === currentSession) {
        setStatus("idle");
        setMessages([{ role: "agent", text: manifest.greeting }]);
      }
    } catch (error) {
      console.error("[VoiceAssistant] Failed to start session:", error);
      if (sessionRef.current) setStatus("idle");
    }
  };

  const endSession = () => {
    if (sessionRef.current) {
      sessionRef.current.leaveCall();
      sessionRef.current = null;
      posthog?.capture("voice_session_ended", { mission_id: missionId });
    }
    setStatus("idle");
  };

  const handleClose = () => {
    endSession();
    if (onClose) onClose();
  };

  const toggleMute = () => {
    if (sessionRef.current) {
      if (isMuted) {
        sessionRef.current.unmuteMic();
        setIsMuted(false);
      } else {
        sessionRef.current.muteMic();
        setIsMuted(true);
      }
    }
  };

  useEffect(() => {
    if (autoStart) {
      setTimeout(() => {
        void startSession();
      }, 0);
    }
    return () => {
      endSession();
    };
    // eslint-disable-next-line -- suppress exhaustive-deps: startSession/endSession excluded; only fire on autoStart change
  }, [autoStart]);

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
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Samtalen pågår
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
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
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
            </motion.div>
          ))
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3 border-t border-zinc-800 bg-zinc-900/50 p-4">
        {status === "idle" ? (
          <button
            onClick={startSession}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-400"
          >
            <Mic className="h-5 w-5" /> Starta samtale
          </button>
        ) : (
          <div className="flex w-full items-center justify-center gap-4">
            <button
              onClick={toggleMute}
              className={`rounded-full p-4 transition-all ${isMuted ? "border border-red-500/20 bg-red-500/20 text-red-500 hover:bg-red-500/30" : "border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <div className="flex flex-1 justify-center">
              <div className="flex h-6 items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={i}
                    animate={
                      isConnected && !isMuted
                        ? {
                            height: ["20%", "80%", "40%", "100%", "20%"],
                            opacity: [0.5, 1, 0.5],
                          }
                        : { height: "20%", opacity: 0.3 }
                    }
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      delay: i * 0.1,
                      ease: "easeInOut",
                    }}
                    className="w-1.5 rounded-full bg-orange-500"
                  />
                ))}
              </div>
            </div>

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
