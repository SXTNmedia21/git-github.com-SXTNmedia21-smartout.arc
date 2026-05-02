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
 * Resolves once the app has landed on any authenticated route.
 *
 * Expo Router path-group notes:
 *   - Route groups like (app), (home) are stripped from the URL bar, so
 *     "/(app)/(home)/shift-hub" renders as "/shift-hub" in the browser.
 *   - workspace-select auto-redirects immediately for single-profile users.
 *   - We wait for any authenticated route (shift-hub, operations, digest, etc.)
 *     rather than asserting a specific path to avoid brittleness.
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

  // After Supabase auth completes, Expo Router goes through workspace-select then
  // redirects to the first authenticated home screen. Single-profile users are
  // auto-redirected immediately; workspace-select is never interactive for them.
  //
  // Wait until the URL has left ALL auth screens (verify/workspace-select).
  // Expo Router strips path-group parens, so /(app)/(home)/shift-hub renders as
  // /shift-hub — but when the home group's index route is the default, Expo may
  // resolve /(app) to "/" (bare root). We accept any URL that is no longer an
  // auth screen (verify, workspace-select) as a successful authenticated landing.
  await page.waitForURL((url) => !/(verify|workspace-select)/.test(url.pathname), {
    timeout: 25_000,
  });
}
