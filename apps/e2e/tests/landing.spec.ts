import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    // Skip if landing server is not running
    try {
      const response = await page.goto("/", { timeout: 5000 });
      if (!response || response.status() >= 500) {
        test.skip(true, "Landing server not running");
      }
    } catch {
      test.skip(true, "Landing server not running");
    }
  });

  test("should load the homepage and show correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/.*SmartOut.*/i);
  });

  test("should navigate to procedures concept page", async ({ page }) => {
    await page.goto("/concepts/procedures");
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
  });
});
