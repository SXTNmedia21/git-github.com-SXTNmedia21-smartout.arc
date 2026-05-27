/**
 * mr-botsson web-chat.spec.ts
 *
 * Desktop chrome flow. Author + read verbs allowed (no ADR-0133 mobile
 * restriction). Validates the full chat round-trip on /dashboard:
 *   - Orb visible → click → Arena renders
 *   - State sync (data-density attribute reflects context)
 *   - Chat input + send wired via testid
 *   - BFF intercept captures payload + responds with mocked text
 *   - Mocked text appears verbatim in messages container
 *   - Send button stays enabled on subsequent input (sticky regression guard)
 *
 * Runs on `web` project only (Desktop Chrome on webBaseUrl).
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

const REPLY_1 = "Du har 4 åpne oppgaver: 2 vaktbytter, 1 HACCP-avvik, 1 onboarding.";
const REPLY_2 = "Vaktbyttene er fra Anna (fredag 17-23) og Bjørn (lørdag 12-20).";

test.describe("mr-botsson — web chat round-trip", () => {
  test("two-turn conversation, BFF intercept, contract to render parity", async ({ page }) => {
    let turnIndex = 0;
    const captured: Array<{ url: string; body: unknown; turn: number }> = [];
    await page.route(/\/api\/(botsson|emma)\/chat/, async (route) => {
      const req = route.request();
      const body = req.postDataJSON?.() ?? null;
      const turn = turnIndex;
      captured.push({ url: req.url(), body, turn });
      const reply = turn === 0 ? REPLY_1 : REPLY_2;
      turnIndex += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: reply,
          sessionId: "00000000-0000-0000-0000-00000000a002",
          intent: { capability: "summary", confidence: 0.93 },
        }),
      });
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard");

    /* Orb → Arena state sync. */
    const orb = page.getByTestId("botsson-orb");
    await expect(orb).toBeVisible({ timeout: 15_000 });
    await orb.click();

    const shell = page.getByTestId("botsson-shell");
    await expect(shell).toHaveAttribute("data-density", /arena|immersive/, { timeout: 5_000 });

    /* Turn 1. */
    const input = page.getByTestId("botsson-chat-input");
    const send = page.getByTestId("botsson-chat-send");
    await input.fill("Hva må jeg ta tak i i dag?");
    await send.click();

    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId("botsson-chat-messages")).toContainText(REPLY_1);

    /* First-turn BFF payload sanity — should carry the user message text. */
    const firstBody = captured[0]?.body as Record<string, unknown> | null;
    expect(firstBody, "BFF payload non-null").not.toBeNull();

    /* Turn 2. Sticky composer regression — send button must re-enable after
     * first turn settles, accepting a new message without page reload.      */
    await expect(send).toBeEnabled({ timeout: 10_000 });
    await input.fill("Hvilke vaktbytter?");
    await send.click();

    await expect.poll(() => captured.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId("botsson-chat-messages")).toContainText(REPLY_2);

    /* Both replies still rendered (no message loss between turns). */
    await expect(page.getByTestId("botsson-chat-messages")).toContainText(REPLY_1);
  });
});
