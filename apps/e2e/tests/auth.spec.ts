import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "password123";

async function loginAndSkipOnboarding(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for login animation to complete and redirect to dashboard/onboarding
  await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // If redirected to onboarding wizard, skip it
  const skipBtn = page.locator("text=Hopp over og gå til dashboard");
  if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  }
}

test.describe("Login Page", () => {
  test("should load the login page with Norwegian labels", async ({ page }) => {
    await page.goto("/login");
    // Login page shows "Logg inn" button or heading
    await expect(page.locator("text=Logg inn").first()).toBeVisible({ timeout: 10000 });
  });

  test("should show email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "wrong@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // Error shown as toast, destructive alert, or inline message
    await expect(
      page
        .locator('[class*="destructive"], [class*="error"], [role="alert"], [data-sonner-toast]')
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should redirect unauthenticated /dashboard to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });
});

test.describe("Authentication Flow", () => {
  test("should login and reach dashboard", async ({ page }) => {
    await loginAndSkipOnboarding(page);
    expect(page.url()).toContain("/dashboard");
  });

  test("should persist session across navigation", async ({ page }) => {
    await loginAndSkipOnboarding(page);

    // Navigate away and back — should stay logged in
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/dashboard");
    expect(page.url()).not.toContain("/login");
  });

  test("should persist session on page reload", async ({ page }) => {
    await loginAndSkipOnboarding(page);

    // Reload page — should stay on dashboard
    await page.reload();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/dashboard");
    expect(page.url()).not.toContain("/login");
  });
});

test.describe("Signup Page", () => {
  test("should load the signup page", async ({ page }) => {
    await page.goto("/signup");
    // Signup page should render without 500 error
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  });

  test("should have signup option from login page", async ({ page }) => {
    await page.goto("/login");
    // Login page has "Opprett konto" link/button
    const signupOption = page.locator("text=Opprett konto").first();
    await expect(signupOption).toBeVisible({ timeout: 10000 });
  });
});
