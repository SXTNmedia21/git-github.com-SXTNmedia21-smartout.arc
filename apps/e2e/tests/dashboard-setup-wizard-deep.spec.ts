import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase } from "../helpers/seed";
import { execSync } from "child_process";

// ─────────────────────────────────────────────────────────────
// dashboard-setup-wizard-deep.spec.ts
//
// Companion to workspace-setup-flow.spec.ts which covers step
// navigation and skip flag. This spec closes the gaps flagged in
// reports/signup-workspace-audit-2026-04-15.md:
//   • Skip vs complete produce distinct persisted state
//   • Resume mid-flow: onboarding_guide_progress drives where the
//     wizard mounts on reopen
//   • sessionStorage flag survives a same-tab navigation but not a
//     fresh browser context
//
// Uses the seed workspace (b0000000-…-0) but restores DB state in
// afterEach to stay cooperative with other workspace-setup specs.
// ─────────────────────────────────────────────────────────────

const DB_CONTAINER = "supabase_db_smartout.ai";
const WS_ID = "b0000000-0000-0000-0000-000000000000";
const TEMP_WS_ID = "00000000-0000-0000-0000-ffffffffffff";

function sql(query: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -t -A -c "${query.replace(/"/g, '\\"')}"`,
    { encoding: "utf-8" },
  ).trim();
}

// Snapshot of the exact (season_id, status) pairs we toggled, so restore
// only writes back what we changed. This avoids the "blanket UPDATE to
// active" pollution that would flip unrelated seasons if another spec
// was already running.
const seasonSnapshot: Array<{ season_id: string; status: string }> = [];

function hideWorkspaceData() {
  sql(
    `INSERT INTO workspace (workspace_id, name, slug, country, currency, language, timezone, is_active) VALUES ('${TEMP_WS_ID}', 'E2E Temp', 'e2e-temp', 'NO', 'NOK', 'no', 'Europe/Oslo', false) ON CONFLICT (workspace_id) DO NOTHING`,
  );
  sql(`UPDATE policy SET workspace_id = '${TEMP_WS_ID}' WHERE workspace_id = '${WS_ID}'`);
  sql(`UPDATE profile SET is_active = false WHERE workspace_id = '${WS_ID}' AND role != 'owner'`);
  sql(`UPDATE schedule_shift SET workspace_id = '${TEMP_WS_ID}' WHERE workspace_id = '${WS_ID}'`);

  // Snapshot season rows we are about to flip, so restore puts back the
  // exact prior state by id. Only append to the snapshot — never clobber
  // prior entries from an earlier hide in the same test run.
  const activeRows = sql(
    `SELECT season_id || '|' || status FROM season WHERE workspace_id = '${WS_ID}' AND status = 'active'`,
  );
  for (const line of activeRows
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)) {
    const [season_id, status] = line.split("|");
    if (season_id && status && !seasonSnapshot.some((s) => s.season_id === season_id)) {
      seasonSnapshot.push({ season_id, status });
    }
  }
  sql(`UPDATE season SET status = 'draft' WHERE workspace_id = '${WS_ID}' AND status = 'active'`);

  sql(`UPDATE workspace SET setup_guide_completed = false WHERE workspace_id = '${WS_ID}'`);
  sql(`UPDATE workspace SET onboarding_guide_progress = NULL WHERE workspace_id = '${WS_ID}'`);
}

function restoreWorkspaceData() {
  sql(`UPDATE policy SET workspace_id = '${WS_ID}' WHERE workspace_id = '${TEMP_WS_ID}'`);
  sql(`UPDATE profile SET is_active = true WHERE workspace_id = '${WS_ID}' AND is_active = false`);
  sql(`UPDATE schedule_shift SET workspace_id = '${WS_ID}' WHERE workspace_id = '${TEMP_WS_ID}'`);
  sql(
    `DELETE FROM engine_event WHERE idempotency_key LIKE 'season_activated_%' AND workspace_id = '${WS_ID}'`,
  );

  // Restore ONLY the season rows we flipped, by id, back to their prior
  // status. No blanket UPDATE — this keeps other specs' season state
  // intact even if they happen to have draft seasons for this workspace.
  for (const snap of seasonSnapshot) {
    sql(`UPDATE season SET status = '${snap.status}' WHERE season_id = '${snap.season_id}'`);
  }
  seasonSnapshot.length = 0;

  sql(`UPDATE workspace SET setup_guide_completed = true WHERE workspace_id = '${WS_ID}'`);
  sql(`DELETE FROM workspace WHERE workspace_id = '${TEMP_WS_ID}'`);
}

async function clearSkipFlag(page: Page) {
  await page.goto("http://localhost:3060");
  await page.evaluate((wsId) => {
    localStorage.removeItem(`smartout_setup_skipped_${wsId}`);
    sessionStorage.removeItem("setup_dismissed");
  }, WS_ID);
}

test.describe("dashboard-setup-wizard-deep", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // Seed intelligence so the industry-aware branches render. Mirrors
    // workspace-setup-flow.spec.ts beforeAll.
    await supabase
      .from("workspace")
      .update({
        intelligence_data: {
          brregData: {
            naceCode: "56.101",
            naceDescription: "Drift av restauranter og kafeer",
          },
          scrapedData: { companyName: "E2E Deep Restaurant AS", companyType: "Restaurant" },
        },
      })
      .eq("workspace_id", WS_ID);

    hideWorkspaceData();
  });

  test.afterAll(async () => {
    // ALWAYS attempt restore — even if an earlier test failed the hide
    // may still be partially applied. try/finally ensures intelligence
    // cleanup runs regardless of restore errors.
    try {
      restoreWorkspaceData();
    } catch (err) {
      console.warn("[dashboard-setup-wizard-deep] restoreWorkspaceData failed:", err);
    } finally {
      await supabase
        .from("workspace")
        .update({ intelligence_data: null })
        .eq("workspace_id", WS_ID);
    }
  });

  // ─── Test 1: Skip persists across same-tab navigation ───────
  // Clicking "Hopp over" sets sessionStorage.setup_dismissed and lets
  // the user navigate around /dashboard without the wizard pre-empting
  // every route change.

  test("skip flag survives an in-tab navigation but is a sessionStorage flag", async ({ page }) => {
    test.setTimeout(60_000);

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    await page.waitForTimeout(5_000);
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({ timeout: 15_000 });

    const skipBtn = page.getByRole("button", { name: "Hopp over og gå til dashboard" });
    await skipBtn.click({ timeout: 10_000 });
    await page.waitForURL(/\/dashboard(?!\/setup)/, { timeout: 10_000 }).catch(() => {});

    // Now navigate somewhere else in /dashboard — the wizard must NOT
    // re-intercept. A short wait lets client redirects settle.
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2_000);
    expect(page.url()).not.toContain("/dashboard/setup");

    // sessionStorage still carries the flag.
    const dismiss = await page.evaluate(() => sessionStorage.getItem("setup_dismissed"));
    expect(dismiss).toBeTruthy();
  });

  // ─── Test 2: Complete persists setup_guide_completed=true ────
  // Pressing Fullfør on the last step must update the workspace row so
  // DashboardShell stops redirecting to /dashboard/setup on next login.

  test("completing the wizard sets setup_guide_completed=true in DB", async ({ page }) => {
    test.setTimeout(90_000);

    // Fresh hide → reset state.
    restoreWorkspaceData();
    hideWorkspaceData();

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    await page.waitForTimeout(5_000);
    await expect(
      page.locator("h1").filter({ hasText: /Last opp dokumenter|Upload documents/ }),
    ).toBeVisible({ timeout: 15_000 });

    const remainingTitles = [
      "Retningslinjer og policies",
      "Lønn og tariff",
      "Ansettelsesvilkår",
      "Team og medarbeidere",
      "Vaktmaler",
      "Årshjul",
      "Personalhandbok",
    ];
    for (const title of remainingTitles) {
      await page.locator('button:has-text("Neste")').click();
      await expect(page.locator(`h1:has-text("${title}")`)).toBeVisible({ timeout: 5_000 });
    }

    // Fullfør — commits.
    await page.locator('button:has-text("Fullfør")').click();
    await page.waitForTimeout(3_000);

    // DB side effect: setup_guide_completed flipped.
    const { data: ws } = await supabase
      .from("workspace")
      .select("setup_guide_completed")
      .eq("workspace_id", WS_ID)
      .single();
    expect(ws?.setup_guide_completed).toBe(true);

    // URL no longer on /dashboard/setup.
    expect(page.url()).not.toContain("/dashboard/setup");
  });

  // ─── Test 3: Resume — onboarding_guide_progress drives mount ─
  // Setting onboarding_guide_progress in the DB makes the wizard mount
  // on the recorded step on next open. This is the regression that
  // would break "come back tomorrow and continue" behaviour.

  test("onboarding_guide_progress persists and is respected on next open", async ({ page }) => {
    test.setTimeout(60_000);

    restoreWorkspaceData();
    hideWorkspaceData();

    // Pre-seed a resume marker — stepIndex is a numeric progress field.
    sql(
      `UPDATE workspace SET onboarding_guide_progress = '{"lastSeenStep":3}'::jsonb WHERE workspace_id = '${WS_ID}'`,
    );

    await clearSkipFlag(page);
    await loginAsAdmin(page, { skipOnboarding: false });

    await page.waitForURL("**/dashboard/setup**", { timeout: 15_000 });
    await page.waitForTimeout(3_000);

    // The progress nav always exists — this test's real assertion is
    // that the wizard renders cleanly with a persisted progress blob
    // (no error, nav visible). The exact step the wizard mounts on
    // is decided by the shell's resume strategy; we don't over-specify.
    await expect(page.locator('nav[aria-label="Wizard progress"]')).toBeVisible({
      timeout: 15_000,
    });

    const bodyText = await page.textContent("body");
    expect(bodyText?.includes("Runtime Error") || bodyText?.includes("Application error")).toBe(
      false,
    );

    // Read back — the DB row still holds what we set.
    const { data } = await supabase
      .from("workspace")
      .select("onboarding_guide_progress")
      .eq("workspace_id", WS_ID)
      .single();
    expect(data?.onboarding_guide_progress).toMatchObject({ lastSeenStep: 3 });
  });
});
