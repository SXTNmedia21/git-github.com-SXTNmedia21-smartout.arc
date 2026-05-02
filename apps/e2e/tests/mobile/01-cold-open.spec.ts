/**
 * Mobile smoke 01 — Cold open
 *
 * Verifies that the Expo PWA renders at all and shows Smartout branding or
 * the sign-in entry point. Does NOT require an authenticated session.
 *
 * Permissive: only fails on a blank page, JS error overlay, or uncaught
 * runtime crash. Routing to /(auth)/welcome is the expected happy path but
 * any non-blank page with Smartout content passes.
 */
import { test, expect } from "@playwright/test";

test.describe("Mobile smoke: cold open @smoke", () => {
  test("PWA loads and shows Smartout welcome screen", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Allow time for Expo Router hydration + auth redirect
    await page.waitForTimeout(3_000);

    // Either the welcome screen text or a login CTA must be present.
    // React Native Web renders Text nodes directly — match any visible text.
    const welcomeText = page.getByText(/Smartout|Logg inn|Velkommen/i).first();
    await expect(welcomeText).toBeVisible({ timeout: 15_000 });

    // Fail on any uncaught JS error (e.g. missing QueryClient, ReferenceError)
    expect(
      pageErrors.filter((e) => !/ResizeObserver|favicon/i.test(e)),
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    ).toHaveLength(0);
  });
});
