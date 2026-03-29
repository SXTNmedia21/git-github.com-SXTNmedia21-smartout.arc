/**
 * state-machine.ts — Valid phase transitions for the shift clock UI.
 * Prevents illegal state jumps (e.g. starting a break before punching in).
 * All UI actions should pass through canTransition() before being dispatched.
 */

import type { ShiftClockPhase } from "./types";

export type ShiftClockAction = "punch_in" | "punch_out" | "start_break" | "end_break" | "dismiss";

export type ShiftClockTransition = {
  from: ShiftClockPhase;
  action: ShiftClockAction;
  to: ShiftClockPhase;
};

const TRANSITIONS: ShiftClockTransition[] = [
  { from: "idle", action: "punch_in", to: "clocked_in" },
  { from: "clocked_in", action: "start_break", to: "on_break" },
  { from: "on_break", action: "end_break", to: "clocked_in" },
  { from: "clocked_in", action: "punch_out", to: "summary" },
  { from: "summary", action: "dismiss", to: "idle" },
];

export function canTransition(currentPhase: ShiftClockPhase, action: ShiftClockAction): boolean {
  return TRANSITIONS.some((t) => t.from === currentPhase && t.action === action);
}

export function getNextPhase(
  currentPhase: ShiftClockPhase,
  action: ShiftClockAction,
): ShiftClockPhase | null {
  return TRANSITIONS.find((t) => t.from === currentPhase && t.action === action)?.to ?? null;
}
