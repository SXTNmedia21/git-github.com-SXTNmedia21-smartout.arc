// services/stage-engine/src/core/session-recorder.test.ts
// ADR-0184 — Session Recorder helper tests.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRecorder, type RecordTurnInput } from "./session-recorder.js";

describe("session-recorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flushes buffered turns to DB", async () => {
    const sb = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    };
    const r = createRecorder({
      supabase: sb as never,
      flushIntervalMs: 10,
    });
    const input: RecordTurnInput = {
      sessionId: "s1",
      workspaceId: "w1",
      turnKind: "user_input",
      phase: "classifier_input",
      content: { text: "hei" },
    };
    r.recordTurn(input);
    await new Promise((res) => setTimeout(res, 30));
    expect(sb.from).toHaveBeenCalledWith("agent_session_recording");
  });

  it("redacts PII before INSERT", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const sb = { from: vi.fn(() => ({ insert: insertSpy })) };
    const r = createRecorder({
      supabase: sb as never,
      flushIntervalMs: 10,
    });
    r.recordTurn({
      sessionId: "s1",
      workspaceId: "w1",
      turnKind: "user_input",
      phase: "classifier_input",
      content: { text: "Personnummer: 12345678901" },
    });
    await new Promise((res) => setTimeout(res, 30));
    const firstCall = insertSpy.mock.calls[0]!;
    const rows = firstCall[0] as Array<{ content_redacted: unknown }>;
    const row = rows[0]!;
    expect(JSON.stringify(row.content_redacted)).toContain("<personnummer>");
    expect(JSON.stringify(row.content_redacted)).not.toContain("12345678901");
  });

  it("drops oldest on buffer overflow (fire-and-forget)", async () => {
    const sb = {
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    };
    const r = createRecorder({
      supabase: sb as never,
      flushIntervalMs: 9999,
      maxBuffer: 3,
    });
    for (let i = 0; i < 10; i++) {
      r.recordTurn({
        sessionId: "s1",
        workspaceId: "w1",
        turnKind: "user_input",
        phase: "classifier_input",
        content: { i },
      });
    }
    expect(r.getDropCount()).toBe(7);
    expect(r.getBufferSize()).toBe(3);
  });

  it("never throws on DB error (recorder never blocks Emma)", async () => {
    const sb = {
      from: vi.fn(() => ({
        insert: vi.fn().mockRejectedValue(new Error("db down")),
      })),
    };
    const r = createRecorder({
      supabase: sb as never,
      flushIntervalMs: 10,
    });
    r.recordTurn({
      sessionId: "s1",
      workspaceId: "w1",
      turnKind: "user_input",
      phase: "classifier_input",
      content: { ok: true },
    });
    await new Promise((res) => setTimeout(res, 30));
    // No unhandled promise rejection; error counter increments
    expect(r.getErrorCount()).toBeGreaterThan(0);
  });
});
