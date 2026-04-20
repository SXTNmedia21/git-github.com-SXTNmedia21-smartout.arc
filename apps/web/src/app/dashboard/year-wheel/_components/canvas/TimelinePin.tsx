"use client";

/**
 * TimelinePin — canvas pin marker for planning events.
 *
 * Implements spec §3.4.4 (visual design) and §8.2 (accessible 24×24 hit-area
 * wrapping a 12×12 visual dot — finger-sized touch target without enlarging
 * the painted marker).
 *
 * Two render modes:
 *   - Range event (xEnd > x): a ~10px-tall bar spanning the date range.
 *   - Point event (no xEnd):  a circular dot with 24×24 invisible hit-area.
 *
 * Phase 2 adaptations (see CompanionRail.tsx for sibling precedent):
 *   - The spec references `PlanningEvent` but the canonical row type exported
 *     by `@smartout/year-wheel/hooks` is `PlanningEventRow`. We alias locally.
 *   - `PlanningEventCategory` today does NOT include `business_critical`; we
 *     keep the CAT_COLOR map string-keyed and fall back to muted-foreground
 *     so a future union widening does not break the build.
 *   - `PlanningEventSource` today does NOT include `ai_generated`; the AI
 *     styling branch stays behind a defensive string compare.
 *   - `demand_multiplier` is typed as `number` today, but may widen to
 *     nullable; we default to 1 for the ring calculation defensively.
 */

import { useState } from "react";
import type { PlanningEventRow } from "@smartout/year-wheel/hooks";

// Local alias — the canvas spec writes `PlanningEvent`; the package exports
// `PlanningEventRow`. Sibling canvas components follow the same convention.
export type PlanningEvent = PlanningEventRow;

type Props = {
  event: PlanningEvent & { x: number; xEnd: number | null };
  onSelect: (id: string) => void;
};

// String-keyed so we tolerate categories not yet in the TS union
// (e.g. `business_critical` from the spec may land in a later migration).
const CAT_COLOR: Record<string, string> = {
  internal: "var(--muted-foreground)",
  cultural_commercial: "var(--brand)",
  business_critical: "var(--destructive)",
};

export function TimelinePin({ event, onSelect }: Props) {
  const [hover, setHover] = useState(false);
  const color = CAT_COLOR[event.category] ?? "var(--muted-foreground)";
  const isRange = event.xEnd != null && event.xEnd > event.x;
  // `ai_generated` is not in PlanningEventSource today — defensive string compare.
  const isAi = (event.source as string) === "ai_generated";
  // demand_multiplier may widen to nullable later; default to 1 for the ring test.
  const demand = event.demand_multiplier ?? 1;
  const hasRing = demand > 1.5 || demand < 0.5;

  if (isRange) {
    const width = Math.max(12, event.xEnd! - event.x);
    return (
      <button
        type="button"
        onClick={() => onSelect(event.planning_event_id)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="absolute rounded-[5px]"
        style={{
          left: event.x,
          top: 23, // pinsY - 5
          width,
          height: 10,
          background: `color-mix(in oklab, ${color} 80%, var(--card))`,
          border: `1px solid ${color}`,
        }}
        aria-label={event.name}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(event.planning_event_id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="absolute inline-flex items-center justify-center"
      // 24x24 hit-area wraps 12x12 visual dot (spec §8.2)
      style={{ left: event.x - 12, top: 22 - 6, width: 24, height: 24 }}
      aria-label={event.name}
    >
      <span
        aria-hidden
        className="h-3 w-3 rounded-full"
        style={{
          background: isAi ? `color-mix(in oklab, ${color} 40%, var(--card))` : color,
          border: isAi
            ? `2px dashed ${color}`
            : hasRing
              ? `3px solid color-mix(in oklab, ${color} 30%, transparent)`
              : "1.5px solid var(--card)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          transform: hover ? "scale(1.2)" : "scale(1)",
          transition: "transform 150ms",
        }}
      />
    </button>
  );
}
