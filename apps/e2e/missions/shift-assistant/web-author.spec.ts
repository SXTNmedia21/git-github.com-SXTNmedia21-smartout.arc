/**
 * shift-assistant web-author.spec.ts
 *
 * Desktop chrome — D4/D5 author flow. Manager invokes chat on
 * /dashboard/schedule, asks to read coverage gap (read-side validates the
 * shift-assistant capability lookup). Write tools (createShift, etc.) need
 * deeper fixture seeding handled in dedicated harness — covered as a
 * read-side contract test here, mutating spec lives in
 * tests/specs/dayplanner/ + schedule-harness.
 *
 * Runs on `web` project only.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { dismissDevOverlays, openBotssonChat } from "../_fixtures";

const REPLY = "Fredag 17-23 mangler 1 kokk og 1 servitør. Anna er ledig — vil du legge henne på?";

test.describe("shift-assistant — web author surface", () => {
  test("schedule page mounts shift-assistant, chat invoke returns mocked coverage", async ({
    page,
  }) => {
    const captured: string[] = [];
    await page.route(/\/api\/(botsson|emma)\/chat/, async (route) => {
      captured.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: REPLY,
          intent: { capability: "get_coverage", confidence: 0.95 },
        }),
      });
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard/schedule");
    await dismissDevOverlays(page);
    await openBotssonChat(page);

    await page.getByTestId("botsson-chat-input").fill("Hva mangler jeg av dekning på fredag?");
    await page.getByTestId("botsson-chat-send").click();

    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId("botsson-chat-messages")).toContainText(REPLY);
  });
});
