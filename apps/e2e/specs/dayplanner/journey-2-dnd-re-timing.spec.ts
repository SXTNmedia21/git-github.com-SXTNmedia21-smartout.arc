/**
 * journey-2-dnd-re-timing.spec.ts
 *
 * E2E tests for Wave 1 Phase A DnD task re-timing on /dashboard/oppgaver.
 *
 * Journey: Manager drags a task block to a new time slot.
 * Expected outcomes:
 *   - Task moves visually to the new position.
 *   - Success toast appears.
 *   - No axe accessibility violations during/after drag.
 *
 * Seed precondition: one session_task at 12:00 in the first lane for today.
 * If SUPABASE_URL is absent (CI smoke without DB), tests are skipped.
 *
 * NOTE (Wave 1): Playwright's page.dragAndDrop() works with HTML5 drag events.
 * If the target app uses pointer-event-based drag (React DnD Backends), a
 * manual mousedown/move/up sequence may be needed. The spec uses dragAndDrop()
 * first with a fallback note; the actual DnD impl uses HTML5 events (draggable
 * attr + ondragstart), so dragAndDrop() should work.
 *
 * References: ADR-0298, PLAN-dayplanner-dnd-and-views.md Phase A.6.
 */

import { test, expect } from "@playwright/test";
// axe-playwright is optional — skip a11y assertions if not installed
let checkA11y: ((page: unknown) => Promise<void>) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axe = require("@axe-core/playwright") as { checkA11y: typeof checkA11y };
  checkA11y = axe.checkA11y;
} catch {
  // axe-playwright not installed — skip a11y assertions
}

const HAS_SUPABASE_ENV = !!process.env.SUPABASE_URL;

test.describe("Journey 2 — DnD task re-timing", () => {
  test.skip(!HAS_SUPABASE_ENV, "Skipped: SUPABASE_URL not set (no DB available)");

  test.beforeEach(async ({ page }) => {
    // Navigate to oppgaver with a test date — seeded task is at 12:00
    await page.goto("/dashboard/oppgaver?date=2026-05-25");
    // Wait for the chart to finish loading
    await page.waitForSelector('[aria-label="Gantt timeline"]', { timeout: 10_000 });
  });

  test("drag task from 12:00 to 14:00 — task moves, toast appears", async ({ page }) => {
    // Find the source task block (seeded at 12:00)
    const sourceBlock = page.locator('[aria-label*="12:00"]').first();
    await expect(sourceBlock).toBeVisible();

    // Find the target lane — drop somewhere in the area below (approx 14:00)
    // We use a relative offset within the first PersonLane
    const lane = page.locator('[role="group"]').first();
    const laneBox = await lane.boundingBox();
    if (!laneBox) throw new Error("Lane not found");

    // Offset for 14:00: relative to 06:00 start, 8 hours down, pxPerHour=48
    // (14*60 - 6*60) / 60 * 48 = 8 * 48 = 384px from lane top
    const targetY = laneBox.y + 384;
    const targetX = laneBox.x + laneBox.width / 2;

    const sourceBox = await sourceBlock.boundingBox();
    if (!sourceBox) throw new Error("Source task not found");

    // Perform drag via Playwright's dragAndDrop
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 10 });
    await page.mouse.up();

    // Assert toast appears (sonner renders as div[data-sonner-toast])
    await expect(page.locator("[data-sonner-toaster]")).toBeVisible({ timeout: 5_000 });

    // Assert task block now appears near 14:00 row
    const movedBlock = page.locator('[aria-label*="14:00"]').first();
    await expect(movedBlock).toBeVisible({ timeout: 3_000 });
  });

  test("axe: zero violations during drag interaction", async ({ page }) => {
    test.skip(!checkA11y, "axe-playwright not installed");

    // Initiate drag (hold down)
    const sourceBlock = page.locator('[aria-label*="12:00"]').first();
    const sourceBox = await sourceBlock.boundingBox();
    if (!sourceBox) {
      test.skip(true, "Source task not seeded");
      return;
    }

    await page.mouse.move(sourceBox.x + 5, sourceBox.y + 5);
    await page.mouse.down();

    // Run axe while drag is in progress
    if (checkA11y) {
      await checkA11y(page);
    }

    // Release drag
    await page.mouse.up();
  });

  test("keyboard: Enter on task block opens re-timing modal", async ({ page }) => {
    const taskBlock = page.locator('button[draggable="true"]').first();
    await taskBlock.focus();
    await page.keyboard.press("Enter");

    // The Sheet should open with edit mode
    await expect(page.locator('[id="edit-time"]')).toBeVisible({ timeout: 3_000 });
  });
});
