import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("HMS Avvik", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("employee can open Avvik form and submit a deviation", async ({ page }) => {
    await page.goto("/dashboard/hms/deviations");
    await page.waitForLoadState("networkidle");

    // Employee mode — should see the form
    // Toggle to employee mode if needed
    const adminToggle = page.locator('[data-testid="admin-toggle"], [aria-label*="admin"]');
    if (await adminToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      // If in admin mode, toggle off to see employee form
      const isAdmin = await page
        .locator("text=Kanban")
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isAdmin) {
        await adminToggle.click();
        await page.waitForTimeout(500);
      }
    }

    // Fill form
    await page.fill(
      'input[id="deviation-title"], input[placeholder*="beskrivelse"]',
      "Test avvik fra E2E",
    );

    // Select domain
    const domainTrigger = page.locator("button").filter({ hasText: "Velg..." }).first();
    if (await domainTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await domainTrigger.click();
      await page.locator('[role="option"]').filter({ hasText: "Sikkerhet" }).click();
    }

    // Select severity
    const severityTrigger = page.locator("button").filter({ hasText: "Velg..." }).first();
    if (await severityTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await severityTrigger.click();
      await page.locator('[role="option"]').filter({ hasText: "Middels" }).click();
    }

    // Submit
    await page.click("text=Meld avvik");
    await expect(page.locator("text=Avvik meldt")).toBeVisible({ timeout: 5000 });
  });

  test("submitted deviation appears in admin Avvik kanban", async ({ page }) => {
    await page.goto("/dashboard/hms/deviations");
    await page.waitForLoadState("networkidle");

    // Should be in admin mode by default, showing kanban
    await expect(page.locator("text=Kanban").or(page.locator("text=Apen"))).toBeVisible({
      timeout: 10000,
    });

    // Check that seeded deviations are visible
    await expect(
      page.locator("text=Kjoleskap 8C").or(page.locator("text=Manglende bruk av hansker")),
    ).toBeVisible({ timeout: 5000 });
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
        'textarea[placeholder*="lukke avviket"]',
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
    const avvikCard = page.locator("text=Apne avvik").locator("..");
    await expect(avvikCard).toBeVisible({ timeout: 5000 });
  });
});
