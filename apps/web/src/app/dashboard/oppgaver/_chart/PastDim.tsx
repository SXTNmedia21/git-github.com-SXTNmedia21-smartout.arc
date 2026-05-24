"use client";

/**
 * PastDim — translucent overlay covering elapsed time on the Manager Timeline.
 *
 * Spans from the top of the chart (DAY_START = 06:00) down to `currentMin`,
 * visually dimming the past portion of the day-line so operators focus on
 * upcoming tasks.
 *
 * Color: `bg-foreground/10` — semantic opacity on the foreground token.
 * ADR-0366: no OKLCH literals. ADR-0361: no hardcoded zinc/gray/slate.
 * The Tailwind opacity modifier (`/10`) satisfies the PastDim test assertion.
 *
 * Props supplied by chart composer (Task 3.7).
 */

import { DAY_START_HOUR } from "./timeMath";

export interface PastDimProps {
  /** Current time expressed as absolute minutes (e.g. 14*60+35 = 875). */
  currentMin: number;
  /** Pixels per minute — supplied by chart composer. */
  pxPerMin: number;
}

const DAY_START_MIN = DAY_START_HOUR * 60;

export function PastDim({ currentMin, pxPerMin }: PastDimProps) {
  const height = Math.max(0, (currentMin - DAY_START_MIN) * pxPerMin);

  return (
    <div
      className="bg-foreground/10 pointer-events-none absolute inset-x-0 top-0"
      style={{ height }}
      aria-hidden="true"
    />
  );
}
