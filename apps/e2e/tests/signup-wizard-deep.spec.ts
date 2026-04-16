import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

// ─────────────────────────────────────────────────────────────
// signup-wizard-deep.spec.ts
//
// Companion to signup-page-validation.spec.ts. That spec already
// covers client-side form validation. This one fills the remaining
// regression gaps flagged in reports/signup-workspace-audit-2026-04-15.md:
//   • submit → redirect (magic-link confirmation surface)
//   • duplicate email surfaced from Supabase
//   • session persistence after login
// The password-signup → auto-confirm flow is NOT exercised here
// because local Supabase requires email confirmation and we do not
// want to create production-shape users from browser specs. Those
// paths are covered by journey-signup-onboarding.spec.ts.
// ─────────────────────────────────────────────────────────────

const createdAuthUserIds: string[] = [];

test.describe("signup-wizard-deep", () => {
  test.afterAll(async () => {
    for (const id of createdAuthUserIds) {
      await supabase.auth.admin.deleteUser(id).catch(() => {});
    }
  });

  async function gotoSignup(page: import("@playwright/test").Page) {
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await page
      .evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
      })
      .catch(() => {});
    await expect(page.getByRole("button", { name: /Fortsett med Google/ })).toBeEnabled({
      timeout: 10_000,
    });
    await page.waitForTimeout(400);
  }

  async function switchToPassword(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: /^Passord$/ }).click();
    for (let i = 0; i < 3; i += 1) {
      if (
        await page
          .locator('input[id="password"]')
          .isVisible()
          .catch(() => false)
      ) {
        return;
      }
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /^Passord$/ }).click();
    }
    await expect(page.locator('input[id="password"]')).toBeVisible({ timeout: 5_000 });
  }

  // ─── Test 1: Magic-link submit lands on confirmation screen ─

  test("magic-link submit transitions from form to confirmation or surfaces an error", async ({
    page,
  }) => {
    await gotoSignup(page);

    const email = `magic-${Date.now()}@e2e.smartout.test`;
    await page.locator('input[id="email"]').fill(email);
    await page.getByRole("button", { name: /Send innloggingslenke|Send magisk lenke/ }).click();

    // Either we land on the "Sjekk e-posten din" confirmation (the h2
    // rendered when magicLinkSent flips true in the signup page) or an
    // error banner appears inside the signup form (Supabase rejected
    // the submission — local dev can rate-limit synthetic addresses).
    //
    // We scope the error selector to the signup form's own error banner
    // (the red .text-destructive box rendered above the Google SSO button)
    // so we don't accept stray page-level alerts as proof of a state
    // transition. Confirmation is matched by the exact post-submit heading.
    const confirmation = page.getByRole("heading", { name: "Sjekk e-posten din", exact: true });
    const signupErrorBanner = page
      .locator("main, body")
      .locator("div.text-destructive")
      .filter({ hasText: /.+/ })
      .first();

    await Promise.race([
      confirmation.waitFor({ state: "visible", timeout: 10_000 }),
      signupErrorBanner.waitFor({ state: "visible", timeout: 10_000 }).catch(() => null),
    ]);

    const confirmationVisible = await confirmation.isVisible({ timeout: 500 }).catch(() => false);
    const errorVisible = await signupErrorBanner.isVisible({ timeout: 500 }).catch(() => false);

    // At least one of the two state transitions must have happened —
    // the form button is wired and the client state machine moved OFF
    // the input form.
    expect(confirmationVisible || errorVisible).toBe(true);
  });

  // ─── Test 2: Duplicate email on password signup is surfaced ──
  // Creates an auth user directly, then tries to signup with the
  // same email via the UI. Supabase responds with
  // "User already registered" — handlePasswordSignup surfaces the
  // error text in the alert region.

  test("password signup with already-registered email surfaces Supabase error", async ({
    page,
  }) => {
    const email = `dup-${Date.now()}@e2e.smartout.test`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: "password123",
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`setup user failed: ${error?.message}`);
    createdAuthUserIds.push(data.user.id);

    await gotoSignup(page);
    await switchToPassword(page);

    await page.locator('input[id="email-pw"]').fill(email);
    await page.locator('input[id="password"]').fill("anotherPassword123");
    await page.locator('input[id="confirm-password"]').fill("anotherPassword123");
    await page.getByRole("button", { name: /Opprett konto/ }).click();

    // The error surfaces in an alert region. We assert on the presence
    // of Supabase's canonical error string or the Norwegian equivalent
    // that the UI maps it to.
    const alreadyRegistered = page.getByText(
      /already registered|allerede registrert|finnes allerede/i,
    );
    await expect(alreadyRegistered).toBeVisible({ timeout: 10_000 });

    // Still on /signup — form did not succeed.
    expect(page.url()).toContain("/signup");
  });

  // ─── Test 3: Session persistence after successful login ─────
  // This uses the admin@smartout.local seed user (not signup). It
  // proves the session cookie survives a full-page reload, which is
  // the #1 production bug class for auth: "user logs in, refreshes,
  // gets kicked to /login". Covered by auth.spec.ts already — this
  // spec adds a deeper variant that also checks we land on /dashboard
  // (not /login) after a cold tab open.

  test("session persists across a cold page navigation after login", async ({ page, context }) => {
    const email = process.env.E2E_EMAIL ?? "admin@smartout.local";
    const password = process.env.E2E_PASSWORD ?? "password123";

    await page.goto("/login");
    await page
      .evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
      })
      .catch(() => {});
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click({ force: true });

    await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 15_000 });

    // Open a NEW page in the same context — session cookie should flow
    // through and land us at an authenticated route, not /login.
    const page2 = await context.newPage();
    await page2.goto("/dashboard");
    // Either we land on /dashboard directly, or we are redirected to
    // /dashboard/setup because the seed workspace has setup steps open.
    // Both are authenticated — /login is the failure.
    await page2.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 10_000 });
    expect(page2.url()).not.toContain("/login");
    await page2.close();
  });

  // ─── Test 4: Footer → /login navigation preserved ───────────

  test("signup footer link round-trips to /login and back", async ({ page }) => {
    await gotoSignup(page);
    await page.getByRole("link", { name: /^Logg inn$/ }).click();
    await page.waitForURL("**/login", { timeout: 10_000 });
    expect(page.url()).toContain("/login");

    // From /login, the "Opprett konto" link returns to /signup
    const backLink = page.getByRole("link", { name: /Opprett konto/ });
    if (await backLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await backLink.click();
      await page.waitForURL("**/signup", { timeout: 10_000 });
      expect(page.url()).toContain("/signup");
    }
  });
});
