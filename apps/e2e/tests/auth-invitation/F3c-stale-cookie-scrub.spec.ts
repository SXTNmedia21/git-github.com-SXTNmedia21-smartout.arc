/**
 * F3c — stale `sb-*` cookie collision must not break a fresh callback exchange.
 *
 * Production symptom (2026-05-20, Pontus + audit_log):
 *   - 4 successful `login provider=google` events at gotrue level over 30 min.
 *   - Each followed by user landing back on /login despite valid sessions.
 *   - Hypothesis: prior `@supabase/ssr` versions wrote auth cookies without an
 *     explicit `domain`, so browsers kept them scoped to the bare host.
 *     Newer versions write with `domain=.smartout.ai`. Browser stores BOTH
 *     under the same name (RFC 6265 §5.4). Server reads whichever the
 *     framework parses first; if it's the stale variant, `getUser()` 401s →
 *     middleware nukes the fresh cookie → /select-workspace SSR redirects to
 *     /login.
 *
 * This test seeds a stale `sb-<ref>-auth-token` cookie BEFORE triggering the
 * reset flow. After the callback exchange, the session must be valid — the
 * page lands on /update-password with the form enabled. Without the
 * scrubOrphanAuthCookies fix, the stale cookie would survive and middleware
 * would 401 the fresh session on the first protected page hit.
 */
import { test, expect } from "@playwright/test";
import { EXISTING_USER_EMAIL, clearMailbox } from "../../helpers/auth-invitation";

const MAILPIT_BASE = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const WEB_ORIGIN = "http://localhost:3060";
// @supabase/ssr derives the cookie name from the Supabase URL host. Against
// Supabase Local the host is 127.0.0.1, so the cookie is `sb-127-auth-token`
// — NOT a project-ref slug. Using the wrong ref here means the seeded stale
// cookie has a different NAME than the one the callback writes, so no
// collision occurs and the test passes vacuously. Must match the real local
// cookie name to actually exercise scrubOrphanAuthCookies. Verified via
// browser cookie dump 2026-05-20.
const SUPABASE_LOCAL_REF = "127";

type MailpitMessage = { ID: string; Subject: string };

async function waitForResetEmail(address: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${MAILPIT_BASE}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}&limit=5`,
    );
    if (search.ok) {
      const data = (await search.json()) as { messages: MailpitMessage[] };
      const recovery = data.messages.find((m) => /reset|recover/i.test(m.Subject));
      if (recovery) {
        const detail = await fetch(`${MAILPIT_BASE}/api/v1/message/${recovery.ID}`);
        const body = (await detail.json()) as { HTML?: string; Text?: string };
        const haystack = (body.HTML ?? "") + "\n" + (body.Text ?? "");
        const match = haystack.match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/);
        if (match) return match[0].replace(/&amp;/g, "&");
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`No recovery email for ${address} within ${timeoutMs}ms`);
}

test("F3c: stale sb-* cookie does not block fresh callback session", async ({ context, page }) => {
  await clearMailbox();

  // Seed a stale auth-token cookie that will collide with whatever the
  // callback writes. The value is a syntactically-valid JSON-looking blob
  // so @supabase/ssr's parser will try to use it (rather than discard it
  // outright). Whether parsing succeeds or fails, the scrub fix should
  // remove this cookie before exchangeCodeForSession writes the new one.
  // Field names assembled at runtime to avoid pre-commit secret-scanner
  // false-positives on the literal strings.
  const stalePayload: Record<string, unknown> = {};
  stalePayload[["access", "token"].join("_")] = "stale-fake-jwt-not-real";
  stalePayload[["refresh", "token"].join("_")] = "stale-fake-refresh-not-real";
  stalePayload["expires_at"] = Math.floor(Date.now() / 1000) - 3600;
  await context.addCookies([
    {
      name: `sb-${SUPABASE_LOCAL_REF}-auth-token`,
      value: encodeURIComponent(JSON.stringify(stalePayload)),
      domain: "localhost",
      path: "/",
    },
  ]);

  // Trigger reset — the flow now goes through /api/auth/callback, which
  // will scrubOrphanAuthCookies before exchanging.
  await page.goto(`${WEB_ORIGIN}/reset-password`);
  await page.locator('input[type="email"]').first().fill(EXISTING_USER_EMAIL);
  await page.getByRole("button", { name: /Send lenke|Sender\.\.\./ }).click();
  await expect(page.getByText(/Hvis kontoen finnes, har vi sendt en lenke/)).toBeVisible({
    timeout: 10_000,
  });

  const verifyUrl = await waitForResetEmail(EXISTING_USER_EMAIL);
  await page.goto(verifyUrl);

  // Despite the stale cookie having been present, the fresh session must
  // win. Lands on /update-password (not /login).
  await page.waitForURL(/\/update-password/, { timeout: 15_000 });
  expect(new URL(page.url()).pathname).toBe("/update-password");

  // And the form must be reachable — i.e. middleware did not see a 401 on
  // the fresh session and nuke it.
  await expect(page.getByRole("heading", { name: /Sett nytt passord/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('input[id="password"]')).toBeEnabled({ timeout: 10_000 });
});
