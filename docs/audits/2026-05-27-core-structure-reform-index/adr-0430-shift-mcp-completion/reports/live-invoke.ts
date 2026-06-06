// =============================================================================
// live-invoke.ts — ADR-0430 shift-mcp completion MANDATORY GATE (closes L-0348)
//
// Invokes the rewritten shift-mcp handlers (create + update) directly against the
// running local Supabase, plus the workspace-api GET /v1/shifts zones[] SQL, and
// asserts the post-M4 contract. This is the gate AC-4a.10 deferred in Phase b —
// it would have caught all three regressions.
//
// Run: SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<key> \
//      pnpm exec tsx docs/domains/scheduling/adr-0430-shift-mcp-completion/reports/live-invoke.ts
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { handleCreateShift } from "../../../../../services/shift-mcp/src/tools/create-shift.js";
import { handleUpdateShift } from "../../../../../services/shift-mcp/src/tools/update-shift.js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");

// shift-mcp's supabaseAdmin reads its own env; we exercise the handler logic with
// the same service-role client the handler would use. The handler imports its
// client from ../lib/supabase.js which reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Seed identity (HQ workspace, Kitchen dept, Oslo location, real zones).
const WS = "b0000000-0000-0000-0000-000000000000";
const DEPT = "d0000000-0000-0000-0000-000000000001";
const LOC = "c0000000-0000-0000-0000-000000000000";
const ZONE_A = "d1000000-0000-0000-0000-000000000001"; // Hovedsal
const ZONE_B = "d1000000-0000-0000-0000-000000000002"; // Terrasse
const EMP = "f0000000-0000-0000-0000-000000000001";
const TEST_DATE = "2099-09-09";

let pass = 0;
let fail = 0;
const log = (ok: boolean, msg: string) => {
  if (ok) {
    pass++;
    console.log(`  PASS: ${msg}`);
  } else {
    fail++;
    console.error(`  FAIL: ${msg}`);
  }
};

function parse(result: { content: Array<{ text: string }>; isError?: boolean }) {
  return { isError: Boolean(result.isError), body: JSON.parse(result.content[0].text) };
}

const created: string[] = [];
let sessionId: string | null = null;
let dayLineId: string | null = null;

async function setup() {
  // Isolated department_session + day_line for TEST_DATE so the trigger materializes.
  const { data: ds } = await sb
    .from("department_session")
    .insert({ workspace_id: WS, department_id: DEPT, session_date: TEST_DATE })
    .select("department_session_id")
    .single();
  sessionId = ds?.department_session_id ?? null;
  if (!sessionId) {
    const { data: ex } = await sb
      .from("department_session")
      .select("department_session_id")
      .eq("workspace_id", WS)
      .eq("department_id", DEPT)
      .eq("session_date", TEST_DATE)
      .single();
    sessionId = ex?.department_session_id ?? null;
  }
  const { data: dl } = await sb
    .from("day_line")
    .insert({
      workspace_id: WS,
      department_session_id: sessionId,
      department_id: DEPT,
      location_id: LOC,
      business_date: TEST_DATE,
      planned_open: "06:00",
      planned_close: "23:59",
    })
    .select("day_line_id")
    .single();
  dayLineId = dl?.day_line_id ?? null;
  if (!dayLineId) {
    const { data: exdl } = await sb
      .from("day_line")
      .select("day_line_id")
      .eq("department_session_id", sessionId)
      .eq("location_id", LOC)
      .single();
    dayLineId = exdl?.day_line_id ?? null;
  }
  console.log(`setup: session=${sessionId} day_line=${dayLineId}`);
}

async function teardown() {
  if (created.length) await sb.from("schedule_shift").delete().in("schedule_shift_id", created);
  if (sessionId) await sb.from("department_session").delete().eq("department_session_id", sessionId);
}

async function run() {
  await setup();

  // ── TEST 1: create_shift with department + zone_ids → shift created + shift_zone rows ──
  console.log("\n[1] create_shift (dept + zone_ids)");
  const c1 = parse(
    await handleCreateShift(
      {
        workspace_id: WS,
        shift_date: TEST_DATE,
        role: "Live Servitør",
        start_time: "10:00",
        end_time: "18:00",
        day_category: "morning",
        employee_id: EMP,
        position_id: null,
        team_id: null,
        department_id: DEPT,
        breaks: 0,
        zone_ids: [ZONE_A, ZONE_B],
        indicator: "blue",
        status: "created",
        is_published: false,
      } as Parameters<typeof handleCreateShift>[0],
      WS,
    ),
  );
  log(!c1.isError, `create returns no error (got ${JSON.stringify(c1.body).slice(0, 120)})`);
  const shiftId = c1.body.schedule_shift_id as string | undefined;
  if (shiftId) created.push(shiftId);
  log(Boolean(shiftId), "shift row returned with schedule_shift_id");
  log(c1.body.department_id === DEPT, "department_id resolved + persisted (M1 NOT NULL)");

  // shift_zone rows present for this shift's session
  const { data: ssRow } = await sb
    .from("shift_session")
    .select("shift_session_id")
    .eq("schedule_shift_id", shiftId ?? "")
    .maybeSingle();
  const { count: szCount } = await sb
    .from("shift_zone")
    .select("*", { count: "exact", head: true })
    .eq("shift_session_id", ssRow?.shift_session_id ?? "");
  log(szCount === 2, `shift_zone has 2 rows for the session (got ${szCount})`);

  // ── TEST 2: create_shift with NO department → fail-fast ──
  console.log("\n[2] create_shift (no department) → must error");
  const c2 = parse(
    await handleCreateShift(
      {
        workspace_id: WS,
        shift_date: TEST_DATE,
        role: "Nope",
        start_time: "11:00",
        end_time: "12:00",
        day_category: "morning",
        employee_id: EMP,
        position_id: null,
        team_id: null,
        breaks: 0,
        zone_ids: [],
        indicator: "blue",
        status: "created",
        is_published: false,
      } as Parameters<typeof handleCreateShift>[0],
      WS,
    ),
  );
  log(
    c2.isError && String(c2.body.error).includes("department_unresolved"),
    `errors with department_unresolved (got ${JSON.stringify(c2.body)})`,
  );

  // ── TEST 3: create_shift with forged zone (wrong workspace) → fail-fast ──
  console.log("\n[3] create_shift (forged zone) → must error");
  const c3 = parse(
    await handleCreateShift(
      {
        workspace_id: WS,
        shift_date: TEST_DATE,
        role: "Forge",
        start_time: "11:00",
        end_time: "12:00",
        day_category: "morning",
        employee_id: EMP,
        position_id: null,
        team_id: null,
        department_id: DEPT,
        breaks: 0,
        zone_ids: ["99999999-9999-9999-9999-999999999999"],
        indicator: "blue",
        status: "created",
        is_published: false,
      } as Parameters<typeof handleCreateShift>[0],
      WS,
    ),
  );
  log(
    c3.isError && String(c3.body.error).includes("zone_forgery"),
    `errors with zone_forgery (got ${JSON.stringify(c3.body)})`,
  );

  // ── TEST 4: update_shift zone_ids reconcile (A,B → B only) ──
  console.log("\n[4] update_shift (zone_ids reconcile to [Terrasse only])");
  if (shiftId) {
    const u1 = parse(
      await handleUpdateShift(
        { shift_id: shiftId, zone_ids: [ZONE_B] } as Parameters<typeof handleUpdateShift>[0],
        WS,
      ),
    );
    log(!u1.isError, `update returns no error (got ${JSON.stringify(u1.body).slice(0, 120)})`);
    const { data: rows } = await sb
      .from("shift_zone")
      .select("zone_id")
      .eq("shift_session_id", ssRow?.shift_session_id ?? "");
    const zoneIds = (rows ?? []).map((r) => r.zone_id);
    log(
      zoneIds.length === 1 && zoneIds[0] === ZONE_B,
      `shift_zone reconciled to [Terrasse] (got ${JSON.stringify(zoneIds)})`,
    );
  }

  // ── TEST 5: GET /v1/shifts zones[] SQL — run the EXACT EF correlated subquery ──
  // The EF (workspace-api/handlers/schedules.ts) builds raw SQL via
  // executeWithWorkspaceContext. We run the identical correlated-subquery shape
  // through node-postgres against the local DB and assert it (a) does not error
  // (proves the dropped `zone` column is gone from the SELECT) and (b) returns the
  // assigned zone names as a text[].
  console.log("\n[5] workspace-api GET /v1/shifts zones[] SQL (exact EF query shape)");
  const { execFileSync } = await import("node:child_process");
  // Run the EXACT correlated-subquery the EF builds, via docker psql (dependency-free).
  // \t -A = tuples-only, unaligned. Asserts: (a) no SQL error on dropped `zone` col,
  // (b) zones text[] carries the reconciled set.
  const efSql = `SELECT COALESCE((
      SELECT array_agg(DISTINCT z.name ORDER BY z.name)
      FROM shift_session ss
      JOIN shift_zone sz ON sz.shift_session_id = ss.shift_session_id
      JOIN zone z ON z.zone_id = sz.zone_id
      WHERE ss.schedule_shift_id = schedule_shift.schedule_shift_id
    ), ARRAY[]::text[]) AS zones
    FROM schedule_shift
    WHERE workspace_id = '${WS}' AND schedule_shift_id = '${shiftId ?? ""}';`;
  let zonesRaw = "";
  let sqlOk = true;
  try {
    zonesRaw = execFileSync(
      "docker",
      ["exec", "supabase_db_smartout.ai", "psql", "-U", "postgres", "-d", "postgres", "-tAc", efSql],
      { encoding: "utf8" },
    ).trim();
  } catch (e) {
    sqlOk = false;
    zonesRaw = String((e as { stderr?: string }).stderr ?? e);
  }
  log(sqlOk, `EF correlated-subquery executes (no SQL error on dropped zone col)`);
  log(
    zonesRaw.includes("Terrasse") && !zonesRaw.includes("Hovedsal"),
    `zones[] = reconciled set {Terrasse} (got ${zonesRaw})`,
  );

  await teardown();

  console.log(`\n==== LIVE-INVOKE RESULT: ${pass} passed, ${fail} failed ====`);
  if (fail > 0) process.exit(1);
}

run().catch(async (e) => {
  console.error("HARNESS ERROR:", e);
  await teardown();
  process.exit(1);
});
