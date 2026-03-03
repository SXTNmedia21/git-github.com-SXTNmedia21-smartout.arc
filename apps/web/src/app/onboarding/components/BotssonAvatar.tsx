"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bot, Volume2, VolumeX } from "lucide-react";

interface BotssonAvatarProps {
  isSpeaking: boolean;
  isEnabled: boolean;
  isUnlocked: boolean;
  currentText: string;
  onToggle: () => void;
  onUnlock: () => void;
}

export function BotssonAvatar({
  isSpeaking,
  isEnabled,
  isUnlocked,
  currentText,
  onToggle,
  onUnlock,
}: BotssonAvatarProps) {
  return (
    <motion.div
      className="fixed right-8 bottom-8 z-50 flex items-end gap-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.6 }}
    >
      <AnimatePresence mode="wait">
        {/* Before unlock: prompt to enable voice */}
        {!isUnlocked && (
          <motion.button
            key="unlock-prompt"
            onClick={onUnlock}
            initial={{ opacity: 0, scale: 0.8, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 10 }}
            className="mb-2 max-w-[280px] cursor-pointer rounded-2xl rounded-br-sm border border-white/10 bg-black/80 px-4 py-3 text-left text-sm leading-relaxed text-white/80 shadow-2xl backdrop-blur-xl transition-colors hover:border-white/20"
          >
            <span className="text-white/50">Trykk for å aktivere stemme</span>
            {currentText && <span className="mt-1 block text-white/70">{currentText}</span>}
          </motion.button>
        )}

        {/* After unlock: show speech bubble when speaking */}
        {isUnlocked && isSpeaking && currentText && (
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

      {/* Avatar button */}
      <button
        onClick={isUnlocked ? onToggle : onUnlock}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl transition-all hover:border-white/20 hover:bg-black/80"
      >
        {/* Breathing ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-white/20"
          animate={
            isSpeaking
              ? {
                  scale: [1, 1.15, 1],
                  opacity: [0.3, 0.6, 0.3],
                }
              : {
                  scale: [1, 1.05, 1],
                  opacity: [0.1, 0.2, 0.1],
                }
          }
          transition={{
            duration: isSpeaking ? 1 : 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <Bot size={24} className="text-white/80" />

        {/* Status indicator */}
        <div className="absolute -top-1 -right-1">
          {isEnabled ? (
            <Volume2 size={12} className="text-emerald-400" />
          ) : (
            <VolumeX size={12} className="text-white/40" />
          )}
        </div>
      </button>
    </motion.div>
  );
}
