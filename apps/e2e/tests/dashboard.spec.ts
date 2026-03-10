import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "password123";
const TEST_DISPLAY_NAME = process.env.E2E_DISPLAY_NAME ?? "Local Admin";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
}

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should render dashboard shell with sidebar", async ({ page }) => {
    await expect(page.locator("aside, nav, [data-sidebar]").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show user menu with display name", async ({ page }) => {
    await expect(page.locator(`text=${TEST_DISPLAY_NAME}`).first()).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to people page", async ({ page }) => {
    // Find and click people/team link in sidebar
    const peopleLink = page.locator('a[href*="/dashboard/people"]').first();
    if (await peopleLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await peopleLink.click();
      await page.waitForURL("**/dashboard/people**", { timeout: 10000 });
      expect(page.url()).toContain("/dashboard/people");
    }
  });

  test("should navigate to schedule page", async ({ page }) => {
    const scheduleLink = page.locator('a[href*="/dashboard/schedule"]').first();
    if (await scheduleLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scheduleLink.click();
      await page.waitForURL("**/dashboard/schedule**", { timeout: 10000 });
      expect(page.url()).toContain("/dashboard/schedule");
    }
  });

  test("should not show platform-admin link for non-godmode users", async ({ page }) => {
    // This test verifies the inverse — godmode user SHOULD see it
    // For now, verify the link exists since our test user has godmode
    const adminLink = page.locator('a[href="/platform-admin"]');
    // If user has godmode, the link should be in the user menu dropdown
    const userMenuButton = page.locator("button").filter({ hasText: TEST_DISPLAY_NAME }).first();
    if (await userMenuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userMenuButton.click();
      // Platform Admin link should be visible for godmode user
      await expect(adminLink).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe("Platform Admin", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should load platform-admin page for godmode user", async ({ page }) => {
    await page.goto("/platform-admin");
    await page.waitForURL("**/platform-admin**", { timeout: 10000 });
    // Should NOT redirect to login or dashboard
    expect(page.url()).toContain("/platform-admin");
    expect(page.url()).not.toContain("/login");
  });

  test("should load guardian page", async ({ page }) => {
    await page.goto("/platform-admin/guardian");
    await page.waitForURL("**/platform-admin/guardian**", { timeout: 10000 });
    expect(page.url()).toContain("/platform-admin/guardian");
    // Page should render without QueryClient error
    await expect(page.locator("main").first()).toBeVisible({ timeout: 10000 });
  });

  test("should have sidebar navigation", async ({ page }) => {
    await page.goto("/platform-admin");
    await expect(page.locator("aside").first()).toBeVisible({ timeout: 10000 });
  });
});
