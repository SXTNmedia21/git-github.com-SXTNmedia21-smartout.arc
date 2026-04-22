// ============================================
// recorder-failure-resilience.spec.ts
// ADR-0184 Q8b — the Session Recorder is fire-and-forget. When the
// recorder write path (DB / Realtime / redaction) fails, Emma MUST
// keep responding to the user. Errors drop into a ring-buffer metric,
// not the critical path.
//
// Acceptance:
//   1. Read baseline metrics from /api/botsson/recorder/_metrics
//   2. Inject a recorder failure (DB error or forced flush failure)
//   3. User sends a message to Emma
//   4. Assistant response arrives normally (no stall, no error)
//   5. error_count strictly increases; recorder_blocking_emma === false
//
// ---------------------------------------------------------------------
// STATUS (2026-04-23): pending-infra — failure-injection surface missing.
//
// What IS built (Phase 2a):
//   - GET /api/botsson/recorder/_metrics (godmode-gated, proxies to
//     stage-engine /recorder/metrics). Returns the four fields this
//     spec reads.
//   - The recorder IS fire-and-forget in source
//     (services/stage-engine/src/core/session-recorder.ts): insert
//     errors increment errors++ in a try/catch, never thrown.
//
// What is MISSING:
//   - A supported failure-injection surface. Neither
//     `/platform-admin/debug` page nor an admin toggle
//     "Simulate recorder failure" exists. The recorder has no env
//     flag like `RECORDER_FORCE_FAIL=1` to corrupt the insert path.
//   - The spec's original assertion used a UI toggle that was never
//     designed or built. ADR-0184 Q8b is covered by a stage-engine
//     UNIT test (services/stage-engine/src/core/session-recorder.test.ts)
//     that monkey-patches the Supabase client — that unit covers the
//     invariant but at a lower fidelity than E2E.
//
// Green gate (in order):
//   (a) Stage-engine exposes a test-only failure toggle. Candidate:
//       env var RECORDER_FORCE_FAIL_FOR_TEST that, when set truthy,
//       replaces the supabase .insert() call with `throw new Error`.
//       Must be hard-gated behind NODE_ENV!==production.
//   (b) A web admin toggle at /platform-admin/debug that flips the
//       env flag via stage-engine control channel. Alternatively, the
//       spec reads a direct stage-engine HTTP endpoint with godmode
//       x-api-key.
//   (c) Supabase Local + Next dev + stage-engine running per
//       schedule-wrong-day-replay.spec.ts header.
//
// Phase 2d candidate. Not blocked by any ADR — just missing surface.
// ============================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

const SKIP_UNTIL_FAILURE_PROBE = true;

test.describe("Recorder failure resilience (ADR-0184 Q8b)", () => {
  test.skip(
    SKIP_UNTIL_FAILURE_PROBE,
    "Failure-injection surface not built: no /platform-admin/debug toggle, no RECORDER_FORCE_FAIL env flag on stage-engine. Invariant is covered at unit level (session-recorder.test.ts); E2E waits on Phase 2d harness. See file header.",
  );

  test("Emma keeps responding when the recorder write path is broken", async ({ page }) => {
    await loginAsAdmin(page);

    // 1. Baseline metrics. Shape per recorder-metrics.ts:
    //    { buffer_size, drop_count, error_count, recorder_blocking_emma }
    const baselineRes = await page.request.get("/api/botsson/recorder/_metrics");
    expect(baselineRes.ok()).toBe(true);
    const baseline = (await baselineRes.json()) as {
      buffer_size: number;
      drop_count: number;
      error_count: number;
      recorder_blocking_emma: boolean;
    };

    // 2. Toggle recorder failure. Debug route does not exist yet —
    //    see file header. Once (a)+(b) land this page.goto will
    //    resolve to the toggle surface.
    await page.goto("/platform-admin/debug", { waitUntil: "domcontentloaded" });
    const failToggle = page.getByLabel("Simulate recorder failure");
    await expect(failToggle).toBeVisible({ timeout: 5_000 });
    await failToggle.check();

    // 3. Trigger a user turn. Assistant response within 15s even when
    //    recorder is down — that is the Q8b invariant.
    //
    //    NOTE: Driving Botsson chat end-to-end from this test needs
    //    the employee user, not the admin login. For a faithful
    //    reproduction, send the user message via /api/emma/chat with
    //    an employee Bearer token — the harness from Phase 2d should
    //    provide this helper. Kept as placeholder below.
    const emmaRes = await page.request.post("/api/emma/chat", {
      data: {
        workspaceId: "b0000000-0000-0000-0000-000000000000",
        userMessage: "Hei Emma, hva er mitt neste skift?",
      },
    });
    expect(emmaRes.ok(), "Emma responded 5xx while recorder was failing").toBe(true);
    const emmaBody = (await emmaRes.json()) as { text: string };
    expect(emmaBody.text?.length ?? 0).toBeGreaterThan(0);

    // 4. Metrics after the failing flush window. error_count must
    //    strictly increase; recorder_blocking_emma must stay false
    //    under any failure mode (ADR-0184 Q8b structural invariant).
    const afterRes = await page.request.get("/api/botsson/recorder/_metrics");
    expect(afterRes.ok()).toBe(true);
    const after = (await afterRes.json()) as typeof baseline;

    expect(after.error_count).toBeGreaterThan(baseline.error_count);
    expect(after.recorder_blocking_emma).toBe(false);
  });
});
