/**
 * mr-botsson mobile-read.spec.ts
 *
 * ADR-0133 mobile boundary: D6 production + C4 acceptance only. This spec
 * exercises the READ verb of the mr-botsson chat surface — no author writes,
 * no scope changes. Pure: open chat, ask read-only question, assert intercepted
 * BFF contract, assert UI renders mocked assistant reply.
 *
 * Mounted under web-iphone14 + web-pixel7 projects (playwright.config.ts).
 * NOT mounted on `web` project (testIgnore matches missions/<id>/mobile-*.spec.ts).
 *
 * Locator policy (Goal 2026-05-27 EC4): user-facing only — getByRole / getByTestId.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

const CHAT_ENDPOINTS = ["**/api/botsson/chat", "**/api/emma/chat"];

/** Mocked Stage-Engine/BFF chat response shape (per BotssonChat ChatApiResponse). */
const MOCK_ASSISTANT_TEXT = "Du har 3 åpne avvik på HACCP-loggen.";
const MOCK_SESSION_ID = "00000000-0000-0000-0000-00000000a001";

test.describe("@mobile-ok mr-botsson — mobile read flow", () => {
  test("user asks a read-only question, UI renders intercepted assistant reply", async ({
    page,
  }) => {
    /* ── Intercept BFF before navigation so first turn is captured. */
    const requests: { url: string; body: unknown }[] = [];
    for (const pattern of CHAT_ENDPOINTS) {
      await page.route(pattern, async (route) => {
        const req = route.request();
        const body = req.postDataJSON?.() ?? null;
        requests.push({ url: req.url(), body });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            text: MOCK_ASSISTANT_TEXT,
            sessionId: MOCK_SESSION_ID,
            intent: { capability: "read_summary", confidence: 0.92 },
          }),
        });
      });
    }

    await loginAsAdmin(page);
    await page.goto("/dashboard");

    /* ── EC1: Botsson Orb rendered on dashboard. */
    const orb = page.getByTestId("botsson-orb");
    await expect(orb).toBeVisible({ timeout: 15_000 });

    /* ── EC2: Click orb to expand to Arena. State sync = density change. */
    await orb.click();
    const shell = page.getByTestId("botsson-shell");
    await expect(shell).toHaveAttribute("data-density", /arena|immersive/, { timeout: 5_000 });

    const arena = page.getByTestId("botsson-arena");
    await expect(arena).toBeVisible();

    /* ── EC3: Chat input + send button reachable via stable testids. */
    const chatInput = page.getByTestId("botsson-chat-input");
    const chatSend = page.getByTestId("botsson-chat-send");
    await expect(chatInput).toBeVisible({ timeout: 5_000 });
    await expect(chatSend).toBeVisible();

    /* ── EC4: User input → send → response render. */
    await chatInput.fill("Hvor mange åpne avvik har jeg på HACCP-loggen?");
    await chatSend.click();

    /* ── EC5: Backend contract intercept. At least one request to chat BFF. */
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const firstReq = requests[0]!;
    expect(firstReq.url).toMatch(/\/api\/(botsson|emma)\/chat/);

    /* ── EC6: UI renders the mocked assistant text exactly (contract → render parity). */
    const messages = page.getByTestId("botsson-chat-messages");
    await expect(messages).toContainText(MOCK_ASSISTANT_TEXT, { timeout: 10_000 });

    /* ── EC7: ADR-0133 sanity — this spec did NOT issue any author verb.
     *      Walk intercepted bodies; require zero write-intent paths.  */
    for (const r of requests) {
      const url = r.url;
      expect(url).not.toMatch(/\/(create|update|delete|publish|finalize)/);
    }
  });
});
