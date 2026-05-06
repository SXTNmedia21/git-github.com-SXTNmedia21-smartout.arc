import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loginAsAdmin } from "../helpers/auth";

// Lazy admin client — do NOT import from helpers/seed at module scope because
// that module throws at import time when SUPABASE_SERVICE_ROLE_KEY is missing.
// The skipped spec must still parse cleanly in environments without secrets.
function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required to run this test");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Season Activation E2E — ADR-0200 Invariant 10 / L-0125 artefact assertion.
 *
 * The PRIMARY artefact assertion for this feature lives at
 * `supabase/tests/season-activation-d1-fanout.sql` — a SQL integration test
 * that asserts `SELECT COUNT(*) FROM department_operating_hours WHERE
 * season_id = <season>` returns the expected row count after the trigger
 * fires. That test runs in <1s and needs no auth fixture.
 *
 * This Playwright spec complements the SQL test by exercising the full
 * user flow:
 *   1. Manager logs in, navigates to /dashboard/season/<id>
 *   2. Clicks "Aktiver sesong"
 *   3. SeasonActivationProposalModal opens with preview counts
 *   4. Clicks Confirm
 *   5. Toast "Sesong aktivert" appears
 *   6. L-0125 artefact check via supabase admin:
 *      SELECT COUNT(*) FROM department_operating_hours WHERE season_id = X > 0
 *   7. SELECT status FROM season WHERE season_id = X → 'active'
 *
 * STATUS: SKIPPED — depends on a season-seed helper that does not yet exist.
 *   Seeding a fully-valid draft season requires: workspace + profile (manager
 *   role) + department + planning_cycle + season + season_budget (total_target_revenue>0)
 *   + 7 day_factors + 24+ hour_factors + DEFAULT department_operating_hours rows.
 *   No such helper exists in apps/e2e/helpers/ today.
 *
 * TODO (M1.13 or a follow-up sortie):
 *   - Add `seedActivatableSeason()` to apps/e2e/helpers/seed.ts returning
 *     { workspaceId, seasonId, departmentIds }.
 *   - Remove the `.skip` modifier below.
 *   - Verify the toast i18n key matches `seasonActivation.toast.success`.
 *
 * The SQL test in supabase/tests/ satisfies the L-0125 artefact invariant
 * today; this spec is scaffolding for full UI coverage later.
 */
test.describe("Season Activation — D1 fan-out artefact", () => {
  test.skip("activates a draft season and generates department_operating_hours rows", async ({
    page,
  }) => {
    // ── Setup (pending seedActivatableSeason helper) ────────────────
    // const { workspaceId, seasonId } = await seedActivatableSeason({
    //   departmentCount: 2,
    // });
    const workspaceId = "PLACEHOLDER_WS";
    const seasonId = "PLACEHOLDER_SEASON";

    await loginAsAdmin(page);

    // ── Navigate to season detail ────────────────────────────────────
    await page.goto(`/dashboard/season/${seasonId}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // ── Open activation modal ────────────────────────────────────────
    const activateBtn = page.getByRole("button", { name: /Aktiver sesong/i });
    await expect(activateBtn).toBeVisible({ timeout: 10000 });
    await activateBtn.click();

    // Modal opens with preview
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Confirm activation
    const confirmBtn = modal.getByRole("button", { name: /Bekreft|Aktiver/i });
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
    await confirmBtn.click();

    // ── Toast confirms success ──────────────────────────────────────
    await expect(page.getByText(/Sesong aktivert/i)).toBeVisible({ timeout: 10000 });

    // ── L-0125 ARTEFACT ASSERTION ────────────────────────────────────
    // SELECT COUNT(*) FROM department_operating_hours WHERE season_id = X
    const admin = getAdminClient();
    const { data: rows, error } = await admin
      .from("department_operating_hours")
      .select("id", { count: "exact", head: false })
      .eq("workspace_id", workspaceId)
      .eq("season_id", seasonId);
    expect(error).toBeNull();
    expect(rows).not.toBeNull();
    expect((rows ?? []).length).toBeGreaterThan(0);

    // ── Season now active ──────────────────────────────────────────
    const { data: season } = await admin
      .from("season")
      .select("status")
      .eq("season_id", seasonId)
      .maybeSingle();
    expect(season?.status).toBe("active");
  });
});
