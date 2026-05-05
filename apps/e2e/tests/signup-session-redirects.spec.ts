import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────
// signup-session-redirects.spec.ts
//
// Regression safety for the route guard + redirect matrix
// surrounding signup / join / onboarding.
// Why: middleware + layout guards are famously easy to break
// silently. A regression here means an unauthenticated user
// could see pages they should not, or a signed-in user gets
// stuck in a login loop.
// ─────────────────────────────────────────────────────────────

test.describe("signup-session-redirects", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  // ─── Test 1: /signup is public ───────────────────────────

  test("unauthenticated /signup renders without redirect @smoke", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    expect(page.url()).toContain("/signup");
    await expect(page.getByRole("heading", { name: /Opprett konto/ })).toBeVisible({
      timeout: 10_000,
    });
  });

  // ─── Test 2: /join is public ─────────────────────────────

  test("unauthenticated /join renders the wizard", async ({ page }) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });
    // Clean wizard state so we always start on step 1
    await page.evaluate(() => localStorage.removeItem("smartout_signup_wizard")).catch(() => {});
    await page.reload();
    await expect(page.locator('[data-botsson-id="join-shell"]')).toBeVisible({ timeout: 15_000 });
  });

  // ─── Test 3: Auth-gated routes redirect to /login ────────

  test("unauthenticated /dashboard redirects to /login @smoke", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated /dashboard/setup redirects to /login", async ({ page }) => {
    await page.goto("/dashboard/setup");
    await page.waitForURL("**/login**", { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated /onboarding does not blow up", async ({ page }) => {
    // /onboarding is behind auth but must not render a 500.
    // Accept either a redirect to /login OR a page that loads cleanly
    // with a login CTA. What we are guarding against is a runtime error.
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const bodyText = (await page.textContent("body")) ?? "";
    expect(bodyText).not.toContain("Runtime Error");
    expect(bodyText).not.toContain("Application error");
  });

  // ─── Test 4: Open-redirect guard on /login ───────────────
  // Why: the signup / auth callback path takes a `next=` query. If the
  // login page forwards arbitrary hosts it becomes an open redirect.

  test("login with external next= does not redirect cross-origin", async ({ page }) => {
    await page.goto("/login?next=https://evil.example.com/steal");
    // Regardless of what the login page does with `next`, the URL must
    // still be on our origin after load.
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);
  });

  // ─── Test 5: Signup → login round-trip via footer link ──
  // Why: the standalone /signup page footer must always lead back
  // to /login. The /login page has its own in-place signup form,
  // so we do not assert a /login → /signup nav here.

  test("signup footer link navigates back to /login", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Opprett konto/ })).toBeVisible({
      timeout: 10_000,
    });
    // Link text is "Logg inn →" — match prefix only (arrow may change)
    await page.getByRole("link", { name: /^Logg inn/ }).click();
    await page.waitForURL("**/login", { timeout: 10_000 });
  });
});
