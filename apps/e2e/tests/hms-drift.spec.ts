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

test.describe("HMS Drift", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("admin table loads sessions for today", async ({ page }) => {
    await page.goto("/dashboard/hms/drift");
    await page.waitForLoadState("networkidle");

    // Admin view — session table should render
    await expect(page.locator("text=Avdeling").or(page.locator("text=Ingen okter"))).toBeVisible({
      timeout: 10000,
    });
  });

  test("admin can drill down into a session", async ({ page }) => {
    await page.goto("/dashboard/hms/drift");
    await page.waitForLoadState("networkidle");

    // Click on a department row
    const row = page.locator("text=Kitchen").or(page.locator("text=Kjokken"));
    if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(500);

      // Should expand to show tasks
      await expect(
        page
          .locator("text=Temperaturkontroll")
          .or(page.locator("text=Apningskontroll"))
          .or(page.locator("text=Ingen oppgaver")),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("date navigation works", async ({ page }) => {
    await page.goto("/dashboard/hms/drift");
    await page.waitForLoadState("networkidle");

    // Find the date display
    const dateDisplay = page.locator("text=mars 2026").or(page.locator("text=March 2026"));
    await expect(dateDisplay).toBeVisible({ timeout: 5000 });

    // Click previous day
    const prevBtn = page.locator("button:has(svg)").first();
    if (await prevBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await prevBtn.click();
      await page.waitForTimeout(500);
      // Should still render without errors
      await expect(page.locator("text=Avdeling").or(page.locator("text=Ingen okter"))).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
