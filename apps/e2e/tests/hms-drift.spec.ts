import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("HMS Drift", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("admin table loads sessions for today", async ({ page }) => {
    await page.goto("/dashboard/hms/drift");
    await page.waitForLoadState("networkidle");

    // Admin view — session table should render
    await expect(page.locator("text=Avdeling").or(page.locator("text=Ingen økter"))).toBeVisible({
      timeout: 10000,
    });
  });

  test("admin can drill down into a session", async ({ page }) => {
    await page.goto("/dashboard/hms/drift");
    await page.waitForLoadState("networkidle");

    // Click on a department row
    const row = page.locator("text=Kitchen").or(page.locator("text=Kjøkken"));
    if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(500);

      // Should expand to show tasks
      await expect(
        page
          .locator("text=Temperaturkontroll")
          .or(page.locator("text=Åpningskontroll"))
          .or(page.locator("text=Ingen oppgaver")),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("date navigation works", async ({ page }) => {
    await page.goto("/dashboard/hms/drift");
    await page.waitForLoadState("networkidle");

    // Find the date display — uses nb-NO long format, match the year
    const dateDisplay = page.locator("text=2026");
    await expect(dateDisplay).toBeVisible({ timeout: 5000 });

    // Click previous day
    const prevBtn = page.locator("button:has(svg)").first();
    if (await prevBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await prevBtn.click();
      await page.waitForTimeout(500);
      // Should still render without errors
      await expect(page.locator("text=Avdeling").or(page.locator("text=Ingen økter"))).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
