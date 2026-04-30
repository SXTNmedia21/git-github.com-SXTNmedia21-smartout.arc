/**
 * Shared helpers for the mobile-pwa Playwright smoke suite.
 *
 * Auth: email + password login via the Expo Web verify screen.
 * Credentials fall back to the local Supabase seed user.
 * Override via E2E_TEST_EMAIL / E2E_TEST_PASSWORD env vars.
 *
 * Why email+password and not OTP:
 *   The seed user (admin@smartout.local) is created with a password in seed.sql.
 *   OTP requires an actual SMS/email delivery pipeline — not viable in CI.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const MOBILE_EMAIL =
  process.env.E2E_TEST_EMAIL ?? process.env.E2E_EMAIL ?? "admin@smartout.local";
export const MOBILE_PASSWORD =
  process.env.E2E_TEST_PASSWORD ?? process.env.E2E_PASSWORD ?? "password123";

/**
 * Signs in via the welcome → verify (login) flow.
 * Resolves once the URL includes "workspace-select" or "/(app)".
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });

  // Allow Expo Router hydration + auth redirect to settle
  await page.waitForTimeout(2_500);

  // Tap the primary login CTA on the welcome screen
  const loginCta = page.getByText(/Logg inn eller opprett konto/i).first();
  await expect(loginCta).toBeVisible({ timeout: 15_000 });
  await loginCta.tap();

  // Email field — React Native Web uses standard <input> elements
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

  // Submit — RNW renders TouchableOpacity as a plain <div> without role="button",
  // so getByRole("button") finds nothing. Target the text node directly instead.
  const submitBtn = page.getByText(/^Logg inn$/).first();
  await expect(submitBtn).toBeVisible({ timeout: 10_000 });
  await submitBtn.tap();

  // After auth, Expo Router routes to workspace-select or directly to /(app)
  await expect(page).toHaveURL(/workspace-select|\/(app)/, { timeout: 20_000 });

  // If on workspace-select, pick the first workspace (auto-select for single workspace)
  if (page.url().includes("workspace-select")) {
    const workspaceItem = page
      .locator('[data-testid*="workspace"], button, [role="button"]')
      .filter({ hasText: /\w+/ })
      .first();
    await expect(workspaceItem).toBeVisible({ timeout: 10_000 });
    await workspaceItem.tap();
    await expect(page).toHaveURL(/shift-hub|\/(app)/, { timeout: 20_000 });
  }
}
