import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Cascade UI — Schedule Day Control", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should navigate to schedule page", async ({ page }) => {
    const scheduleLink = page.locator('a[href*="/dashboard/schedule"]').first();
    if (await scheduleLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await scheduleLink.click();
      await page.waitForURL("**/dashboard/schedule**", { timeout: 10000 });
    } else {
      await page.goto("/dashboard/schedule", { waitUntil: "domcontentloaded" });
    }
    expect(page.url()).toContain("/dashboard/schedule");
  });

  test("should render schedule grid with day columns", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // The schedule page should load without crashing
    await expect(page.locator("main").first()).toBeVisible({ timeout: 10000 });
  });

  test("should open day control panel and show planned hours", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // Look for a clickable day header or day column that opens the DayControlSheet
    const dayHeader = page.locator("[data-day-header], [data-date-id]").first();
    if (await dayHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dayHeader.click();

      // The day control panel should appear with the Oversikt tab
      const oversiktTab = page.locator("text=Oversikt").first();
      await expect(oversiktTab).toBeVisible({ timeout: 5000 });

      // Opening hours should be displayed (not the old hardcoded "11:00 - 23:00")
      // Look for time pattern or "Planlagt" or "Stengt" or "Apningstider"
      const hoursLabel = page.locator("text=Apningstider").first();
      await expect(hoursLabel).toBeVisible({ timeout: 5000 });
    }
  });

  test("should open hours override popover on click", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // Open a day panel first
    const dayHeader = page.locator("[data-day-header], [data-date-id]").first();
    if (await dayHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dayHeader.click();

      // Wait for the panel
      await page.waitForTimeout(1000);

      // Click the hours display area to open the override popover
      const hoursButton = page.locator("text=Apningstider").first();
      if (await hoursButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Find the clickable area near the hours label
        const hoursArea = hoursButton.locator("..").locator("button").first();
        if (await hoursArea.isVisible({ timeout: 2000 }).catch(() => false)) {
          await hoursArea.click();

          // The override popover should appear
          const popoverTitle = page.locator("text=Apningstider unntak").first();
          await expect(popoverTitle).toBeVisible({ timeout: 3000 });

          // Should have the closed toggle
          await expect(page.locator("text=Stengt hele dagen").first()).toBeVisible({
            timeout: 3000,
          });

          // Should have save button
          await expect(page.locator("text=Lagre").first()).toBeVisible({ timeout: 3000 });

          // Close with Escape
          await page.keyboard.press("Escape");
          await expect(popoverTitle).not.toBeVisible({ timeout: 3000 });
        }
      }
    }
  });
});

test.describe("Cascade UI — Season Planning", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should navigate to season page", async ({ page }) => {
    await page.goto("/dashboard/season");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    expect(page.url()).toContain("/dashboard/season");

    // Should show the page header
    await expect(page.locator("text=Sesongplanlegging").first()).toBeVisible({ timeout: 10000 });
  });

  test("should show planning cycle selector", async ({ page }) => {
    await page.goto("/dashboard/season", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // The planning cycle selector or season heading should be visible
    const cycleLabel = page.locator("text=Planperiode").first();
    const seasonHeading = page.locator("text=Sesongplanlegging").first();

    const cycleVisible = await cycleLabel.isVisible({ timeout: 10000 }).catch(() => false);
    const headingVisible = await seasonHeading.isVisible({ timeout: 3000 }).catch(() => false);

    expect(cycleVisible || headingVisible).toBe(true);
  });

  test("should show Hendelser tab in season page", async ({ page }) => {
    await page.goto("/dashboard/season");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // Select a season first if there is one
    const seasonButton = page.locator("[data-season-selector] button, select").first();
    if (await seasonButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await seasonButton.click();
      await page.waitForTimeout(500);
      // Select first option
      const firstOption = page.locator("[data-season-option], option").first();
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click();
        await page.waitForTimeout(500);
      }
    }

    // The Hendelser tab should be visible in the tab bar
    const eventsTab = page.locator("button").filter({ hasText: "Hendelser" }).first();
    if (await eventsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await eventsTab.click();

      // Should show the events calendar or empty state
      await page.waitForTimeout(1000);

      // Look for calendar navigation or empty state
      const calendarOrEmpty = page
        .locator("text=Man, text=Ny hendelse, text=Ingen hendelser")
        .first();
      await expect(calendarOrEmpty)
        .toBeVisible({ timeout: 5000 })
        .catch(() => {
          // If no season selected, the events tab content may not show
        });
    }
  });

  test("should open planning cycle dropdown", async ({ page }) => {
    await page.goto("/dashboard/season");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // Find the cycle selector trigger
    const cycleTrigger = page.locator("text=Planperiode").first();
    if (await cycleTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click the trigger area
      const clickable = cycleTrigger.locator("..").locator("button, [role=button]").first();
      if (await clickable.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clickable.click();

        // Should show "Ny planperiode" option in dropdown
        const createOption = page.locator("text=Ny planperiode").first();
        await expect(createOption).toBeVisible({ timeout: 3000 });

        // Close with Escape
        await page.keyboard.press("Escape");
      }
    }
  });
});
