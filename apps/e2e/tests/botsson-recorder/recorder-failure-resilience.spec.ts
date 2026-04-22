// ============================================
// recorder-failure-resilience.spec.ts
// ADR-0184 Q8b — the Session Recorder is fire-and-forget. When the
// recorder write path (DB / Realtime / redaction) fails, Emma MUST
// keep responding to the user. Errors drop into a ring-buffer metric,
// not the critical path.
//
// What this test verifies:
//   1. Baseline `/recorder/metrics` (error_count, recorder_blocking_emma).
//   2. Arm the failure-injection toggle via the stage-engine test probe.
//   3. Push one synthetic turn through the flush path and let it fail.
//   4. Assert: error_count strictly increased AND recorder_blocking_emma
//      is still false (Q8b structural invariant).
//   5. Disarm the toggle so subsequent tests don't inherit failure mode.
//
// Why NOT drive Emma end-to-end here: Emma requires OpenRouter LLM calls
// which are expensive, non-deterministic, and require a real API key in
// the test environment. The invariant under test is purely architectural:
// "recorder errors do not propagate". We verify it at the narrowest
// possible surface — recorder flush path — via a dev-only probe endpoint
// (`POST /recorder/_test_probe`) that records one synthetic turn and
// awaits the flush tick. That endpoint is hard-gated behind NODE_ENV !==
// "production" in both session-recorder.ts (the toggle) and
// recorder-metrics.ts (the endpoint) — see file headers there.
//
// The web BFF `/api/botsson/recorder/metrics` proxies to stage-engine
// with the godmode gate in front, so the read path exercises the real
// auth chain the admin UI uses.
// ============================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

// Stage-engine URL + API key must match what the web BFF uses. The
// start-local-next-app.sh script exports both with these defaults.
const STAGE_ENGINE_URL =
  process.env.STAGE_ENGINE_URL ??
  process.env.NEXT_PUBLIC_STAGE_ENGINE_URL ??
  "http://127.0.0.1:5010";
const STAGE_ENGINE_API_KEY =
  process.env.STAGE_ENGINE_API_KEY ?? "test-dev-api-key-for-local-e2e-12345";

type Metrics = {
  buffer_size: number;
  drop_count: number;
  error_count: number;
  recorder_blocking_emma: boolean;
};

test.describe("Recorder failure resilience (ADR-0184 Q8b)", () => {
  test("recorder errors climb without blocking Emma (fire-and-forget)", async ({ page }) => {
    await loginAsAdmin(page);

    // 1. Baseline via the BFF proxy. Shape per recorder-metrics.ts:
    //    { buffer_size, drop_count, error_count, recorder_blocking_emma }
    const baselineRes = await page.request.get("/api/botsson/recorder/metrics");
    expect(baselineRes.ok(), `BFF metrics proxy not reachable: ${baselineRes.status()}`).toBe(true);
    const baseline = (await baselineRes.json()) as Metrics;
    expect(baseline.recorder_blocking_emma).toBe(false);

    // 2. Arm the runtime force-fail toggle + push one synthetic turn.
    //    We hit stage-engine directly here (bypassing the BFF) because the
    //    probe endpoint is a stage-engine test affordance, not a product
    //    surface — there is intentionally no BFF proxy for it.
    const armRes = await page.request.post(
      `${STAGE_ENGINE_URL}/recorder/_test_probe?force_fail=1`,
      {
        headers: { "x-api-key": STAGE_ENGINE_API_KEY },
      },
    );
    expect(
      armRes.ok(),
      `Stage-engine probe endpoint unreachable or returns non-OK (${armRes.status()}).
Is stage-engine running in NODE_ENV!=="production" and is the probe route mounted?`,
    ).toBe(true);
    const armBody = (await armRes.json()) as {
      probed: boolean;
      force_fail_active: boolean;
      error_count: number;
    };
    expect(armBody.probed).toBe(true);
    expect(armBody.force_fail_active).toBe(true);

    // 3. Re-read metrics via the BFF. The force_fail toggle routed a flush
    //    through the catch-branch, which increments errors. The BFF MUST
    //    NOT start returning 5xx just because recorder errors exist —
    //    that would itself violate Q8b at the admin-visibility layer.
    const afterRes = await page.request.get("/api/botsson/recorder/metrics");
    expect(afterRes.ok()).toBe(true);
    const after = (await afterRes.json()) as Metrics;

    // 4. Q8b invariants:
    //    (a) error_count strictly increased — we armed the fail flag and
    //        ran at least one flush tick.
    //    (b) recorder_blocking_emma is false — ADR-0184 Q8b requires this
    //        be structurally true regardless of error state.
    expect(
      after.error_count,
      `error_count did not climb (baseline=${baseline.error_count}, after=${after.error_count}).
Either the probe did not reach the flush path or the force-fail hook is unarmed.`,
    ).toBeGreaterThan(baseline.error_count);
    expect(after.recorder_blocking_emma).toBe(false);

    // 5. Disarm so subsequent tests in the same process are not infected.
    const disarmRes = await page.request.post(
      `${STAGE_ENGINE_URL}/recorder/_test_probe?force_fail=0`,
      {
        headers: { "x-api-key": STAGE_ENGINE_API_KEY },
      },
    );
    expect(disarmRes.ok()).toBe(true);
    const disarmBody = (await disarmRes.json()) as { force_fail_active: boolean };
    expect(disarmBody.force_fail_active).toBe(false);
  });
});
