"use client";

/**
 * NowLine — horizontal marker at the current time on the Manager Timeline.
 *
 * Positioned via `top: currentMin * pxPerMin` relative to the chart body.
 * Color: `bg-warning` / `border-warning` (warm orange-amber semantic token).
 *
 * Accessibility + motion:
 * - `useReducedMotion` from framer-motion is checked before any animation is applied.
 * - When prefersReducedMotion is true: static <div> only — no motion props, no pulse.
 * - When prefersReducedMotion is false: subtle pulse via framer-motion `motion.div`
 *   using `motionTokens.springGentle` (stiffness 30, damping 20, mass 2.5).
 *
 * Props supplied by chart composer (Task 3.7).
 */

import { motion } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { minToHM, DAY_START_HOUR } from "./timeMath";

export interface NowLineProps {
  /** Current time expressed as absolute minutes (e.g. 14*60+35 = 875). */
  currentMin: number;
  /** Pixels per minute — supplied by chart composer. */
  pxPerMin: number;
}

const DAY_START_MIN = DAY_START_HOUR * 60;

/** Framer-motion pulse animation for the now-indicator dot. */
const pulseVariants = {
  idle: { opacity: 1, scale: 1 },
  pulse: {
    opacity: [1, 0.5, 1],
    scale: [1, 1.4, 1],
    transition: {
      // Keyframe arrays require type:"tween" — spring physics conflict with
      // duration-based loops and are silently overridden by Framer Motion.
      type: "tween" as const,
      duration: 2,
      repeat: Infinity,
      ease: motionTokens.easingArray,
    },
  },
};

export function NowLine({ currentMin, pxPerMin }: NowLineProps) {
  // Reduced-motion preference resolves to null on SSR + first client render,
  // then to boolean after the media-query subscription mounts. Gating DOM
  // structure on this value caused SSR/client tree divergence (hydration
  // mismatch). Single tree always; only the framer-motion `animate` target
  // changes, which is applied post-hydration without DOM diff.
  const prefersReducedMotion = useReducedMotion();

  const top = (currentMin - DAY_START_MIN) * pxPerMin;
  const timeLabel = minToHM(currentMin);

  return (
    <>
      {/* PLAN-5a: screen-reader announcement of the current time. The visual
          now-line is aria-hidden (decorative); this polite live-region carries
          the same information to assistive tech. sr-only = no layout impact. */}
      <span className="sr-only" role="status" aria-live="polite">
        Nåværende tid {timeLabel}
      </span>
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{ top: 0, bottom: 0 }}
        aria-hidden="true"
        data-testid="now-line"
      >
        <div className="border-warning absolute right-0 left-0 border-t-2" style={{ top }}>
          <motion.div
            className="bg-warning absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full"
            variants={pulseVariants}
            initial="idle"
            animate={prefersReducedMotion ? "idle" : "pulse"}
            transition={{ type: "spring", ...motionTokens.springGentle }}
          />
          <span className="text-warning absolute -top-3 left-4 font-mono text-xs select-none">
            {timeLabel}
          </span>
        </div>
      </div>
    </>
  );
}
