// ============================================
// recorder-failure-resilience.spec.ts
// ADR-0184 Q8b — the Session Recorder is fire-and-forget. When the recorder
// write path (DB / Realtime / redaction) fails, Emma MUST keep responding to
// the user. Errors drop into a ring-buffer metric, not the critical path.
//
// Acceptance:
//   1. Inject a recorder failure (debug flag or env)
//   2. User sends a message to Emma
//   3. Assistant response arrives normally (no stall, no error surfaced)
//   4. Drop-count metric is visible via debug endpoint / metrics surface
//
// ---------------------------------------------------------------------
// STATUS: TDD, pending-infra.
//
// Neither `/platform-admin/debug` (recorder failure toggle) nor
// `/api/botsson/recorder/_metrics` (drop-count read) exists yet. Both are
// Phase 2 additions — the session-recorder helper under
//   services/stage-engine/src/core/session-recorder.ts
// already counts errors internally, but nothing exposes that count to web
// callers. The resilience behaviour itself is implemented (the recorder
// catches and logs, never throws) — the assertion surface is what is
// missing.
//
// When Phase 2 ships:
//   - Add /api/botsson/recorder/_metrics (platform-admin-only, RLS godmode)
//   - Add a recorder.force_error_for_test env flag or admin toggle
//   - Flip SKIP_UNTIL_PROBES → false
// ============================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

const SKIP_UNTIL_PROBES = true;

test.describe("Recorder failure resilience (ADR-0184 Q8b)", () => {
  test.skip(SKIP_UNTIL_PROBES, "Metrics endpoint + failure toggle pending — Phase 2");

  test("Emma keeps responding when the recorder write path is broken", async ({ page }) => {
    await loginAsAdmin(page);

    // 1. Read baseline drop count. The probe returns JSON
    //    { error_count: number, drop_count: number, recorder_blocking_emma: boolean }
    const baselineRes = await page.request.get("/api/botsson/recorder/_metrics");
    expect(baselineRes.ok()).toBe(true);
    const baseline = await baselineRes.json();

    // 2. Toggle recorder failure. Debug route is expected to expose a simple
    //    POST endpoint / admin control. Until it lands the test cannot be
    //    unskipped.
    await page.goto("/platform-admin/debug", { waitUntil: "domcontentloaded" });
    const failToggle = page.getByLabel("Simulate recorder failure");
    await expect(failToggle).toBeVisible({ timeout: 5_000 });
    await failToggle.check();

    // 3. Trigger a user turn. If the recorder is blocking Emma, this will
    //    either stall or surface an error — both fail the test.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: /botsson|emma/i })
      .first()
      .click();

    const chatInput = page.getByPlaceholder(/Skriv til Emma|Skriv en melding/i).first();
    await chatInput.fill("Hei Emma, hva er mitt neste skift?");
    await page.getByRole("button", { name: /send/i }).first().click();

    // Assistant reply within 15s — normal SLA even when recorder is down.
    const agentBubble = page.locator("[data-role='agent']").last();
    await expect(agentBubble).toBeVisible({ timeout: 15_000 });

    // 4. Drop-count / error-count strictly increased. recorder_blocking_emma
    //    invariant — always false regardless of injected failure.
    const afterRes = await page.request.get("/api/botsson/recorder/_metrics");
    expect(afterRes.ok()).toBe(true);
    const after = await afterRes.json();

    expect(after.error_count).toBeGreaterThan(Number(baseline.error_count ?? 0));
    expect(after.recorder_blocking_emma).toBe(false);
  });
});
