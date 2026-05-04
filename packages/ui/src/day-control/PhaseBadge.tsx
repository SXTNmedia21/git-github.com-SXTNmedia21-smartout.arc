import { cn } from "../lib/utils";
import type { UiPhase } from "./types";
import { PHASE_STYLES } from "./phase-styles";

/**
 * PhaseBadge (web) — pill-shaped indicator of the UI phase.
 * Pulse dot animates on `active` (motion-safe gate respects prefers-reduced-motion).
 *
 * ADR-0158 dual-platform: this `.tsx` ships for web. The `.native.tsx` sibling
 * renders the same contract via React Native primitives. Style metadata comes
 * from shared `./phase-styles.ts` (label, tone, pulse) to keep the two
 * variants in lock-step.
 */
export function PhaseBadge({
  phase,
  size = "md",
  className,
}: {
  phase: UiPhase;
  size?: "sm" | "md";
  className?: string;
}) {
  const style = PHASE_STYLES[phase] ?? PHASE_STYLES.upcoming;
  const padding = size === "sm" ? "px-2 py-[3px]" : "px-2.5 py-1";
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium tracking-[0.06em] uppercase",
        padding,
        textSize,
        style.bgClass,
        style.textClass,
        className,
      )}
      aria-label={`Status: ${style.label}`}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          style.dotClass,
          // Only the dot pulses — text stays crisp (Gate 2 designer fix).
          // motion-safe gate respects prefers-reduced-motion.
          style.pulse && "motion-safe:animate-pulse",
        )}
      />
      {style.label}
    </span>
  );
}
