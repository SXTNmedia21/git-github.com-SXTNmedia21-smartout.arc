/**
 * onboarding-interview web-author.spec.ts
 *
 * ADR-0133 author-only — onboarding is a D1-D5 setup verb. Web-only.
 *
 * Targets /dashboard/onboarding-assistant. ROUTE_MISSION_MAP wires the
 * mission to BotssonShell on this route; AssistantUI placeholder renders
 * the page header + tool bridges. Real onboarding session bootstrap is
 * out-of-scope (covered by onboarding-harness + dashboard-setup-wizard-deep).
 *
 * Runs on `web` project only.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

const REPLY = "Vi setter opp Smartout for deg. Hva heter du? — Vi starter med å hente bedriften.";

test.describe("onboarding-interview — web author surface", () => {
  test("/dashboard/onboarding-assistant mounts mission, chat reachable", async ({ page }) => {
    const captured: string[] = [];
    await page.route(/\/api\/(botsson|emma)\/chat/, async (route) => {
      captured.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: REPLY,
          sessionId: "00000000-0000-0000-0000-00000000d001",
          intent: { capability: "onboarding_open", confidence: 0.97 },
        }),
      });
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard/onboarding-assistant");

    /* Orb mounted via DashboardShell → BotssonHost → BotssonShell. */
    const orb = page.getByTestId("botsson-orb");
    await expect(orb).toBeVisible({ timeout: 15_000 });
    await orb.click();

    const shell = page.getByTestId("botsson-shell");
    await expect(shell).toHaveAttribute("data-density", /arena|immersive/, { timeout: 5_000 });

    await page.getByTestId("botsson-chat-input").fill("La oss starte oppsettet.");
    await page.getByTestId("botsson-chat-send").click();

    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId("botsson-chat-messages")).toContainText(REPLY);
  });
});
