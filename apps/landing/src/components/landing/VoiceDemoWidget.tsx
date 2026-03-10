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

/**
 * Dynamically import VoiceAssistant to avoid SSR issues with
 * the Ultravox client SDK (uses browser-only WebRTC APIs).
 */
const VoiceAssistant = dynamic(() => import("../voice-assistant"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-2xl border border-white/10 bg-[#0a0a0c]/50 backdrop-blur-xl" />
  ),
});

type VoiceDemoWidgetProps = {
  config: VariantVoiceConfig;
  className?: string;
  /** Height of the widget container. Defaults to 600px on desktop. */
  height?: string;
};

/**
 * Reusable voice demo widget with variant-aware theming.
 *
 * Renders either a themed placeholder card (closed state) or the
 * full VoiceAssistant component (open state). The placeholder
 * adapts its accent color, copy, and pulse animation based on
 * the variant config.
 *
 * Why: Extracts ~150 lines of duplicated voice widget code from
 * page.tsx into a single component that all 7 variants can use.
 *
 * @param config - Per-variant voice configuration from VARIANT_VOICE_CONFIG
 * @param className - Additional CSS classes for the outer wrapper
 * @param height - Container height (default "600px")
 * @returns The voice demo widget with open/close transitions
 */
export default function VoiceDemoWidget({ config, className = "", height }: VoiceDemoWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = ACCENT_COLORS[config.accentColor];

  return (
    <div className={`w-full ${className}`}>
      <AnimatePresence mode="wait">
        {isOpen ? (
          <m.div
            key="assistant"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0c]/50 p-6 text-center shadow-2xl backdrop-blur-xl transition-colors sm:p-10 ${colors.borderHover}`}
            style={{ height: height ?? "600px" }}
            onClick={() => setIsOpen(true)}
          >
            {/* Bottom gradient overlay */}
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#050505]/90 to-transparent" />

            {/* Hover glow */}
            <div
              className={`absolute -inset-2 z-0 bg-gradient-to-r from-transparent to-transparent opacity-0 blur-2xl transition-opacity duration-1000 group-hover:opacity-100 ${colors.glow}`}
            />

            {/* Mic icon with optional pulse */}
            <m.div
              animate={
                config.usePulse
                  ? {
                      scale: [1, 1.05, 1],
                      boxShadow: [
                        "0 0 0px rgba(255,255,255,0)",
                        "0 0 20px rgba(255,255,255,0.05)",
                        "0 0 0px rgba(255,255,255,0)",
                      ],
                    }
                  : undefined
              }
              transition={
                config.usePulse ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : undefined
              }
              className={`relative z-20 mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/5 bg-white/5 transition-colors sm:mb-6 sm:h-24 sm:w-24 ${colors.borderHover} ${colors.groupHoverBg}`}
            >
              {config.usePulse && (
                <div
                  className={`absolute inset-0 rounded-full border opacity-0 group-hover:animate-ping group-hover:opacity-100 ${colors.border}`}
                />
              )}
              <Mic
                className={`h-7 w-7 text-zinc-500 transition-colors sm:h-10 sm:w-10 ${colors.groupHoverText}`}
              />
            </m.div>

            {/* Title */}
            <h3 className="relative z-20 mb-1 text-lg font-bold text-white sm:mb-2 sm:text-2xl">
              {config.placeholderTitle}
            </h3>

            {/* Subtitle — hidden for variants with empty subtitle */}
            {config.placeholderSubtitle && (
              <p className="relative z-20 mb-4 max-w-xs text-sm text-zinc-500 sm:mb-8 sm:text-base">
                {config.placeholderSubtitle}
              </p>
            )}

            {/* Connect button */}
            <div className="relative z-20 flex items-center gap-2 rounded-full border border-zinc-700/50 bg-zinc-800/80 px-4 py-2 text-xs font-bold text-zinc-400 shadow-xl transition-colors group-hover:bg-zinc-800 group-hover:text-zinc-300">
              Trykk for å koble til <ArrowRight className="h-3 w-3" />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
