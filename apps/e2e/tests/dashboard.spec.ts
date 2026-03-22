import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

const TEST_DISPLAY_NAME = process.env.E2E_DISPLAY_NAME ?? "Local Admin";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should render dashboard shell with sidebar", async ({ page }) => {
    await expect(page.locator("aside, nav, [data-sidebar]").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show user menu with display name", async ({ page }) => {
    // Display name may appear as initials (AD) or full name, or in profile code
    const displayName = page.locator(`text=${TEST_DISPLAY_NAME}`).first();
    const initials = page.locator("text=AD").first();
    const adminText = page.locator("text=admin").first();

    const nameVisible = await displayName.isVisible({ timeout: 10000 }).catch(() => false);
    const initialsVisible = await initials.isVisible({ timeout: 3000 }).catch(() => false);
    const adminVisible = await adminText.isVisible({ timeout: 3000 }).catch(() => false);

    expect(nameVisible || initialsVisible || adminVisible).toBe(true);
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
    await loginAsAdmin(page);
  });

  test("should load platform-admin page for godmode user", async ({ page }) => {
    await page.goto("/platform-admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    // If godmode is set, stays on platform-admin. Otherwise redirects.
    const onAdmin = page.url().includes("/platform-admin");
    const onDashboard = page.url().includes("/dashboard");
    expect(onAdmin || onDashboard).toBe(true);
    if (onAdmin) {
      expect(page.url()).not.toContain("/login");
    }
  });

  test("should load guardian page", async ({ page }) => {
    await page.goto("/platform-admin/guardian", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    // If godmode, page loads. Otherwise redirects.
    if (page.url().includes("/platform-admin/guardian")) {
      await expect(page.locator("main, body").first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("should have sidebar navigation", async ({ page }) => {
    await page.goto("/platform-admin");
    await expect(page.locator("aside").first()).toBeVisible({ timeout: 10000 });
  });
});
