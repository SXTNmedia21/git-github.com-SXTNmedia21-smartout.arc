import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase } from "../helpers/seed";
import { execSync } from "child_process";

// ─── Constants ─────────────────────────────────────────────
const DB_CONTAINER = "supabase_db_smartout.ai";
const WS_ID = "b0000000-0000-0000-0000-000000000000";
const TEMP_WS_ID = "00000000-0000-0000-0000-ffffffffffff";

function sql(query: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -t -A -c "${query.replace(/"/g, '\\"')}"`,
    { encoding: "utf-8" },
  ).trim();
}

function hideWorkspaceData() {
  sql(
    `INSERT INTO workspace (workspace_id, name, slug, country, currency, language, timezone, is_active) VALUES ('${TEMP_WS_ID}', 'E2E Temp', 'e2e-temp', 'NO', 'NOK', 'no', 'Europe/Oslo', false) ON CONFLICT (workspace_id) DO NOTHING`,
  );
  sql(`UPDATE policy SET workspace_id = '${TEMP_WS_ID}' WHERE workspace_id = '${WS_ID}'`);
  sql(`UPDATE profile SET is_active = false WHERE workspace_id = '${WS_ID}' AND role != 'owner'`);
  sql(`UPDATE schedule_shift SET workspace_id = '${TEMP_WS_ID}' WHERE workspace_id = '${WS_ID}'`);
  sql(`UPDATE season SET status = 'draft' WHERE workspace_id = '${WS_ID}' AND status = 'active'`);
}

function restoreWorkspaceData() {
  sql(`UPDATE policy SET workspace_id = '${WS_ID}' WHERE workspace_id = '${TEMP_WS_ID}'`);
  sql(`UPDATE profile SET is_active = true WHERE workspace_id = '${WS_ID}' AND is_active = false`);
  sql(`UPDATE schedule_shift SET workspace_id = '${WS_ID}' WHERE workspace_id = '${TEMP_WS_ID}'`);
  sql(`UPDATE season SET status = 'active' WHERE workspace_id = '${WS_ID}' AND status = 'draft'`);
  sql(`DELETE FROM workspace WHERE workspace_id = '${TEMP_WS_ID}'`);
}

// ─── Tests ─────────────────────────────────────────────────

test.describe("signup-flow", () => {
  test.describe.configure({ mode: "serial" });

  // ─── Test 1: New user → /onboarding → wizard starts ────

  test("onboarding wizard starts on /onboarding", async ({ page }) => {
    await page.goto("/onboarding");

    // The hero section should be visible with the main heading
    const hero = page.locator('[data-section="hero"]');
    await expect(hero).toBeVisible({ timeout: 15_000 });

    // Unauthenticated hero: "Velkommen til Smartout"
    await expect(page.locator('h1:has-text("Velkommen til")')).toBeVisible({ timeout: 10_000 });

    // Navigation controller should show step 1 of 7 (contract excluded)
    await expect(page.locator("text=/1\\/7/")).toBeVisible({ timeout: 5_000 });
  });

  // ─── Test 2: Wizard sections render without contract ────

  test("wizard renders all visible sections (no contract)", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.locator('[data-section="hero"]')).toBeVisible({ timeout: 15_000 });

    // All 7 visible sections should exist in the DOM
    const expectedSections = [
      "hero",
      "business",
      "departments",
      "locations",
      "procedures",
      "season",
      "welcome",
    ];
    for (const section of expectedSections) {
      await expect(page.locator(`[data-section="${section}"]`)).toBeAttached();
    }

    // Contract section should NOT exist
    await expect(page.locator('[data-section="contract"]')).not.toBeAttached();
  });

  // ─── Test 3: Dashboard → setup wizard shows (not StrategicView) ──

  test("dashboard shows setup wizard instead of StrategicView", async ({ page }) => {
    test.setTimeout(45_000);

    // Hide workspace data so it looks like a new workspace
    hideWorkspaceData();

    // Clear any skip flag
    await page.goto("http://localhost:3060");
    await page.evaluate((wsId) => localStorage.removeItem(`smartout_setup_skipped_${wsId}`), WS_ID);

    await loginAsAdmin(page);

    // Wizard should show
    const wizardHeader = page.locator('text="Oppsett av arbeidsrom"');
    await expect(wizardHeader).toBeVisible({ timeout: 15_000 });

    // StrategicView should NOT be visible
    await expect(page.locator('text="Strategisk oversikt"')).not.toBeVisible();

    // Wizard first step should be visible
    await expect(page.locator('h1:has-text("Velkommen til Smartout")')).toBeVisible({
      timeout: 5_000,
    });

    // Restore data for other tests
    restoreWorkspaceData();
  });
});
