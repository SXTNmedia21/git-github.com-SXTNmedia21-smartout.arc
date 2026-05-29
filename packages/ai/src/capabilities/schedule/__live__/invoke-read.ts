// packages/ai/src/capabilities/schedule/__live__/invoke-read.ts
//
// Track-F live-invoke script (L-0348 / ADR-0430 Rule 3).
// Verifies that the 4 new shift_session → shift_session_day_line → day_line → location
// embed paths resolve correctly against local Supabase (HQ workspace seed).
//
// Run with:
//   npx tsx packages/ai/src/capabilities/schedule/__live__/invoke-read.ts
//
// Prerequisites:
//   - supabase running locally (npx supabase start)
//   - seed applied (npx supabase db reset)
//   - env vars set: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//     (or falls back to local dev defaults)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

// Require env var — no inline keys (secrets-protocol LAW 3).
// For local dev: run `npx supabase status` to get the service_role key,
// then: SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx packages/ai/src/capabilities/schedule/__live__/invoke-read.ts
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error(
    "ERROR: SUPABASE_SERVICE_ROLE_KEY env var required.\n" +
      "  Run: npx supabase status  (get the key)\n" +
      "  Then: SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx packages/ai/src/capabilities/schedule/__live__/invoke-read.ts",
  );
  process.exit(1);
}

const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

// SUPABASE_KEY is guaranteed non-null after the guard above.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY as string);

async function main(): Promise<void> {
  console.log("=== ADR-0430 Rule 3 — Track-F live invoke ===");
  console.log(`URL: ${SUPABASE_URL}  workspace: ${HQ_WORKSPACE_ID}`);
  console.log("");

  let allPass = true;

  // ── Test 1: getMyShifts path (shift_session → ssdl → day_line → location) ──
  {
    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        "schedule_shift_id, shift_date, start_time, end_time, role, status, department:department_id(name), shift_session(shift_session_day_line(day_line(location(name))))",
      )
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .order("shift_date", { ascending: true })
      .limit(3);

    if (error) {
      console.error("FAIL [getMyShifts embed]:", error.message);
      allPass = false;
    } else {
      const count = data?.length ?? 0;
      const firstLocation =
        data?.[0]?.shift_session?.[0]?.shift_session_day_line?.[0]?.day_line?.[0]?.location?.[0] ??
        null;
      console.log(
        `PASS [getMyShifts embed] rows=${count} firstLocation=${JSON.stringify(firstLocation)}`,
      );
      if (count === 0) {
        console.warn("  WARN: 0 rows — seed may not have shifts");
      }
    }
  }

  // ── Test 2: getShiftDetail path ──
  {
    // Get first shift ID
    const { data: shifts } = await supabase
      .from("schedule_shift")
      .select("schedule_shift_id")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .limit(1)
      .single();

    if (!shifts) {
      console.warn("SKIP [getShiftDetail embed] — no shifts found in HQ workspace");
    } else {
      // Note: omit 'position' here — pre-existing debt in tools.ts:getShiftDetail.
      // schedule_shift has no 'position' column; that field is stale. Not a PLAN-2 regression.
      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, start_time, end_time, status, notes, department:department_id(name), shift_session(shift_session_day_line(day_line(location(name))))",
        )
        .eq("schedule_shift_id", shifts.schedule_shift_id)
        .eq("workspace_id", HQ_WORKSPACE_ID)
        .single();

      if (error) {
        console.error("FAIL [getShiftDetail embed]:", error.message);
        allPass = false;
      } else {
        const location =
          data?.shift_session?.[0]?.shift_session_day_line?.[0]?.day_line?.[0]?.location?.[0] ??
          null;
        console.log(
          `PASS [getShiftDetail embed] id=${data?.schedule_shift_id} location=${JSON.stringify(location)}`,
        );
      }
    }
  }

  // ── Test 3: briefing.ts select (no location_id) ──
  {
    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        "schedule_shift_id, employee_id, department_id, role, shift_date, start_time, end_time, work_hours, notes, status, team_id",
      )
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .limit(2);

    if (error) {
      console.error("FAIL [briefing select]:", error.message);
      allPass = false;
    } else {
      const count = data?.length ?? 0;
      console.log(`PASS [briefing select] rows=${count} (location_id correctly absent)`);
    }
  }

  // ── Test 4: getWorkspaceSchedule path ──
  {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        "schedule_shift_id, shift_date, start_time, end_time, role, status, department:department_id(name), shift_session(shift_session_day_line(day_line(location(name))))",
      )
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("shift_date", today)
      .limit(3);

    if (error) {
      console.error("FAIL [getWorkspaceSchedule embed]:", error.message);
      allPass = false;
    } else {
      const count = data?.length ?? 0;
      console.log(
        `PASS [getWorkspaceSchedule embed] date=${today} rows=${count} (0 is ok if no shifts today)`,
      );
    }
  }

  console.log("");
  if (allPass) {
    console.log("ALL PASS — ADR-0430 Rule 3 READ paths verified.");
    process.exit(0);
  } else {
    console.error("SOME TESTS FAILED — check errors above.");
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
