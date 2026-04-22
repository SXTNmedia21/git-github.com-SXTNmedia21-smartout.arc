// services/stage-engine/src/routes/recorder-metrics.test.ts
// Tests for GET /recorder/metrics — debug introspection into the recorder
// singleton (ADR-0184). Used by the web BFF _metrics proxy, which is used
// by the recorder-failure-resilience E2E.

import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { Hono } from "hono";
import { recorderMetrics } from "./recorder-metrics.js";
import { setRecorder } from "../core/session-recorder.js";
import type { Recorder } from "../core/session-recorder.js";

function buildApp() {
  const app = new Hono();
  app.route("/", recorderMetrics);
  return app;
}

function makeStubRecorder(opts: {
  bufferSize: number;
  dropCount: number;
  errorCount: number;
}): Recorder {
  return {
    recordTurn: () => undefined,
    getBufferSize: () => opts.bufferSize,
    getDropCount: () => opts.dropCount,
    getErrorCount: () => opts.errorCount,
    stop: () => undefined,
  };
}

describe("GET /recorder/metrics", () => {
  beforeEach(() => {
    setRecorder(null);
  });
  afterEach(() => {
    setRecorder(null);
  });

  it("returns zero-state metrics when recorder singleton is absent", async () => {
    const app = buildApp();
    const res = await app.request("/recorder/metrics");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      buffer_size: number;
      drop_count: number;
      error_count: number;
      recorder_blocking_emma: boolean;
    };
    expect(body.buffer_size).toBe(0);
    expect(body.drop_count).toBe(0);
    expect(body.error_count).toBe(0);
    // Fire-and-forget invariant (Q8b) — recorder must NEVER block Emma.
    expect(body.recorder_blocking_emma).toBe(false);
  });

  it("returns live counts from the singleton", async () => {
    setRecorder(makeStubRecorder({ bufferSize: 3, dropCount: 17, errorCount: 2 }));
    const app = buildApp();
    const res = await app.request("/recorder/metrics");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      buffer_size: number;
      drop_count: number;
      error_count: number;
      recorder_blocking_emma: boolean;
    };
    expect(body.buffer_size).toBe(3);
    expect(body.drop_count).toBe(17);
    expect(body.error_count).toBe(2);
    expect(body.recorder_blocking_emma).toBe(false);
  });

  it("recorder_blocking_emma is always false even with errors (Q8b invariant)", async () => {
    setRecorder(makeStubRecorder({ bufferSize: 999, dropCount: 1000, errorCount: 50 }));
    const app = buildApp();
    const res = await app.request("/recorder/metrics");
    const body = (await res.json()) as { recorder_blocking_emma: boolean };
    expect(body.recorder_blocking_emma).toBe(false);
  });
});
