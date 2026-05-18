/**
 * day-line/edit-hours.spec.ts
 *
 * ADR-0367 Phase F E2E — Manager edits planned open/close hours on a day line.
 *
 * Journey: JOURNEY-day-line-edit-hours.md
 * Covers:
 *   J1 — DayLineStrip renders edit-hours button when manager is logged in
 *   J2 — Clicking open-close-edit-trigger opens OpenCloseEditPopover
 *   J3 — Popover shows planned-open-input + planned-close-input pre-filled
 *   J4 — Filling new time + clicking save-hours-button triggers update
 *         and shows success toast "Åpningstider oppdatert"
 *
 * Precondition note:
 *   J1-J4 require at least one day_line row for today's session. If no strips
 *   exist in seed (no session or no day_lines), tests skip gracefully.
 *   OpenCloseEditPopover IS wired in DayLineStrip (no Phase-C gate needed).
 *
 * Auth: loginAsAdmin (admin@smartout.local) — manager-level in seed workspace.
 * Route: /dashboard → Dagslinjen tab → first DayLineStrip.
 */
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { showStep } from "../../helpers/show-step";

test.describe("day-line/edit-hours — ADR-0367 Phase F", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ── J1: DayLineStrip edit-hours button visible ──────────────────────────────
  test("J1 — edit-hours button renders on first strip (manager role)", async ({ page }) => {
    await showStep(page, "J1", "Navigerer til /dashboard → Dagslinjen tab");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const tabList = page.getByRole("tablist", { name: /Dag-informasjon/i });
    const hasTabs = await tabList.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasTabs) {
      await showStep(page, "J1", "Ingen session — J1 skipped", 800);
      test.skip(true, "No active session seeded — tab-list not visible");
      return;
    }

    await page.getByRole("tab", { name: /Dagslinjen/i }).click();
    await page.waitForTimeout(600);

    await showStep(page, "J1", "Venter på day-line strips");
    const stripsContainer = page.locator('[data-testid="timeline-tab-strips"]');
    const hasStrips = await stripsContainer.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!hasStrips) {
      await showStep(page, "J1", "Ingen day_lines seeded for today — J1 skipped", 800);
      test.skip(true, "No day_line rows seeded for today's session");
      return;
    }

    // First strip header should render an edit-hours button (manager role, non-locked status)
    const firstEditBtn = page.locator('[data-testid^="day-line-edit-hours-"]').first();
    await expect(firstEditBtn).toBeVisible({ timeout: 5_000 });

    await showStep(page, "J1", "✓ J1 — edit-hours knapp synlig på første strip", 800);
  });

  // ── J2: OpenCloseEditPopover opens ─────────────────────────────────────────
  test("J2 — clicking open-close-edit-trigger opens popover", async ({ page }) => {
    await showStep(page, "J2", "Navigerer til /dashboard → Dagslinjen tab");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const tabList = page.getByRole("tablist", { name: /Dag-informasjon/i });
    const hasTabs = await tabList.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasTabs) {
      test.skip(true, "No active session seeded — tab-list not visible");
      return;
    }

    await page.getByRole("tab", { name: /Dagslinjen/i }).click();
    await page.waitForTimeout(600);

    const stripsContainer = page.locator('[data-testid="timeline-tab-strips"]');
    const hasStrips = await stripsContainer.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!hasStrips) {
      test.skip(true, "No day_line rows seeded for today's session");
      return;
    }

    await showStep(page, "J2", "Klikker open-close-edit-trigger på første strip");
    const editTrigger = page.locator('[data-testid="open-close-edit-trigger"]').first();
    await editTrigger.click();

    // Popover should open
    const popover = page.locator('[data-testid="open-close-edit-popover"]');
    await expect(popover).toBeVisible({ timeout: 5_000 });

    await showStep(page, "J2", "✓ J2 — OpenCloseEditPopover åpnet", 800);
  });

  // ── J3: Popover fields are pre-filled ──────────────────────────────────────
  test("J3 — popover shows planned-open and planned-close inputs pre-filled", async ({ page }) => {
    await showStep(page, "J3", "Navigerer til /dashboard → Dagslinjen tab");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const tabList = page.getByRole("tablist", { name: /Dag-informasjon/i });
    const hasTabs = await tabList.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasTabs) {
      test.skip(true, "No active session seeded — tab-list not visible");
      return;
    }

    await page.getByRole("tab", { name: /Dagslinjen/i }).click();
    await page.waitForTimeout(600);

    const stripsContainer = page.locator('[data-testid="timeline-tab-strips"]');
    const hasStrips = await stripsContainer.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!hasStrips) {
      test.skip(true, "No day_line rows seeded for today's session");
      return;
    }

    await showStep(page, "J3", "Åpner popover + verifiserer input-felter");
    const editTrigger = page.locator('[data-testid="open-close-edit-trigger"]').first();
    await editTrigger.click();

    await expect(page.locator('[data-testid="open-close-edit-popover"]')).toBeVisible({
      timeout: 5_000,
    });

    // Both inputs should be present and pre-filled with non-empty values
    const openInput = page.locator('[data-testid="planned-open-input"]');
    const closeInput = page.locator('[data-testid="planned-close-input"]');

    await expect(openInput).toBeVisible();
    await expect(closeInput).toBeVisible();

    const openVal = await openInput.inputValue();
    const closeVal = await closeInput.inputValue();

    // Pre-filled from the day_line row — should not be empty
    expect(openVal.length, "planned-open should be pre-filled").toBeGreaterThan(0);
    expect(closeVal.length, "planned-close should be pre-filled").toBeGreaterThan(0);

    await showStep(page, "J3", `✓ J3 — Åpner: ${openVal}  Stenger: ${closeVal}`, 800);
  });

  // ── J4: Save triggers toast "Åpningstider oppdatert" ───────────────────────
  test("J4 — saving new times shows success toast", async ({ page }) => {
    await showStep(page, "J4", "Navigerer til /dashboard → Dagslinjen tab");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const tabList = page.getByRole("tablist", { name: /Dag-informasjon/i });
    const hasTabs = await tabList.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasTabs) {
      test.skip(true, "No active session seeded — tab-list not visible");
      return;
    }

    await page.getByRole("tab", { name: /Dagslinjen/i }).click();
    await page.waitForTimeout(600);

    const stripsContainer = page.locator('[data-testid="timeline-tab-strips"]');
    const hasStrips = await stripsContainer.isVisible({ timeout: 6_000 }).catch(() => false);

    if (!hasStrips) {
      test.skip(true, "No day_line rows seeded for today's session");
      return;
    }

    await showStep(page, "J4", "Åpner popover og fyller inn ny åpningstid");
    const editTrigger = page.locator('[data-testid="open-close-edit-trigger"]').first();
    await editTrigger.click();
    await expect(page.locator('[data-testid="open-close-edit-popover"]')).toBeVisible({
      timeout: 5_000,
    });

    // Fill a valid planned_open time
    const openInput = page.locator('[data-testid="planned-open-input"]');
    await openInput.fill("08:00");

    await showStep(page, "J4", "Klikker save-hours-button");
    const saveBtn = page.locator('[data-testid="save-hours-button"]');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Toast should appear confirming the update
    const toast = page.getByText(/Åpningstider oppdatert/i).first();
    await expect(toast).toBeVisible({ timeout: 8_000 });

    await showStep(page, "J4", "✓ J4 — Toast: Åpningstider oppdatert", 800);
  });
});
