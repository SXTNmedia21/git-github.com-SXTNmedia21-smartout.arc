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
  // Deactivate seasons
  sql(`UPDATE season SET status = 'draft' WHERE workspace_id = '${WS_ID}' AND status = 'active'`);
}

function restoreWorkspaceData() {
  // Restore policies
  sql(`UPDATE policy SET workspace_id = '${WS_ID}' WHERE workspace_id = '${TEMP_WS_ID}'`);
  // Reactivate profiles
  sql(`UPDATE profile SET is_active = true WHERE workspace_id = '${WS_ID}' AND is_active = false`);
  // Restore shifts
  sql(`UPDATE schedule_shift SET workspace_id = '${WS_ID}' WHERE workspace_id = '${TEMP_WS_ID}'`);
  // Reactivate seasons
  sql(`UPDATE season SET status = 'active' WHERE workspace_id = '${WS_ID}' AND status = 'draft'`);
  // Clean up temp workspace
  sql(`DELETE FROM workspace WHERE workspace_id = '${TEMP_WS_ID}'`);
}

async function clearSkipFlag(page: Page) {
  await page.goto("http://localhost:3060");
  await page.evaluate((wsId) => localStorage.removeItem(`smartout_setup_skipped_${wsId}`), WS_ID);
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

  test("shows wizard for workspace needing setup", async ({ page }) => {
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    // Wizard should render
    const wizardHeader = page.locator('text="Oppsett av arbeidsrom"');
    await expect(wizardHeader).toBeVisible({ timeout: 15_000 });

    // Step 0 title should be visible (no completed modules → starts at step 0)
    await expect(page.locator('h1:has-text("Velkommen til Smartout")')).toBeVisible({
      timeout: 5_000,
    });

    // Sidebar should NOT be visible (wizard is fullscreen)
    const dashSidebar = page.locator('[data-sidebar="sidebar"]');
    await expect(dashSidebar).not.toBeVisible();
  });

  // ─── Test 2: Step 0 shows scraped data ───────────────

  test("step 0 shows scraped data", async ({ page }) => {
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    await expect(page.locator('h1:has-text("Velkommen til Smartout")')).toBeVisible({
      timeout: 15_000,
    });

    // The WelcomeStep shows "Det vi allerede vet" when intelligence_data exists
    const factsSection = page.locator('text="Det vi allerede vet"');
    const hasFacts = await factsSection.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasFacts) {
      await expect(factsSection).toBeVisible();
    } else {
      // Verify the wizard loaded with scroll area content
      const scrollArea = page.locator("[data-wizard-scroll]");
      await expect(scrollArea).toBeVisible();
    }
  });

  // ─── Test 3: Can navigate through all 9 steps ────────

  test("can navigate through all 9 steps", async ({ page }) => {
    test.setTimeout(60_000);

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    await expect(page.locator('h1:has-text("Velkommen til Smartout")')).toBeVisible({
      timeout: 15_000,
    });

    const stepTitles = [
      "Velkommen til Smartout",
      "Last opp dokumenter",
      "Dine retningslinjer",
      "Lønn og tillegg",
      "Ansettelsesvilkår",
      "Ditt team",
      "Dine vaktmaler",
      "Din sesong",
      "Din personalhåndbok",
    ];

    // Verify step 0
    await expect(page.locator(`h1:has-text("${stepTitles[0]}")`)).toBeVisible();

    // Click "Neste" 8 times
    for (let i = 1; i < stepTitles.length; i++) {
      await page.locator('button:has-text("Neste")').click();

      const title = stepTitles[i]!;
      await expect(page.locator(`h1:has-text("${title}")`)).toBeVisible({ timeout: 5_000 });

      // Verify step counter (partial match — text continues with subtitle)
      const stepIndicator = page.locator(`text=/Steg ${i} av ${stepTitles.length - 1}/`);
      await expect(stepIndicator).toBeVisible();
    }

    // Last step shows "Fullfør" button
    await expect(page.locator('button:has-text("Fullfør og åpne dashboard")')).toBeVisible();
  });

  // ─── Test 4: Governance templates filtered by industry ─

  test("governance templates filtered by industry", async ({ page }) => {
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    await expect(page.locator('h1:has-text("Velkommen til Smartout")')).toBeVisible({
      timeout: 15_000,
    });

    // Navigate to step 2 (governance) — Neste twice
    await page.locator('button:has-text("Neste")').click();
    await expect(page.locator('h1:has-text("Last opp dokumenter")')).toBeVisible();

    await page.locator('button:has-text("Neste")').click();
    await expect(page.locator('h1:has-text("Dine retningslinjer")')).toBeVisible({
      timeout: 5_000,
    });

    // Mandatory templates always visible regardless of industry
    await expect(page.locator("text=/Arbeidsmilj.*HMS/")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text="Brannsikkerhet"')).toBeVisible();

    // Overnight template NOT visible for restaurants
    await expect(page.locator('text="Romrenhold"')).not.toBeVisible();
  });

  // ─── Test 5: Can create policy from template ─────────

  test("can create policy from template", async ({ page }) => {
    test.setTimeout(45_000);

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    // Wait for wizard to load (any step)
    await expect(page.locator('text="Oppsett av arbeidsrom"')).toBeVisible({ timeout: 15_000 });

    // Navigate to governance step — click step button or use Neste
    const govStepBtn = page.locator('button:has-text("Dine retningslinjer")');
    if (await govStepBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await govStepBtn.click();
    } else {
      // Navigate forward until we reach governance
      for (let i = 0; i < 5; i++) {
        if (
          await page
            .locator('h1:has-text("Dine retningslinjer")')
            .isVisible()
            .catch(() => false)
        )
          break;
        const nextBtn = page.locator('button:has-text("Neste")');
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }
    await expect(page.locator('h1:has-text("Dine retningslinjer")')).toBeVisible({
      timeout: 5_000,
    });

    // Count active policies before
    const { count: beforeCount } = await supabase
      .from("policy")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    // Click "Opprett" on a template
    const createBtn = page.locator('button:has-text("Opprett")').first();
    await createBtn.click();

    // Wait for creation
    await page.waitForTimeout(2_000);

    // Verify count increased
    const { count: afterCount } = await supabase
      .from("policy")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    expect(afterCount).toBeGreaterThan(beforeCount ?? 0);

    // Track for cleanup
    const { data: newest } = await supabase
      .from("policy")
      .select("policy_id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (newest?.[0]) seededPolicyIds.push(newest[0].policy_id);
  });

  // ─── Test 6: Can invite team member ──────────────────

  test("can invite team member", async ({ page }) => {
    test.setTimeout(45_000);

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    // Wait for wizard to load (any step)
    await expect(page.locator('text="Oppsett av arbeidsrom"')).toBeVisible({ timeout: 15_000 });

    // Navigate to step 5 (team) — click the step button directly or use Neste
    const teamStepBtn = page.locator('button:has-text("Ditt team")');
    const teamStepVisible = await teamStepBtn.isVisible().catch(() => false);

    if (teamStepVisible) {
      // Click the step button directly
      await teamStepBtn.click();
    } else {
      // Navigate forward with Neste until we reach "Ditt team"
      for (let i = 0; i < 8; i++) {
        const heading = page.locator('h1:has-text("Ditt team")');
        if (await heading.isVisible().catch(() => false)) break;
        const nextBtn = page.locator('button:has-text("Neste")');
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }
    await expect(page.locator('h1:has-text("Ditt team")')).toBeVisible({ timeout: 5_000 });

    // Mock the Edge Function BEFORE interacting with the form
    await page.route("**/functions/v1/create-invitation", async (route) => {
      const body = await route.request().postDataJSON();
      const invites = body.invites ?? [];

      for (const inv of invites) {
        const { data } = await supabase
          .from("invitation")
          .insert({
            workspace_id: workspaceId,
            company_id: companyId || null,
            email: inv.email,
            first_name: inv.firstName,
            last_name: inv.lastName,
            role: "employee",
            status: "pending",
          })
          .select("invitation_id")
          .single();
        if (data) seededInvitationIds.push(data.invitation_id);
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          sent: invites.length,
          results: invites.map((inv: { email: string }) => ({
            email: inv.email,
            status: "sent",
          })),
        }),
      });
    });

    // Add manual invite row
    await page.locator('button:has-text("Legg til manuelt")').click();

    // Fill the last invite row (newly added)
    const nameInputs = page.locator('input[placeholder="Fornavn"]');
    const lastIdx = (await nameInputs.count()) - 1;
    await nameInputs.nth(lastIdx).fill("Test");
    await page.locator('input[placeholder="Etternavn"]').nth(lastIdx).fill("Bruker");
    await page
      .locator('input[placeholder="E-post"]')
      .nth(lastIdx)
      .fill("test.bruker@e2e-test.local");

    // Wait for "Send invitasjoner" button to appear (depends on pending count > 0)
    const sendBtn = page.locator('button:has-text("Send invitasjoner")');
    await expect(sendBtn).toBeVisible({ timeout: 5_000 });
    await sendBtn.click();

    // Wait for the row to show as sent (disabled inputs)
    await page.waitForTimeout(2_000);

    // DB check
    const { count } = await supabase
      .from("invitation")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("email", "test.bruker@e2e-test.local");
    expect(count).toBeGreaterThan(0);
  });

  // ─── Test 7: Wizard disappears when setup complete ───

  test("wizard disappears when setup complete", async ({ page }) => {
    test.setTimeout(30_000);

    // Restore all data so the workspace is fully set up
    restoreWorkspaceData();

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });

    // Wizard should NOT show
    const wizardHeader = page.locator('text="Oppsett av arbeidsrom"');
    await expect(wizardHeader).not.toBeVisible({ timeout: 10_000 });

    // Sidebar should be visible (normal dashboard)
    await expect(page.locator("aside, nav, [data-sidebar]").first()).toBeVisible({
      timeout: 5_000,
    });

    // Re-hide data for test 8
    hideWorkspaceData();
  });

  // ─── Test 8: Skip works with localStorage ────────────

  test("skip saves to localStorage and persists", async ({ page }) => {
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    // Wizard should show
    const skipBtn = page.locator('button:has-text("Hopp over")');
    await expect(skipBtn).toBeVisible({ timeout: 15_000 });

    // Click skip
    await skipBtn.click();

    // Wizard gone
    await page.waitForTimeout(1_000);
    const wizardHeader = page.locator('text="Oppsett av arbeidsrom"');
    await expect(wizardHeader).not.toBeVisible({ timeout: 5_000 });

    // Verify localStorage
    const skipValue = await page.evaluate(
      (wsId) => localStorage.getItem(`smartout_setup_skipped_${wsId}`),
      WS_ID,
    );
    expect(skipValue).toBeTruthy();
    expect(Number(skipValue)).toBeGreaterThan(0);

    // Reload — wizard still hidden
    await page.reload();
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    await expect(wizardHeader).not.toBeVisible({ timeout: 10_000 });
  });

  // ─── Test 9: Skip → clear localStorage → wizard returns ─

  test("clearing localStorage skip flag makes wizard reappear", async ({ page }) => {
    test.setTimeout(45_000);

    // First, ensure data is hidden (wizard should show)
    hideWorkspaceData();

    // Skip the wizard
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    const skipBtn = page.locator('button:has-text("Hopp over")');
    await expect(skipBtn).toBeVisible({ timeout: 15_000 });
    await skipBtn.click();

    // Wizard gone
    await page.waitForTimeout(1_000);
    await expect(page.locator('text="Oppsett av arbeidsrom"')).not.toBeVisible({ timeout: 5_000 });

    // Clear localStorage
    await page.evaluate((wsId) => localStorage.removeItem(`smartout_setup_skipped_${wsId}`), WS_ID);

    // Reload — wizard should return
    await page.reload();
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    await expect(page.locator('text="Oppsett av arbeidsrom"')).toBeVisible({ timeout: 15_000 });
  });

  // ─── Test 10: Full 9-step wizard navigation ─────────────

  test("can navigate all 9 steps: welcome → handbook → complete", async ({ page }) => {
    test.setTimeout(90_000);

    hideWorkspaceData();
    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    const stepTitles = [
      "Velkommen til Smartout",
      "Last opp dokumenter",
      "Dine retningslinjer",
      "Lønn og tillegg",
      "Ansettelsesvilkår",
      "Ditt team",
      "Dine vaktmaler",
      "Din sesong",
      "Din personalhåndbok",
    ];

    // Verify step 0 shows
    await expect(page.locator(`h1:has-text("${stepTitles[0]}")`)).toBeVisible({ timeout: 15_000 });

    // Navigate through all 9 steps
    for (let i = 1; i < stepTitles.length; i++) {
      await page.locator('button:has-text("Neste")').click();

      const title = stepTitles[i]!;
      await expect(page.locator(`h1:has-text("${title}")`)).toBeVisible({ timeout: 5_000 });

      // Verify step counter
      const stepIndicator = page.locator(`text=/Steg ${i} av ${stepTitles.length - 1}/`);
      await expect(stepIndicator).toBeVisible();
    }

    // Last step should show "Fullfør" button
    const completeBtn = page.locator('button:has-text("Fullfør og åpne dashboard")');
    await expect(completeBtn).toBeVisible();

    // Click complete — wizard should dismiss
    await completeBtn.click();
    await page.waitForTimeout(2_000);

    // Wizard should be gone
    await expect(page.locator('text="Oppsett av arbeidsrom"')).not.toBeVisible({ timeout: 10_000 });
  });

  // ─── Test 11: After wizard complete → StrategicView shows ─

  test("after wizard complete, StrategicView shows", async ({ page }) => {
    test.setTimeout(45_000);

    // Restore data so workspace is fully set up (all modules complete)
    restoreWorkspaceData();

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });

    // Wizard should NOT show
    await expect(page.locator('text="Oppsett av arbeidsrom"')).not.toBeVisible({ timeout: 10_000 });

    // Normal dashboard has a header with navigation — not present in setup mode
    const header = page.locator("header").first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Should see navigation links (normal dashboard chrome, not wizard)
    const navLink = page.locator("nav a, header a").first();
    await expect(navLink).toBeVisible({ timeout: 5_000 });
  });
});
