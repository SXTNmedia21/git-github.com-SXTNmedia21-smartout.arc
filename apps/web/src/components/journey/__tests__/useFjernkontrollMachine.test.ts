/**
 * useFjernkontrollMachine.test.ts
 *
 * Unit tests for the Fjernkontroll reducer (ADR-0177).
 *
 * We test the pure `reduce` function directly rather than the hook:
 *   - `apps/web` Vitest runs in the `node` environment (see
 *     vitest.config.ts). No DOM, no `@testing-library/react`.
 *   - The hook is a thin `useReducer` wrapper — all transition logic
 *     lives in `reduce`, which is exported specifically so tests can
 *     stay in the fast node lane.
 *
 * Coverage focus: the exit edges added in the Track C honesty fix
 * (stuck + retry, stuck + abandon, failed + reset) plus the defensive
 * "invalid event leaves state unchanged" guards.
 */

import { describe, it, expect } from "vitest";
import { reduce, type FjernkontrollSnapshot } from "../useFjernkontrollMachine";

const INITIAL: FjernkontrollSnapshot = {
  state: "idle",
  currentStepIndex: 0,
  lastError: null,
  lastStuckStepKey: null,
};

describe("useFjernkontrollMachine reducer", () => {
  describe("initial state", () => {
    it("starts in 'idle'", () => {
      expect(INITIAL.state).toBe("idle");
    });
  });

  describe("happy-path transitions", () => {
    it("idle + start -> running (clears lastError)", () => {
      const prev: FjernkontrollSnapshot = { ...INITIAL, lastError: "stale" };
      const next = reduce(prev, { type: "start" });
      expect(next.state).toBe("running");
      expect(next.lastError).toBeNull();
    });

    it("running + stuck -> stuck (records stepKey)", () => {
      const prev: FjernkontrollSnapshot = { ...INITIAL, state: "running" };
      const next = reduce(prev, { type: "stuck", stepKey: "submit-form" });
      expect(next.state).toBe("stuck");
      expect(next.lastStuckStepKey).toBe("submit-form");
    });

    it("running + fail -> failed (records error)", () => {
      const prev: FjernkontrollSnapshot = { ...INITIAL, state: "running" };
      const next = reduce(prev, { type: "fail", error: "timeout" });
      expect(next.state).toBe("failed");
      expect(next.lastError).toBe("timeout");
    });
  });

  describe("exit edges from 'stuck' (Track C honesty fix)", () => {
    it("stuck + retry -> running (clears lastStuckStepKey)", () => {
      const prev: FjernkontrollSnapshot = {
        ...INITIAL,
        state: "stuck",
        lastStuckStepKey: "submit-form",
      };
      const next = reduce(prev, { type: "retry" });
      expect(next.state).toBe("running");
      expect(next.lastStuckStepKey).toBeNull();
    });

    it("stuck + abandon -> idle (returns to clean snapshot)", () => {
      const prev: FjernkontrollSnapshot = {
        ...INITIAL,
        state: "stuck",
        currentStepIndex: 4,
        lastStuckStepKey: "submit-form",
      };
      const next = reduce(prev, { type: "abandon" });
      expect(next.state).toBe("idle");
      expect(next.currentStepIndex).toBe(0);
      expect(next.lastStuckStepKey).toBeNull();
      expect(next.lastError).toBeNull();
    });
  });

  describe("exit edges from 'failed' (Track C honesty fix)", () => {
    it("failed + reset -> idle (clears lastError)", () => {
      const prev: FjernkontrollSnapshot = {
        ...INITIAL,
        state: "failed",
        lastError: "timeout",
        currentStepIndex: 3,
      };
      const next = reduce(prev, { type: "reset" });
      expect(next.state).toBe("idle");
      expect(next.lastError).toBeNull();
      expect(next.currentStepIndex).toBe(0);
    });

    it("failed + start -> running (compat shortcut for direct restart)", () => {
      const prev: FjernkontrollSnapshot = {
        ...INITIAL,
        state: "failed",
        lastError: "timeout",
      };
      const next = reduce(prev, { type: "start" });
      expect(next.state).toBe("running");
      expect(next.lastError).toBeNull();
    });
  });

  describe("defensive guards — invalid events leave state unchanged", () => {
    it("stuck + pause -> stuck (unchanged, no throw)", () => {
      const prev: FjernkontrollSnapshot = { ...INITIAL, state: "stuck" };
      const next = reduce(prev, { type: "pause" });
      expect(next).toBe(prev);
    });

    it("stuck + resume -> stuck (unchanged)", () => {
      const prev: FjernkontrollSnapshot = { ...INITIAL, state: "stuck" };
      const next = reduce(prev, { type: "resume" });
      expect(next).toBe(prev);
    });

    it("stuck + complete -> stuck (unchanged)", () => {
      const prev: FjernkontrollSnapshot = { ...INITIAL, state: "stuck" };
      const next = reduce(prev, { type: "complete" });
      expect(next).toBe(prev);
    });

    it("failed + pause -> failed (unchanged)", () => {
      const prev: FjernkontrollSnapshot = {
        ...INITIAL,
        state: "failed",
        lastError: "timeout",
      };
      const next = reduce(prev, { type: "pause" });
      expect(next).toBe(prev);
    });

    it("failed + retry -> failed (unchanged; retry is stuck-only)", () => {
      const prev: FjernkontrollSnapshot = {
        ...INITIAL,
        state: "failed",
        lastError: "timeout",
      };
      const next = reduce(prev, { type: "retry" });
      expect(next).toBe(prev);
    });

    it("failed + abandon -> failed (unchanged; abandon is stuck-only)", () => {
      const prev: FjernkontrollSnapshot = {
        ...INITIAL,
        state: "failed",
        lastError: "timeout",
      };
      const next = reduce(prev, { type: "abandon" });
      expect(next).toBe(prev);
    });

    it("running + reset -> running (unchanged; reset is failed-only)", () => {
      const prev: FjernkontrollSnapshot = { ...INITIAL, state: "running" };
      const next = reduce(prev, { type: "reset" });
      expect(next).toBe(prev);
    });

    it("idle + retry -> idle (unchanged)", () => {
      const next = reduce(INITIAL, { type: "retry" });
      expect(next).toBe(INITIAL);
    });
  });

  describe("round-trip — stuck recovery via retry preserves the run", () => {
    it("idle -> running -> stuck -> running (retry) -> completed", () => {
      let snap = INITIAL;
      snap = reduce(snap, { type: "start" });
      expect(snap.state).toBe("running");
      snap = reduce(snap, { type: "stuck", stepKey: "upload" });
      expect(snap.state).toBe("stuck");
      expect(snap.lastStuckStepKey).toBe("upload");
      snap = reduce(snap, { type: "retry" });
      expect(snap.state).toBe("running");
      expect(snap.lastStuckStepKey).toBeNull();
      snap = reduce(snap, { type: "complete" });
      expect(snap.state).toBe("completed");
    });
  });

  describe("round-trip — failure recovery via reset lands in idle", () => {
    it("running -> failed -> idle (reset) -> running (fresh start)", () => {
      let snap: FjernkontrollSnapshot = { ...INITIAL, state: "running" };
      snap = reduce(snap, { type: "fail", error: "network" });
      expect(snap.state).toBe("failed");
      expect(snap.lastError).toBe("network");
      snap = reduce(snap, { type: "reset" });
      expect(snap.state).toBe("idle");
      expect(snap.lastError).toBeNull();
      snap = reduce(snap, { type: "start" });
      expect(snap.state).toBe("running");
    });
  });
});
