/**
 * haccp-inspector mobile-run-check.spec.ts
 *
 * ADR-0133 mobile boundary: D6 production. Mobile is where checks actually
 * run — temperature reading, deviation report. NO HACCP authoring (D3) on
 * mobile per ADR-0133. NO biometric/camera path here (separate spec scope).
 *
 * Mounted under web-iphone14 + web-pixel7.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

const MOCK_REPLY = "Bra. Temperaturen er innenfor. Loggen er signert.";

test.describe("@mobile-ok haccp-inspector — mobile run-check", () => {
  test("operator triggers HACCP read via chat, UI renders inspector reply", async ({ page }) => {
    const captured: string[] = [];
    await page.route(/\/api\/(botsson|emma)\/chat/, async (route) => {
      captured.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: MOCK_REPLY,
          sessionId: "00000000-0000-0000-0000-00000000c001",
          intent: { capability: "haccp_check", confidence: 0.91 },
        }),
      });
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard/hms");

    const orb = page.getByTestId("botsson-orb");
    await expect(orb).toBeVisible({ timeout: 15_000 });
    await orb.click();

    const shell = page.getByTestId("botsson-shell");
    await expect(shell).toHaveAttribute("data-density", /arena|immersive/, { timeout: 5_000 });

    await page.getByTestId("botsson-chat-input").fill("Logg temperatur 4 grader på kjøl 1.");
    await page.getByTestId("botsson-chat-send").click();

    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId("botsson-chat-messages")).toContainText(MOCK_REPLY);

    /* ADR-0133 guard: HACCP authoring stays web-only.  */
    for (const url of captured) {
      expect(url).not.toMatch(/\/api\/governance\/(policy|protocol)\/(create|update|delete)/);
    }
  });
});
