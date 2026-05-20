// =============================================================================
// schedule/density.fixtures.ts
//
// Fixture helpers for the schedule card-density E2E spec.
//
// Conflict seeding:
//   Two overlapping shifts for the same employee on the same date. The
//   schedule grid detects overlap via the `hasConflict` flag that T5 wires
//   from the daily-grid cell renderer. We write two schedule_shift rows whose
//   time windows overlap — conflict detection happens client-side in T5's
//   implementation, not in the DB.
//
// Auth pattern:
//   Reuses the shared service-role Supabase client from helpers/seed.ts.
//   The SEED_PROFILE_ID + SEED_WORKSPACE_ID constants are the global E2E
//   fixture provisioned by global-setup.ts (ensure-local-e2e-runtime-fixture.mjs).
//   Specs run against that workspace so no teardown of workspace/profile is needed.
//
// Cleanup:
//   Each helper returns shift IDs. Callers delete them in afterEach via
//   cleanupDensityFixture(). user_view_preference rows are cleaned separately
//   via cleanupDensityPreference().
// =============================================================================

import { supabase } from "../helpers/seed";
import { SEED_PROFILE_ID, SEED_WORKSPACE_ID } from "../helpers/botsson-harness";

export { SEED_PROFILE_ID, SEED_WORKSPACE_ID };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DensityFixture = {
  shiftIds: string[];
  /** ISO date the shifts live on (YYYY-MM-DD) */
  shiftDate: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a future date string (YYYY-MM-DD) far enough ahead that it lands
 * within the visible schedule week regardless of the current weekday.
 */
function futureDateString(daysAhead = 4): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/**
 * Seed a pair of overlapping shifts for SEED_PROFILE_ID on the same day.
 * The overlap (10:00–14:00 and 12:00–18:00) is intentional — T5's daily-grid
 * conflict detector flags any pair where one shift's start < other's end AND
 * one shift's end > other's start (standard interval overlap).
 *
 * Returns the two shift IDs and the shared shift date.
 */
export async function seedConflictShifts(): Promise<DensityFixture> {
  const shiftDate = futureDateString(4);

  // Shift A: 10:00–14:00 (morning into afternoon)
  const { data: shiftA, error: errA } = await supabase
    .from("schedule_shift")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      employee_id: SEED_PROFILE_ID,
      shift_date: shiftDate,
      start_time: "10:00:00",
      end_time: "14:00:00",
      day_category: "morning",
      role: "server",
      status: "published",
      is_published: true,
      notes: "e2e-density-conflict-A",
    })
    .select("schedule_shift_id")
    .single();

  if (errA || !shiftA) {
    throw new Error(`seedConflictShifts (A) failed: ${errA?.message ?? "no row"}`);
  }

  // Shift B: 12:00–18:00 — overlaps with A by 2 hours
  const { data: shiftB, error: errB } = await supabase
    .from("schedule_shift")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      employee_id: SEED_PROFILE_ID,
      shift_date: shiftDate,
      start_time: "12:00:00",
      end_time: "18:00:00",
      day_category: "afternoon",
      role: "bartender",
      status: "published",
      is_published: true,
      notes: "e2e-density-conflict-B",
    })
    .select("schedule_shift_id")
    .single();

  if (errB || !shiftB) {
    throw new Error(`seedConflictShifts (B) failed: ${errB?.message ?? "no row"}`);
  }

  return {
    shiftIds: [shiftA.schedule_shift_id, shiftB.schedule_shift_id],
    shiftDate,
  };
}

/**
 * Delete schedule_shift rows created by seedConflictShifts (and any other
 * density fixture). Scoped by ID list to avoid touching unrelated seed data.
 */
export async function cleanupDensityFixture(shiftIds: string[]): Promise<void> {
  if (shiftIds.length === 0) return;
  await supabase.from("schedule_shift").delete().in("schedule_shift_id", shiftIds);
}

/**
 * Delete any user_view_preference rows for SEED_PROFILE_ID / SEED_WORKSPACE_ID
 * with surface='schedule' and preference_key='density'.
 *
 * Call this in afterEach to guarantee J4 starts from a clean state, and to
 * reset any preference written by J1/J3 so tests don't bleed into each other.
 */
export async function cleanupDensityPreference(): Promise<void> {
  await supabase
    .from("user_view_preference")
    .delete()
    .eq("profile_id", SEED_PROFILE_ID)
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .eq("surface", "schedule")
    .eq("preference_key", "density");
}

/**
 * Assert that a user_view_preference row exists with the expected density value.
 * Used by J1 (persistence) and J3 (voice bridge writes through to DB).
 *
 * Polls up to timeoutMs (default 5000ms) because the Server Action is
 * fire-and-forget from the client setter — the row may appear slightly after
 * the UI updates.
 */
export async function assertDensityPreference(
  expectedDensity: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const { timeoutMs = 5000, intervalMs = 300 } = opts;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("user_view_preference")
      .select("preference_value")
      .eq("profile_id", SEED_PROFILE_ID)
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("surface", "schedule")
      .eq("preference_key", "density")
      .single();

    if (data?.preference_value === expectedDensity) return;

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // Fetch last state for a diagnostic message
  const { data: last } = await supabase
    .from("user_view_preference")
    .select("preference_value")
    .eq("profile_id", SEED_PROFILE_ID)
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .eq("surface", "schedule")
    .eq("preference_key", "density")
    .single();

  throw new Error(
    `assertDensityPreference: expected '${expectedDensity}' but got '${last?.preference_value ?? "<no row>"}' after ${timeoutMs}ms`,
  );
}
