// packages/ui/src/shift-timeline/ActiveOrb.tsx
"use client";

/**
 * ActiveOrb — the warm focal glow that marks "this is where you are".
 *
 * Built from two layered radial gradients (NOT CSS blur) so it reads
 * crisp on every background. The orb shares a Framer `layoutId` so it
 * can drift between stages with a lava-lamp spring when the phase
 * advances — but only if the user hasn't opted out of motion.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../lib/utils";

const SIZE_PX = {
  sm: 160,
  md: 240,
  lg: 360,
} as const;

export type ActiveOrbSize = keyof typeof SIZE_PX;

export type ActiveOrbProps = {
  /** Phase this orb is anchored to — used only for `layoutId` stability. */
  anchorPhase: string;
  size?: ActiveOrbSize;
  /**
   * `calm` = normal state. `attention` shifts hue warmer and pulses subtly
   * — reserved for blocking deviations on the active stage.
   */
  intensity?: "calm" | "attention";
  /** Override Framer's reduced-motion detection (tests, Storybook). */
  reducedMotion?: boolean;
  className?: string;
};

const SPRING = { type: "spring", stiffness: 35, damping: 22, mass: 2.2 } as const;

export function ActiveOrb({
  anchorPhase,
  size = "md",
  intensity = "calm",
  reducedMotion,
  className,
}: ActiveOrbProps) {
  const prefersReduced = useReducedMotion();
  const still = reducedMotion ?? prefersReduced ?? false;

  const px = SIZE_PX[size];
  // Attention shifts hue from 50 → 35 (warmer, more urgent) per plan §1.3.
  const baseHue = intensity === "attention" ? 35 : 50;
  const highlightHue = intensity === "attention" ? 40 : 55;

  const background = [
    `radial-gradient(ellipse at center, oklch(0.70 0.14 ${baseHue} / 0.45), transparent 60%)`,
    `radial-gradient(circle at 30% 30%, oklch(0.85 0.08 ${highlightHue} / 0.35), transparent 45%)`,
  ].join(", ");

  const shouldPulse = !still && intensity === "attention";
  const transition = still
    ? { duration: 0 }
    : shouldPulse
      ? { ...SPRING, scale: { duration: 3, repeat: Infinity } }
      : SPRING;

  return (
    <motion.div
      aria-hidden
      // Shared layoutId enables lava-lamp drift across stages.
      layoutId="shift-lifecycle-orb"
      layout={!still}
      transition={transition}
      className={cn("pointer-events-none absolute -z-0 rounded-full", className)}
      data-anchor-phase={anchorPhase}
      style={{
        width: px,
        height: px,
        background,
      }}
      animate={shouldPulse ? { scale: [1, 1.03, 1] } : undefined}
    />
  );
}
