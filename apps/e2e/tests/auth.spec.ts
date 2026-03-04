import { test, expect } from "@playwright/test";

const TEST_EMAIL = "pontus@smartout.no";
const TEST_PASSWORD = "smartout123";

test.describe("Login Page", () => {
  test("should load the login page with Norwegian labels", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h2")).toContainText("Logg inn", { timeout: 10000 });
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
    await expect(page.locator('[class*="destructive"], [class*="error"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should redirect unauthenticated /dashboard to /login", async ({ page }) => {
    // Clear cookies first
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });
});

test.describe("Authentication Flow", () => {
  test("should login and reach dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Should navigate to dashboard after login
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    expect(page.url()).toContain("/dashboard");
  });

  test("should persist session across navigation", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

    // Navigate away and back — should stay logged in
    await page.goto("/dashboard");
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/dashboard");
    // Should NOT redirect to login
    expect(page.url()).not.toContain("/login");
  });

  test("should persist session on page reload", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15000 });

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
    await expect(page.locator("h2")).toBeVisible({ timeout: 10000 });
  });

  test("should have link from login to signup", async ({ page }) => {
    await page.goto("/login");
    const signupLink = page.locator('a[href="/signup"]');
    await expect(signupLink).toBeVisible({ timeout: 10000 });
  });
});
