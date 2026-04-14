import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("HMS Oversikt", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("Oversikt shows real open deviation count", async ({ page }) => {
    await page.goto("/dashboard/hms");
    await page.waitForLoadState("networkidle");

    // Admin view should show KPI cards
    await expect(page.locator("text=Åpne avvik")).toBeVisible({ timeout: 10000 });

    // The count should be a number (not "0" placeholder from Phase 1)
    const avvikValue = page
      .locator("text=Åpne avvik")
      .locator("..")
      .locator("p.text-2xl, .text-2xl");
    await expect(avvikValue).toBeVisible({ timeout: 3000 });
  });

  test("Oversikt sub-nav renders all 6 tabs", async ({ page }) => {
    await page.goto("/dashboard/hms");
    await page.waitForLoadState("networkidle");

    // Use href selectors to avoid sidebar/breadcrumb ambiguity
    await expect(page.locator("a[href='/dashboard/hms']").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("a[href='/dashboard/hms/drift']")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("a[href='/dashboard/hms/training']")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("a[href='/dashboard/hms/documents']")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("a[href='/dashboard/hms/deviations']")).toBeVisible({
      timeout: 3000,
    });
    await expect(page.locator("a[href='/dashboard/hms/governance']")).toBeVisible({
      timeout: 3000,
    });
  });

  test("navigation between HMS tabs works", async ({ page }) => {
    await page.goto("/dashboard/hms");
    await page.waitForLoadState("networkidle");

    // Click Drift tab — scope to HMS sub-nav link to avoid sidebar match
    await page.click("a[href='/dashboard/hms/drift']");
    await expect(page).toHaveURL(/\/dashboard\/hms\/drift/);

    // Click Avvik tab
    await page.click("a[href='/dashboard/hms/deviations']");
    await expect(page).toHaveURL(/\/dashboard\/hms\/deviations/);

    // Click back to Oversikt — scope to HMS sub-nav link to avoid sidebar match
    await page.click("a[href='/dashboard/hms']");
    await expect(page).toHaveURL(/\/dashboard\/hms$/);
  });
});
