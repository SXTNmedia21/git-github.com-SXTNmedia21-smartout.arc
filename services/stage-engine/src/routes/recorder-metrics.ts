// ============================================
// recorder-metrics.ts
// GET /recorder/metrics — introspection into the Session Recorder singleton.
// Used by the web BFF proxy at /api/botsson/recorder/metrics, which is
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
import {
  getRecorder,
  setRecorderForceFailForTest,
  getRecorderForceFailForTest,
} from "../core/session-recorder.js";

const recorderMetrics = new Hono();

// Test-only UUID constants for the failure-probe endpoint. Kept stable
// so the E2E can target the same synthetic session across runs.
const TEST_PROBE_SESSION = "00000000-0000-4000-8000-000000000001";
const TEST_PROBE_WORKSPACE = "b0000000-0000-0000-0000-000000000000"; // HQ workspace from seed

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

/**
 * POST /recorder/_test_probe
 *
 * TEST-ONLY. Dev/test gated (NODE_ENV !== "production"). Pushes one
 * synthetic turn into the recorder buffer then awaits the next flush.
 *
 * Purpose: give E2E a surgical way to exercise the recorder write path
 * (including the RECORDER_FORCE_FAIL_FOR_TEST hook in session-recorder.ts)
 * without driving an Emma turn through OpenRouter. Production never reaches
 * this handler — the 404 returned when NODE_ENV==="production" is the
 * structural guard.
 *
 * The E2E sets RECORDER_FORCE_FAIL_FOR_TEST=1 in the stage-engine process,
 * POSTs here, polls `/recorder/metrics` until `error_count` climbs, and
 * asserts `recorder_blocking_emma: false`. The force-fail flag converts
 * the insert to a thrown error which is swallowed by the fire-and-forget
 * catch. Without the flag the insert succeeds and `error_count` stays 0.
 *
 * Connected to: services/stage-engine/src/core/session-recorder.ts (flush path)
 */
recorderMetrics.post("/recorder/_test_probe", async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "not_found" }, 404);
  }
  const r = getRecorder();
  if (!r) {
    return c.json({ error: "recorder_not_initialized" }, 503);
  }

  // ?force_fail=1 flips the runtime toggle so the flush path throws.
  // ?force_fail=0 clears it. Omitting leaves the current state. The toggle
  // is hard-gated behind NODE_ENV in session-recorder.ts — no production
  // execution can arm it from outside.
  const url = new URL(c.req.url);
  const forceFailParam = url.searchParams.get("force_fail");
  if (forceFailParam === "1") {
    setRecorderForceFailForTest(true);
  } else if (forceFailParam === "0") {
    setRecorderForceFailForTest(false);
  }

  r.recordTurn({
    sessionId: TEST_PROBE_SESSION,
    workspaceId: TEST_PROBE_WORKSPACE,
    turnKind: "agent_response",
    phase: "post_turn",
    content: { text: "synthetic probe turn — see recorder-metrics.ts" },
    meta: { source: "e2e_test_probe" },
  });
  // Give the recorder's setInterval flush a window to run. Flush interval
  // is 500ms by default; waiting 800ms guarantees at least one tick.
  await new Promise((resolve) => setTimeout(resolve, 800));
  return c.json({
    probed: true,
    force_fail_active: getRecorderForceFailForTest(),
    buffer_size: r.getBufferSize(),
    drop_count: r.getDropCount(),
    error_count: r.getErrorCount(),
  });
});

export { recorderMetrics };
