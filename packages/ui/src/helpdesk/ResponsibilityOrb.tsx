"use client";

/**
 * ResponsibilityOrb (web) — the darkening-orb primitive from Spec §4.1.
 *
 * Renders a soft CSS radial-gradient scaled to `size`. Chroma shifts per
 * ticket status; hue stays at 50 (warm neutral) in Phase 1. Phase 2 will
 * lerp hue 50→40 and chroma statusChroma→0.18 based on `slaProgress`.
 *
 * The orb NEVER turns red, NEVER ticks a countdown, and NEVER carries text.
 * All communication happens through hue + chroma + pulse cadence.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../lib/utils";
import type { ResponsibilityOrbProps, TicketStatus } from "./types";

// Chroma per status — matches Spec §4.1 table. Hue locked at 50.
const STATUS_CHROMA: Record<TicketStatus, number> = {
  waiting: 0.06,
  active: 0.1,
  complete: 0.04,
};

/**
 * Phase 1 returns `statusChroma` verbatim. Phase 2 will interpolate toward
 * 0.18 as SLA progress approaches 1.0. Kept as a helper so the Phase 2
 * landing is a one-line change.
 */
function resolveChroma(status: TicketStatus, slaProgress?: number): number {
  const base = STATUS_CHROMA[status];
  if (slaProgress === undefined) return base;
  const clamped = Math.min(1, Math.max(0, slaProgress));
  return base + (0.18 - base) * clamped;
}

function resolveHue(slaProgress?: number): number {
  if (slaProgress === undefined) return 50;
  const clamped = Math.min(1, Math.max(0, slaProgress));
  return 50 - 10 * clamped; // 50 (warm) → 40 (brand orange)
}

function shouldPulse(status: TicketStatus, pulse?: boolean): boolean {
  if (pulse !== undefined) return pulse;
  return status === "waiting";
}

export const ResponsibilityOrb = React.forwardRef<
  HTMLDivElement,
  ResponsibilityOrbProps & { className?: string }
>(function ResponsibilityOrb(
  { status, size, slaProgress, pulse, decorative = true, className },
  ref,
) {
  const reduceMotion = useReducedMotion();
  const hue = resolveHue(slaProgress);
  const chroma = resolveChroma(status, slaProgress);
  const willPulse = shouldPulse(status, pulse) && !reduceMotion;

  const gradient = `radial-gradient(circle at 50% 50%, oklch(0.72 ${chroma} ${hue}) 0%, oklch(0.62 ${chroma * 0.7} ${hue} / 0.55) 45%, transparent 72%)`;

  return (
    <motion.div
      ref={ref}
      className={cn("relative inline-block", className)}
      style={{ width: size, height: size, background: gradient, borderRadius: "50%" }}
      aria-hidden={decorative ? "true" : undefined}
      role={decorative ? undefined : "img"}
      animate={
        willPulse
          ? { opacity: [0.82, 1, 0.82], scale: [0.985, 1, 0.985] }
          : { opacity: 1, scale: 1 }
      }
      transition={
        willPulse ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }
      }
    />
  );
});
