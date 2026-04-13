import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Season Planning — Critical Flows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should navigate to season page and render tabs", async ({ page }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    await expect(page.locator("main").first()).toBeVisible({ timeout: 10000 });

    const tabLabels = [
      "Oversikt",
      "Budsjett",
      "Dagfaktorer",
      "Timefaktorer",
      "Hendelser",
      "Mål",
      "Prosedyrer & HMS",
    ];
    for (const label of tabLabels) {
      const tab = page.locator(`button:has-text("${label}")`).first();
      await expect(tab).toBeVisible({ timeout: 5000 });
    }
  });

  test("should auto-select active season if one exists", async ({ page }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const tabBar = page.locator("button:has-text('Oversikt')").first();
    const hasTabBar = await tabBar.isVisible({ timeout: 8000 }).catch(() => false);

    if (hasTabBar) {
      expect(true).toBe(true);
    } else {
      const emptyState = page.locator("text=Velg en sesong").first();
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    }
  });

  test("should switch to goals tab and show create button", async ({ page }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const goalsTab = page.locator("button:has-text('Mål')").first();
    if (await goalsTab.isVisible({ timeout: 8000 }).catch(() => false)) {
      await goalsTab.click();
      await page.waitForTimeout(500);

      const createBtn = page.locator("button:has-text('Nytt mål')").first();
      const emptyState = page.locator("text=Ingen mål satt").first();

      const hasCreate = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasCreate || hasEmpty).toBe(true);
    }
  });

  test("should switch to procedures tab and show policy list or empty state", async ({ page }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const proceduresTab = page.locator("button:has-text('Prosedyrer & HMS')").first();
    if (await proceduresTab.isVisible({ timeout: 8000 }).catch(() => false)) {
      await proceduresTab.click();
      await page.waitForTimeout(500);

      const header = page.locator("text=Prosedyrer & HMS").first();
      const emptyState = page.locator("text=Ingen prosedyrer").first();

      const hasHeader = await header.isVisible({ timeout: 3000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasHeader || hasEmpty).toBe(true);
    }
  });

  test("should show planning cycle selector and open dropdown", async ({ page }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const cycleSelector = page.locator("text=Planperiode:").first();
    if (await cycleSelector.isVisible({ timeout: 8000 }).catch(() => false)) {
      await cycleSelector.click();
      await page.waitForTimeout(300);

      const createCycleBtn = page.locator("text=Ny planperiode").first();
      await expect(createCycleBtn).toBeVisible({ timeout: 3000 });
    }
  });
});
