import { test, expect } from "@playwright/test";

test.describe("Dashboard App", () => {
  test("should load the dashboard page correctly", async ({ page }) => {
    await page.goto("/dashboard");
    // Scope to <main> to avoid strict mode violations from sidebar duplicates
    await expect(page.locator("main").first()).toBeVisible({ timeout: 10000 });
  });
});
