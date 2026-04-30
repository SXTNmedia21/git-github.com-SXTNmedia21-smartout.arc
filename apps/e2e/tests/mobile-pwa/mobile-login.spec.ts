/**
 * mobile-pwa smoke 02 — Login flow.
 *
 * Navigates welcome → "Logg inn eller opprett konto" → fills email+password
 * → submits → asserts the app reaches workspace-select or the (app) shell.
 *
 * Uses the local Supabase seed user (admin@smartout.local / password123).
 * Override via E2E_TEST_EMAIL / E2E_TEST_PASSWORD.
 */
import { test, expect } from "@playwright/test";
import { MOBILE_EMAIL, MOBILE_PASSWORD } from "./_helpers";

test.describe("mobile-pwa: login @smoke", () => {
  test("welcome screen → credentials → reaches workspace-select or (app)", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2_500);

    const loginCta = page.getByText(/Logg inn eller opprett konto/i).first();
    await expect(loginCta).toBeVisible({ timeout: 15_000 });
    await loginCta.tap();

    const emailInput = page
      .locator('input[type="email"], input[placeholder*="post"], input[placeholder*="E-post"]')
      .first();
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill(MOBILE_EMAIL);

    const passwordInput = page
      .locator('input[type="password"], input[placeholder*="assord"]')
      .first();
    await expect(passwordInput).toBeVisible({ timeout: 5_000 });
    await passwordInput.fill(MOBILE_PASSWORD);

    // RNW renders TouchableOpacity as a plain <div> without role="button".
    // Use text-based selector instead of getByRole("button").
    const submitBtn = page.getByText(/^Logg inn$/).first();
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    await submitBtn.tap();

    await expect(page).toHaveURL(/workspace-select|\/(app)/, { timeout: 20_000 });

    const fatal = pageErrors.filter((e) => !/ResizeObserver|favicon/i.test(e));
    expect(fatal, `Fatal page errors after login: ${fatal.join("; ")}`).toHaveLength(0);
  });
});
