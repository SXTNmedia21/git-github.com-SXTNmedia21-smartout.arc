// ============================================
// VoiceDemoWidget.tsx
// Shared voice demo widget used across all landing variants.
// Wraps the VoiceAssistant component with a themed placeholder,
// open/close state management, and AnimatePresence transitions.
// Connected to: voice-assistant.tsx (voice UI)
//               variant-voice-config.ts (per-variant config)
//               page.tsx + Variant*Landing.tsx (consumers)
// ============================================

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { m, AnimatePresence } from "framer-motion";
import { Mic, ArrowRight } from "lucide-react";
import type { VariantVoiceConfig } from "../../lib/variant-voice-config";
import { ACCENT_COLORS } from "../../lib/variant-voice-config";

const VoiceAssistant = dynamic(() => import("../voice-assistant"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-2xl border border-white/10 bg-[#0a0a0c]/50 backdrop-blur-xl" />
  ),
});

type VoiceDemoWidgetProps = {
  config: VariantVoiceConfig;
  className?: string;
  height?: string;
};

export default function VoiceDemoWidget({ config, className = "", height }: VoiceDemoWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = ACCENT_COLORS[config.accentColor];

  return (
    <div className={`w-full ${className}`}>
      <AnimatePresence mode="wait">
        {isOpen ? (
          <m.div
            key="assistant"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="relative z-50 w-full"
            style={{ height: height ?? "600px" }}
          >
            <VoiceAssistant
              autoStart
              missionId="landing-demo"
              onClose={() => setIsOpen(false)}
              variantContext={{
                variant: config.variant,
                personaName: config.personaName,
                personaRole: config.personaRole,
              }}
            />
          </m.div>
        ) : (
          <m.div
            key="placeholder"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            whileHover={{ scale: 1.015 }}
            className={`group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0c]/50 p-6 text-center shadow-2xl backdrop-blur-xl transition-colors duration-200 sm:p-10 ${colors.borderHover}`}
            style={{ height: height ?? "600px" }}
            onClick={() => setIsOpen(true)}
          >
            {/* Bottom gradient overlay */}
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#050505]/90 to-transparent" />

            {/* Hover glow — faster reveal */}
            <div
              className={`absolute -inset-2 z-0 bg-gradient-to-r from-transparent to-transparent opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 ${colors.glow}`}
            />

            {/* Mic icon — snappier pulse */}
            <m.div
              animate={
                config.usePulse
                  ? {
                      scale: [1, 1.12, 1],
                      boxShadow: [
                        "0 0 0px rgba(255,255,255,0)",
                        "0 0 24px rgba(255,255,255,0.08)",
                        "0 0 0px rgba(255,255,255,0)",
                      ],
                    }
                  : undefined
              }
              transition={
                config.usePulse ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : undefined
              }
              className={`relative z-20 mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/5 bg-white/5 transition-all duration-200 sm:mb-6 sm:h-24 sm:w-24 ${colors.borderHover} ${colors.groupHoverBg}`}
            >
              {config.usePulse && (
                <m.div
                  className={`absolute inset-0 rounded-full border ${colors.border}`}
                  animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <Mic
                className={`h-7 w-7 text-zinc-500 transition-colors duration-150 sm:h-10 sm:w-10 ${colors.groupHoverText}`}
              />
            </m.div>

            {/* Title */}
            <h3 className="relative z-20 mb-1 text-lg font-bold text-white sm:mb-2 sm:text-2xl">
              {config.placeholderTitle}
            </h3>

            {/* Subtitle */}
            {config.placeholderSubtitle && (
              <p className="relative z-20 mb-4 max-w-xs text-sm text-zinc-500 sm:mb-8 sm:text-base">
                {config.placeholderSubtitle}
              </p>
            )}

            {/* Connect button — faster hover response */}
            <m.div
              className="relative z-20 flex items-center gap-2 rounded-full border border-zinc-700/50 bg-zinc-800/80 px-4 py-2 text-xs font-bold text-zinc-400 shadow-xl transition-all duration-150 group-hover:bg-zinc-800 group-hover:text-zinc-300"
              whileHover={{ x: 3 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              Trykk for å koble til{" "}
              <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
