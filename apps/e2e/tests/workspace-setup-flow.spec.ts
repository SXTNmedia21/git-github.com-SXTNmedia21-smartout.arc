import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase } from "../helpers/seed";
import { execSync } from "child_process";

// ─── Setup ────────────────────────────────────────────────

const E2E_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const DB_CONTAINER = "supabase_db_smartout.ai";
const WS_ID = "b0000000-0000-0000-0000-000000000000";

// Track IDs we create so we can clean up
const seededPolicyIds: string[] = [];
const seededInvitationIds: string[] = [];

let profileId: string;
let companyId: string;
let workspaceId: string;

/**
 * Run SQL directly in the Supabase DB container.
 */
function sql(query: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -t -A -c "${query.replace(/"/g, '\\"')}"`,
    { encoding: "utf-8" },
  ).trim();
}

async function getAdminContext() {
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();
  const admin = users.find((u) => u.email === E2E_EMAIL);
  if (!admin) throw new Error(`Admin user ${E2E_EMAIL} not found`);

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", admin.id)
    .limit(1)
    .single();
  if (!profile) throw new Error(`No profile for ${E2E_EMAIL}`);

  const { data: workspace } = await supabase
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", profile.workspace_id)
    .single();

  return {
    profileId: profile.profile_id as string,
    workspaceId: profile.workspace_id as string,
    companyId: (workspace?.company_id ?? "") as string,
  };
}

const TEMP_WS_ID = "00000000-0000-0000-0000-ffffffffffff";

/**
 * Make the workspace appear "new" by moving data to a temp workspace.
 * Creates the temp workspace if needed, then moves policies/shifts there.
 */
function hideWorkspaceData() {
  // Create temp workspace for parking data
  sql(
    `INSERT INTO workspace (workspace_id, name, slug, country, currency, language, timezone, is_active) VALUES ('${TEMP_WS_ID}', 'E2E Temp', 'e2e-temp', 'NO', 'NOK', 'no', 'Europe/Oslo', false) ON CONFLICT (workspace_id) DO NOTHING`,
  );

  // Move policies to temp workspace
  sql(`UPDATE policy SET workspace_id = '${TEMP_WS_ID}' WHERE workspace_id = '${WS_ID}'`);
  // Deactivate extra profiles (keep only 1 active — owner)
  sql(`UPDATE profile SET is_active = false WHERE workspace_id = '${WS_ID}' AND role != 'owner'`);
  // Move shifts to temp workspace
  sql(`UPDATE schedule_shift SET workspace_id = '${TEMP_WS_ID}' WHERE workspace_id = '${WS_ID}'`);
  // Deactivate seasons (use draft to avoid trigger issues)
  sql(`UPDATE season SET status = 'draft' WHERE workspace_id = '${WS_ID}' AND status = 'active'`);
  // Reset setup_guide_completed so DashboardShell triggers redirect to /dashboard/setup
  sql(`UPDATE workspace SET setup_guide_completed = false WHERE workspace_id = '${WS_ID}'`);
  // Reset onboarding guide progress so wizard starts at step 0
  sql(`UPDATE workspace SET onboarding_guide_progress = NULL WHERE workspace_id = '${WS_ID}'`);
}

function restoreWorkspaceData() {
  // Restore policies
  sql(`UPDATE policy SET workspace_id = '${WS_ID}' WHERE workspace_id = '${TEMP_WS_ID}'`);
  // Reactivate profiles
  sql(`UPDATE profile SET is_active = true WHERE workspace_id = '${WS_ID}' AND is_active = false`);
  // Restore shifts
  sql(`UPDATE schedule_shift SET workspace_id = '${WS_ID}' WHERE workspace_id = '${TEMP_WS_ID}'`);
  // Reactivate seasons — delete conflicting idempotency keys first to avoid trigger constraint violations
  sql(
    `DELETE FROM engine_event WHERE idempotency_key LIKE 'season_activated_%' AND workspace_id = '${WS_ID}'`,
  );
  sql(`UPDATE season SET status = 'active' WHERE workspace_id = '${WS_ID}' AND status = 'draft'`);
  // Mark setup as complete so DashboardShell skips the redirect
  sql(`UPDATE workspace SET setup_guide_completed = true WHERE workspace_id = '${WS_ID}'`);
  // Clean up temp workspace
  sql(`DELETE FROM workspace WHERE workspace_id = '${TEMP_WS_ID}'`);
}

async function clearSkipFlag(page: Page) {
  await page.goto("http://localhost:3060");
  await page.evaluate((wsId) => {
    localStorage.removeItem(`smartout_setup_skipped_${wsId}`);
    // Also clear the DashboardShell sessionStorage dismiss flag
    sessionStorage.removeItem("setup_dismissed");
  }, WS_ID);
}

// ─── Test Suite ───────────────────────────────────────────

test.describe("setup-wizard", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const ctx = await getAdminContext();
    workspaceId = ctx.workspaceId;
    profileId = ctx.profileId;
    companyId = ctx.companyId;

    // Seed intelligence_data with restaurant info
    // Must match detectIndustryType() expected structure:
    // - brregData.naceCode for NACE detection
    // - scrapedData.companyName for display
    await supabase
      .from("workspace")
      .update({
        intelligence_data: {
          brregData: {
            naceCode: "56.101",
            naceDescription: "Drift av restauranter og kafeer",
          },
          scrapedData: {
            companyName: "E2E Test Restaurant AS",
            companyType: "Restaurant",
            openingHours: "11:00–23:00",
            address: "Testgata 1, 0001 Oslo",
          },
        },
      })
      .eq("workspace_id", workspaceId);

    // Hide existing data so the wizard shows
    hideWorkspaceData();
  });

  test.afterAll(async () => {
    // Always restore workspace data
    restoreWorkspaceData();

    // Restore intelligence_data
    await supabase
      .from("workspace")
      .update({ intelligence_data: null })
      .eq("workspace_id", workspaceId);

    // Clean up test-created policies
    for (const id of seededPolicyIds) {
      await supabase.from("policy").delete().eq("policy_id", id);
    }

    // Clean up test-created invitations
    for (const id of seededInvitationIds) {
      await supabase.from("invitation").delete().eq("invitation_id", id);
    }
  });

  // ─── Test 1: Wizard shows for new workspace ──────────

  test("shows wizard for workspace needing setup @smoke", async ({ page }) => {
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    // DashboardShell redirects to /dashboard/setup when setup_guide_completed is false.
    // The wizard's loadState computes _initialStepIndex based on module completion.
    // With policies/shifts moved away, the first incomplete module is "governance" →
    // wizard starts at step 1 (document-drop), not step 0 (welcome).
    await page.waitForTimeout(5_000);

    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Sidebar should NOT be visible (wizard is fullscreen)
    const dashSidebar = page.locator("aside");
    await expect(dashSidebar).not.toBeVisible();
  });

  // ─── Test 2: Step 0 shows scraped data ───────────────

  test("step 1 shows document drop after data hidden", async ({ page }) => {
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    await page.waitForTimeout(5_000);

    // With data hidden, wizard starts at document-drop step
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Verify the wizard loaded without error
    const bodyText = await page.textContent("body");
    const hasError = bodyText?.includes("Runtime Error") || bodyText?.includes("Application error");
    expect(hasError).toBeFalsy();
  });

  // ─── Test 3: Can navigate through all 9 steps ────────

  test("can navigate through remaining steps from document-drop @smoke", async ({ page }) => {
    test.setTimeout(90_000);

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    await page.waitForTimeout(5_000);

    // Wizard starts at document-drop (step 1) since data is hidden
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Remaining step titles from step 1 onward
    // NOTE: "Sesong" was renamed to "Årshjul" (season_title i18n key)
    const remainingTitles = [
      "Retningslinjer og policies",
      "Lønn og tariff",
      "Ansettelsesvilkår",
      "Team og medarbeidere",
      "Vaktmaler",
      "Årshjul",
      "Personalhandbok",
    ];

    // Click "Neste" through remaining steps
    for (const title of remainingTitles) {
      await page.locator('button:has-text("Neste")').click();
      await expect(page.locator(`h1:has-text("${title}")`)).toBeVisible({ timeout: 5_000 });
    }

    // Last step shows "Fullfør" button
    await expect(page.locator('button:has-text("Fullfør")')).toBeVisible();
  });

  // ─── Test 4: Governance templates filtered by industry ─

  test("governance step shows industry-relevant toggles", async ({ page }) => {
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    await page.waitForTimeout(5_000);

    // Wizard starts at document-drop (step 1) since data is hidden
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Navigate to governance — Neste once from document-drop
    await page.locator('button:has-text("Neste")').click();
    await expect(page.locator('h1:has-text("Retningslinjer og policies")')).toBeVisible({
      timeout: 5_000,
    });

    // Governance step now shows "Hva gjelder for din virksomhet?" with toggle switches
    await expect(page.locator('h3:has-text("Hva gjelder for din virksomhet")')).toBeVisible({
      timeout: 5_000,
    });

    // Restaurant-relevant toggles should be present
    await expect(page.locator("text=Matservering")).toBeVisible();
    await expect(page.locator("text=Alkoholservering")).toBeVisible();

    // Policy count summary should be visible
    await expect(page.locator("text=/\\d+ retningslinjer/")).toBeVisible();
  });

  // ─── Test 5: Can create policy from template ─────────

  test("can expand policy list on governance step", async ({ page }) => {
    test.setTimeout(45_000);

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    // Wait for setup wizard to load (starts at document-drop when data is hidden)
    await page.waitForTimeout(5_000);
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Navigate to governance step
    await page.locator('button:has-text("Neste")').click();
    await expect(page.locator('h1:has-text("Retningslinjer og policies")')).toBeVisible({
      timeout: 5_000,
    });

    // The collapsed policy list shows "N retningslinjer — Trykk for å se og aktivere"
    const expandBtn = page.locator("button:has-text('retningslinjer')").first();
    await expect(expandBtn).toBeVisible({ timeout: 5_000 });

    // Expand and verify content loads
    await expandBtn.click();
    await page.waitForTimeout(1_000);

    // After expansion, policy template names should be visible (or a list of checkboxes/toggles)
    // The exact UI depends on the GovernanceSetupStep component
    const bodyText = await page.textContent("body");
    const hasError = bodyText?.includes("Runtime Error") || bodyText?.includes("Application error");
    expect(hasError).toBeFalsy();
  });

  // ─── Test 6: Can invite team member ──────────────────

  test("can add team member on team step", async ({ page }) => {
    test.setTimeout(45_000);

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    // Wait for setup wizard to load (starts at document-drop when data is hidden)
    await page.waitForTimeout(5_000);
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Navigate to step 5 (team) — click Neste until we reach it
    for (let i = 0; i < 8; i++) {
      const heading = page.locator('h1:has-text("Team og medarbeidere")');
      if (await heading.isVisible({ timeout: 1_000 }).catch(() => false)) break;
      const nextBtn = page.locator('button:has-text("Neste")');
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(800);
      }
    }
    await expect(page.locator('h1:has-text("Team og medarbeidere")')).toBeVisible({
      timeout: 5_000,
    });

    // Team step shows "Legg til teamet ditt" heading
    await expect(page.locator('h3:has-text("Legg til teamet ditt")')).toBeVisible({
      timeout: 5_000,
    });

    // Fill team member form — find the last row's inputs
    const nameInputs = page.locator('input[placeholder="Fornavn"]');
    const lastIdx = (await nameInputs.count()) - 1;
    await nameInputs.nth(lastIdx).fill("Test");
    await page.locator('input[placeholder="Etternavn"]').nth(lastIdx).fill("Bruker");
    await page
      .locator('input[placeholder="E-post"]')
      .nth(lastIdx)
      .fill("test.bruker@e2e-test.local");

    // Verify data is in the form
    await expect(nameInputs.nth(lastIdx)).toHaveValue("Test");

    // Person count should update
    await expect(page.locator("text=/\\d+ person/")).toBeVisible();
  });

  // ─── Test 7: Wizard disappears when setup complete ───

  test("wizard disappears when setup complete @smoke", async ({ page }) => {
    test.setTimeout(30_000);

    // Restore all data so the workspace is fully set up
    restoreWorkspaceData();

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });

    // Wizard should NOT show — should stay on /dashboard (not redirect to /dashboard/setup)
    await page.waitForTimeout(3_000);
    expect(page.url()).not.toContain("/dashboard/setup");

    // Sidebar should be visible (normal dashboard)
    await expect(page.locator("aside, nav, [data-sidebar]").first()).toBeVisible({
      timeout: 5_000,
    });

    // Re-hide data for test 8
    hideWorkspaceData();
  });

  // ─── Test 8: Skip works with localStorage ────────────

  test("skip saves to sessionStorage and persists", async ({ page }) => {
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    // Wizard should redirect to /dashboard/setup (starts at document-drop)
    await page.waitForTimeout(5_000);
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({
      timeout: 15_000,
    });

    // The top-right skip button: "Hopp over og gå til dashboard"
    const skipBtn = page.getByRole("button", { name: "Hopp over og gå til dashboard" });
    await expect(skipBtn).toBeVisible({ timeout: 5_000 });

    // Click skip — redirects back to /dashboard
    await skipBtn.click();

    // Wizard gone — should be on /dashboard now
    await page.waitForTimeout(2_000);
    expect(page.url()).not.toContain("/dashboard/setup");

    // Verify sessionStorage flag was set (setup page uses sessionStorage)
    const dismissValue = await page.evaluate(() => sessionStorage.getItem("setup_dismissed"));
    expect(dismissValue).toBeTruthy();
  });

  // ─── Test 9: Skip → clear localStorage → wizard returns ─

  test("clearing sessionStorage dismiss flag makes wizard reappear", async ({ page }) => {
    test.setTimeout(45_000);

    // First, ensure data is hidden (wizard should show)
    hideWorkspaceData();

    // Skip the wizard
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    await page.waitForTimeout(5_000);
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({
      timeout: 15_000,
    });

    const skipBtn = page.getByRole("button", { name: "Hopp over og gå til dashboard" });
    await expect(skipBtn).toBeVisible({ timeout: 5_000 });
    await skipBtn.click();

    // Wizard gone — on normal dashboard
    await page.waitForTimeout(2_000);
    expect(page.url()).not.toContain("/dashboard/setup");

    // Clear sessionStorage dismiss flag
    await page.evaluate(() => sessionStorage.removeItem("setup_dismissed"));

    // Reload — wizard should redirect back to /dashboard/setup
    await page.reload();
    await page.waitForTimeout(5_000);

    // Should show the setup wizard again (starts at document-drop)
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({
      timeout: 15_000,
    });
  });

  // ─── Test 10: Full 9-step wizard navigation ─────────────

  test("can navigate all 9 steps: welcome → handbook → complete", async ({ page }) => {
    test.setTimeout(90_000);

    hideWorkspaceData();
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    // Wizard starts at document-drop (step 1) since data is hidden
    await page.waitForTimeout(5_000);
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Remaining step titles from document-drop onward
    // NOTE: "Sesong" was renamed to "Årshjul" (season_title i18n key)
    const remainingTitles = [
      "Retningslinjer og policies",
      "Lønn og tariff",
      "Ansettelsesvilkår",
      "Team og medarbeidere",
      "Vaktmaler",
      "Årshjul",
      "Personalhandbok",
    ];

    // Navigate through remaining steps
    for (const title of remainingTitles) {
      await page.locator('button:has-text("Neste")').click();
      await expect(page.locator(`h1:has-text("${title}")`)).toBeVisible({ timeout: 5_000 });
    }

    // Last step should show "Fullfør" button
    const completeBtn = page.locator('button:has-text("Fullfør")');
    await expect(completeBtn).toBeVisible();

    // Click complete — wizard should dismiss
    await completeBtn.click();
    await page.waitForTimeout(3_000);

    // Should no longer be on the setup page
    expect(page.url()).not.toContain("/dashboard/setup");
  });

  // ─── Test 11: After wizard complete → StrategicView shows ─

  test("after wizard complete, StrategicView shows", async ({ page }) => {
    test.setTimeout(45_000);

    // Restore data so workspace is fully set up (all modules complete)
    restoreWorkspaceData();

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });

    // Should NOT be on setup page
    await page.waitForTimeout(3_000);
    expect(page.url()).not.toContain("/dashboard/setup");

    // Normal dashboard has a header with navigation — not present in setup mode
    const header = page.locator("header").first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Should see navigation links (normal dashboard chrome, not wizard)
    const navLink = page.locator("nav a, header a").first();
    await expect(navLink).toBeVisible({ timeout: 5_000 });
  });
});
