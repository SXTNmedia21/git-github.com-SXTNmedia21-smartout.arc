// =============================================================================
// schedule/tidslinje-tab.axe.spec.ts
//
// Gate 1 a11y verification for the PageTabNav ARIA contract on DayControlPanel.
// Sortie 1 / Task 9 — feat/p10-tidslinje-tab.
//
// What this tests:
//   The DayControlPanel (at /dashboard/schedule) replaced its inline tab strip
//   with PageTabNav (commit c9dd3faa3). This spec verifies the ARIA contract
//   holds end-to-end: zero axe violations on the tablist + tabpanel region,
//   and that every tab carries the correct role/aria-selected/aria-controls
//   attributes as defined by PageTabNav.
//
// How the panel opens:
//   The schedule grid renders DroppableDayHeader elements with a
//   data-schedule-day-id attribute. Clicking any day header triggers
//   setSelectedDate() in the schedule page, which opens DayControlSheet
//   containing DayControlPanel. We click the first visible day header to
//   open the panel.
//
// Auth pattern:
//   loginAsAdmin() from helpers/auth.ts — inline login, no storageState.
//   global-setup.ts ensures admin@smartout.local exists.
//
// Infrastructure prerequisite:
//   Requires dev server (web on port 3060) + Supabase local running.
//   Run via: cd apps/e2e && pnpm test:e2e -- schedule/tidslinje-tab.axe.spec.ts
//   or:      pnpm exec playwright test schedule/tidslinje-tab.axe.spec.ts --project=web
//
//   If no dev server is available, this test defers to CI. The syntax is
//   verified via `pnpm typecheck` (tsc --noEmit) in apps/e2e.
//
// ARIA contract verified (from PageTabNav.tsx + DayControlPanel.tsx):
//   - [role="tablist"][aria-label="Kontrollsenter tabs"] wraps all tab buttons
//   - Each tab: role="tab", aria-selected="true"|"false", aria-controls="tab-panel-<key>"
//   - 7 tabs defined: oversikt, meldinger, bookings, oppgaver, budsjett, bemanning, okonomi
//   - tabpanel: role="tabpanel", id="tab-panel-<activeTab>", aria-labelledby="tab-btn-<activeTab>"
// =============================================================================

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginAsAdmin } from "../helpers/auth";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** ARIA label as rendered by PageTabNav ariaLabel="Kontrollsenter tabs" */
const TABLIST_ARIA_LABEL = "Kontrollsenter tabs";

/** Minimum tab count — TAB_DEFS in DayControlPanel.tsx defines 7 tabs. */
const MIN_TAB_COUNT = 7;

/** Selector for day column headers in the schedule grid (DroppableDayHeader) */
const DAY_HEADER_SELECTOR = "[data-schedule-day-id]";

/** Selector for the rendered tablist */
const TABLIST_SELECTOR = `[role="tablist"][aria-label="${TABLIST_ARIA_LABEL}"]`;

// ---------------------------------------------------------------------------
// Helper: navigate to schedule + open day control panel
// ---------------------------------------------------------------------------

/**
 * Opens the DayControlPanel by clicking the first visible day column header.
 * DroppableDayHeader renders data-schedule-day-id on each day column.
 * Clicking any day header calls setSelectedDate(day.id) → opens DayControlSheet.
 */
async function openDayControlPanel(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/dashboard/schedule");
  await page.waitForLoadState("domcontentloaded");

  // Wait for the schedule grid to render at least one day header
  const firstHeader = page.locator(DAY_HEADER_SELECTOR).first();
  await expect(firstHeader).toBeVisible({ timeout: 20_000 });

  // Click the first day header to open DayControlPanel
  await firstHeader.click();

  // Wait for the tablist to appear — this confirms the panel is open
  await page.waitForSelector(TABLIST_SELECTOR, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("DayControlPanel — Sortie 1 a11y gate (PageTabNav ARIA contract)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // -------------------------------------------------------------------------
  // Test 1: Zero axe violations on the tablist + tabpanel region
  // -------------------------------------------------------------------------
  test("zero axe violations with panel open on /dashboard/schedule", async ({ page }) => {
    await openDayControlPanel(page);

    const results = await new AxeBuilder({ page })
      .include(TABLIST_SELECTOR)
      .include("[role='tabpanel']")
      .analyze();

    expect(results.violations).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Test 2: Each tab carries role=tab + aria-selected + aria-controls
  // -------------------------------------------------------------------------
  test("each tab has role=tab + aria-selected + aria-controls pointing to tab-panel-*", async ({
    page,
  }) => {
    await openDayControlPanel(page);

    const tabs = await page.locator(`${TABLIST_SELECTOR} [role="tab"]`).all();

    // DayControlPanel defines 7 tabs — verify at least that many rendered
    expect(tabs.length).toBeGreaterThanOrEqual(MIN_TAB_COUNT);

    for (const tab of tabs) {
      const ariaSelected = await tab.getAttribute("aria-selected");
      const ariaControls = await tab.getAttribute("aria-controls");

      // aria-selected must be either "true" (active tab) or "false"
      // PageTabNav sets aria-selected={isActive} (boolean), Playwright reads as string
      expect(ariaSelected, "aria-selected must be 'true' or 'false'").toMatch(/^(true|false)$/);

      // aria-controls must point to a tab-panel-* id
      // PageTabNav sets aria-controls={`tab-panel-${t.key}`}
      expect(ariaControls, "aria-controls must match tab-panel-<key> pattern").toMatch(
        /^tab-panel-/,
      );
    }
  });

  // -------------------------------------------------------------------------
  // Test 3: Exactly one tab is selected at a time (the active tab)
  // -------------------------------------------------------------------------
  test("exactly one tab has aria-selected='true' on initial open", async ({ page }) => {
    await openDayControlPanel(page);

    const selectedTabs = await page
      .locator(`${TABLIST_SELECTOR} [role="tab"][aria-selected="true"]`)
      .all();

    // DayControlPanel initializes with activeTab="oversikt" — exactly 1 selected
    expect(selectedTabs.length).toBe(1);

    // The first selected tab's aria-controls must be tab-panel-oversikt
    const ariaControls = await selectedTabs[0]!.getAttribute("aria-controls");
    expect(ariaControls).toBe("tab-panel-oversikt");
  });

  // -------------------------------------------------------------------------
  // Test 4: tabpanel id and aria-labelledby match the active tab
  // -------------------------------------------------------------------------
  test("tabpanel id and aria-labelledby are coherent with active tab", async ({ page }) => {
    await openDayControlPanel(page);

    // The active tab on open is "oversikt" (DayControlPanel initialState)
    const tabPanel = page.locator('[role="tabpanel"]').first();
    await expect(tabPanel).toBeVisible({ timeout: 10_000 });

    const panelId = await tabPanel.getAttribute("id");
    const labelledBy = await tabPanel.getAttribute("aria-labelledby");

    // DayControlPanel renders: id="tab-panel-${activeTab}" aria-labelledby="tab-btn-${activeTab}"
    expect(panelId).toBe("tab-panel-oversikt");
    expect(labelledBy).toBe("tab-btn-oversikt");
  });

  // -------------------------------------------------------------------------
  // Test 5: Tab switching — clicking a tab updates aria-selected + tabpanel
  // -------------------------------------------------------------------------
  test("clicking a tab updates aria-selected and tabpanel visibility", async ({ page }) => {
    await openDayControlPanel(page);

    // Find the "Dagsinfo" tab (key="meldinger")
    const meldingerTab = page.locator(
      `${TABLIST_SELECTOR} [role="tab"][aria-controls="tab-panel-meldinger"]`,
    );

    await expect(meldingerTab).toBeVisible({ timeout: 10_000 });

    // Confirm it starts unselected
    await expect(meldingerTab).toHaveAttribute("aria-selected", "false");

    // Click to activate
    await meldingerTab.click();

    // aria-selected should flip to true
    await expect(meldingerTab).toHaveAttribute("aria-selected", "true", { timeout: 5_000 });

    // tabpanel id should update to tab-panel-meldinger
    const tabPanel = page.locator('[role="tabpanel"]').first();
    await expect(tabPanel).toHaveAttribute("id", "tab-panel-meldinger", { timeout: 5_000 });
    await expect(tabPanel).toHaveAttribute("aria-labelledby", "tab-btn-meldinger");

    // Previous active tab (oversikt) must now be deselected
    const oversiktTab = page.locator(
      `${TABLIST_SELECTOR} [role="tab"][aria-controls="tab-panel-oversikt"]`,
    );
    await expect(oversiktTab).toHaveAttribute("aria-selected", "false");
  });

  // -------------------------------------------------------------------------
  // Test 6 (T18): Zero axe violations scoped to the Tidslinje tabpanel
  // Added by Task 18 — extends axe coverage from global tablist to specific
  // Tidslinje panel content (chip-bar, event rows, empty-state).
  // -------------------------------------------------------------------------
  test("zero axe violations on Tidslinje tabpanel", async ({ page }) => {
    await openDayControlPanel(page);

    // Switch to the Tidslinje tab (key="tidslinje", mounted by T8)
    await page.locator(`[role="tab"][data-tab-key="tidslinje"]`).click();
    await page.waitForSelector(`[role="tabpanel"][id="tab-panel-tidslinje"]`, {
      timeout: 10_000,
    });

    const results = await new AxeBuilder({ page })
      .include(`[role="tabpanel"][id="tab-panel-tidslinje"]`)
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
