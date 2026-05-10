"use client";

// ============================================
// voice-assistant.tsx
// ADR-0282 Phase F0 T1: Ultravox removed from landing.
// Landing wizard is text-only. Web wizard (smartout.ai/onboarding) is the
// sole voice surface. This component is retained as a named export so
// existing import sites compile without change; it renders a redirect CTA.
// ============================================

import { ExternalLink, Mic } from "lucide-react";

interface VoiceAssistantProps {
  onClose?: () => void;
  /** Unused after ADR-0282 Phase F0 — kept for API compatibility. */
  autoStart?: boolean;
  /** Unused after ADR-0282 Phase F0 — kept for API compatibility. */
  missionId?: string;
  /** Unused after ADR-0282 Phase F0 — kept for API compatibility. */
  useEngine?: boolean;
  /** Unused after ADR-0282 Phase F0 — kept for API compatibility. */
  variantContext?: {
    variant: string;
    personaName: string;
    personaRole: string;
  };
}

export default function VoiceAssistant({ onClose }: VoiceAssistantProps) {
  return (
    <div className="border-border bg-background/80 relative flex h-full flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border p-8 text-center shadow-2xl backdrop-blur-xl">
      <div className="border-border bg-muted flex h-16 w-16 items-center justify-center rounded-full border">
        <Mic className="text-muted-foreground h-8 w-8" />
      </div>

      <div className="space-y-2">
        <h3 className="text-foreground text-lg font-bold">Stemmefunksjon ikke tilgjengelig her</h3>
        <p className="text-muted-foreground max-w-xs text-sm">
          Snakk med oss — bruk vår fulle wizard på <strong>smartout.ai/onboarding</strong> for
          stemme og chat.
        </p>
      </div>

      <a
        href="https://smartout.ai/onboarding"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-brand-orange text-foreground hover:bg-brand-orange-light flex items-center gap-2 rounded-xl px-6 py-3 font-bold shadow-lg transition-all"
      >
        <ExternalLink className="h-4 w-4" />
        Gå til fullstendig wizard
      </a>

      {onClose && (
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-2 transition-colors hover:underline"
        >
          Lukk
        </button>
      )}
    </div>
  );
}
