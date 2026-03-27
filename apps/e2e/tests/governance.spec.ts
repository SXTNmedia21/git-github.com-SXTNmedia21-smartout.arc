import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Governance Module", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should load governance page", async ({ page }) => {
    await page.goto("/dashboard/governance");
    await expect(page).toHaveURL(/\/dashboard\/governance/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("should show governance content", async ({ page }) => {
    await page.goto("/dashboard/governance");
    // Governance page should render its main content area
    await expect(page.locator("[data-testid='governance-content'], main")).toBeVisible({
      timeout: 10000,
    });
  });
});
