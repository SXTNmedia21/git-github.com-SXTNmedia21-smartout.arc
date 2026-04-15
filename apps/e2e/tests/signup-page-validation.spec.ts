import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────
// signup-page-validation.spec.ts
//
// Regression safety for the public /signup page form behaviour.
// Why: /signup is the first door users walk through — client-side
// validation and the magic-link / password branching are the most
// common regression surfaces when auth UI gets rewritten.
//
// These tests are intentionally UI-only — they never hit Supabase
// auth.signUp() with valid credentials, so they cannot create users
// and do not need DB cleanup. Duplicate-email coverage is deferred
// to server-level Event Engine specs.
// ─────────────────────────────────────────────────────────────

test.describe("signup-page-validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    // Strip the Next.js dev overlay so clicks land on buttons.
    await page
      .evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
      })
      .catch(() => {});
    // Wait for React hydration — without this, the first click on the
    // method toggle fires before React has attached its onClick handler,
    // and the form mode never changes. We wait for the Google button to
    // be clickable as a proxy for "page is interactive".
    await expect(page.getByRole("button", { name: /Fortsett med Google/ })).toBeEnabled({
      timeout: 10_000,
    });
    await page.waitForTimeout(400);
  });

  async function switchToPassword(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: /^Passord$/ }).click();
    // Confirm the form really switched — retry the click if hydration
    // swallowed it.
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

  // ─── Test 1: Heading + primary CTAs present ──────────────

  test("shows heading, Google SSO, and method toggle @smoke", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Kom i gang/ })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: /Fortsett med Google/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Magisk lenke$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Passord$/ })).toBeVisible();
  });

  // ─── Test 2: Toggle swaps form contents ──────────────────

  test("method toggle swaps between magic-link and password forms", async ({ page }) => {
    // Default is magic link — email input visible, no password field.
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toHaveCount(0);

    // Switch to password
    await switchToPassword(page);
    await expect(page.locator('input[id="confirm-password"]')).toBeVisible();

    // Switch back to magic link — password fields gone
    await page.getByRole("button", { name: /^Magisk lenke$/ }).click();
    await expect(page.locator('input[id="password"]')).toHaveCount(0, { timeout: 5_000 });
  });

  // ─── Test 3: Password too short surfaces error ───────────
  // Why: handlePasswordSignup enforces minLength=8 before calling Supabase.
  // A regression where the client check is removed would silently accept
  // weak passwords — Supabase would then reject with a generic error.

  test("password shorter than 8 chars cannot submit the signup form", async ({ page }) => {
    await switchToPassword(page);

    await page.locator('input[id="email-pw"]').fill("e2e-short@smartout.test");
    await page.locator('input[id="password"]').fill("short");
    await page.locator('input[id="confirm-password"]').fill("short");

    await page.getByRole("button", { name: /Opprett konto/ }).click();

    // The form must not have succeeded — no "Sjekk e-posten din"
    // confirmation state, no navigation away from /signup. Either
    // the JS guard (length check) or the native minLength attribute
    // blocked it; both are acceptable — we are guarding against a
    // silent accept.
    await page.waitForTimeout(1_000);
    expect(page.url()).toContain("/signup");
    await expect(page.getByRole("heading", { name: /Sjekk e-posten din/ })).toHaveCount(0);
    // The input must still be present (no redirect, no success state)
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  // ─── Test 4: Password mismatch surfaces error ────────────

  test("mismatched password + confirm shows Norwegian error", async ({ page }) => {
    await switchToPassword(page);

    await page.locator('input[id="email-pw"]').fill("e2e-mismatch@smartout.test");
    await page.locator('input[id="password"]').fill("longenough-1");
    await page.locator('input[id="confirm-password"]').fill("longenough-2");

    await page.getByRole("button", { name: /Opprett konto/ }).click();

    await expect(page.getByText("Passordene stemmer ikke overens")).toBeVisible({
      timeout: 5_000,
    });
    // Still on /signup — no navigation happened
    expect(page.url()).toContain("/signup");
  });

  // ─── Test 5: Footer link routes to /login ───────────────

  test("footer link navigates to /login", async ({ page }) => {
    await page.getByRole("link", { name: /^Logg inn$/ }).click();
    await page.waitForURL("**/login", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
});
