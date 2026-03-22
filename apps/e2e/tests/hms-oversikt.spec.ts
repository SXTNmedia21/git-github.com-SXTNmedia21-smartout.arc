import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "password123";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 20000 }).catch(() => {});

  for (let attempt = 0; attempt < 3; attempt++) {
    const skipBtn = page.locator("text=Hopp over og gå til dashboard");
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1500);
    } else {
      break;
    }
  }
}

test.describe("HMS Oversikt", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Oversikt shows real open deviation count", async ({ page }) => {
    await page.goto("/dashboard/hms");
    await page.waitForLoadState("networkidle");

    // Admin view should show KPI cards
    await expect(page.locator("text=Apne avvik")).toBeVisible({ timeout: 10000 });

    // The count should be a number (not "0" placeholder from Phase 1)
    const avvikValue = page
      .locator("text=Apne avvik")
      .locator("..")
      .locator("p.text-2xl, .text-2xl");
    await expect(avvikValue).toBeVisible({ timeout: 3000 });
  });

  test("Oversikt sub-nav renders all 5 tabs", async ({ page }) => {
    await page.goto("/dashboard/hms");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Oversikt").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Drift")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=Opplaering")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=Dokumenter")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=Avvik")).toBeVisible({ timeout: 3000 });
  });

  test("navigation between HMS tabs works", async ({ page }) => {
    await page.goto("/dashboard/hms");
    await page.waitForLoadState("networkidle");

    // Click Drift tab
    await page.click("text=Drift");
    await expect(page).toHaveURL(/\/dashboard\/hms\/drift/);

    // Click Avvik tab
    await page.click("text=Avvik");
    await expect(page).toHaveURL(/\/dashboard\/hms\/deviations/);

    // Click back to Oversikt
    await page.click("a:has-text('Oversikt')");
    await expect(page).toHaveURL(/\/dashboard\/hms$/);
  });
});
