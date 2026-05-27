/**
 * haccp-inspector web-author.spec.ts
 *
 * Desktop chrome — D3 authoring surface. Admin/manager opens /dashboard/hms,
 * invokes haccp-inspector chat. Validates surface mounts via ROUTE_MISSION_MAP
 * and BFF contract is honored. Full protocol authoring (D3 write) is covered
 * in dedicated governance tests (procedure-engine/, governance-harness).
 *
 * Runs on `web` project only.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { dismissDevOverlays, openBotssonChat } from "../_fixtures";

const REPLY =
  "Du har 8 kjøl/frys-punkter registrert. Siste avvik var fredag — temperatur 9° på kjøl 3, korrigert.";

test.describe("haccp-inspector — web author surface", () => {
  test("hms page mounts haccp-inspector, chat surface returns mocked status", async ({ page }) => {
    const captured: string[] = [];
    await page.route(/\/api\/(botsson|emma)\/chat/, async (route) => {
      captured.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: REPLY,
          intent: { capability: "haccp_status", confidence: 0.92 },
        }),
      });
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard/hms");
    await dismissDevOverlays(page);
    await openBotssonChat(page);

    await page.getByTestId("botsson-chat-input").fill("Hvordan står det til med HACCP?");
    await page.getByTestId("botsson-chat-send").click();

    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId("botsson-chat-messages")).toContainText(REPLY);
  });
});
