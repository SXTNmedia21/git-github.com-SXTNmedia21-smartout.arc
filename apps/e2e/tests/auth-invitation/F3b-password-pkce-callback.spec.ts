/**
 * F3b — password-reset PKCE callback end-to-end.
 *
 * Regression test for the bug where /update-password bounced to /reset-password
 * because the page only inspected `#access_token` hash but `@supabase/ssr`
 * defaults to PKCE which delivers `?code=...`. Fix routes the recovery link
 * through /api/auth/callback (commit c29155e6c).
 *
 * What this test proves (and the existing F3 spec does NOT):
 *   1. The reset email's `redirect_to` parameter points at /api/auth/callback?next=/update-password
 *      (not directly at /update-password).
 *   2. Following the Supabase verify URL in a real browser lands on /update-password
 *      with the form visible — NOT bounced to /reset-password.
 *   3. The recovery session is active (form fields enabled, `ready` state reached).
 */
import { test, expect } from "@playwright/test";
import { EXISTING_USER_EMAIL, clearMailbox } from "../../helpers/auth-invitation";

const MAILPIT_BASE = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitMessage = { ID: string; Subject: string };

async function waitForRecoveryEmail(
  address: string,
  timeoutMs = 20_000,
): Promise<{ verifyUrl: string; redirectTo: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_BASE}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=5`,
    );
    if (res.ok) {
      const data = (await res.json()) as { messages: MailpitMessage[] };
      const recovery = data.messages.find((m) => /reset|recover/i.test(m.Subject));
      if (recovery) {
        const detail = await fetch(`${MAILPIT_BASE}/api/v1/message/${recovery.ID}`);
        const body = (await detail.json()) as { HTML?: string; Text?: string };
        const haystack = (body.HTML ?? "") + "\n" + (body.Text ?? "");
        // Pull the bare verify link — strip HTML-entity-encoded ampersands.
        const match = haystack.match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/);
        if (match) {
          const verifyUrl = match[0].replace(/&amp;/g, "&");
          const params = new URL(verifyUrl).searchParams;
          const redirectTo = params.get("redirect_to") ?? "";
          return { verifyUrl, redirectTo };
        }
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`No recovery email for ${address} within ${timeoutMs}ms`);
}

test.describe("F3b PKCE callback regression", () => {
  test("reset link routes via /api/auth/callback and lands on /update-password", async ({
    page,
    baseURL,
  }) => {
    await clearMailbox();

    // Supabase Local rewrites the redirect host to whatever `site_url` /
    // `additional_redirect_urls` allow. Use `localhost` (the allowed host)
    // throughout to keep the session cookie domain stable across the
    // 127.0.0.1 ↔ localhost hop — otherwise getUser() on /update-password
    // returns null in headless Chromium even though the server set the cookie.
    const webOrigin = "http://localhost:3060";

    // 1. Submit the reset form (this calls resetPasswordForEmail with the
    //    redirectTo from the fixed code path).
    await page.goto(`${webOrigin}/reset-password`);
    await page.locator('input[type="email"]').first().fill(EXISTING_USER_EMAIL);
    await page.getByRole("button", { name: /Send lenke|Sender\.\.\./ }).click();
    await expect(page.getByText(/Hvis kontoen finnes, har vi sendt en lenke/)).toBeVisible({
      timeout: 10_000,
    });

    // 2. Pull the email and assert the redirect_to param matches the new
    //    callback path. This is the load-bearing assertion — if the redirectTo
    //    regresses back to /update-password directly, this assertion fails.
    const { verifyUrl, redirectTo } = await waitForRecoveryEmail(EXISTING_USER_EMAIL);
    expect(redirectTo).toContain("/api/auth/callback");
    // URL.searchParams.get already decodes once; tolerate both encoded
    // (raw email body) and decoded forms.
    expect(redirectTo).toMatch(/next=(\/|%2F)update-password/);

    // 3. Follow the verify URL in the actual browser. Supabase verifies the
    //    token, then 302s to redirect_to with `?code=PKCE_CODE` appended.
    //    /api/auth/callback exchanges the code, sets the session cookie, then
    //    redirects to /update-password.
    await page.goto(verifyUrl);

    // 4. Final URL must be /update-password (NOT /reset-password — that's the
    //    pre-fix bounce we're guarding against).
    await page.waitForURL(/\/update-password/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/update-password");
    expect(page.url()).not.toMatch(/\/reset-password/);

    // 5. Form must be reachable — not the post-bounce empty state. The page
    //    sets `ready=true` after getUser() resolves with a session.
    await expect(page.getByRole("heading", { name: /Sett nytt passord/i })).toBeVisible({
      timeout: 10_000,
    });
    const pwdInput = page.locator('input[id="password"]');
    await expect(pwdInput).toBeEnabled({ timeout: 10_000 });
    expect(baseURL).toBeTruthy();
  });
});
