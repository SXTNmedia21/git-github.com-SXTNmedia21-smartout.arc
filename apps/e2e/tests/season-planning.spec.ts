import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

/**
 * Season Planning E2E — updated for the 2026-04-20 year-wheel redesign.
 *
 * The old drawer/tab-on-page layout is gone. `/dashboard/year-wheel` now
 * renders a 3-column shell (sidebar + canvas + rail). Season detail editing
 * lives on `/dashboard/season/[seasonId]?tab=<key>`. Goals + Procedures
 * tabs were deferred to P2 and moved under `_deferred/`, so the tests that
 * drove them are skipped until that work lands.
 *
 * Ref: docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §14
 */
test.describe("Season Planning — Critical Flows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should render the new year-wheel shell", async ({ page }) => {
    // The year-wheel page is now a 3-column shell (sidebar + canvas + rail).
    // Verifies main region renders and the sidebar's "Sesonger {year}" header
    // is present — that's the most stable landmark independent of seed data.
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    await expect(page.locator("main").first()).toBeVisible({ timeout: 10000 });

    // The sidebar renders an aside with aria-label starting with "Sesonger".
    await expect(page.locator('aside[aria-label^="Sesonger"]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("should expose the season sidebar regardless of season data", async ({ page }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // The sidebar is always rendered — either populated with season rows or
    // showing an empty state. Either way the aside landmark is visible.
    const sidebar = page.locator('aside[aria-label^="Sesonger"]').first();
    await expect(sidebar).toBeVisible({ timeout: 8000 });
  });

  // Per-test skip modifier — uses `test.skip("name", ...)` variant so the
  // surrounding describe's shell-render + sidebar tests still run. Top-level
  // `test.skip(true, reason)` would skip the WHOLE describe.
  test.skip("should switch to goals tab and show create button", async ({ page: _page }) => {
    // P2 deferred per 2026-04-20 year-wheel redesign council — Goals tab
    // moved to _deferred/. Re-enable when the tab is re-wired to the new
    // season page route (`/dashboard/season/[seasonId]?tab=goals`). See
    // docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §11.5.
  });

  test.skip("should switch to procedures tab and show policy list or empty state", async ({
    page: _page,
  }) => {
    // P2 deferred per 2026-04-20 year-wheel redesign council — Procedures
    // tab moved to _deferred/. Re-enable when re-wired to the new season
    // page route (`/dashboard/season/[seasonId]?tab=procedures`). See
    // docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §11.5.
  });
});
