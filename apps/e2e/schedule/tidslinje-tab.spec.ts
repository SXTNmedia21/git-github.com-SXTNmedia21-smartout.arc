// =============================================================================
// schedule/tidslinje-tab.spec.ts
//
// Happy-path E2E for TidslinjeTab in DayControlPanel.
// Sortie 1 / Task 18 — feat/p10-tidslinje-tab.
//
// What this tests:
//   1. Opening DayControlPanel, clicking the Tidslinje tab, and verifying the
//      chip-bar + chronological list / empty-state renders correctly.
//   2. Clicking a location chip toggles aria-pressed (true ↔ false).
//   3. Tidslinje is the 5th tab in the DayControlPanel tablist (after T8 mount).
//
// How the panel opens:
//   See tidslinje-tab.axe.spec.ts (T9) — same [data-schedule-day-id] selector.
//   DroppableDayHeader renders data-schedule-day-id on each day column.
//   Clicking opens DayControlSheet containing DayControlPanel.
//
// Auth pattern:
//   loginAsAdmin() from helpers/auth.ts.
//
// Infrastructure prerequisite:
//   Requires dev server (web on port 3060) + Supabase local running.
//   Run via: cd apps/e2e && pnpm test:e2e -- schedule/tidslinje-tab.spec.ts
//   or:      pnpm exec playwright test schedule/tidslinje-tab.spec.ts --project=web
//
//   If no dev server is available, tests defer to CI. Syntax is verified via
//   `pnpm typecheck` (tsc --noEmit) in apps/e2e.
//
// Selectors verified against component tree (T8 implementation):
//   - [data-schedule-day-id]                       DroppableDayHeader (T9-discovered)
//   - [role="tab"][data-tab-key="tidslinje"]        PageTabNav tab button (T8)
//   - [role="tabpanel"][id="tab-panel-tidslinje"]   DayControlPanel panel wrap (T8)
//   - button[aria-pressed]                          TidslinjeChipBar chips
//   - [role="tablist"][aria-label="Kontrollsenter tabs"]  PageTabNav tablist
// =============================================================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_HEADER_SELECTOR = "[data-schedule-day-id]";
const TABLIST_SELECTOR = `[role="tablist"][aria-label="Kontrollsenter tabs"]`;
const TIDSLINJE_TAB_SELECTOR = `[role="tab"][data-tab-key="tidslinje"]`;
const TIDSLINJE_PANEL_SELECTOR = `[role="tabpanel"][id="tab-panel-tidslinje"]`;

// ---------------------------------------------------------------------------
// Helper: navigate to schedule + open DayControlPanel + switch to Tidslinje
// ---------------------------------------------------------------------------

/**
 * Navigates to /dashboard/schedule, opens the DayControlPanel by clicking the
 * first visible day column header, then switches to the Tidslinje tab.
 */
async function openTidslinjePanel(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/dashboard/schedule");
  await page.waitForLoadState("domcontentloaded");

  const firstHeader = page.locator(DAY_HEADER_SELECTOR).first();
  await expect(firstHeader).toBeVisible({ timeout: 20_000 });
  await firstHeader.click();

  await page.waitForSelector(TABLIST_SELECTOR, { timeout: 15_000 });

  await page.locator(TIDSLINJE_TAB_SELECTOR).click();
  await page.waitForSelector(TIDSLINJE_PANEL_SELECTOR, { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("DayControlPanel — Tidslinje tab happy path", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // -------------------------------------------------------------------------
  // Test 1: Open panel → click Tidslinje tab → chip-bar + list/empty-state
  // -------------------------------------------------------------------------
  test("opens via tab click, renders chip-bar + chronological list or empty state", async ({
    page,
  }) => {
    await openTidslinjePanel(page);

    const panel = page.locator(TIDSLINJE_PANEL_SELECTOR);

    // Chip-bar visible — at minimum the "Alle" chip exists
    const chips = panel.locator("button[aria-pressed]");
    await expect(chips.first()).toBeVisible({ timeout: 8_000 });

    // Body: either ≥1 additional button row OR empty-state text.
    // Use race to accept either outcome — depends on fixture data for that day.
    const rowsOrEmpty = await Promise.race([
      panel
        .locator("button")
        .nth(1)
        .waitFor({ state: "visible", timeout: 3_000 })
        .then(() => "rows"),
      panel
        .locator("text=/Ingen aktivitet|No activity/")
        .waitFor({ state: "visible", timeout: 3_000 })
        .then(() => "empty"),
    ]);
    expect(["rows", "empty"]).toContain(rowsOrEmpty);
  });

  // -------------------------------------------------------------------------
  // Test 2: Clicking a location chip toggles aria-pressed
  // -------------------------------------------------------------------------
  test("clicking location chip toggles aria-pressed", async ({ page }) => {
    await openTidslinjePanel(page);

    const chips = page.locator(`${TIDSLINJE_PANEL_SELECTOR} button[aria-pressed]`);
    const count = await chips.count();

    if (count < 2) {
      // Skip gracefully — test fixture lacks ≥2 chips (no day_line locations
      // for the fixture day). Chip-toggle behavior is covered by unit tests
      // (commit f2eece986).
      test.skip(
        true,
        "Test fixture lacks ≥2 chips (no day_line locations for fixture day); chip-toggle behavior covered by unit tests f2eece986",
      );
      return;
    }

    const secondChip = chips.nth(1);
    const before = await secondChip.getAttribute("aria-pressed");
    await secondChip.click();
    const after = await secondChip.getAttribute("aria-pressed");

    // aria-pressed must have flipped
    expect(before).not.toBe(after);
  });

  // -------------------------------------------------------------------------
  // Test 3: Tidslinje is the 5th tab (index 4) in DayControlPanel
  // -------------------------------------------------------------------------
  test("Tidslinje tab is the 5th tab in DayControlPanel", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.waitForLoadState("domcontentloaded");

    const firstHeader = page.locator(DAY_HEADER_SELECTOR).first();
    await expect(firstHeader).toBeVisible({ timeout: 20_000 });
    await firstHeader.click();

    await page.waitForSelector(TABLIST_SELECTOR, { timeout: 15_000 });

    const tabs = await page.locator(`${TABLIST_SELECTOR} [role="tab"]`).all();

    // 8 tabs: 7 original (oversikt, meldinger, bookings, oppgaver, budsjett,
    // bemanning, okonomi) + Tidslinje inserted as 5th (between oppgaver + budsjett)
    expect(tabs.length).toBe(8);

    const tabKeys = await Promise.all(tabs.map((t) => t.getAttribute("data-tab-key")));
    expect(tabKeys).toEqual([
      "oversikt",
      "meldinger",
      "bookings",
      "oppgaver",
      "tidslinje",
      "budsjett",
      "bemanning",
      "okonomi",
    ]);
  });
});
