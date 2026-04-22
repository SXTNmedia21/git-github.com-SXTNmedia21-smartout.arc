/**
 * F2 — login-magic.spec.ts
 *
 * Journey: Returning user logs in via magic-link / OTP.
 * Current /login shipping: "Engangskode" tab (not "Magisk lenke") sends
 * an OTP code via Supabase signInWithOtp(shouldCreateUser=false).
 * We verify the email arrives in Mailpit — full click-through is not
 * required because click-through requires OTP input by the user, and
 * the OTP digits are inside the email body.
 */
import { test, expect } from "@playwright/test";
import {
  EXISTING_USER_EMAIL,
  clearMailbox,
  waitForMagicLinkEmail,
} from "../../helpers/auth-invitation";

test.describe("F2 login-magic", () => {
  test("OTP tab sends email and confirms on screen", async ({ page }) => {
    await clearMailbox();

    await page.goto("/login");

    // Click the Engangskode tab.
    const otpTab = page.getByRole("button", { name: "Engangskode", exact: true });
    await expect(otpTab).toBeVisible({ timeout: 10_000 });
    await otpTab.click();

    // Fill the OTP email input.
    const otpEmail = page.locator('input#otp-email, input[type="email"]').last();
    await otpEmail.fill(EXISTING_USER_EMAIL);

    // Click "Send kode".
    const sendBtn = page.getByRole("button", { name: /Send kode|Sender\.\.\./ });
    await sendBtn.click();

    // Success text — the template uses "Hvis denne e-posten finnes…"
    await expect(page.getByText(/Hvis denne e-posten finnes, har vi sendt en kode/)).toBeVisible({
      timeout: 10_000,
    });

    // Mailpit received the OTP email (tokens/links in the body).
    const { body } = await waitForMagicLinkEmail(EXISTING_USER_EMAIL, { timeoutMs: 15_000 });
    expect(body.length).toBeGreaterThan(0);
    // Supabase OTP emails include a 6-digit token and a magic link URL. Either is fine.
    const hasTokenOrLink = /\b\d{6}\b/.test(body) || /https?:\/\/127\.0\.0\.1|localhost/.test(body);
    expect(hasTokenOrLink).toBe(true);
  });
});
