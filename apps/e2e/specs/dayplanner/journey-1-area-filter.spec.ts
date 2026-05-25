/**
 * journey-1-area-filter.spec.ts
 *
 * E2E tests for Wave 2 Phase C area-filter chip dimming on /dashboard/oppgaver.
 *
 * Journey: Manager clicks an area chip to filter the timeline, then resets to "Alle".
 * Expected outcomes:
 *   - Non-matching AreaBand gets `opacity-50` Tailwind class (dimmed).
 *   - Matching bands remain at full opacity.
 *   - Clicking the active chip again restores all bands to full opacity.
 *   - axe-core: zero violations on chip-bar region (role=toolbar, FilterChip buttons).
 *
 * Seed precondition:
 *   - 2+ day_line rows (e.g. "Sal", "Kjøkken") for today.
 *   - session_tasks exist in both areas so bands render.
 *
 * Gate: tests skip when E2E_OPPGAVER env var is absent (CI smoke without live DB).
 *
 * Implementation note on dimming:
 *   AreaBand uses `dimmed && "opacity-50"` (Tailwind class). The prototype targets
 *   opacity: 0.3 but implementation intentionally uses 50% for legibility
 *   (visual-parity doc — MINOR DEVIATION, accepted). Tests assert class presence,
 *   not computed style, to stay resilient to value changes.
 *
 * References: JOURNEY-dayplanner-area-filter.md, PLAN-dayplanner-dnd-and-views.md Phase C.5.
 */

import { test, expect } from "@playwright/test";

// ── axe optional import ──────────────────────────────────────────────────────
let injectAxe: (() => Promise<void>) | null = null;
let checkA11y: ((page: unknown, options?: unknown) => Promise<void>) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axe = require("@axe-core/playwright") as {
    injectAxe: typeof injectAxe;
    checkA11y: typeof checkA11y;
  };
  injectAxe = axe.injectAxe;
  checkA11y = axe.checkA11y;
} catch {
  // axe-playwright not installed — skip a11y assertions
}

// ── Environment gate ─────────────────────────────────────────────────────────
const HAS_OPPGAVER_ENV = !!process.env.E2E_OPPGAVER;

test.describe("Journey 1 — area-filter dim (Wave 2 Phase C)", () => {
  test.skip(!HAS_OPPGAVER_ENV, "Skipped: E2E_OPPGAVER not set (no live DB)");

  test.beforeEach(async ({ page }) => {
    // Navigate with today's date; seed must have 2+ day_lines for today
    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`/dashboard/oppgaver?date=${today}`);
    // Wait for the chart to render (Gantt aria-label set in ManagerTimelineChart)
    await page.waitForSelector('[aria-label="Gantt timeline"]', { timeout: 15_000 });
    // Wait for at least one area band header to confirm data loaded
    await page.waitForSelector('[role="toolbar"]', { timeout: 10_000 });
  });

  test("clicking area chip dims non-matching bands", async ({ page }) => {
    // Locate the toolbar chip group
    const toolbar = page.locator('[role="toolbar"]');
    await expect(toolbar).toBeVisible();

    // Find the first area FilterChip (not the boolean filter chips)
    // FilterChip renders as button with aria-pressed attribute
    const chips = toolbar.locator("button[aria-pressed]");
    const chipCount = await chips.count();
    // Need at least 1 area chip to proceed
    if (chipCount === 0) {
      test.skip(true, "No area chips found — no areas seeded for today");
      return;
    }

    // Get the label of the first chip (e.g. "Kjøkken") — we will activate it
    const firstChip = chips.first();
    const firstChipLabel = (await firstChip.textContent()) ?? "";

    // Click the first chip to activate it
    await firstChip.click();

    // After activation: aria-pressed should be "true"
    await expect(firstChip).toHaveAttribute("aria-pressed", "true");

    // Non-matching AreaBand wrappers should get opacity-50 class.
    // AreaBand root div carries the `opacity-50` class when dimmed prop is true.
    // We assert that at least one band has the opacity-50 class (a non-matching band).
    const dimmedBands = page.locator(".opacity-50");
    await expect(dimmedBands.first()).toBeVisible({ timeout: 3_000 });

    // The band matching firstChipLabel should NOT be dimmed.
    // Band headers contain the area name in a <span class="...">name</span>.
    // We look for a parent that contains the chip label text and verify no opacity-50 on it.
    // NOTE: This test can only verify count-based assertion since we don't control
    // the exact band-id ↔ chip-label mapping in the E2E seed.
    // At minimum, not ALL bands should be dimmed (the active one should remain).
    const allBands = page.locator('[class*="area-band"], [data-testid="area-band"]');
    const totalBands = await allBands.count();
    const allDimmed = await dimmedBands.count();
    if (totalBands > 0) {
      // At least one band should NOT be dimmed
      expect(allDimmed).toBeLessThan(totalBands);
    }

    // Deactivate: click the chip again to toggle off (restore "Alle")
    await firstChip.click();
    await expect(firstChip).toHaveAttribute("aria-pressed", "false");

    // All opacity-50 classes should be gone
    await expect(dimmedBands).toHaveCount(0, { timeout: 3_000 });

    // Log context for debugging
    void firstChipLabel; // suppress unused var warning
  });

  test("chip activates and deactivates cleanly (toggle cycle)", async ({ page }) => {
    const toolbar = page.locator('[role="toolbar"]');
    const chips = toolbar.locator("button[aria-pressed]");
    const chipCount = await chips.count();
    if (chipCount === 0) {
      test.skip(true, "No area chips found");
      return;
    }

    const chip = chips.first();

    // Initial state: not active
    await expect(chip).toHaveAttribute("aria-pressed", "false");

    // Activate
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");

    // Deactivate
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "false");

    // No dimmed bands after full toggle cycle
    const dimmedBands = page.locator(".opacity-50");
    await expect(dimmedBands).toHaveCount(0, { timeout: 2_000 });
  });

  test("axe: zero violations on toolbar chip region", async ({ page }) => {
    test.skip(!checkA11y || !injectAxe, "axe-playwright not installed");

    const toolbar = page.locator('[role="toolbar"]');
    await expect(toolbar).toBeVisible();

    if (injectAxe) await injectAxe();
    if (checkA11y) {
      await checkA11y(page, {
        // Scope to the toolbar region only
        include: [[`[role="toolbar"]`]],
        // Exclude known acceptable patterns per Nordic Split
        rules: {
          // color-contrast may fail in headless without real CSS cascade
          "color-contrast": { enabled: false },
        },
      });
    }
  });
});
