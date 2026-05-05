/**
 * mobile-pwa smoke 01 — App loads without React QueryClient errors.
 *
 * Regression: duplicate React / TanStack QueryClient initialization caused a
 * "No QueryClient set" error at startup. This spec catches any recurrence.
 *
 * Also asserts the Expo bundle itself returns a 200 (not a blank error page).
 * No login required — this is a cold-open check.
 */
import { test, expect } from "@playwright/test";

test.describe("mobile-pwa: app loads @smoke", () => {
  test("PWA renders Smartout branding with no QueryClient errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    const response = await page.goto("/", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Bundle must respond with 200
    expect(response?.status(), "Expected HTTP 200 from Expo bundle").toBe(200);

    // Allow time for Expo Router hydration + auth redirect
    await page.waitForTimeout(3_000);

    // Any Smartout content should appear (welcome screen or auth form)
    const content = page.getByText(/Smartout|Logg inn|Velkommen/i).first();
    await expect(content).toBeVisible({ timeout: 15_000 });

    // Regression: React-dup QueryClient error must NOT appear
    const queryClientErrors = [...consoleErrors, ...pageErrors].filter((e) =>
      /QueryClient|No QueryClient set/i.test(e),
    );

    expect(
      queryClientErrors,
      `QueryClient errors detected (regression): ${queryClientErrors.join("; ")}`,
    ).toHaveLength(0);
  });
});
