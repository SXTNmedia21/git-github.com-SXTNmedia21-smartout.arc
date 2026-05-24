"use client";

/**
 * RoutineStrips — background phase bands behind the chart lanes.
 *
 * Each band spans a service phase (prep / service / winddown) and is tinted
 * using phase tokens from `@smartout/design-tokens`. Colors are injected as
 * inline CSS custom properties (dynamic-color carve-out — token values are
 * not known at compile-time per phase; we pass the resolved OKLCH string
 * through a component-local CSS var, never hardcode it in JSX).
 *
 * Positioning: absolute within the scrollable chart body. `top` and `height`
 * are derived from `hmToMin` + pxPerMin supplied by the chart composer (Task 3.7).
 *
 * ADR-0366: no OKLCH literals in source. ADR-0361: no hardcoded zinc/gray/slate.
 */

import { phase as tokens } from "@smartout/design-tokens";
import { hmToMin, DAY_START_HOUR } from "./timeMath";
import { routinePhases } from "./routinePhases";
import type { PhaseKind } from "./routinePhases";

export interface RoutineStripsProps {
  /** Pixels per minute — supplied by chart composer via layout calculation. */
  pxPerMin: number;
}

/** Map phase kind → design token value (no inline OKLCH literals). */
function phaseColor(kind: PhaseKind): string {
  switch (kind) {
    case "prep":
      return tokens.phasePrep;
    case "service":
      return tokens.phaseService;
    case "winddown":
      return tokens.phaseWindDown;
  }
}

const DAY_START_MIN = DAY_START_HOUR * 60;

export function RoutineStrips({ pxPerMin }: RoutineStripsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {routinePhases.map((r) => {
        const startMin = hmToMin(r.start) - DAY_START_MIN;
        const endMin = hmToMin(r.end) - DAY_START_MIN;
        const top = startMin * pxPerMin;
        const height = (endMin - startMin) * pxPerMin;

        // Dynamic-color pattern: resolve token value → inject as component-local
        // CSS var → reference via background shorthand. Never a raw OKLCH literal.
        const color = phaseColor(r.kind);

        return (
          <div
            key={r.id}
            className="absolute right-0 left-0"
            style={
              {
                top,
                height,
                // Inject resolved token as local CSS variable (phase.* tokens)
                "--phase-bg": color,
                background: "color-mix(in oklch, var(--phase-bg) 8%, transparent)",
              } as React.CSSProperties
            }
            title={r.name}
          />
        );
      })}
    </div>
  );
}
