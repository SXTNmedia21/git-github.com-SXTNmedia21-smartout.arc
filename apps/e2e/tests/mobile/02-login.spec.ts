/**
 * Mobile smoke 02 — Login flow
 *
 * From the welcome screen, taps "Logg inn eller opprett konto" → fills
 * email+password credentials → submits → expects redirect to either
 * workspace-select or the main /(app) shell.
 *
 * Credentials: E2E_TEST_EMAIL / E2E_TEST_PASSWORD (falls back to local defaults).
 * These should match a valid user in the local Supabase instance.
 */
import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? process.env.E2E_EMAIL ?? "admin@smartout.local";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? process.env.E2E_PASSWORD ?? "password123";

test.describe("Mobile smoke: login @smoke", () => {
  test("fills credentials and reaches workspace-select or app shell", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2_000);

    // Tap the primary login CTA on the welcome screen
    const loginCta = page.getByText(/Logg inn eller opprett konto/i).first();
    await expect(loginCta).toBeVisible({ timeout: 15_000 });
    await loginCta.tap();

    // Wait for the verify/login form to appear (email + password fields)
    const emailInput = page
      .locator('input[type="email"], input[placeholder*="post"], input[placeholder*="E-post"]')
      .first();
    await expect(emailInput).toBeVisible({ timeout: 10_000 });

    await emailInput.fill(TEST_EMAIL);

    const passwordInput = page
      .locator('input[type="password"], input[placeholder*="assord"]')
      .first();
    await expect(passwordInput).toBeVisible({ timeout: 5_000 });
    await passwordInput.fill(TEST_PASSWORD);

    // Submit — RN Web renders TouchableOpacity as a generic/div, not button role.
    // Target the last "Logg inn" text on the page (the heading says "Velkommen tilbake",
    // the submit CTA is a standalone "Logg inn" element with cursor=pointer).
    const submitBtn = page.getByText(/^Logg inn$/).last();
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    await submitBtn.tap();

    // After successful auth, Expo Router redirects to workspace-select, shift-hub,
    // or any app-shell screen. Expo Web strips group-route parens from URLs, so
    // /(app)/(home)/shift-hub → /shift-hub, /operations, etc.
    await expect(page).toHaveURL(/workspace-select|shift-hub|operations|digest|\/\(app\)/, {
      timeout: 20_000,
    });

    // No fatal runtime crashes
    expect(
      pageErrors.filter((e) => !/ResizeObserver|favicon/i.test(e)),
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    ).toHaveLength(0);
  });
});
