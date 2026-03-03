"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bot, Mic, MicOff, Loader2, Info } from "lucide-react";
import type { UltravoxSessionStatus } from "ultravox-client";

interface BotssonAvatarProps {
  status: UltravoxSessionStatus | "idle";
  isConnected: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  currentText: string;
  onToggleMic: () => void;
  onStart: () => void;
  onEnd: () => void;
  onShowCard?: () => void;
}

/** Animated bars that visualize voice activity */
function VoiceVisualizer({
  isSpeaking,
  isConnected,
}: {
  isSpeaking: boolean;
  isConnected: boolean;
}) {
  const barCount = 5;

  return (
    <div className="flex items-center justify-center gap-[3px]">
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-white/70"
          animate={
            isSpeaking
              ? {
                  height: [4, 14 + Math.random() * 10, 6, 18 + Math.random() * 6, 4],
                  opacity: [0.5, 0.9, 0.6, 1, 0.5],
                }
              : isConnected
                ? {
                    height: [3, 6, 3],
                    opacity: [0.2, 0.4, 0.2],
                  }
                : {
                    height: 3,
                    opacity: 0.15,
                  }
          }
          transition={{
            duration: isSpeaking ? 0.6 + i * 0.08 : 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.07,
          }}
        />
      ))}
    </div>
  );
}

export function BotssonAvatar({
  status,
  isConnected,
  isSpeaking,
  isMuted,
  currentText,
  onToggleMic,
  onStart,
  onEnd,
  onShowCard,
}: BotssonAvatarProps) {
  const isConnecting = status === "connecting" || status === "disconnecting";

  return (
    <motion.div
      className="fixed right-8 bottom-8 z-50 flex cursor-grab items-end gap-3 active:cursor-grabbing"
      drag
      dragMomentum={false}
      dragElastic={0.1}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.6 }}
    >
      <AnimatePresence mode="wait">
        {/* Idle: gentle hint — first click anywhere starts the session */}
        {status === "idle" && (
          <motion.div
            key="idle-hint"
            initial={{ opacity: 0, scale: 0.8, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 10 }}
            className="mb-2 max-w-[240px] rounded-2xl rounded-br-sm border border-white/[0.06] bg-black/60 px-4 py-3 text-sm leading-relaxed text-white/40 shadow-2xl backdrop-blur-xl"
          >
            Lise er klar
          </motion.div>
        )}

        {/* Connecting: loading state */}
        {isConnecting && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0, scale: 0.8, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mb-2 flex items-center gap-2 rounded-2xl rounded-br-sm border border-white/10 bg-black/80 px-4 py-3 text-sm text-white/60 shadow-2xl backdrop-blur-xl"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Kobler til...
          </motion.div>
        )}

        {/* Connected: show speech bubble with latest text */}
        {isConnected && currentText && (
          <motion.div
            key="speech-bubble"
            initial={{ opacity: 0, scale: 0.8, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mb-2 max-w-[280px] rounded-2xl rounded-br-sm border border-white/10 bg-black/80 px-4 py-3 text-sm leading-relaxed text-white/80 shadow-2xl backdrop-blur-xl"
          >
            {currentText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar + controls */}
      <div className="flex flex-col items-center gap-2">
        {/* Info button — show when connected or idle */}
        {(isConnected || status === "idle") && onShowCard && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onShowCard}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/60 transition-all hover:text-white/80"
          >
            <Info size={14} />
          </motion.button>
        )}

        {/* Mic toggle — only show when connected */}
        {isConnected && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onToggleMic}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
              isMuted
                ? "border-red-500/30 bg-red-500/20 text-red-400"
                : "border-white/10 bg-black/40 text-white/60 hover:text-white/80"
            }`}
          >
            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </motion.button>
        )}

        {/* Main avatar — grows when connected to show visualizer */}
        <button
          onClick={status === "idle" ? onStart : isConnected ? onEnd : undefined}
          className={`group relative flex items-center justify-center rounded-full border border-white/10 shadow-2xl backdrop-blur-xl transition-all hover:border-white/20 hover:bg-black/80 ${
            isConnected ? "h-16 w-16 bg-black/70" : "h-14 w-14 bg-black/60"
          }`}
        >
          {/* Breathing ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-white/20"
            animate={
              isSpeaking
                ? {
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }
                : isConnected
                  ? {
                      scale: [1, 1.05, 1],
                      opacity: [0.1, 0.2, 0.1],
                    }
                  : {
                      scale: 1,
                      opacity: 0.1,
                    }
            }
            transition={{
              duration: isSpeaking ? 0.8 : 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Outer glow when speaking */}
          {isSpeaking && (
            <motion.div
              className="absolute -inset-2 rounded-full border border-white/10"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.1, 0.3, 0.1],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}

          {isConnecting ? (
            <Loader2 size={24} className="animate-spin text-white/60" />
          ) : isConnected ? (
            <VoiceVisualizer isSpeaking={isSpeaking} isConnected={isConnected} />
          ) : (
            <Bot size={24} className="text-white/80" />
          )}

          {/* Connection status indicator */}
          <div className="absolute -top-1 -right-1">
            {isConnected ? (
              <span className="flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            )}
          </div>
        </button>
      </div>
    </motion.div>
  );
}
