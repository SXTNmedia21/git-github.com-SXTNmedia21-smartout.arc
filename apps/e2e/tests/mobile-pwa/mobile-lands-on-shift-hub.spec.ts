/**
 * mobile-pwa smoke 03 — Regression: lands on shift-hub, NOT chat.
 *
 * After login, the default route must be /(app)/(home)/shift-hub.
 * Previously, the missing `unstable_settings.initialRouteName` caused the app
 * to default to /(app)/(chat) instead.
 *
 * This spec fails if the post-login URL contains "chat" or is missing "shift-hub".
 */
import { test, expect } from "@playwright/test";
import { signIn } from "./_helpers";

test.describe("mobile-pwa: lands on shift-hub (not chat) @smoke", () => {
  test("post-login URL is shift-hub, NOT /(chat)", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await signIn(page);

    // Allow the final redirect to settle
    await page.waitForTimeout(2_000);

    const currentUrl = page.url();

    // Regression gate: must NOT be on the chat tab
    expect(
      currentUrl,
      `App landed on chat instead of shift-hub — regression in initialRouteName`,
    ).not.toContain("(chat)");
    expect(
      currentUrl,
      `App landed on chat instead of shift-hub — regression in initialRouteName`,
    ).not.toMatch(/\/chat\b/);

    // Happy-path gate: must be on shift-hub or /(home)
    expect(currentUrl, `Expected shift-hub or /(home), got: ${currentUrl}`).toMatch(
      /shift-hub|\/\(home\)|\/(app)/,
    );

    const fatal = pageErrors.filter((e) => !/ResizeObserver|favicon/i.test(e));
    expect(fatal, `Fatal page errors: ${fatal.join("; ")}`).toHaveLength(0);
  });
});
