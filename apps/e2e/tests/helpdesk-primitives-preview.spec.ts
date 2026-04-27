/**
 * E2E smoke + visual regression baseline for the helpdesk primitives preview.
 *
 * Route: /platform-admin/helpdesk-preview
 * Scope: Phase 1 primitives (Orb, LighthouseAvatar, StatusLabel, Pill).
 *
 * Snapshot baseline intentionally NOT generated inside the campaign plan run
 * because the local dev server is not started as part of automated execution.
 * Run manually once to seed the baseline:
 *
 *   cd apps/e2e && pnpm exec playwright test \
 *     tests/helpdesk-primitives-preview.spec.ts --update-snapshots
 */
import { test, expect } from "@playwright/test";

test("helpdesk primitives preview renders all sections", async ({ page }) => {
  await page.goto("/platform-admin/helpdesk-preview");

  await expect(page.getByRole("heading", { name: "Helpdesk Primitives" })).toBeVisible();
  await expect(page.getByText("Orb — size 48, 3 statuses")).toBeVisible();
  await expect(page.getByText("Orb — pulse animation")).toBeVisible();
  await expect(page.getByText("LighthouseAvatar — 3 halo intensities")).toBeVisible();
  await expect(page.getByText("StatusLabel — 3 states")).toBeVisible();
  await expect(page.getByText("Pill — 3 tones")).toBeVisible();

  await expect(page.getByLabel("waiting")).toBeVisible();
  await expect(page.getByLabel("active")).toBeVisible();
  await expect(page.getByLabel("complete")).toBeVisible();

  await expect(page.getByText("VENTER")).toBeVisible();
  await expect(page.getByText("AKTIV")).toBeVisible();
  await expect(page.getByText("LØST")).toBeVisible();
});

test("helpdesk primitives preview — visual regression baseline", async ({ page }) => {
  await page.goto("/platform-admin/helpdesk-preview");
  await page.waitForLoadState("networkidle");
  // Give the pulse animation a settled frame.
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot("helpdesk-primitives-preview.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});
