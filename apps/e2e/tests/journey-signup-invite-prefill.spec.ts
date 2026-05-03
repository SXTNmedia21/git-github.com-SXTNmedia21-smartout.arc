/**
 * journey-signup-invite-prefill.spec.ts
 *
 * Verifies the /signup?invite=<token> arrival flow:
 *   1. Page detects the `invite` query param.
 *   2. Calls get_invitation_by_token RPC client-side.
 *   3. Pre-fills the email field with the invitation's email.
 *   4. Locks the email field (readonly).
 *   5. Renders the invite-specific copy ("Bli med i teamet" + "Godta invitasjon").
 *   6. Hides the magic-link/password method picker (forced password mode).
 *   7. Hides the Google SSO + bottom invitation hint (irrelevant in invite flow).
 *
 * This is the wiring that lets clicking the email button in Mailpit land the
 * invitee on a form that already knows who they are — no second email
 * verification, no manual email re-entry.
 */

import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

const SEED_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
const SEED_COMPANY_ID = "a0000000-0000-0000-0000-000000000000";
const WEB_URL = process.env.E2E_WEB_URL ?? "http://127.0.0.1:3060";

function uniqueEmail(prefix = "e2e-signup-prefill"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function seedInvitation(
  email: string,
  firstName = "Pre",
  lastName = "Filled",
): Promise<string> {
  const { data, error } = await supabase
    .from("invitation")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      company_id: SEED_COMPANY_ID,
      email,
      first_name: firstName,
      last_name: lastName,
      role: "employee",
      status: "pending",
      invite_type: "link",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("token")
    .single();
  if (error || !data) throw new Error(`seed failed: ${error?.message}`);
  return data.token;
}

async function cleanup(email: string): Promise<void> {
  if (process.env.KEEP_E2E_INVITATIONS === "1") return;
  await supabase.from("invitation").delete().eq("email", email);
}

test.describe("Journey — /signup?invite=<token> prefill", () => {
  test("invite arrival pre-fills email, locks it, hides method picker, shows invite copy", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const token = await seedInvitation(email);

    try {
      await page.goto(`${WEB_URL}/signup?invite=${token}`);
      await page.waitForLoadState("domcontentloaded");

      // Headline switches to invite copy after RPC resolves.
      await expect(page.getByRole("heading", { name: /Bli med i teamet/i })).toBeVisible({
        timeout: 10_000,
      });

      // Email field has the invitation's email and is readonly.
      const emailInput = page.locator('input[type="email"]').first();
      await expect(emailInput).toHaveValue(email);
      const readonlyAttr = await emailInput.getAttribute("readonly");
      expect(readonlyAttr).not.toBeNull();

      // The label switches to "(fra invitasjon)" so the user understands why.
      await expect(page.getByText(/E-post \(fra invitasjon\)/i)).toBeVisible();

      // Method picker (Magisk lenke / Passord tabs) is hidden.
      await expect(page.getByRole("button", { name: /^Magisk lenke$/ })).toHaveCount(0);

      // CTA copy reflects the invite intent.
      await expect(
        page.getByRole("button", { name: /Godta invitasjon og bli med/i }),
      ).toBeVisible();

      // Reassurance copy: no second verification email.
      await expect(
        page.getByText(/E-postadressen din er allerede bekreftet via invitasjonen/i),
      ).toBeVisible();

      // Google SSO + bottom invitation hint are hidden.
      await expect(page.getByRole("button", { name: /Fortsett med Google/i })).toHaveCount(0);
      await expect(page.getByText(/Er du invitert av en arbeidsgiver\?/i)).toHaveCount(0);
    } finally {
      await cleanup(email);
    }
  });

  test("invite arrival → submit creates account and redirects to /dashboard", async ({ page }) => {
    const email = uniqueEmail("e2e-signup-submit");
    const token = await seedInvitation(email, "Sub", "Mit");

    try {
      await page.goto(`${WEB_URL}/signup?invite=${token}`);
      await expect(page.getByRole("heading", { name: /Bli med i teamet/i })).toBeVisible({
        timeout: 10_000,
      });

      const password = "test-password-1234";
      // Two password fields share the same `type=password` selector — disambiguate by id.
      await page.locator("#password").fill(password);
      await page.locator("#confirm-password").fill(password);

      const submit = page.getByRole("button", { name: /Godta invitasjon og bli med/i });
      await submit.click();

      // After accept-invitation succeeds + signInWithPassword, the page routes
      // to /dashboard. We assert the URL transition rather than dashboard
      // content because dashboard rendering depends on workspace state we
      // don't fully control here.
      await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
      expect(page.url()).toContain("/dashboard");

      // Sanity: invitation is now flipped to accepted in DB.
      const { data: inv } = await supabase
        .from("invitation")
        .select("status")
        .eq("email", email)
        .single();
      expect(inv?.status).toBe("accepted");
    } finally {
      await cleanup(email);
    }
  });
});
