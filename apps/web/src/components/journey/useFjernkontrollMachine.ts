// apps/web/src/components/journey/useFjernkontrollMachine.ts
//
// State machine hook for the Fjernkontroll runtime UI (ADR-0177).
//
// Six states, unidirectional transitions. The runtime path is:
//   idle    -> running   (start)
//   running -> paused    (pause)
//   paused  -> running   (resume)
//   running -> stuck     (stuck-detector Edge Function emits journey.stuck)
//   stuck   -> running   (retry — re-enter the current step)
//   stuck   -> idle      (abandon — terminal user-cancellation recovery)
//   running -> completed (final step reached)
//   running -> failed    (emit journey.run_failed)
//   failed  -> idle      (reset — fresh start after a terminal failure)
//
// Why a home-rolled reducer rather than xstate:
//   - Six states / ~ten transitions fits a discriminated union cleanly.
//   - Zero external dependency on the runtime bundle (xstate alone is
//     ~30KB gzip); the Fjernkontroll ships on the runtime web entry
//     and must stay lean for mobile BFF parity (ADR-0132).
//   - `@smartout/journey-ir` keeps the schema, `ADR-0177` keeps the
//     state contract — a local reducer makes the source of truth
//     obvious and greppable.
//
// Telemetry policy:
//   This hook is intentionally PURE — zero emit side-effects. The
//   outer Fjernkontroll.tsx subscribes to `engine_event` realtime and
//   drives the machine from server-observed events. Callers that want
//   to emit telemetry on UI-initiated transitions (e.g. `abandon` →
//   `journey.run_failed` with `error_code: "abandoned_by_user"` per
//   ADR-0175) do so in their own dispatch wrapper — NOT in the reducer.
//   This keeps the reducer trivially testable in a node-only Vitest
//   environment with no Supabase / PostHog mocks.
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
  | { type: "abandon" }
  | { type: "reset" }
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

/**
 * Pure reducer. Exported for unit testing in a node environment without
 * requiring `@testing-library/react`. The hook below wraps it with
 * `useReducer` + stable callbacks.
 *
 * Invariants:
 *   - Invalid events leave state unchanged (no throw). This is a
 *     defensive guard for the stuck-detector realtime path, which can
 *     deliver an event after the user has already navigated the
 *     machine elsewhere.
 *   - `retry`, `abandon`, and `reset` each reset `lastError` /
 *     `lastStuckStepKey` where appropriate so no stale failure data
 *     bleeds into the next run.
 */
export function reduce(
  prev: FjernkontrollSnapshot,
  event: FjernkontrollEvent,
): FjernkontrollSnapshot {
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
        // Re-enter the current step. Clear the stuck marker so the
        // next stuck-detector signal doesn't look like a duplicate.
        return { ...prev, state: "running", lastStuckStepKey: null };
      }
      if (event.type === "abandon") {
        // Terminal user-cancellation. Drop back to idle with a clean
        // snapshot so the next Start is indistinguishable from a cold
        // boot. `currentStepIndex` resets to 0 per the INITIAL contract.
        return { ...INITIAL };
      }
      if (event.type === "fail") {
        return { ...prev, state: "failed", lastError: event.error ?? "unknown" };
      }
      return prev;
    }
    case "completed": {
      // Terminal. Explicit `start` restarts a fresh run.
      if (event.type === "start") return { ...INITIAL, state: "running" };
      return prev;
    }
    case "failed": {
      // Terminal. `reset` is the explicit recovery path (back to idle);
      // `start` remains a compatibility shortcut for a direct restart.
      if (event.type === "reset") return { ...INITIAL };
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
  const abandon = useCallback(() => dispatch({ type: "abandon" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const markStuck = useCallback((stepKey?: string) => dispatch({ type: "stuck", stepKey }), []);
  const markCompleted = useCallback(() => dispatch({ type: "complete" }), []);
  const markFailed = useCallback((error?: string) => dispatch({ type: "fail", error }), []);

  return {
    snapshot,
    start,
    pause,
    resume,
    retry,
    abandon,
    reset,
    markStuck,
    markCompleted,
    markFailed,
  };
}
