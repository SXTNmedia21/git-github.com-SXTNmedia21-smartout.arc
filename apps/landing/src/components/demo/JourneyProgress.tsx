// ============================================
// JourneyProgress.tsx
// Horizontal step indicator for the guided demo.
// Shows numbered dots at the top of the journey shell
// with the current step highlighted in orange.
// Connected to: DemoShell.tsx (parent)
// ============================================

"use client";

import { m } from "framer-motion";
import type { JourneyPersona } from "./journeys/types";

/** Map persona keys to Norwegian display labels */
const PERSONA_LABELS: Record<JourneyPersona, string> = {
  ansatt: "Ansatt",
  leder: "Leder",
  "ny-ansatt": "Ny ansatt",
};

/** Map persona keys to badge color classes */
const PERSONA_COLORS: Record<JourneyPersona, string> = {
  ansatt: "border-brand-orange/30 bg-brand-orange/10 text-brand-orange",
  leder: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  "ny-ansatt": "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

type JourneyProgressProps = {
  /** Journey title displayed next to the persona badge */
  title: string;
  /** Persona shown as a colored badge */
  persona: JourneyPersona;
  /** Total number of steps in the journey */
  totalSteps: number;
  /** Zero-based index of the current step */
  currentStep: number;
};

/**
 * Renders the journey title, persona badge, and step dots.
 *
 * Why dots instead of a progress bar: dots give a clearer
 * sense of how many discrete steps remain, which matters
 * for a scripted demo where each step is a distinct action.
 */
export function JourneyProgress({ title, persona, totalSteps, currentStep }: JourneyProgressProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: title + persona badge */}
      <div className="flex items-center gap-3">
        <h1 className="text-foreground text-lg font-bold">{title}</h1>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${PERSONA_COLORS[persona]}`}
        >
          {PERSONA_LABELS[persona]}
        </span>
      </div>

      {/* Right: step dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => {
          const isActive = i === currentStep;
          const isCompleted = i < currentStep;

          return (
            <m.div
              key={i}
              className={`rounded-full transition-colors ${
                isActive
                  ? "bg-brand-orange h-2.5 w-2.5 shadow-[0_0_8px_rgba(249,115,22,0.4)]"
                  : isCompleted
                    ? "bg-muted-foreground h-2 w-2"
                    : "bg-muted h-2 w-2"
              }`}
              animate={isActive ? { scale: [1, 1.2, 1] } : {}}
              transition={isActive ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
            />
          );
        })}
        <span className="text-muted-foreground ml-2 text-xs">
          {currentStep + 1} / {totalSteps}
        </span>
      </div>
    </div>
  );
}
