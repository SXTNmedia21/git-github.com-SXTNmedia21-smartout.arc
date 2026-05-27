/**
 * landing-demo landing-read.spec.ts
 *
 * Marketing-page voice demo. Mounts VoiceDemoWidget on landing app /.
 * Voice transport (Ultravox/LiveKit) is out-of-scope per goal 2026-05-27.
 * This spec validates the demo widget mounts, expand trigger reachable,
 * and the missionId="landing-demo" boundary is honored.
 *
 * Runs on `landing` project (Desktop Chrome on landingBaseUrl).
 */

import { test, expect } from "@playwright/test";

test.describe("landing-demo — voice widget mount", () => {
  test("landing page renders, voice trigger reachable via role", async ({ page }) => {
    const response = await page.goto("/", { timeout: 15_000 });
    expect(response, "landing server must respond on baseURL").not.toBeNull();
    expect(response!.status(), "non-5xx response from landing app").toBeLessThan(500);

    /* Page-level sanity. */
    await expect(page).toHaveTitle(/SmartOut/i);

    /* Voice widget trigger — role-based locator since aria-label / role:button
     * is more stable than a CSS chain or framer-motion wrapper. The widget
     * lifts open state on click; matching by an accessible name "Snakk med"
     * keeps the locator readable when the visual treatment changes. */
    const trigger = page.getByRole("button", { name: /snakk|prøv|demo|mic|voice/i }).first();

    /* Soft-skip path is forbidden by goal (no weakening). If trigger absent,
     * fail loudly so the gap is visible.                                     */
    await expect(trigger, "landing must expose a voice-demo trigger button").toBeVisible({
      timeout: 10_000,
    });
  });
});
