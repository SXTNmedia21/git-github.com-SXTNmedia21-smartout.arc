// ============================================
// recorder-metrics.ts
// GET /recorder/metrics — introspection into the Session Recorder singleton.
// Used by the web BFF proxy at /api/botsson/recorder/_metrics, which is
// consumed by the recorder-failure-resilience E2E spec.
//
// Exposes three counters plus the Q8b invariant:
//   buffer_size            — rows currently queued for flush
//   drop_count             — rows dropped because buffer was full
//   error_count            — failed Supabase INSERT calls (post-flush)
//   recorder_blocking_emma — ALWAYS false per ADR-0184 Q8b fire-and-forget
//
// No auth here — the web BFF gates on godmode before proxying. Stage-engine
// auth middleware (x-api-key / JWT) runs upstream on all non-/health paths.
//
// Connected to: src/core/session-recorder.ts (getRecorder singleton)
// ============================================

import { Hono } from "hono";
import { getRecorder } from "../core/session-recorder.js";

const recorderMetrics = new Hono();

/**
 * GET /recorder/metrics
 *
 * Returns recorder health counters. When the singleton is absent (startup
 * race, test environment, recorder construction failure), returns zero-
 * state — the absence is itself a healthy "we captured nothing" state,
 * not an error.
 */
recorderMetrics.get("/recorder/metrics", (c) => {
  const r = getRecorder();
  return c.json({
    buffer_size: r?.getBufferSize() ?? 0,
    drop_count: r?.getDropCount() ?? 0,
    error_count: r?.getErrorCount() ?? 0,
    // ADR-0184 Q8b: recorder is fire-and-forget by contract. A failing
    // recorder must NEVER degrade the Emma primary path. Exposing this as
    // a boolean lets the E2E assert the invariant at the BFF level.
    recorder_blocking_emma: false,
  });
});

export { recorderMetrics };
