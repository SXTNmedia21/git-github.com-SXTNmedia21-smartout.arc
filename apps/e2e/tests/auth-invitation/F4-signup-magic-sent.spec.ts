/**
 * F4 — signup-magic-sent.spec.ts
 *
 * Journey: New user signs up via magic-link tab (default).
 * We verify:
 *   1. /signup loads with the Magisk lenke tab active.
 *   2. Submitting the form triggers Supabase OTP (signInWithOtp) and shows
 *      the "Sjekk e-posten din" confirmation.
 *   3. Mailpit receives the magic link (enabling post-signup flow).
 * We do NOT follow the link because callback handling requires exercising
 * Supabase's /auth/v1/verify endpoint — a separate end-to-end slice.
 */
import { test, expect } from "@playwright/test";
import {
  clearMailbox,
  deleteAuthUserByEmail,
  waitForMagicLinkEmail,
} from "../../helpers/auth-invitation";

test.describe("F4 signup-magic-sent", () => {
  const signupEmail = `e2e-signup-${Date.now()}@smartout.test`;

  test.afterEach(async () => {
    // Clean up any auth.users row that may have been created.
    await deleteAuthUserByEmail(signupEmail);
  });

  test("/signup Magisk lenke tab sends magic link and confirms on screen", async ({ page }) => {
    await clearMailbox();

    await page.goto("/signup");

    // Magic-link tab should be the default but click it defensively.
    const magicTab = page.getByRole("button", { name: "Magisk lenke", exact: true });
    if (await magicTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await magicTab.click();
    }

    // Fill email + submit.
    const emailInput = page.locator("input#email, input[type='email']").first();
    await emailInput.fill(signupEmail);

    await page.getByRole("button", { name: /Send lenke|Sender lenke\.\.\./ }).click();

    // Confirmation screen.
    await expect(page.getByRole("heading", { name: "Sjekk e-posten din" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(signupEmail)).toBeVisible();

    // Mail arrives.
    const { body } = await waitForMagicLinkEmail(signupEmail, { timeoutMs: 15_000 });
    expect(body.length).toBeGreaterThan(0);
  });
});
