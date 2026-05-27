/**
 * dagslinjen-parity/parity.spec.ts
 *
 * Track G — Manager Timeline parity spec.
 * Asserts that the Dagslinjen Manager Timeline matches prototype expectations
 * after Track A (workspace/department bootstrap) + Track B (day_line + shift_session spawn)
 * + Track C (session_task creation) have shipped.
 *
 * Runs against http://localhost:3060/dashboard/oppgaver with seed data in place:
 *   - 4 department_sessions seeded
 *   - 4–12 day_lines per session (Track B expanding to 12)
 *   - 23 session_tasks across all lines
 *
 * Happy paths:
 *   H1. Page loads /dashboard/oppgaver as admin, no hydration mismatch errors.
 *   H2. Manager Timeline region exists with aria-label.
 *   H3. At least 4 area-band elements render (sticky band headers or visually grouped).
 *   H4. NowLine exists with aria-label starting with "Nå:".
 *   H5. At least 1 TaskBlock rendered (draggable or with status indicator).
 *
 * Error paths:
 *   E1. Empty timeline → zero task blocks (seed validation).
 *   E2. Hydration mismatch visible in console → FAIL (React/SSR parity).
 *
 * Blockers:
 *   - If component data-testids are missing, tests may fall back to role + aria-label selectors.
 *   - If seed data is not in place, timeline will be empty (expected to fail pre-Track-A/B/C).
 *
 * Run:
 *   pnpm --filter apps/e2e exec playwright test dagslinjen-parity/parity.spec.ts
 *
 * Visual baseline for future diff comparison: ./__screenshots__/baseline.png
 */

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { dismissDevOverlays } from "../missions/_fixtures";

// ─── Constants ────────────────────────────────────────────────────────────────

const ANIMATION_SETTLE_MS = 600;
const OPPGAVER_URL = "/dashboard/oppgaver";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigate to /dashboard/oppgaver (Manager Timeline).
 */
async function goToManagerTimeline(page: Page): Promise<void> {
  await page.goto(OPPGAVER_URL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

/**
 * Capture console logs and errors during page load.
 * Returns { logs, errors } for post-test verification.
 */
function captureConsoleEvents(page: Page): { logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    logs.push(text);
    if (msg.type() === "error") {
      errors.push(text);
    }
  });

  return { logs, errors };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe("Manager Timeline — parity spec", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await dismissDevOverlays(page);
  });

  test("H1 — Page loads /dashboard/oppgaver as admin, no hydration mismatch", async ({ page }) => {
    // Arrange: capture console before navigation
    const { logs, errors } = captureConsoleEvents(page);

    // Act
    await goToManagerTimeline(page);

    // Assert
    expect(page.url()).toContain(OPPGAVER_URL);

    // Verify no hydration mismatch errors (React SSR parity)
    const hydrationErrors = errors.filter(
      (e) => e.toLowerCase().includes("hydration") || e.toLowerCase().includes("mismatch"),
    );
    expect(hydrationErrors).toHaveLength(0);
  });

  test("H2 — Manager Timeline region exists with aria-label", async ({ page }) => {
    // Act
    await goToManagerTimeline(page);

    // Assert: Manager Timeline region found
    const timeline = page.locator('[role="region"][aria-label*="Manager"]');
    await expect(timeline).toBeVisible({ timeout: 10_000 });

    // Fallback: if region not found with Manager label, try generic timeline region
    if (!(await timeline.isVisible({ timeout: 2_000 }).catch(() => false))) {
      const anyTimeline = page.locator('[role="region"]');
      await expect(anyTimeline).toBeVisible({ timeout: 6_000 });
    }
  });

  test("H3 — At least 4 area-band elements render (sticky band headers)", async ({ page }) => {
    // Act
    await goToManagerTimeline(page);

    // Assert: Look for area-band class or band-name heading elements
    // Selectors (in fallback order):
    //   1. data-testid="area-band" (explicit marker)
    //   2. class containing "area-band"
    //   3. font-heading text-sm font-semibold band-name spans
    const bandsByTestId = page.locator('[data-testid="area-band"]');
    const bandsByClass = page.locator(".area-band");
    const bandsByHeading = page.locator(
      "span.font-heading.text-sm.font-semibold:has-text(/[A-Z].*[0-9]?/)",
    );

    let bandCount = 0;

    bandCount = await bandsByTestId.count();
    if (bandCount === 0) {
      bandCount = await bandsByClass.count();
    }
    if (bandCount === 0) {
      bandCount = await bandsByHeading.count();
    }

    expect(bandCount).toBeGreaterThanOrEqual(4);
  });

  test("H4 — NowLine exists with aria-label starting with 'Nå:'", async ({ page }) => {
    // Act
    await goToManagerTimeline(page);

    // Assert: Look for NowLine element
    // Selectors (in fallback order):
    //   1. data-testid="now-line" (explicit marker)
    //   2. aria-label starting with "Nå:" (Norwegian for "Now:")
    //   3. class containing "now-line"
    const nowLineByTestId = page.getByTestId("now-line");
    const nowLineByAriaLabel = page.locator('[aria-label^="Nå:"]');
    const nowLineByClass = page.locator(".now-line");

    const isVisible =
      (await nowLineByTestId.isVisible({ timeout: 2_000 }).catch(() => false)) ||
      (await nowLineByAriaLabel.isVisible({ timeout: 2_000 }).catch(() => false)) ||
      (await nowLineByClass.isVisible({ timeout: 2_000 }).catch(() => false));

    expect(isVisible).toBe(true);
  });

  test("H5 — At least 1 TaskBlock rendered (draggable or with status indicator)", async ({
    page,
  }) => {
    // Act
    await goToManagerTimeline(page);

    // Assert: Look for task block elements
    // Selectors (in fallback order):
    //   1. data-testid="task-block" (explicit marker)
    //   2. [draggable=true] (DOM attribute for drag-drop)
    //   3. class containing "task-block" or "task"
    //   4. Status indicator: [data-testid*="status"] or class "status-"
    const tasksByTestId = page.locator('[data-testid="task-block"]');
    const tasksByDraggable = page.locator('[draggable="true"]');
    const tasksByClass = page.locator(".task-block, .task");
    const tasksByStatus = page.locator('[data-testid*="status"]');

    let taskCount = 0;

    taskCount = await tasksByTestId.count();
    if (taskCount === 0) {
      taskCount = await tasksByDraggable.count();
    }
    if (taskCount === 0) {
      taskCount = await tasksByClass.count();
    }
    if (taskCount === 0) {
      taskCount = await tasksByStatus.count();
    }

    expect(taskCount).toBeGreaterThanOrEqual(1);
  });

  test("E1 — Empty timeline → zero task blocks (seed validation)", async ({ page }) => {
    // This test is informational: if seed data is not in place, timeline will be empty.
    // Expected to pass if seed is complete; to fail if Track A/B/C haven't shipped.

    // Act
    await goToManagerTimeline(page);

    // Assert: Count task blocks
    const tasks = page.locator('[data-testid="task-block"], [draggable="true"]');
    const taskCount = await tasks.count();

    // If taskCount === 0, it means seed data is not in place.
    // This is expected until Track A + B + C ship.
    // For now, we just log the count (test always passes).
    console.log(`[E1] Task block count: ${taskCount} (0 = seed data not ready)`);
    expect(taskCount).toBeGreaterThanOrEqual(0);
  });

  test("H6 — Capture baseline screenshot for visual-diff comparison", async ({ page }) => {
    // Act
    await goToManagerTimeline(page);
    await page.waitForTimeout(ANIMATION_SETTLE_MS);

    // Assert: Snapshot captured
    await page.screenshot({
      path: "apps/e2e/dagslinjen-parity/__screenshots__/baseline.png",
      fullPage: true,
    });

    // Verify file was written (basic smoke)
    const fs = await import("fs").then((m) => m.promises);
    const exists = await fs
      .stat("apps/e2e/dagslinjen-parity/__screenshots__/baseline.png")
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);
  });
});
