import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should load the login page", async ({ page }) => {
    await page.goto("/login");
    // Check for the sign in header using standard exact text
    await expect(page.locator('h2:has-text("Sign in to your account")')).toBeVisible({
      timeout: 10000,
    });
  });

  // Adding actual authentication testing would require a test user or bypass
  // so keeping it simple for now verifying the UI loads.
});

test.describe("Signup Page", () => {
  test("should load the signup page", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('h2:has-text("Create your account")')).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show password mismatch error", async ({ page }) => {
    await page.goto("/signup");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.fill('input[name="confirm-password"]', "different123");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Passwords do not match")).toBeVisible();
  });
});

test.describe("Invitation Accept Page", () => {
  test("should show invalid state for fake token", async ({ page }) => {
    await page.goto("/invite/00000000-0000-0000-0000-000000000000");
    // Should show error since this token doesn't exist
    await expect(
      page.locator("text=Invitation not found").or(page.locator("text=not found")),
    ).toBeVisible({ timeout: 10000 });
  });
});
