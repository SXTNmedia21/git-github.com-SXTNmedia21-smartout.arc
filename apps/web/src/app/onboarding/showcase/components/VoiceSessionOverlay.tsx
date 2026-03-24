"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, Mic, MicOff } from "lucide-react";
import { useOnboarding } from "../WizardContext";

/** Animated bars — larger version for centered overlay */
function LargeVoiceVisualizer({
  isSpeaking,
  isConnected,
}: {
  isSpeaking: boolean;
  isConnected: boolean;
}) {
  const barCount = 7;

  return (
    <div className="flex items-center justify-center gap-[5px]">
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[5px] rounded-full bg-white/70"
          animate={
            isSpeaking
              ? {
                  height: [8, 40 + i * 5, 12, 50 + i * 4, 8],
                  opacity: [0.5, 0.9, 0.6, 1, 0.5],
                }
              : isConnected
                ? {
                    height: [6, 16, 6],
                    opacity: [0.2, 0.4, 0.2],
                  }
                : {
                    height: 6,
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

export function VoiceSessionOverlay() {
  const { botsson, completeSection } = useOnboarding();
  const { isConnected, isSpeaking, isMuted, currentText, toggleMic } = botsson;

  return (
    <AnimatePresence>
      <motion.div
        key="voice-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="flex flex-col items-center gap-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <AnimatePresence mode="wait">
            {/* Connecting state */}
            {!isConnected && (
              <motion.div
                key="connecting"
                className="flex flex-col items-center gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Large avatar circle with breathing animation */}
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-white/20"
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <motion.div
                    className="absolute -inset-3 rounded-full border border-white/10"
                    animate={{
                      scale: [1, 1.08, 1],
                      opacity: [0.1, 0.25, 0.1],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                    <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                  </div>
                </div>

                <p className="text-lg text-white/50">Kobler til Botsson...</p>
              </motion.div>
            )}

            {/* Connected state */}
            {isConnected && (
              <motion.div
                key="connected"
                className="flex flex-col items-center gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Voice visualizer with breathing ring */}
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-white/20"
                    animate={
                      isSpeaking
                        ? {
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.6, 0.3],
                          }
                        : {
                            scale: [1, 1.05, 1],
                            opacity: [0.1, 0.2, 0.1],
                          }
                    }
                    transition={{
                      duration: isSpeaking ? 0.8 : 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  {isSpeaking && (
                    <motion.div
                      className="absolute -inset-4 rounded-full border border-white/10"
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
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                    <LargeVoiceVisualizer isSpeaking={isSpeaking} isConnected={isConnected} />
                  </div>
                </div>

                {/* Speech bubble */}
                {currentText && (
                  <motion.div
                    key={currentText}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4 text-center text-base leading-relaxed text-white/80"
                  >
                    {currentText}
                  </motion.div>
                )}

                {/* Controls row */}
                <motion.div
                  className="flex items-center gap-4"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {/* Mic toggle */}
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all ${
                      isMuted
                        ? "border-destructive/30 bg-destructive/20 text-destructive"
                        : "border-white/10 bg-white/[0.05] text-white/60 hover:text-white/80"
                    }`}
                  >
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>

                  {/* Continue button */}
                  <button
                    type="button"
                    onClick={() => completeSection("hero")}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-6 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/[0.08] hover:text-white/80"
                  >
                    Fortsett
                    <ArrowRight size={16} />
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
