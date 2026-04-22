// apps/web/src/components/journey/useFjernkontrollMachine.ts
//
// State machine hook for the Fjernkontroll runtime UI (ADR-0177).
//
// Six states, unidirectional transitions. The runtime path is:
//   idle -> running (start)
//   running -> paused (user pause)
//   paused -> running (resume)
//   running -> stuck (stuck-detector Edge Function emits journey.stuck)
//   stuck   -> running (retry)
//   running -> completed (final step reached)
//   running -> failed (emit journey.run_failed)
//
// Why a home-rolled reducer rather than xstate:
//   - Six states / ~eight transitions fits a discriminated union cleanly.
//   - Zero external dependency on the runtime bundle (xstate alone is
//     ~30KB gzip); the Fjernkontroll ships on the runtime web entry
//     and must stay lean for mobile BFF parity (ADR-0132).
//   - `@smartout/journey-ir` keeps the schema, `ADR-0177` keeps the
//     state contract — a local reducer makes the source of truth
//     obvious and greppable.
//
// Council red-line R5.1-4: no hardcoded colors. This module is
// token-agnostic — coloring happens in Fjernkontroll.tsx via design
// tokens (bg-muted, border-border, text-foreground, etc.).

"use client";

import { useCallback, useReducer } from "react";

export type FjernkontrollState = "idle" | "running" | "paused" | "stuck" | "completed" | "failed";

export type FjernkontrollEvent =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stuck"; stepKey?: string }
  | { type: "retry" }
  | { type: "complete" }
  | { type: "fail"; error?: string };

export type FjernkontrollSnapshot = {
  state: FjernkontrollState;
  currentStepIndex: number;
  lastError: string | null;
  lastStuckStepKey: string | null;
};

const INITIAL: FjernkontrollSnapshot = {
  state: "idle",
  currentStepIndex: 0,
  lastError: null,
  lastStuckStepKey: null,
};

function reduce(prev: FjernkontrollSnapshot, event: FjernkontrollEvent): FjernkontrollSnapshot {
  switch (prev.state) {
    case "idle": {
      if (event.type === "start") {
        return { ...prev, state: "running", lastError: null };
      }
      return prev;
    }
    case "running": {
      if (event.type === "pause") return { ...prev, state: "paused" };
      if (event.type === "stuck") {
        return { ...prev, state: "stuck", lastStuckStepKey: event.stepKey ?? null };
      }
      if (event.type === "complete") return { ...prev, state: "completed" };
      if (event.type === "fail") {
        return { ...prev, state: "failed", lastError: event.error ?? "unknown" };
      }
      return prev;
    }
    case "paused": {
      if (event.type === "resume") return { ...prev, state: "running" };
      if (event.type === "fail") {
        return { ...prev, state: "failed", lastError: event.error ?? "unknown" };
      }
      return prev;
    }
    case "stuck": {
      if (event.type === "retry") {
        return { ...prev, state: "running", lastStuckStepKey: null };
      }
      if (event.type === "fail") {
        return { ...prev, state: "failed", lastError: event.error ?? "unknown" };
      }
      return prev;
    }
    case "completed":
    case "failed": {
      // Terminal states — explicit `start` resets. No implicit recovery.
      if (event.type === "start") return { ...INITIAL, state: "running" };
      return prev;
    }
    default: {
      // Exhaustiveness guard. Unreachable if the union is complete.
      const _exhaustive: never = prev.state;
      return _exhaustive;
    }
  }
}

export type UseFjernkontrollMachineOptions = {
  initialState?: FjernkontrollState;
};

export function useFjernkontrollMachine(options?: UseFjernkontrollMachineOptions) {
  const [snapshot, dispatch] = useReducer(reduce, {
    ...INITIAL,
    state: options?.initialState ?? "idle",
  });

  const start = useCallback(() => dispatch({ type: "start" }), []);
  const pause = useCallback(() => dispatch({ type: "pause" }), []);
  const resume = useCallback(() => dispatch({ type: "resume" }), []);
  const retry = useCallback(() => dispatch({ type: "retry" }), []);
  const markStuck = useCallback((stepKey?: string) => dispatch({ type: "stuck", stepKey }), []);
  const markCompleted = useCallback(() => dispatch({ type: "complete" }), []);
  const markFailed = useCallback((error?: string) => dispatch({ type: "fail", error }), []);

  return {
    snapshot,
    start,
    pause,
    resume,
    retry,
    markStuck,
    markCompleted,
    markFailed,
  };
}
