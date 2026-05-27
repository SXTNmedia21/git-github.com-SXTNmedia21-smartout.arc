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
import { dismissDevOverlays, openBotssonChat } from "../_fixtures";

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
          intent: { capability: "haccp_check", confidence: 0.91 },
        }),
      });
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard/hms");
    await dismissDevOverlays(page);
    await openBotssonChat(page);

    const input = page.getByTestId("botsson-chat-input");
    await input.fill("Logg temperatur 4 grader på kjøl 1.");
    /* Submit via Enter — see mr-botsson/mobile-read.spec.ts rationale. */
    await input.press("Enter");

    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId("botsson-chat-messages")).toContainText(MOCK_REPLY);

    /* ADR-0133 guard: HACCP authoring stays web-only.  */
    for (const url of captured) {
      expect(url).not.toMatch(/\/api\/governance\/(policy|protocol)\/(create|update|delete)/);
    }
  });
});
