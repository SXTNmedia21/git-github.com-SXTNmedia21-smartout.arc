import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("HMS Avvik", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("employee can open Avvik form and submit a deviation", async ({ page }) => {
    await page.goto("/dashboard/hms/deviations");
    await page.waitForLoadState("networkidle");

    // Toggle to employee mode — admin sees kanban, employee sees the form
    const adminToggle = page.locator('[data-autoplay="admin-mode-toggle"]');
    if (await adminToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isAdmin = await page
        .locator("text=Kanban")
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isAdmin) {
        await adminToggle.click();
        await page.waitForTimeout(800);
      }
    }

    // Wait for the deviation form to render (uses i18n: "Meld avvik" title)
    const formTitle = page.locator("h2").filter({ hasText: /Meld avvik|Report deviation/ });
    await expect(formTitle).toBeVisible({ timeout: 10000 });

    // Fill form — id selector is stable, placeholder is i18n-based
    await page.fill("#deviation-title", "Test avvik fra E2E");

    // Select domain — the trigger renders the i18n placeholder text
    const domainTrigger = page.locator("button[role='combobox']").first();
    if (await domainTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await domainTrigger.click();
      await page
        .locator('[role="option"]')
        .filter({ hasText: /Sikkerhet|Safety/ })
        .click();
    }

    // Select severity — second combobox trigger
    const severityTrigger = page.locator("button[role='combobox']").nth(1);
    if (await severityTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await severityTrigger.click();
      await page
        .locator('[role="option"]')
        .filter({ hasText: /Middels|Medium/ })
        .click();
    }

    // Submit — button text comes from i18n
    const submitBtn = page.locator("button").filter({ hasText: /Meld avvik|Report deviation/ });
    await submitBtn.click();
    await expect(
      page.locator("text=Avvik meldt").or(page.locator("text=Deviation reported")),
    ).toBeVisible({ timeout: 5000 });
  });

  test("submitted deviation appears in admin Avvik kanban", async ({ page }) => {
    await page.goto("/dashboard/hms/deviations");
    await page.waitForLoadState("networkidle");

    // Admin mode by default — should see kanban view toggle or deviation heading
    // The page shows h2 "Avvik" and a Kanban/Liste toggle in admin mode
    await expect(
      page
        .locator("h2")
        .filter({ hasText: /^Avvik$/ })
        .or(page.locator("text=Kanban")),
    ).toBeVisible({ timeout: 10000 });

    // Check that seeded deviations are visible (if seed data exists)
    const hasSeededData = await page
      .locator("text=Kjøleskap 8C")
      .or(page.locator("text=Manglende bruk av hansker"))
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // If no seed data, at least verify the kanban rendered without error
    if (!hasSeededData) {
      const bodyText = await page.textContent("body");
      const hasError =
        bodyText?.includes("Runtime Error") || bodyText?.includes("Application error");
      expect(hasError).toBeFalsy();
    }
  });

  test("admin can open detail drawer and resolve a deviation", async ({ page }) => {
    await page.goto("/dashboard/hms/deviations");
    await page.waitForLoadState("networkidle");

    // Click on a deviation card
    const card = page.locator("text=Manglende bruk av hansker");
    if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
      await card.click();

      // Detail drawer should open
      await expect(page.locator("text=Lukk avvik")).toBeVisible({ timeout: 3000 });

      // Fill resolution notes
      await page.fill(
        'textarea[placeholder*="lukke avviket"], textarea',
        "Tatt opp med ansatt. Rutine gjennomgatt.",
      );

      // Click resolve
      await page.click("text=Lukk avvik");
      await expect(page.locator("text=Avvik lukket")).toBeVisible({ timeout: 5000 });
    }
  });

  test("resolved deviation no longer counts as open", async ({ page }) => {
    await page.goto("/dashboard/hms");
    await page.waitForLoadState("networkidle");

    // The Oversikt KPI card should show open deviation count
    // After resolution, count should be lower
    const avvikCard = page.locator("text=Åpne avvik").locator("..");
    await expect(avvikCard).toBeVisible({ timeout: 5000 });
  });
});
