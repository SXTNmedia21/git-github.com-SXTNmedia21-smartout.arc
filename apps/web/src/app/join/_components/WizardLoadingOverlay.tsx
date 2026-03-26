"use client";

/**
 * WizardLoadingOverlay — fullscreen-ish loading state shown between steps
 * when AI is working (BRREG lookup, scraping, enrichment, generation).
 *
 * Uses the warm brand color with pulsing dots and a rotating message.
 * Renders inside the step area, replacing the form until data is ready.
 */

import { useEffect, useState } from "react";

interface WizardLoadingOverlayProps {
  messages: string[];
  rotateInterval?: number;
}

export function WizardLoadingOverlay({
  messages,
  rotateInterval = 3000,
}: WizardLoadingOverlayProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, rotateInterval);
    return () => clearInterval(timer);
  }, [messages.length, rotateInterval]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center py-24">
      {/* Pulsing orbs */}
      <div className="relative mb-8 flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: 10,
              height: 10,
              background: "var(--brand, #f97316)",
              opacity: 0.3,
              animation: `wizardPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Rotating message */}
      <p
        className="text-center text-sm font-medium transition-opacity duration-500"
        style={{ color: "var(--fg, oklch(0.15 0.01 50))" }}
        key={index}
      >
        {messages[index]}
      </p>

      <p className="mt-2 text-center text-xs" style={{ color: "var(--fgm, oklch(0.52 0.01 52))" }}>
        Dette tar vanligvis noen sekunder
      </p>

      <style>{`
        @keyframes wizardPulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}
