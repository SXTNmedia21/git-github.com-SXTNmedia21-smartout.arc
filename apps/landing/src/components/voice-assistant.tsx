"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { m } from "framer-motion";
import { Mic, MicOff, Sparkles, X, Activity, Bot, Loader2 } from "lucide-react";
import { UltravoxSession, UltravoxSessionStatus, Role } from "ultravox-client";
import { MISSION_MANIFEST } from "@smartout/ai/missions";
import type { MissionId } from "@smartout/ai/missions";

interface VoiceAssistantProps {
  onClose?: () => void;
  autoStart?: boolean;
  missionId?: MissionId;
  /** When true, route through the Stage Engine instead of direct Ultravox. */
  useEngine?: boolean;
  /** Per-variant context passed to the API so Lise adapts her tone. */
  variantContext?: {
    variant: string;
    personaName: string;
    personaRole: string;
  };
}

export default function VoiceAssistant({
  onClose,
  autoStart = false,
  missionId = "landing-demo",
  useEngine = false,
  variantContext,
}: VoiceAssistantProps) {
  const [status, setStatus] = useState<UltravoxSessionStatus | "idle">("idle");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const sessionRef = useRef<UltravoxSession | null>(null);

  const manifest = useMemo(
    () => MISSION_MANIFEST[missionId] ?? MISSION_MANIFEST["landing-demo"],
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
        const apiEndpoint = useEngine ? "/api/wizard/engine-start" : "/api/wizard/start";

        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mission_id: missionId,
            template_context: variantContext ?? undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          joinUrl = data.joinUrl;
        }
      } catch (err) {
        console.warn("[VoiceAssistant] Could not fetch joinUrl:", err);
      }

      if (joinUrl && sessionRef.current === currentSession) {
        currentSession.joinCall(joinUrl);
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
    if (!autoStart) return;
    const timer = setTimeout(() => void startSession(), 0);
    return () => {
      clearTimeout(timer);
      endSession();
    };
    // eslint-disable-next-line -- suppress exhaustive-deps: only fire on autoStart change
  }, [autoStart]);

  const isConnected = ["listening", "thinking", "speaking"].includes(status);

  return (
    <div className="border-border bg-background/80 relative flex h-full flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="border-border/60 bg-muted flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isConnected ? "bg-brand-orange text-foreground" : "bg-muted text-muted-foreground"}`}
            >
              <Bot className="h-5 w-5" />
            </div>
            {isConnected && (
              <span className="absolute -right-0.5 -bottom-0.5 flex h-3 w-3">
                <span className="bg-brand-orange absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                <span className="border-background bg-brand-orange relative inline-flex h-3 w-3 rounded-full border-2"></span>
              </span>
            )}
          </div>
          <div>
            <h3 className="text-foreground text-sm font-bold">{manifest.agentDisplayName}</h3>
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              {isConnected ? (
                <>
                  <span className="bg-brand-orange h-1.5 w-1.5 rounded-full" /> Samtalen pågår
                </>
              ) : status === UltravoxSessionStatus.CONNECTING ||
                status === UltravoxSessionStatus.DISCONNECTING ? (
                <>
                  <Loader2 className="text-brand-orange h-3 w-3 animate-spin" /> Kobler til...
                </>
              ) : (
                <>
                  <span className="bg-muted-foreground/70 h-1.5 w-1.5 rounded-full" />{" "}
                  {manifest.uiDescription}
                </>
              )}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Transcript Area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="border-border bg-background mb-4 flex h-16 w-16 items-center justify-center rounded-full border">
              <Sparkles className="text-brand-orange/50 h-8 w-8" />
            </div>
            <h4 className="text-foreground mb-2 font-semibold">
              Hei, jeg er {manifest.agentDisplayName}!
            </h4>
            <p className="text-muted-foreground max-w-xs text-sm">{manifest.uiDescription}</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <m.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  {msg.role === "user" ? "Du" : manifest.agentDisplayName}
                </span>
                {msg.role === "agent" && isConnected && idx === messages.length - 1 && (
                  <Activity className="text-brand-orange h-3 w-3 animate-pulse" />
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-brand-orange text-foreground rounded-br-none" : "border-border/50 bg-muted text-foreground rounded-bl-none border"}`}
              >
                {msg.text}
              </div>
            </m.div>
          ))
        )}
      </div>

      {/* Controls */}
      <div className="border-border bg-muted flex flex-col items-center gap-3 border-t p-4">
        {status === "idle" ? (
          <button
            onClick={startSession}
            className="bg-brand-orange text-foreground shadow-brand-orange/20 hover:bg-brand-orange-light flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold shadow-lg transition-all"
          >
            <Mic className="h-5 w-5" /> Start samtale
          </button>
        ) : (
          <div className="flex w-full items-center justify-center gap-4">
            <button
              onClick={toggleMute}
              className={`rounded-full p-4 transition-all ${isMuted ? "border border-red-500/20 bg-red-500/20 text-red-500 hover:bg-red-500/30" : "border-border bg-muted text-foreground hover:bg-muted border"}`}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <div className="flex flex-1 justify-center">
              <div className="flex h-6 items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <m.div
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
                    className="bg-brand-orange w-1.5 rounded-full"
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleClose}
              className="text-foreground rounded-full border border-red-400 bg-red-500 p-4 shadow-lg shadow-red-500/20 transition-all hover:bg-red-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
