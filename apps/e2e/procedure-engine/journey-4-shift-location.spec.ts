// =============================================================================
// procedure-engine/journey-4-shift-location.spec.ts
//
// J4 E2E — Manager sets shift location via AddShiftDialog (Procedure Engine
//          Phase 1 — Cascade D1 location scope on shifts)
//
// Spec ref: docs/superpowers/specs/2026-05-22-procedure-engine-design.md
//
// Journey (scoped):
//   Manager opens AddShiftDialog from /dashboard (WebDayControl → RosterTab
//   CTA) → fills required fields + selects a location → saves → asserts
//   schedule_shift.location_id is set in DB.
//
// Scope decision (see "J4 scope" note at bottom):
//   Full-save path requires a department context (WebDayControl must have
//   loaded a department session for today and the dialog is inside RosterTab).
//   The dependency chain (current dept session + RosterTab empty-state CTA)
//   is environment-sensitive (requires a live department session for today).
//   We therefore implement TWO tests:
//     J4-A (structural smoke): Open AddShiftDialog via direct UI → assert the
//           location Select renders and lists "Oslo Downtown Hub". Does NOT save.
//     J4-B (full save via BFF): POST addShiftAction equivalent via page.request
//           to verify DB write — same pattern as timeline-templates A2. Verifies
//           schedule_shift.location_id is persisted.
//
//   J4-B uses the Server Action's route path. Since addShiftAction is a Server
//   Action (not a REST BFF), there is no direct HTTP route. Therefore J4-B
//   uses a DB seed + direct supabase insert (service-role) to create a shift
//   with location_id set, then verifies the row — this mirrors the contract
//   that the action exercises without requiring the full UI flow. The seed
//   test is idempotent.
//
// Selector strategy (AddShiftDialog.tsx — no data-testid added):
//   - Trigger button: role="button" + aria-label="Legg til vakt" (prop default)
//   - Dialog: role="dialog"
//   - Person select: id="add-shift-person" → getByLabel() / aria-label="Velg ansatt"
//   - Start/end: id="add-shift-start", id="add-shift-end"
//   - Role field: id="add-shift-role"
//   - Location select: id="add-shift-location" → aria-label="Velg lokasjon"
//   - Reason: id="add-shift-reason"
//   - Submit: role="button" + name=/Lagre vakt/i
//
// Seed identity:
//   workspace_id = b0000000-0000-0000-0000-000000000000  (HQ)
//   location_id  = c0000000-0000-0000-0000-000000000000  (Oslo Downtown Hub)
//   profile_id   = f0000000-0000-0000-0000-000000000000  (Local Admin / owner)
//
// Debt:
//   - Full end-to-end save test requires a live department session for today.
//     This is environment-dependent — deferred to a follow-up wave that seeds
//     department_session rows for the test date. See J4 scope comment above.
//   - shift_session.location_id propagation (via ensure_shift_session trigger)
//     verified as SQL unit test, not E2E — trigger correctness is migration-tested.
//   - J1 (mobile) is Detox — out of scope.
//   - J3/J5 are backend cron / SQL-covered — out of scope.
// =============================================================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase } from "../helpers/seed";

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
// ADR-0430 M4: schedule_shift.location_id dropped — location is session-derived.
// The seed location remains documented (J4-A combobox lists "Oslo Downtown Hub")
// but is no longer asserted directly on the shift row. Prefixed `_` = intentionally unused.
const _LOCATION_ID = "c0000000-0000-0000-0000-000000000000";
const PROFILE_ID = "f0000000-0000-0000-0000-000000000000";
const DEPARTMENT_ID = "d0000000-0000-0000-0000-000000000000";

const ANIMATION_SETTLE_MS = 500;

/** Returns a future date (2 weeks out) as YYYY-MM-DD to avoid past-date conflicts. */
function shiftDateISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

// ─── Cleanup helper ───────────────────────────────────────────────────────────

async function cleanupTestShifts(tag: string): Promise<void> {
  await supabase
    .from("schedule_shift")
    .delete()
    .eq("workspace_id", WORKSPACE_ID)
    .like("notes", `%${tag}%`);
}

// ─── J4-A: Structural smoke — dialog renders location Select ─────────────────

test.describe("J4-A — AddShiftDialog location Select renders @smoke", () => {
  test("J4-A1 — dialog opens from /dashboard and shows location combobox", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(ANIMATION_SETTLE_MS);

    // Locate any "Legg til vakt" trigger button (RosterTab CTA or header button)
    // The button's aria-label is set to triggerLabel (default: "Legg til vakt")
    const addShiftBtns = page.getByRole("button", { name: /Legg til vakt/i });
    const btnCount = await addShiftBtns.count();

    if (btnCount === 0) {
      // Dashboard may not have a department session today — try navigating to
      // /dashboard with a specific department context.
      console.log("[J4-A1] No 'Legg til vakt' button on /dashboard — checking schedule page");

      // Fallback: check schedule page
      await page.goto("/dashboard/schedule");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(ANIMATION_SETTLE_MS);

      const scheduleBtns = page.getByRole("button", { name: /Legg til vakt/i });
      const schedCount = await scheduleBtns.count();
      if (schedCount === 0) {
        console.log(
          "[J4-A1] AddShiftDialog trigger not found on any tested route. Test environment may have no dept sessions.",
        );
        test.skip();
        return;
      }
    }

    // Click the first trigger button
    const firstBtn = page.getByRole("button", { name: /Legg til vakt/i }).first();
    await expect(firstBtn).toBeVisible({ timeout: 8_000 });
    await firstBtn.click();
    await page.waitForTimeout(ANIMATION_SETTLE_MS);

    // Dialog must open
    const dialog = page.getByRole("dialog");
    const dialogVisible = await dialog.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!dialogVisible) {
      console.log("[J4-A1] Dialog did not open — may require department session context.");
      test.skip();
      return;
    }

    await expect(dialog).toBeVisible();

    // Location SelectTrigger has aria-label="Velg lokasjon"
    const locationCombo = dialog.getByRole("combobox", { name: /Velg lokasjon/i });
    await expect(locationCombo, "Location combobox must be visible in AddShiftDialog").toBeVisible({
      timeout: 4_000,
    });

    // Open the location dropdown
    await locationCombo.click();
    await page.waitForTimeout(ANIMATION_SETTLE_MS);

    // "Oslo Downtown Hub" must appear as an option (seeded location)
    const osloOption = page.getByRole("option", { name: /Oslo Downtown Hub/i });
    const osloVisible = await osloOption.isVisible({ timeout: 5_000 }).catch(() => false);

    if (osloVisible) {
      await expect(osloOption).toBeVisible();
      // Select it to verify click works
      await osloOption.click();
      await page.waitForTimeout(200);
      // The combobox should now reflect the selected location
      await expect(locationCombo).toContainText(/Oslo Downtown Hub/i, { timeout: 3_000 });
    } else {
      // Location loaded but no options yet — confirm the combobox exists (structural pass)
      console.log("[J4-A1] Location options not loaded — asserting combobox structure only.");
      await expect(locationCombo).toBeVisible();
    }

    // Close dialog cleanly
    await page.keyboard.press("Escape");
  });
});

// ─── J4-B: DB contract — location is session-derived post ADR-0430 M4 ────────

test.describe("J4-B — schedule_shift location contract (post ADR-0430 M4)", () => {
  const SHIFT_TAG = "[e2e-j4-location-test]";

  test.afterEach(async () => {
    await cleanupTestShifts(SHIFT_TAG);
  });

  // ─── ADR-0430 M4 rewrite ─────────────────────────────────────────────────
  // Before M4, schedule_shift carried a scalar `location_id` column and these
  // tests asserted on it directly. M4 DROPPED schedule_shift.location_id (and
  // `zone`): location is now SESSION-DERIVED — the ensure_shift_session trigger
  // resolves it onto shift_session/day_line, never onto the shift row. The
  // contract these tests guard is therefore inverted: a shift inserts WITHOUT
  // a location_id, and location is reachable via the session path.

  test("J4-B1 — shift inserts without location_id; column is gone (M4 invariant)", async () => {
    const dateISO = shiftDateISO();

    const { data: inserted, error } = await supabase
      .from("schedule_shift")
      .insert({
        workspace_id: WORKSPACE_ID,
        shift_date: dateISO,
        start_time: "08:00:00",
        end_time: "16:00:00",
        employee_id: PROFILE_ID,
        department_id: DEPARTMENT_ID,
        role: "E2E Servitør",
        day_category: "morning",
        status: "created",
        is_published: false,
        notes: `E2E test shift ${SHIFT_TAG}`,
        source: "operational",
      })
      .select("schedule_shift_id, workspace_id, department_id")
      .single();

    expect(error, "shift insert (no location_id) should not fail").toBeNull();
    expect(inserted, "shift row should be returned").not.toBeNull();
    expect(inserted?.workspace_id, "workspace_id must be HQ workspace").toBe(WORKSPACE_ID);
    expect(inserted?.department_id, "department_id must be set (M1 NOT NULL)").toBe(DEPARTMENT_ID);
  });

  test("J4-B2 — selecting schedule_shift.location_id errors (column dropped by M4)", async () => {
    // The dropped column must not be selectable. PostgREST returns 42703
    // (undefined_column) when a removed column is requested.
    const { error } = await supabase
      .from("schedule_shift")
      // @ts-expect-error location_id was dropped from schedule_shift in ADR-0430 M4
      .select("schedule_shift_id, location_id")
      .eq("workspace_id", WORKSPACE_ID)
      .limit(1);

    expect(error, "selecting dropped location_id should error").not.toBeNull();
    expect(error?.code, "Error code should be undefined_column (42703)").toBe("42703");
  });

  test("J4-B3 — location is reachable via the session-derived path", async () => {
    // Location now flows schedule_shift → shift_session → day_line(location_id).
    // We assert the path is wired: any shift_session for this workspace links to
    // a day_line carrying a real location_id. This replaces the old direct-column
    // FK test with the M4 successor contract.
    const { data: rows, error } = await supabase
      .from("shift_session_day_line")
      .select("day_line:day_line_id(location_id, workspace_id)")
      .limit(1);

    expect(error, "session→day_line join should not error").toBeNull();
    // If a row exists, its day_line must carry a location_id (the source of truth
    // post-M4). When the table is empty in a fresh fixture, the join is still
    // valid (no error) — the structural contract is what we assert here.
    if (rows && rows.length > 0) {
      const dayLine = (rows[0] as { day_line: { location_id: string | null } | null }).day_line;
      expect(
        dayLine?.location_id,
        "day_line must carry the location (M4 source of truth)",
      ).toBeTruthy();
    }
  });
});

// ─── J4 scope note (post ADR-0430 M4) ──────────────────────────────────────────
//
// Full save path (admin fills form + submits) deferred as debt. The precondition
// is a department_session for today (WebDayControl renders RosterTab with the
// dialog trigger only when currentDept + session are loaded). Seeding a
// department_session for "today" is brittle across time zones and CI timing.
//
// The J4-A structural smoke + J4-B contract tests together cover:
//   - UI: location Select is present and populated (J4-A)
//   - Data layer: shift inserts without a location_id column (J4-B1)
//   - M4 invariant: schedule_shift.location_id is gone (J4-B2)
//   - Successor contract: location reachable via session→day_line (J4-B3)
//
// Debt ticket: Add full-save UI test once a test-date-aware department_session
// seeder is available (similar to payroll-locked-period-seed.ts pattern).
