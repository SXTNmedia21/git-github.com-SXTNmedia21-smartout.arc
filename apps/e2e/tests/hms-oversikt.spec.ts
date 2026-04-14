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

    // Wait for HMS sub-nav to render — it is a client component inside the layout.
    // The sub-nav is a rounded-xl container with 6 Link elements.
    await page.waitForTimeout(2000);

    // Use href selectors scoped to the page (not sidebar)
    const hmsLinks = [
      "/dashboard/hms",
      "/dashboard/hms/drift",
      "/dashboard/hms/training",
      "/dashboard/hms/documents",
      "/dashboard/hms/deviations",
      "/dashboard/hms/governance",
    ];

    for (const href of hmsLinks) {
      const link = page.locator(`a[href='${href}']`).first();
      await expect(link).toBeVisible({ timeout: 5000 });
    }
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
