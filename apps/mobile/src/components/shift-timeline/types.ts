/**
 * shift-timeline (mobile) — shared types.
 *
 * Re-exports `ShiftLifecyclePhase` and `ShiftLifecycleRow` from
 * @smartout/schedule so mobile callers import phase semantics from the
 * single source of truth established by ADR-0108. Mobile-only props types
 * are declared here.
 */

import type { ShiftLifecyclePhase, ShiftLifecycleRow } from "@smartout/schedule";

export type { ShiftLifecyclePhase, ShiftLifecycleRow };

/**
 * Canonical phase order for the shift timeline. Matches the `phase` values
 * emitted by `v_shift_lifecycle` and the web composed timeline.
 */
export const PHASE_ORDER: ReadonlyArray<ShiftLifecyclePhase> = [
  "planlegges",
  "pagar",
  "oppgjor",
  "avsluttet",
] as const;

/**
 * Visual state of a stage relative to the currently active phase.
 * Mirrors the web `StageState` so vocabulary stays platform-consistent.
 */
export type StageState = "completed" | "active" | "upcoming";

/** Reason for opening Botsson from the timeline (ADR-0078 telemetry). */
export type TimelineOpenReason = "deviation" | "help";

/** Intent payload passed to BotssonProvider.openWithIntent. */
export type TimelineBotssonIntent = {
  kind: "deviation" | "help";
  shift_id: string;
  deviation_id?: string | null;
  phase: ShiftLifecyclePhase;
};

/** Derive stage visual state given the active phase. */
export function deriveStageState(
  forPhase: ShiftLifecyclePhase,
  active: ShiftLifecyclePhase,
): StageState {
  const forIdx = PHASE_ORDER.indexOf(forPhase);
  const activeIdx = PHASE_ORDER.indexOf(active);
  if (forIdx < 0 || activeIdx < 0) return "upcoming";
  if (forIdx < activeIdx) return "completed";
  if (forIdx === activeIdx) return "active";
  return "upcoming";
}
