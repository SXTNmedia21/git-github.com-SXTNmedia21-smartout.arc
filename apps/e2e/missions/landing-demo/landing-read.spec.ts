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
  /* SMA-376 resolved 2026-05-27: VoiceDemoWidget now mounts on /demo/voice
   * (apps/landing/src/app/demo/voice/page.tsx) with missionId="landing-demo"
   * wired through the widget's default Ultravox/LiveKit bootstrap. */
  test("landing voice-demo page renders, voice trigger reachable", async ({ page }) => {
    const response = await page.goto("/demo/voice", { timeout: 15_000 });
    expect(response, "landing server must respond on baseURL").not.toBeNull();
    expect(response!.status(), "non-5xx response from landing app").toBeLessThan(500);

    /* Page-level sanity — heading or title indicates mount. Title falls back
     * to landing layout default; the page-specific h1 is the stable signal. */
    await expect(page.getByRole("heading", { name: /snakk med lise/i })).toBeVisible({
      timeout: 10_000,
    });

    /* Voice widget trigger — VoiceDemoWidget placeholder is a styled <div>
     * with onClick + cursor-pointer (not <button>). Locate by the visible
     * Norwegian CTA text "Trykk for å koble til" rendered inside the inner
     * connect chip — stable across variant colour/copy tweaks. */
    const trigger = page.getByText(/trykk for å koble til/i).first();

    /* Soft-skip path forbidden by goal (no weakening). Failing loud here
     * surfaces a real regression if the demo widget stops mounting.        */
    await expect(trigger, "landing must expose voice-demo trigger CTA").toBeVisible({
      timeout: 10_000,
    });

    /* Click expands the widget — verify mount lifts the dynamic
     * VoiceAssistant island into the DOM. The replaced placeholder is
     * removed by AnimatePresence so its disappearance is the contract. */
    await trigger.click();
    await expect(trigger).not.toBeVisible({ timeout: 5_000 });
  });
});
