import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
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
  // Reset setup_guide_completed so DashboardShell triggers redirect to /dashboard/setup
  sql(`UPDATE workspace SET setup_guide_completed = false WHERE workspace_id = '${WS_ID}'`);
}

function restoreWorkspaceData() {
  sql(`UPDATE policy SET workspace_id = '${WS_ID}' WHERE workspace_id = '${TEMP_WS_ID}'`);
  sql(`UPDATE profile SET is_active = true WHERE workspace_id = '${WS_ID}' AND is_active = false`);
  sql(`UPDATE schedule_shift SET workspace_id = '${WS_ID}' WHERE workspace_id = '${TEMP_WS_ID}'`);
  sql(`UPDATE season SET status = 'active' WHERE workspace_id = '${WS_ID}' AND status = 'draft'`);
  // Mark setup as complete so DashboardShell skips the redirect
  sql(`UPDATE workspace SET setup_guide_completed = true WHERE workspace_id = '${WS_ID}'`);
  sql(`DELETE FROM workspace WHERE workspace_id = '${TEMP_WS_ID}'`);
}

// ─── Tests ─────────────────────────────────────────────────

test.describe("signup-flow", () => {
  test.describe.configure({ mode: "serial" });

  // ─── Test 1: Onboarding page now uses WizardShell ─────
  // The old scroll-based onboarding with data-section attributes has been
  // replaced by AnimatedWizardShell. The page now shows one step at a time
  // (5-step confirmation flow) instead of all sections simultaneously.

  test("onboarding wizard starts on /onboarding with WizardShell", async ({ page }) => {
    await page.goto("/onboarding");

    // WizardShell renders with data-walkai-id attribute
    const wizardShell = page.locator('[data-walkai-id="onboarding-shell"]');
    await expect(wizardShell).toBeVisible({ timeout: 15_000 });

    // First step is "Bekreft bedriftsinformasjon" (confirm business)
    // If user is unauthenticated the loadState returns empty, showing initial state
    await expect(wizardShell).toBeAttached();
  });

  // ─── Test 2: Wizard shows steps one at a time ──────────
  // Old test checked for all data-section elements rendered simultaneously.
  // WizardShell shows ONE step at a time — not a scrollable page.

  test("onboarding wizard shows single step at a time (not all sections)", async ({ page }) => {
    await page.goto("/onboarding");

    const wizardShell = page.locator('[data-walkai-id="onboarding-shell"]');
    await expect(wizardShell).toBeVisible({ timeout: 15_000 });

    // Should have exactly one visible step content area
    const stepArea = page.locator('[data-walkai-type="wizard-step"]');
    await expect(stepArea).toBeVisible();

    // Navigation buttons should be present (WizardNavBar)
    await expect(page.locator("button", { hasText: "Neste" })).toBeVisible();
  });

  // ─── Test 3: Dashboard → setup wizard shows (not StrategicView) ──
  // This test uses the WorkspaceSetupWizard (NOT WizardShell) — unchanged.

  test("dashboard shows setup wizard instead of StrategicView", async ({ page }) => {
    test.setTimeout(45_000);

    // Hide workspace data so it looks like a new workspace
    hideWorkspaceData();

    // Clear any skip flag
    await page.goto("http://localhost:3060");
    await page.evaluate((wsId) => {
      localStorage.removeItem(`smartout_setup_skipped_${wsId}`);
      sessionStorage.removeItem("setup_dismissed");
    }, WS_ID);

    await loginAsAdmin(page, { skipOnboarding: false });

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
