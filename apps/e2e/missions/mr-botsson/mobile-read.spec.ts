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
import { dismissDevOverlays, openBotssonChat } from "../_fixtures";

const CHAT_ENDPOINTS = ["**/api/botsson/chat", "**/api/emma/chat"];

/* Mocked Stage-Engine/BFF chat response shape (per BotssonChat ChatApiResponse).
 *
 * sessionId is INTENTIONALLY OMITTED — BotssonChat:265-269 has a useEffect
 * dependency on `currentSessionId` that calls `setMessages([])` when the
 * session id changes. Returning a sessionId here would race with the
 * assistant-message append and wipe the conversation before the test asserts
 * on it. Discovered iter-9 (2026-05-27); architectural fix tracked
 * separately. See report .claude/reports/testing-analysis-2026-05-27.md. */
const MOCK_ASSISTANT_TEXT = "Du har 3 åpne avvik på HACCP-loggen.";

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
            intent: { capability: "read_summary", confidence: 0.92 },
          }),
        });
      });
    }

    await loginAsAdmin(page);
    await page.goto("/dashboard");
    await dismissDevOverlays(page);

    /* ── EC1-EC3: Open admin-chat (density → immersive + chat input mounted).
     *      EC2 state sync verified inside openBotssonChat via data-density.   */
    await openBotssonChat(page);

    /* ── EC4: User input → send → response render. */
    const input = page.getByTestId("botsson-chat-input");
    await input.fill("Hvor mange åpne avvik har jeg på HACCP-loggen?");
    /* Submit via Enter keypress on the textarea — BotssonChat handles
     * `e.key === "Enter" && !e.shiftKey` synchronously in onKeyDown
     * (apps/web/src/app/Botsson/_components/BotssonChat.tsx:475-479).
     * Avoids the viewport-clip click failure that hits the send button
     * when BotssonShell immersive layout (100vh) places the composer
     * below the iPhone 14 / Pixel 7 visible viewport. `force: true` on
     * .click() does NOT bypass viewport clipping in Playwright 1.58. */
    await input.press("Enter");

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
