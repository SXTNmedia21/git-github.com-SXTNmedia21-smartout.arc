// packages/ai/src/lib/recording-hook.test.ts
// ADR-0184 — Boundary shim unit tests.

import { describe, expect, it, beforeEach } from "vitest";
import { recordTurn, setRecordingHook, type RecordedTurn } from "./recording-hook.js";

describe("recording-hook", () => {
  beforeEach(() => {
    setRecordingHook(null);
  });

  it("recordTurn is a no-op when no hook is registered", () => {
    expect(() =>
      recordTurn({
        sessionId: "s1",
        workspaceId: "w1",
        turnKind: "memory_write",
        phase: "post_turn",
        content: { ok: true },
      }),
    ).not.toThrow();
  });

  it("delegates to the registered hook", () => {
    const seen: RecordedTurn[] = [];
    setRecordingHook((input) => seen.push(input));

    recordTurn({
      sessionId: "s1",
      workspaceId: "w1",
      turnKind: "memory_write",
      phase: "post_turn",
      content: { memory_id: "m1" },
    });

    expect(seen.length).toBe(1);
    expect(seen[0]!.turnKind).toBe("memory_write");
  });

  it("swallows hook exceptions so callers never throw", () => {
    setRecordingHook(() => {
      throw new Error("hook crashed");
    });

    expect(() =>
      recordTurn({
        sessionId: "s1",
        workspaceId: "w1",
        turnKind: "memory_write",
        phase: "post_turn",
        content: {},
      }),
    ).not.toThrow();
  });

  it("setRecordingHook(null) disables recording", () => {
    const seen: RecordedTurn[] = [];
    setRecordingHook((input) => seen.push(input));
    setRecordingHook(null);

    recordTurn({
      sessionId: "s1",
      workspaceId: "w1",
      turnKind: "memory_write",
      phase: "post_turn",
      content: {},
    });

    expect(seen.length).toBe(0);
  });
});
