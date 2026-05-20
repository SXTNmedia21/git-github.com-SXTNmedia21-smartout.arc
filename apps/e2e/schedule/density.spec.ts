// =============================================================================
// schedule/density.spec.ts
//
// E2E spec: Schedule card density feature (J1–J4)
//
// Depends on T5 live integration being merged (Phase E). Each test will FAIL
// with "locator not found" until T5 ships the data-testid attributes below.
// That is expected — this file exists to define the contract T5 must satisfy.
//
// data-testid contract (T5 implements, spec consumes):
//   schedule-density-selector          segmented group container
//   schedule-density-button-cozy       tier button
//   schedule-density-button-default    tier button (active on first load)
//   schedule-density-button-compact    tier button
//   schedule-density-button-pulse      tier button
//   schedule-cell                      every grid cell wrapper
//   schedule-shift-card                every shift card in cozy/default/compact
//   schedule-pulse-heatmap             heatmap cell in Pulse mode
//   schedule-pulse-conflict-card       Pulse mini-card with escape strip
//   density-strip                      4px left rail (all tiers)
//                                        data-conflict="true" when conflict detected
//
// Auth pattern:
//   loginAsAdmin() from helpers/auth.ts — no storageState file, inline login.
//   The global-setup.ts fixture provisioner ensures admin@smartout.local exists.
//
// Fixture seeding:
//   DB writes via service-role client (helpers/seed.ts). Conflict shifts are
//   created by seedConflictShifts() in density.fixtures.ts and deleted in
//   afterEach. Preference rows are deleted in afterEach via
//   cleanupDensityPreference() so tests are independent.
//
// Voice scenario substitution (J3):
//   The plan §10 specified a voice command "gi meg pulsen". LiveKit + WebRTC
//   are not drivable from Playwright in CI. Substituted with programmatic
//   dispatch of the same `schedule_view_change` CustomEvent that the voice
//   bridge dispatches when the LLM tool fires. Effect on the UI is identical.
//   See schedule-voice-tools-bridge.tsx `case "set_density":`.
//
// References:
//   Plan: docs/journeys/JOURNEY-schedule-card-density-PLAN.md §10
//   ADR-0331 (pending): schedule-density-persistence.md
// =============================================================================

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import {
  seedConflictShifts,
  cleanupDensityFixture,
  cleanupDensityPreference,
  assertDensityPreference,
  type DensityFixture,
} from "./density.fixtures";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type Density = "cozy" | "default" | "compact" | "pulse";

const DENSITIES: Density[] = ["cozy", "default", "compact", "pulse"];

/** Row heights per tier (px). Compact = 52, Default = 100, Cozy = 120, Pulse-heatmap = 28. */
const DENSITY_ROW_HEIGHTS: Record<Density, number> = {
  cozy: 120,
  default: 100,
  compact: 52,
  pulse: 28,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Click a density tier button and wait for the selector's active state to update.
 * The selector is expected to reflect the active tier via aria-pressed="true" on
 * the active button, OR via a data-active attribute on the group container.
 * T5 must implement at least one of these. The spec tries aria-pressed first.
 */
async function selectDensity(page: Page, density: Density): Promise<void> {
  const btn = page.getByTestId(`schedule-density-button-${density}`);
  await btn.click();
  // Wait for active state to propagate — aria-pressed is the preferred signal.
  // If T5 uses a different pattern (e.g. data-active on group container),
  // update this wait condition to match. See flagged concern #1 below.
  await expect(btn).toHaveAttribute("aria-pressed", "true", { timeout: 5000 });
}

/**
 * Navigate to the schedule page and wait for the density selector to be visible.
 */
async function gotoSchedule(page: Page): Promise<void> {
  await page.goto("/dashboard/schedule");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByTestId("schedule-density-selector")).toBeVisible({ timeout: 15000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Schedule card density", () => {
  let fixture: DensityFixture = { shiftIds: [], shiftDate: "" };

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await gotoSchedule(page);
  });

  test.afterEach(async () => {
    // Clean up any shifts seeded during this test
    await cleanupDensityFixture(fixture.shiftIds);
    fixture = { shiftIds: [], shiftDate: "" };
    // Reset preference row so next test starts from 'default'
    await cleanupDensityPreference();
  });

  // -------------------------------------------------------------------------
  // J1: Density preference persists across reload
  // -------------------------------------------------------------------------
  test("J1 — density preference persists across reload", async ({ page }) => {
    // Step 1: Assert selector is visible and Default button is active on first load
    // (No preference row → server returns 'default' → initialDensity='default')
    const defaultBtn = page.getByTestId("schedule-density-button-default");
    await expect(defaultBtn).toHaveAttribute("aria-pressed", "true", { timeout: 8000 });

    // Step 2: Click Compact
    await selectDensity(page, "compact");

    // Step 3: Assert active state moved to Compact
    await expect(page.getByTestId("schedule-density-button-compact")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(defaultBtn).toHaveAttribute("aria-pressed", "false");

    // Step 4: Assert grid reflects compact height.
    // The first visible schedule-cell should match h-[52px].
    // We check via getBoundingClientRect — allows for border/padding variance.
    const cellHeight = await page
      .getByTestId("schedule-cell")
      .first()
      .evaluate((el) => {
        return el.getBoundingClientRect().height;
      });
    // Compact rows are 52px. Allow ±4px for border + subpixel rendering.
    expect(cellHeight).toBeGreaterThanOrEqual(DENSITY_ROW_HEIGHTS.compact - 4);
    expect(cellHeight).toBeLessThanOrEqual(DENSITY_ROW_HEIGHTS.compact + 4);

    // Step 5: Assert the Server Action persisted the row in DB
    // (fire-and-forget — poll up to 5s)
    await assertDensityPreference("compact");

    // Step 6: Reload the page
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("schedule-density-selector")).toBeVisible({ timeout: 15000 });

    // Step 7: Assert Compact still active after reload (server-fetched initialDensity)
    await expect(page.getByTestId("schedule-density-button-compact")).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 8000 },
    );
  });

  // -------------------------------------------------------------------------
  // J2: Pulse mode heatmap baseline + conflict escape
  // -------------------------------------------------------------------------
  test("J2 — Pulse mode heatmap baseline + conflict escape", async ({ page }) => {
    // Seed a conflict: two overlapping shifts for SEED_PROFILE_ID on a future date
    fixture = await seedConflictShifts();

    // Navigate to the schedule week containing the conflict date.
    // The schedule page defaults to the current week; navigate forward until
    // the conflict date is visible if needed. For now, we navigate directly
    // to the date via URL query param that T5 should support.
    //
    // Concern flagged (#2): T5 needs to expose a way to jump to a specific week.
    // If the schedule page doesn't support ?date=YYYY-MM-DD query param,
    // the "navigate forward" approach requires clicking the next-week button.
    // Using goto with date param as primary strategy; fallback note below.
    await page.goto(`/dashboard/schedule?date=${fixture.shiftDate}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("schedule-density-selector")).toBeVisible({ timeout: 15000 });

    // Step 1: Switch to Pulse mode
    await selectDensity(page, "pulse");

    // Step 2: Assert heatmap cells render at 28px height (baseline Pulse row)
    // At least one heatmap cell should be present (other employees/days without conflict)
    await expect(page.getByTestId("schedule-pulse-heatmap").first()).toBeVisible({ timeout: 8000 });

    const heatmapHeight = await page
      .getByTestId("schedule-pulse-heatmap")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(heatmapHeight).toBeGreaterThanOrEqual(DENSITY_ROW_HEIGHTS.pulse - 4);
    expect(heatmapHeight).toBeLessThanOrEqual(DENSITY_ROW_HEIGHTS.pulse + 4);

    // Step 3: Assert the conflict-row escapes to mini-card
    // The cell with overlapping shifts should render as schedule-pulse-conflict-card
    await expect(page.getByTestId("schedule-pulse-conflict-card").first()).toBeVisible({
      timeout: 8000,
    });

    // Step 4: Assert the conflict card has a red density-strip
    // T5 sets data-conflict="true" on the strip when hasConflict is true
    const conflictStrip = page
      .getByTestId("schedule-pulse-conflict-card")
      .first()
      .getByTestId("density-strip");
    await expect(conflictStrip).toHaveAttribute("data-conflict", "true");

    // Step 5: Assert the conflict mini-card row is ~40px (escape height)
    const conflictCardHeight = await page
      .getByTestId("schedule-pulse-conflict-card")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    // 40px escape height, ±4px tolerance
    expect(conflictCardHeight).toBeGreaterThanOrEqual(36);
    expect(conflictCardHeight).toBeLessThanOrEqual(44);
  });

  // -------------------------------------------------------------------------
  // J3: conflict-strip survives all 4 tiers
  //
  // Voice scenario substitution: the plan originally specified a voice command
  // "gi meg pulsen". LiveKit + WebRTC cannot be driven from Playwright in CI.
  // This test programmatically dispatches the same schedule_view_change
  // CustomEvent that the voice bridge publishes (BotssonOrbVoiceMount.tsx
  // _publishActivity → ScheduleViewChangePayload { action: "set_density" }).
  // The schedule-voice-tools-bridge.tsx case "set_density" handler processes
  // this event identically to a button click, so the assertion coverage is
  // equivalent for the purpose of verifying the bridge wiring.
  // -------------------------------------------------------------------------
  test("J3 — conflict-strip survives all 4 tiers (incl. voice event dispatch)", async ({
    page,
  }) => {
    // Seed conflict shifts
    fixture = await seedConflictShifts();

    // Navigate to the week containing the conflict
    await page.goto(`/dashboard/schedule?date=${fixture.shiftDate}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("schedule-density-selector")).toBeVisible({ timeout: 15000 });

    for (const tier of DENSITIES) {
      if (tier !== "pulse") {
        // Button click path for cozy / default / compact
        await selectDensity(page, tier);
      } else {
        // Voice bridge substitution: dispatch the schedule_view_change event
        // This is the exact event shape the voice tool publishes via _publishActivity.
        await page.evaluate(() => {
          window.dispatchEvent(
            new CustomEvent("schedule_view_change", {
              detail: { action: "set_density", density: "pulse" },
            }),
          );
        });
        // Wait for the UI to settle — the bridge calls setScheduleDensity(payload.density)
        // which updates ScheduleCoordinationContext state via the same React setter.
        await expect(page.getByTestId("schedule-density-button-pulse")).toHaveAttribute(
          "aria-pressed",
          "true",
          { timeout: 5000 },
        );
      }

      // For cozy/default/compact: assert density-strip with data-conflict="true" is in DOM
      // For pulse: the conflict escape renders as schedule-pulse-conflict-card which
      // contains its own density-strip[data-conflict="true"]
      // Use CSS attribute selector to target only the conflict-flagged strip
      const conflictStrip = page.locator('[data-testid="density-strip"][data-conflict="true"]');

      // At least one conflict strip must be visible regardless of tier
      await expect(conflictStrip.first()).toBeVisible({ timeout: 8000 });
      await expect(conflictStrip.first()).toHaveAttribute("data-conflict", "true");

      // Sanity: the strip should carry a destructive color class (red) in all tiers.
      // T5 applies bg-destructive to DensityStrip when hasConflict=true.
      const hasDestructiveClass = await conflictStrip
        .first()
        .evaluate((el) => el.className.includes("destructive"));
      expect(
        hasDestructiveClass,
        `density-strip should have 'destructive' class in tier '${tier}'`,
      ).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // J4: New user with no preference defaults to 'default'
  // -------------------------------------------------------------------------
  test("J4 — new user with no preference defaults to 'default'", async ({ page }) => {
    // Ensure no preference row exists for the test user.
    // afterEach already handles cleanup, but run it upfront too to guard
    // against bleed-in from a previous failed run.
    await cleanupDensityPreference();

    // Navigate fresh — page server-component calls getScheduleDensity() which
    // returns 'default' when no row exists (never throws on missing row).
    await page.goto("/dashboard/schedule");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("schedule-density-selector")).toBeVisible({ timeout: 15000 });

    // Step 1: Default button must be active (aria-pressed="true")
    await expect(page.getByTestId("schedule-density-button-default")).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 8000 },
    );

    // Step 2: Cozy/Compact/Pulse buttons must not be active
    for (const tier of ["cozy", "compact", "pulse"] as const) {
      await expect(page.getByTestId(`schedule-density-button-${tier}`)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }

    // Step 3: No console errors about missing preference row.
    // Attach a listener before page load — this test mounts a fresh page so
    // we check retrospectively that no error was emitted during this test's
    // beforeEach navigation.
    //
    // Note: We cannot retrofit a console listener on a page that already
    // navigated. For a full assertion, we rely on the absence of visible
    // error indicators in the DOM and the successful render of the grid.
    // T5 should confirm the server helper returns 'default' without throwing
    // when the table row is absent (test concern #3).

    // Step 4: Grid renders normally — at least one schedule-cell is present
    await expect(page.getByTestId("schedule-cell").first()).toBeVisible({ timeout: 8000 });

    // Step 5: No error boundary or crash overlay visible
    // Check for common Next.js error overlays
    const errorOverlay = page.locator("nextjs-portal, [data-nextjs-dialog]");
    await expect(errorOverlay).not.toBeVisible();
  });
});
