import { cn } from "@smartout/ui";
import type { UiPhase } from "./types";

/**
 * PhaseBadge — pill-shaped indicator of the UI phase (derived via derivePhase).
 * Pulse dot animates on `active`.
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
  const style = PHASE_STYLES[phase];
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

export const PHASE_STYLES: Record<
  UiPhase,
  {
    label: string;
    bgClass: string;
    textClass: string;
    dotClass: string;
    pulse?: boolean;
  }
> = {
  upcoming: {
    label: "Starter snart",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  active: {
    label: "Pågår",
    bgClass: "bg-[color:color-mix(in_oklch,var(--success)_12%,transparent)]",
    textClass: "text-[color:var(--success)]",
    dotClass: "bg-[color:var(--success)]",
    pulse: true,
  },
  pending_signoff: {
    label: "Venter på oppgjør",
    bgClass: "bg-[color:color-mix(in_oklch,var(--warning)_14%,transparent)]",
    textClass: "text-[color:var(--warning)]",
    dotClass: "bg-[color:var(--warning)]",
  },
  closed: {
    label: "Stengt",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  missed: {
    label: "Ikke åpnet",
    bgClass: "bg-[color:color-mix(in_oklch,var(--destructive)_12%,transparent)]",
    textClass: "text-[color:var(--destructive)]",
    dotClass: "bg-[color:var(--destructive)]",
  },
  locked: {
    label: "Låst",
    bgClass: "bg-[color:color-mix(in_oklch,var(--brand-orange)_12%,transparent)]",
    textClass: "text-[color:var(--brand-orange)]",
    dotClass: "bg-[color:var(--brand-orange)]",
  },
};
