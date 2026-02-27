"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Sparkles, X, Activity, Bot, Loader2 } from "lucide-react";
import { UltravoxSession, UltravoxSessionStatus, Role } from "ultravox-client";
import { usePostHog } from "posthog-js/react";

interface VoiceAssistantProps {
    onClose?: () => void;
    autoStart?: boolean;
}

export default function VoiceAssistant({ onClose, autoStart = false }: VoiceAssistantProps) {
    const [status, setStatus] = useState<UltravoxSessionStatus | "idle">("idle");
    const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const sessionRef = useRef<UltravoxSession | null>(null);
    const posthog = usePostHog();

    // Fallback to start a session since the API route might have been lost in the folder move
    const startSession = async () => {
        setStatus(UltravoxSessionStatus.CONNECTING); // Use as connecting state initially
        try {
            // Create session
            const currentSession = new UltravoxSession();
            sessionRef.current = currentSession;

            // Listeners
            currentSession.addEventListener("status", () => {
                if (sessionRef.current === currentSession) {
                    setStatus(currentSession.status || "idle");
                }
            });

            currentSession.addEventListener("transcripts", () => {
                if (sessionRef.current === currentSession) {
                    const transcripts = currentSession.transcripts;
                    if (transcripts) {
                        const formatted = transcripts.map(t => ({
                            role: t.speaker === Role.USER ? "user" : "agent",
                            text: t.text
                        }));
                        setMessages(formatted);

                        // Capture final transcript segments
                        const lastTranscript = transcripts[transcripts.length - 1];
                        if (lastTranscript && lastTranscript.isFinal) {
                            posthog?.capture("voice_transcript_logged", {
                                role: lastTranscript.speaker === Role.USER ? "user" : "agent",
                                text: lastTranscript.text
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

            // Try fetching a real token if the API route was restored, or fallback
            let joinUrl = "";
            try {
                const res = await fetch("/api/wizard/start", { method: "POST" });
                if (res.ok) {
                    const data = await res.json();
                    joinUrl = data.joinUrl;
                }
            } catch (err) {
                console.warn("Could not fetch Ultravox joinUrl from internal API. Agent will remain in idle mode if no fallback exists.", err);
            }

            if (joinUrl && sessionRef.current === currentSession) {
                currentSession.joinCall(joinUrl);
                posthog?.capture("voice_session_started");
            } else if (!joinUrl && sessionRef.current === currentSession) {
                // UI mock state if API is completely missing
                setStatus("idle");
                setMessages([
                    { role: "agent", text: "Hej, jag är Lise! Tyvärr är min röstanslutning inte konfigurerad just nu, men jag ser fram emot att prata med dig snart." }
                ]);
            }

        } catch (error) {
            console.error("Failed to start Ultravox session:", error);
            if (sessionRef.current) setStatus("idle");
        }
    };

    const endSession = () => {
        if (sessionRef.current) {
            sessionRef.current.leaveCall();
            sessionRef.current = null;
            posthog?.capture("voice_session_ended");
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
            setTimeout(() => { void startSession(); }, 0);
        }
        return () => {
            endSession();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart]);

    const isConnected = ['listening', 'thinking', 'speaking'].includes(status);

    return (
        <div className="flex flex-col h-[600px] w-[350px] bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative shadow-[0_0_50px_rgba(249,115,22,0.15)] pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/60 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isConnected ? "bg-orange-500 text-white" : "bg-zinc-800 text-zinc-400"}`}>
                            <Bot className="w-5 h-5" />
                        </div>
                        {isConnected && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500 border-2 border-zinc-950"></span>
                            </span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Lise Botsson</h3>
                        <p className="text-xs text-zinc-400 flex items-center gap-1">
                            {isConnected ? (
                                <><span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Samtalet pågår</>
                            ) : status === UltravoxSessionStatus.CONNECTING || status === UltravoxSessionStatus.DISCONNECTING ? (
                                <><Loader2 className="w-3 h-3 animate-spin text-orange-500" /> Ansluter...</>
                            ) : (
                                <><span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> Redo att prata</>
                            )}
                        </p>
                    </div>
                </div>

                {onClose && (
                    <button onClick={handleClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Transcript Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4 border border-zinc-800">
                            <Sparkles className="w-8 h-8 text-orange-500/50" />
                        </div>
                        <h4 className="text-zinc-200 font-semibold mb-2">Hej, jag är Lise!</h4>
                        <p className="text-sm text-zinc-400 max-w-xs">
                            Din AI-kollega. Jag kan berätta allt om SmartOuts lokationer, procedurer och säsongsdrift.
                        </p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                    {msg.role === "user" ? "Du" : "Lise"}
                                </span>
                                {msg.role === "agent" && isConnected && idx === messages.length - 1 && (
                                    <Activity className="w-3 h-3 text-orange-500 animate-pulse" />
                                )}
                            </div>
                            <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm ${msg.role === "user" ? "bg-orange-500 text-white rounded-br-none" : "bg-zinc-800 text-zinc-200 rounded-bl-none border border-zinc-700/50"}`}>
                                {msg.text}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Controls */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex flex-col items-center gap-3">

                {status === "idle" ? (
                    <button
                        onClick={startSession}
                        className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/20"
                    >
                        <Mic className="w-5 h-5" /> Starta konversation
                    </button>
                ) : (
                    <div className="flex items-center gap-4 w-full justify-center">
                        <button
                            onClick={toggleMute}
                            className={`p-4 rounded-full transition-all ${isMuted ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/20" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"}`}
                        >
                            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        <div className="flex-1 flex justify-center">
                            <div className="flex gap-1 h-6 items-center">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <motion.div
                                        key={i}
                                        animate={isConnected && !isMuted ? {
                                            height: ["20%", "80%", "40%", "100%", "20%"],
                                            opacity: [0.5, 1, 0.5]
                                        } : { height: "20%", opacity: 0.3 }}
                                        transition={{
                                            repeat: Infinity,
                                            duration: 1.5,
                                            delay: i * 0.1,
                                            ease: "easeInOut"
                                        }}
                                        className="w-1.5 bg-orange-500 rounded-full"
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleClose}
                            className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all border border-red-400"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
