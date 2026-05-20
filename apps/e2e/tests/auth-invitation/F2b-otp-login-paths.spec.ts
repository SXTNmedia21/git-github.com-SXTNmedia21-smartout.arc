/**
 * F2b — OTP login: both the 6-digit code path AND the magic-link path
 *       must end in an authenticated session.
 *
 * Why this regression test exists:
 *   - Pontus reported "kode ikke valid" + "magic link funker heller ikke" in
 *     production. Two separate failure modes share one root: signInWithOtp
 *     was called without `emailRedirectTo`, so the magic link landed on
 *     site_url with `?code=PKCE_CODE` and no handler. The send-error was
 *     silently swallowed too — the digit form would render even when the
 *     send failed. Both fixed in the commit that adds this spec.
 *
 *   - The existing F2 spec stops at "OTP form rendered". It does not actually
 *     type a code, does not follow the magic link, and therefore cannot
 *     catch either of the symptoms Pontus reported.
 *
 * Two tests, two paths, one fixture send (Mailpit reuses the same email):
 *   1. Code path  — type the 6-digit code → assert navigation away from /login.
 *   2. Link path  — open the magiclink URL → assert it goes through
 *                   /api/auth/callback and ends authenticated.
 */
import { test, expect, type Page } from "@playwright/test";
import { EXISTING_USER_EMAIL, clearMailbox } from "../../helpers/auth-invitation";

const MAILPIT_BASE = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const WEB_ORIGIN = "http://localhost:3060";

type MailpitMessage = { ID: string; Subject: string };

/**
 * Pull the most recent magic-link email for `address` and extract both
 * the 6-digit OTP code and the verify URL. The default Supabase email
 * template carries both in the same message; production templates SHOULD
 * preserve this — if not, that's a template-config bug, not a code bug.
 */
async function waitForOtpEmail(
  address: string,
  timeoutMs = 20_000,
): Promise<{ code: string; verifyUrl: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${MAILPIT_BASE}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=5`,
    );
    if (search.ok) {
      const data = (await search.json()) as { messages: MailpitMessage[] };
      const magic = data.messages.find((m) => /magic|otp|code/i.test(m.Subject));
      if (magic) {
        const detail = await fetch(`${MAILPIT_BASE}/api/v1/message/${magic.ID}`);
        const body = (await detail.json()) as { HTML?: string; Text?: string };
        const haystack = (body.HTML ?? "") + "\n" + (body.Text ?? "");
        const codeMatch = haystack.match(/\b(\d{6})\b/);
        const urlMatch = haystack.match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/);
        if (codeMatch && urlMatch) {
          return {
            code: codeMatch[1]!,
            verifyUrl: urlMatch[0].replace(/&amp;/g, "&"),
          };
        }
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`No OTP email for ${address} within ${timeoutMs}ms`);
}

async function submitEmailOnOtpTab(page: Page, email: string) {
  await page.goto(`${WEB_ORIGIN}/login`);
  await page.getByRole("button", { name: "Engangskode" }).click();
  await page.locator('input[type="email"]').first().fill(email);
  await page.getByRole("button", { name: /Send kode|Sender/ }).click();
  // The page transitions to the OTP digit form once send resolves without error.
  await expect(page.getByText(/Hvis denne e-posten finnes/)).toBeVisible({
    timeout: 10_000,
  });
}

// Serial mode: both tests trigger signInWithOtp for the same user. Supabase
// Local rate-limits same-email sends, so parallel runs cause the second
// send to silently no-op and the test never sees the OTP-form transition.
test.describe.serial("F2b OTP login regressions", () => {
  test("6-digit code path — typing the code logs the user in", async ({ page }) => {
    await clearMailbox();
    await submitEmailOnOtpTab(page, EXISTING_USER_EMAIL);

    const { code } = await waitForOtpEmail(EXISTING_USER_EMAIL);
    expect(code).toMatch(/^\d{6}$/);

    // Fill all 6 inputs — the form auto-submits on the 6th digit (see
    // OtpVerificationForm.handleDigitChange). Paste-into-first is the most
    // reliable way; the paste handler distributes across all 6 inputs.
    const firstInput = page.locator('input[aria-label="Siffer 1 av 6"]');
    await firstInput.focus();
    await page
      .evaluate(async (c) => {
        await navigator.clipboard.writeText(c);
      }, code)
      .catch(() => {
        // navigator.clipboard not available in all headless contexts — fall back
        // to per-digit typing.
      });
    // Type each digit explicitly — paste is unreliable headless.
    for (let i = 0; i < 6; i++) {
      await page.locator(`input[aria-label="Siffer ${i + 1} av 6"]`).fill(code[i]!);
    }

    // After verification the page sets mode=logging-in and routes to returnTo
    // (default /dashboard) after a 1100ms animation. Wait for any non-login
    // URL — dashboard, select-workspace, or onboarding are all valid landings
    // depending on user state.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 15_000,
    });
    expect(page.url()).not.toMatch(/\/login/);
  });

  test("magic-link path — clicking the email link goes through callback", async ({ page }) => {
    await clearMailbox();
    await submitEmailOnOtpTab(page, EXISTING_USER_EMAIL);

    const { verifyUrl } = await waitForOtpEmail(EXISTING_USER_EMAIL);
    // The verify URL's `redirect_to` MUST point at /api/auth/callback so the
    // PKCE code exchange happens server-side. This is the load-bearing
    // assertion — if it regresses, the link will land on site_url with an
    // unhandled `?code=`.
    const redirectTo = new URL(verifyUrl).searchParams.get("redirect_to") ?? "";
    expect(redirectTo).toContain("/api/auth/callback");

    await page.goto(verifyUrl);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 15_000,
    });
    expect(page.url()).not.toMatch(/\/login/);
  });
});
