// packages/ui/src/shift-timeline/LifecycleStage.tsx
"use client";

/**
 * LifecycleStage — one stage on the shift timeline.
 *
 * Renders a dot, a label, an optional metric and optional detail/badges.
 * The stage is itself a <button> so it is tab-reachable and can trigger
 * deeper views (open Botsson, open deviation, open sheet). The component
 * NEVER renders user-facing phase copy itself — callers pass it in.
 *
 * Visual state matrix:
 *   active     → primary/10 inner + primary/40 ring; label foreground
 *   completed  → muted foreground; icon primary/60
 *   upcoming   → dashed border; extra-muted label
 *   skipped    → upcoming + strikethrough
 *
 * Deviation/blocking adds a small amber/destructive dot on the indicator.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Check, Circle } from "lucide-react";
import { cn } from "../lib/utils";
import type { ShiftPhase, StageOrientation, StageState } from "./types";

export type LifecycleStageProps = {
  phase: ShiftPhase;
  state: StageState;
  /** Stage label — always i18n-resolved copy, never a DB key. */
  label: string;
  timestamp?: string;
  metric?: string;
  detail?: React.ReactNode;
  hasDeviation?: boolean;
  hasBlockingDeviation?: boolean;
  onClick?: () => void;
  orientation?: StageOrientation;
  reducedMotion?: boolean;
  icon?: LucideIcon;
  ariaCurrent?: "step" | false;
  className?: string;
};

const SPRING = { type: "spring", stiffness: 35, damping: 22, mass: 2.2 } as const;

export function LifecycleStage({
  phase,
  state,
  label,
  timestamp,
  metric,
  detail,
  hasDeviation,
  hasBlockingDeviation,
  onClick,
  orientation = "vertical",
  reducedMotion,
  icon: Icon,
  ariaCurrent,
  className,
}: LifecycleStageProps) {
  const prefersReduced = useReducedMotion();
  const still = reducedMotion ?? prefersReduced ?? false;

  const isActive = state === "active";
  const isCompleted = state === "completed";
  const isSkipped = state === "skipped";

  const dot = (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-full",
        isActive && "bg-primary/10 ring-primary/40 ring-1",
        isCompleted && "bg-transparent",
        !isActive && !isCompleted && "border-border/60 border border-dashed",
      )}
    >
      {isCompleted ? (
        <Check aria-hidden className="text-primary/60 h-4 w-4" />
      ) : Icon ? (
        <Icon
          aria-hidden
          className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground/70")}
        />
      ) : (
        <Circle
          aria-hidden
          className={cn("h-3 w-3", isActive ? "text-primary" : "text-muted-foreground/70")}
        />
      )}
      {(hasDeviation || hasBlockingDeviation) && (
        <span
          aria-hidden
          className={cn(
            "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full",
            hasBlockingDeviation ? "bg-destructive animate-pulse" : "",
          )}
          // Amber dot for non-blocking deviations — inline oklch so we
          // don't need a new CSS variable for a single use.
          style={hasBlockingDeviation ? undefined : { backgroundColor: "oklch(0.75 0.15 55)" }}
        />
      )}
    </span>
  );

  const body = (
    <div
      className={cn(
        "flex",
        orientation === "vertical"
          ? "flex-row items-start gap-3 text-left"
          : "flex-col items-center gap-2 text-center",
      )}
    >
      <motion.div layout={!still} transition={still ? { duration: 0 } : SPRING}>
        {dot}
      </motion.div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div
          className={cn(
            "text-sm font-medium",
            isActive && "text-foreground",
            isCompleted && "text-muted-foreground",
            !isActive && !isCompleted && "text-muted-foreground/70",
            isSkipped && "line-through",
          )}
        >
          {label}
        </div>
        {timestamp && (
          <div className="text-muted-foreground/80 font-mono text-xs tabular-nums">{timestamp}</div>
        )}
        {metric && (
          <div
            className={cn(
              "font-mono text-lg tabular-nums",
              isActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {metric}
          </div>
        )}
        {detail && <div className="text-muted-foreground text-xs">{detail}</div>}
      </div>
    </div>
  );

  // Stage is always a button so keyboard/screen-reader users can jump to
  // deeper views. If there's no onClick we disable it — still focusable
  // if explicitly tabbed? No: disabled buttons are skipped, which is what
  // we want for pure-display timelines.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-current={ariaCurrent || undefined}
      aria-label={label}
      data-phase={phase}
      data-state={state}
      className={cn(
        "relative block w-full rounded-md px-2 py-2 text-left",
        "transition-colors duration-150",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        onClick && "hover:bg-muted/40 cursor-pointer",
        !onClick && "cursor-default",
        "disabled:opacity-100", // don't dim display-only stages
        className,
      )}
    >
      {body}
    </button>
  );
}
