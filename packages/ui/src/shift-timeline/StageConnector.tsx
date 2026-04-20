// packages/ui/src/shift-timeline/StageConnector.tsx
"use client";

/**
 * StageConnector — the thin line between two stages.
 *
 * Three visual states:
 *   completed → completed  : solid primary/40
 *   completed → active     : gradient fill with a 700ms reveal (progress feel)
 *   anything else          : dashed border/50
 *
 * Purely decorative: rendered with aria-hidden so screen readers skip it.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../lib/utils";
import type { StageOrientation, StageState } from "./types";

export type StageConnectorProps = {
  fromState: StageState;
  toState: StageState;
  orientation?: StageOrientation;
  reducedMotion?: boolean;
  className?: string;
};

export function StageConnector({
  fromState,
  toState,
  orientation = "vertical",
  reducedMotion,
  className,
}: StageConnectorProps) {
  const prefersReduced = useReducedMotion();
  const still = reducedMotion ?? prefersReduced ?? false;

  const isSolid = fromState === "completed" && toState === "completed";
  const isProgressing = fromState === "completed" && toState === "active";

  const base = orientation === "vertical" ? "mx-auto h-8 w-px" : "my-auto h-px w-12";

  if (isProgressing) {
    // Gradient progress fill — reveals on mount unless reduced-motion.
    const gradient =
      orientation === "vertical"
        ? "linear-gradient(to bottom, oklch(var(--primary) / 0.4), oklch(var(--primary) / 0.1))"
        : "linear-gradient(to right, oklch(var(--primary) / 0.4), oklch(var(--primary) / 0.1))";
    return (
      <motion.div
        aria-hidden
        className={cn(base, className)}
        style={{ background: gradient }}
        initial={still ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: still ? 0 : 0.7 }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        base,
        isSolid
          ? orientation === "vertical"
            ? "bg-primary/40"
            : "bg-primary/40"
          : orientation === "vertical"
            ? "border-border/50 w-0 border-l border-dashed bg-transparent"
            : "border-border/50 h-0 border-t border-dashed bg-transparent",
        className,
      )}
    />
  );
}
