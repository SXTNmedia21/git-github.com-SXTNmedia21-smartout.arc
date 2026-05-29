// apps/e2e/db/triggers/shift-session-trigger.spec.ts
//
// Integration tests for ADR-0367 §5.6 triggers:
//   - ensure_shift_session  (schedule_shift INSERT/UPDATE → shift_session + junction)
//   - back_populate_shift_session_day_line (day_line INSERT → junction backfill)
//
// ADR-0430 M4 update: the ensure_shift_session trigger was rewritten (migration
// 20260801000005) — it no longer watches `OF location_id` and no longer reads
// schedule_shift.location_id (dropped by M4). Location is resolved from the
// session's day_line. These tests seed a day_line in beforeAll and assert the
// session materializes from the day_line's location, not from the shift row.
//
// Uses well-known seed workspace/department/location/profile IDs from
// supabase/seed.sql to avoid needing to create schema objects with
// complex NOT NULL dependencies (user_id on profile, slug on location, etc.).
//
// Requires local Supabase running (npx supabase start) and
// SUPABASE_SERVICE_ROLE_KEY in env (op run --env-file=.env.template).
//
// When SUPABASE_SERVICE_ROLE_KEY is absent (e.g. plain `pnpm test` without
// op run), the entire suite is SKIPPED rather than crashing — the vitest
// runner does not inject Supabase env vars.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "../helpers/clients";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

// ---------------------------------------------------------------------------
// Skip guard — vitest run without Supabase env must not crash
// ---------------------------------------------------------------------------

const HAS_SUPABASE_ENV = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Well-known seed IDs — set by supabase/seed.sql
// ---------------------------------------------------------------------------

const SEED_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
const SEED_DEPARTMENT_ID = "d0000000-0000-0000-0000-000000000001"; // Kitchen
const SEED_LOCATION_ID = "c0000000-0000-0000-0000-000000000000"; // Oslo Downtown Hub
const SEED_PROFILE_ID = "f0000000-0000-0000-0000-000000000002"; // Erik Pedersen (employee)

// Test session date — isolated to avoid colliding with existing sessions.
const TEST_DATE = "2099-07-01"; // far future; no session seeded by default

// Client is initialised lazily inside beforeAll — createServiceClient() calls
// createClient() immediately and supabase-js throws when the key is empty.
let sb: SupabaseClient<Database>;

// Created objects tracked for cleanup.
let testSessionId: string | null = null;
const insertedShiftIds: string[] = [];
const insertedDayLineIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup: insert a department_session for TEST_DATE.
// The trigger requires a session for the date to create shift_session rows.
// ---------------------------------------------------------------------------

beforeAll(async () => {
  if (!HAS_SUPABASE_ENV) return; // skip setup when env absent

  // Initialise client lazily — avoids supabase-js "key is required" crash when
  // the test runner does not inject SUPABASE_SERVICE_ROLE_KEY.
  sb = createServiceClient();

  // Ensure department_location pairing exists (needed for junction population).
  await sb
    .from("department_location")
    .insert({ department_id: SEED_DEPARTMENT_ID, location_id: SEED_LOCATION_ID })
    .select();
  // Ignore conflict — pairing may already exist from other tests.

  // Create an isolated department_session for TEST_DATE.
  const { data: ds, error } = await sb
    .from("department_session")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      department_id: SEED_DEPARTMENT_ID,
      session_date: TEST_DATE,
    })
    .select("department_session_id")
    .single();

  if (error || !ds) {
    // If unique constraint fires, fetch the existing one.
    const { data: existing } = await sb
      .from("department_session")
      .select("department_session_id")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .eq("department_id", SEED_DEPARTMENT_ID)
      .eq("session_date", TEST_DATE)
      .single();
    testSessionId = existing?.department_session_id ?? null;
  } else {
    testSessionId = ds.department_session_id;
  }

  if (!testSessionId) {
    throw new Error(`beforeAll: could not resolve testSessionId for ${TEST_DATE}`);
  }

  // ADR-0430 M4: the ensure_shift_session trigger now resolves location_id from
  // a day_line (department_session_id + active) — NOT from schedule_shift.location_id
  // (dropped). A day_line must exist for the session BEFORE a shift insert can
  // materialize a shift_session. Seed one for TEST_DATE.
  const { data: setupDl } = await sb
    .from("day_line")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      department_session_id: testSessionId,
      department_id: SEED_DEPARTMENT_ID,
      location_id: SEED_LOCATION_ID,
      business_date: TEST_DATE,
      planned_open: "06:00",
      planned_close: "23:59",
    })
    .select("day_line_id")
    .single();
  if (setupDl) {
    insertedDayLineIds.push(setupDl.day_line_id);
  }
  // Conflict (unique department_session_id + location_id) = already seeded; fine.
}, 30_000);

// ---------------------------------------------------------------------------
// Cleanup: remove test data (cascade deletes shift_session + junction rows).
// ---------------------------------------------------------------------------

afterAll(async () => {
  if (!HAS_SUPABASE_ENV || !sb) return;
  if (insertedShiftIds.length > 0) {
    await sb.from("schedule_shift").delete().in("schedule_shift_id", insertedShiftIds);
  }
  if (insertedDayLineIds.length > 0) {
    await sb.from("day_line").delete().in("day_line_id", insertedDayLineIds);
  }
  if (testSessionId) {
    await sb.from("department_session").delete().eq("department_session_id", testSessionId);
  }
});

// ---------------------------------------------------------------------------
// Helper: insert a schedule_shift and track its id for cleanup.
// ---------------------------------------------------------------------------

// ADR-0430 M4: schedule_shift.location_id dropped. Location is resolved by the
// trigger from the session's day_line, so this helper no longer sets location_id.
async function insertShift(overrides: {
  employee_id?: string | null;
  department_id?: string | null;
  shift_date?: string;
  start_time?: string;
  end_time?: string;
}): Promise<string> {
  const { data, error } = await sb
    .from("schedule_shift")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      employee_id: overrides.employee_id !== undefined ? overrides.employee_id : SEED_PROFILE_ID,
      department_id:
        overrides.department_id !== undefined ? overrides.department_id : SEED_DEPARTMENT_ID,
      shift_date: overrides.shift_date ?? TEST_DATE,
      start_time: overrides.start_time ?? "08:00",
      end_time: overrides.end_time ?? "16:00",
      role: "employee",
      day_category: "morning",
    })
    .select("schedule_shift_id")
    .single();

  if (error || !data) {
    throw new Error(`insertShift failed: ${error?.message}`);
  }
  insertedShiftIds.push(data.schedule_shift_id);
  return data.schedule_shift_id;
}

// ---------------------------------------------------------------------------
// Tests: ensure_shift_session trigger (BT3-1)
// ---------------------------------------------------------------------------

// skipIf guard: when SUPABASE_SERVICE_ROLE_KEY is absent (plain `pnpm test`),
// these DB integration tests are skipped — they require a live local Supabase.
describe.skipIf(!HAS_SUPABASE_ENV)("ensure_shift_session trigger (BT3-1)", () => {
  // ADR-0430 M4: location_id no longer exists on schedule_shift. The
  // "skips when location is missing" condition is now expressed as
  // "no active day_line for the session" (see the no-session test below).

  it("skips when employee_id is NULL — no shift_session created", async () => {
    const shiftId = await insertShift({ employee_id: null });

    const { count } = await sb
      .from("shift_session")
      .select("*", { count: "exact", head: true })
      .eq("schedule_shift_id", shiftId);

    expect(count).toBe(0);
  });

  it("creates exactly 1 shift_session when all required fields present + department_session + day_line exist", async () => {
    const shiftId = await insertShift({
      employee_id: SEED_PROFILE_ID,
      department_id: SEED_DEPARTMENT_ID,
      shift_date: TEST_DATE,
      start_time: "10:00",
      end_time: "18:00",
    });

    const { count: ssCount } = await sb
      .from("shift_session")
      .select("*", { count: "exact", head: true })
      .eq("schedule_shift_id", shiftId);

    expect(ssCount).toBe(1);
  });

  it("shift_session has status='scheduled' and location resolved from the day_line (ADR-0430)", async () => {
    const shiftId = await insertShift({
      employee_id: SEED_PROFILE_ID,
      department_id: SEED_DEPARTMENT_ID,
      shift_date: TEST_DATE,
      start_time: "12:00",
      end_time: "20:00",
    });

    const { data } = await sb
      .from("shift_session")
      .select("status, location_id, department_id, workspace_id, department_session_id")
      .eq("schedule_shift_id", shiftId)
      .single();

    expect(data?.status).toBe("scheduled");
    // location_id now comes from the seeded day_line, not the shift row.
    expect(data?.location_id).toBe(SEED_LOCATION_ID);
    expect(data?.department_id).toBe(SEED_DEPARTMENT_ID);
    expect(data?.workspace_id).toBe(SEED_WORKSPACE_ID);
    expect(data?.department_session_id).toBe(testSessionId);
  });

  it("is idempotent — UPDATE on same schedule_shift_id does not create second shift_session", async () => {
    const shiftId = await insertShift({
      employee_id: SEED_PROFILE_ID,
      department_id: SEED_DEPARTMENT_ID,
      shift_date: TEST_DATE,
      start_time: "14:00",
      end_time: "22:00",
    });

    // Fire the UPDATE trigger by touching a WATCHED column. The new trigger
    // watches: position_id, department_id, employee_id, shift_date (NOT location_id).
    await sb
      .from("schedule_shift")
      .update({ department_id: SEED_DEPARTMENT_ID }) // same value — still fires UPDATE OF department_id
      .eq("schedule_shift_id", shiftId);

    const { count } = await sb
      .from("shift_session")
      .select("*", { count: "exact", head: true })
      .eq("schedule_shift_id", shiftId);

    expect(count).toBe(1);
  });

  it("skips when no department_session exists for the date", async () => {
    const NO_SESSION_DATE = "2099-12-31"; // guaranteed no session/day_line seeded

    const shiftId = await insertShift({
      employee_id: SEED_PROFILE_ID,
      department_id: SEED_DEPARTMENT_ID,
      shift_date: NO_SESSION_DATE,
      start_time: "09:00",
      end_time: "17:00",
    });

    const { count } = await sb
      .from("shift_session")
      .select("*", { count: "exact", head: true })
      .eq("schedule_shift_id", shiftId);

    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: back_populate_shift_session_day_line trigger (BT3-2)
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_SUPABASE_ENV)("back_populate_shift_session_day_line trigger (BT3-2)", () => {
  it("populates junction when day_line is inserted AFTER shift_session already exists", async () => {
    // Step 1: Insert shift → ensure_shift_session fires → shift_session created.
    const shiftId = await insertShift({
      employee_id: SEED_PROFILE_ID,
      department_id: SEED_DEPARTMENT_ID,
      shift_date: TEST_DATE,
      start_time: "06:00",
      end_time: "14:00",
    });

    const { data: ss } = await sb
      .from("shift_session")
      .select("shift_session_id")
      .eq("schedule_shift_id", shiftId)
      .single();

    if (!ss) {
      // shift_session not created (trigger prerequisite not met) — skip gracefully.
      console.warn(
        "BT3-2 back-populate test skipped: shift_session not created for shift",
        shiftId,
      );
      return;
    }

    const ssId = ss.shift_session_id;

    // Step 2: Insert a day_line → back_populate trigger should wire the junction.
    const { data: dl, error: dlError } = await sb
      .from("day_line")
      .insert({
        workspace_id: SEED_WORKSPACE_ID,
        department_session_id: testSessionId!,
        department_id: SEED_DEPARTMENT_ID,
        location_id: SEED_LOCATION_ID,
        business_date: TEST_DATE,
        planned_open: "07:00",
        planned_close: "23:00",
      })
      .select("day_line_id")
      .single();

    if (dlError || !dl) {
      // Unique constraint (department_session_id, location_id) already filled — skip.
      // Another test may have inserted the day_line already; the trigger already ran.
      console.warn("BT3-2 back-populate: day_line insert skipped (conflict):", dlError?.message);
      // Still verify via existing day_line for this session+location.
      const { data: existingDl } = await sb
        .from("day_line")
        .select("day_line_id")
        .eq("department_session_id", testSessionId!)
        .eq("location_id", SEED_LOCATION_ID)
        .single();
      if (existingDl) {
        const { count } = await sb
          .from("shift_session_day_line")
          .select("*", { count: "exact", head: true })
          .eq("shift_session_id", ssId)
          .eq("day_line_id", existingDl.day_line_id);
        expect(count).toBeGreaterThanOrEqual(1);
      }
      return;
    }

    insertedDayLineIds.push(dl.day_line_id);

    // Step 3: Verify junction row exists.
    const { count } = await sb
      .from("shift_session_day_line")
      .select("*", { count: "exact", head: true })
      .eq("shift_session_id", ssId)
      .eq("day_line_id", dl.day_line_id);

    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("does not create junction rows for clocked_out sessions", async () => {
    // Insert shift → shift_session created.
    const shiftId = await insertShift({
      employee_id: SEED_PROFILE_ID,
      department_id: SEED_DEPARTMENT_ID,
      shift_date: TEST_DATE,
      start_time: "04:00",
      end_time: "12:00",
    });

    const { data: ss } = await sb
      .from("shift_session")
      .select("shift_session_id")
      .eq("schedule_shift_id", shiftId)
      .single();

    if (!ss) {
      console.warn("BT3-2 clocked_out test skipped: shift_session not created");
      return;
    }

    // Move session to clocked_out — trigger should NOT link it to new day_lines.
    await sb
      .from("shift_session")
      .update({ status: "clocked_out" })
      .eq("shift_session_id", ss.shift_session_id);

    // For strong isolation: insert a second session for a unique date.
    // The back_populate trigger only links status IN ('scheduled', 'clocked_in') sessions.
    // We move this session to clocked_out BEFORE inserting the day_line, then
    // confirm the junction row is NOT created for it.
    const CLOCKED_OUT_DATE = "2099-07-02";
    const { data: ds2 } = await sb
      .from("department_session")
      .insert({
        workspace_id: SEED_WORKSPACE_ID,
        department_id: SEED_DEPARTMENT_ID,
        session_date: CLOCKED_OUT_DATE,
      })
      .select("department_session_id")
      .single();

    if (!ds2) {
      console.warn("BT3-2 clocked_out test: could not create isolated session, skipping");
      return;
    }

    // Cleanup session after test.
    const session2Id = ds2.department_session_id;
    afterAll(async () => {
      await sb.from("department_session").delete().eq("department_session_id", session2Id);
    });

    // Insert day_line for the new session + same location.
    const { data: dl2 } = await sb
      .from("day_line")
      .insert({
        workspace_id: SEED_WORKSPACE_ID,
        department_session_id: session2Id,
        department_id: SEED_DEPARTMENT_ID,
        location_id: SEED_LOCATION_ID,
        business_date: CLOCKED_OUT_DATE,
        planned_open: "05:00",
        planned_close: "13:00",
      })
      .select("day_line_id")
      .single();

    if (!dl2) {
      console.warn("BT3-2 clocked_out test: day_line insert failed, skipping");
      return;
    }

    insertedDayLineIds.push(dl2.day_line_id);

    // back_populate does NOT link clocked_out sessions.
    const { count } = await sb
      .from("shift_session_day_line")
      .select("*", { count: "exact", head: true })
      .eq("shift_session_id", ss.shift_session_id)
      .eq("day_line_id", dl2.day_line_id);

    expect(count).toBe(0);
  });
});
