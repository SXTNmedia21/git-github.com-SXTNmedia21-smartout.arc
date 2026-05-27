/**
 * shift-assistant mobile-my-schedule.spec.ts
 *
 * ADR-0133 mobile boundary: D6 production only. Employee views their own
 * schedule, asks read-only question via embedded Botsson chat. NO shift
 * authoring on mobile.
 *
 * Mounted under web-iphone14 + web-pixel7 against webBaseUrl.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { dismissDevOverlays, openBotssonChat } from "../_fixtures";

const MOCK_REPLY = "Du har 2 vakter neste uke: mandag 16-23 og torsdag 17-23.";

test.describe("@mobile-ok shift-assistant — mobile my-schedule read", () => {
  test("employee asks about own schedule, UI renders mocked reply", async ({ page }) => {
    const captured: { url: string; method: string }[] = [];
    await page.route(/\/api\/(botsson|emma)\/chat/, async (route) => {
      captured.push({ url: route.request().url(), method: route.request().method() });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: MOCK_REPLY,
          intent: { capability: "get_employee_schedule", confidence: 0.94 },
        }),
      });
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard/my-schedule");
    await dismissDevOverlays(page);
    await openBotssonChat(page);

    const input = page.getByTestId("botsson-chat-input");
    await input.fill("Hva er mine vakter neste uke?");
    /* Submit via Enter — see mr-botsson/mobile-read.spec.ts rationale. */
    await input.press("Enter");

    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId("botsson-chat-messages")).toContainText(MOCK_REPLY);

    /* ADR-0133 guard: no shift mutation routes hit. */
    for (const r of captured) {
      expect(r.url).not.toMatch(/\/(create|update|delete|publish)Shift/i);
      expect(r.url).not.toMatch(/\/api\/schedule\/(create|update|delete|publish)/);
    }
  });
});
