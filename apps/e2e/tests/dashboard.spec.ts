import { test, expect } from "@playwright/test";

test.describe("Dashboard App", () => {
  test("should load the dashboard page correctly", async ({ page }) => {
    await page.goto("/dashboard");
    // For now, since there's no strict middleware redirect, we just verify it loads
    await expect(page.locator("text=Operations").first()).toBeVisible({ timeout: 10000 });
  });
});
