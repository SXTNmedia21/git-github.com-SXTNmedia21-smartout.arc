// ============================================
// payroll-locked-period-seed.ts
//
// Idempotent seed of one locked payroll period + one payroll.calculation row
// against the E2E fixture workspace (`b0000000-…`). Unblocks the Group B
// round-trip tests in apps/e2e/tests/payroll-phase-{3,4}-*.spec.ts which
// gate on `process.env.E2E_LOCKED_PERIOD_ID`.
//
// Wired into `apps/e2e/global-setup.ts` after the recorder authority seed.
// Setting the env var here propagates to all worker processes Playwright
// spawns from this run.
//
// Schema note: payroll tables live in the `payroll` schema (ADR-0055 +
// migration 20260422110700), not `public`. Use `.schema("payroll").from(...)`.
// ============================================

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@smartout/supabase";

// Stable deterministic IDs — chosen to not collide with the existing
// fixture pool (a000…/b000…/c000…/d000…/f000…/ac000…/ad000…). The `b1…`
// prefix marks "payroll fixture, not workspace".
const LOCKED_PERIOD_ID = "b1000000-0000-0000-0000-000000000001";
const LOCKED_CALCULATION_ID = "b1000000-0000-0000-0000-000000000002";

const FIXTURE_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
const FIXTURE_ADMIN_PROFILE_ID = "f0000000-0000-0000-0000-000000000000";
const FIXTURE_SHIFT_ID = "ac000000-0000-0000-0000-000000000001";

// Period: full month enclosing the fixture shift date 2026-03-23.
// Hard-coding the dates keeps the period stable across CI runs — drift
// would invalidate filename regexes in payroll-phase-3 specs.
const PERIOD_START = "2026-03-01";
const PERIOD_END = "2026-03-31";
const PERIOD_LOCKED_AT = "2026-04-02T08:00:00Z";

export async function ensurePayrollLockedPeriodSeed(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "ensurePayrollLockedPeriodSeed: SUPABASE_SERVICE_ROLE_KEY not set — " +
        "cannot seed locked period.",
    );
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Verify fixture workspace exists before attempting dependent seeds.
  // Runtime fixture script is the canonical owner of the workspace row;
  // skip quietly if it hasn't provisioned yet rather than throw.
  const { data: workspace, error: wsErr } = await admin
    .from("workspace")
    .select("workspace_id")
    .eq("workspace_id", FIXTURE_WORKSPACE_ID)
    .maybeSingle();
  if (wsErr) {
    throw new Error(`ensurePayrollLockedPeriodSeed: workspace lookup failed: ${wsErr.message}`);
  }
  if (!workspace) {
    return;
  }

  const periodRow: Database["payroll"]["Tables"]["period"]["Insert"] = {
    id: LOCKED_PERIOD_ID,
    workspace_id: FIXTURE_WORKSPACE_ID,
    start_date: PERIOD_START,
    end_date: PERIOD_END,
    status: "locked",
    locked_by: FIXTURE_ADMIN_PROFILE_ID,
    locked_at: PERIOD_LOCKED_AT,
  };

  const { error: periodErr } = await admin
    .schema("payroll")
    .from("period")
    .upsert(periodRow, { onConflict: "id" });
  if (periodErr) {
    throw new Error(`ensurePayrollLockedPeriodSeed: upsert period failed: ${periodErr.message}`);
  }

  // One payroll.calculation row so the CSV/PDF export has data. Shape
  // chosen to match a typical 8-hour shift with a 30-min unpaid break.
  // Numbers don't need to be tariff-accurate — Group B specs assert
  // filename shape, BOM, and Content-Type, not numerical values.
  const calculationRow: Database["payroll"]["Tables"]["calculation"]["Insert"] = {
    id: LOCKED_CALCULATION_ID,
    workspace_id: FIXTURE_WORKSPACE_ID,
    period_id: LOCKED_PERIOD_ID,
    schedule_shift_id: FIXTURE_SHIFT_ID,
    profile_id: FIXTURE_ADMIN_PROFILE_ID,
    shift_date: "2026-03-23",
    scheduled_start: "2026-03-23T09:00:00+01:00",
    scheduled_end: "2026-03-23T17:00:00+01:00",
    gross_minutes: 480,
    break_minutes_paid: 0,
    break_minutes_unpaid: 30,
    net_working_minutes: 450,
    base_rate: 200,
    base_pay: 1500,
    total_supplements: 0,
    total_deductions: 0,
    total_pay: 1500,
    calculation_version: 1,
  };

  const { error: calcErr } = await admin
    .schema("payroll")
    .from("calculation")
    .upsert(calculationRow, { onConflict: "id" });
  if (calcErr) {
    throw new Error(`ensurePayrollLockedPeriodSeed: upsert calculation failed: ${calcErr.message}`);
  }

  // Propagate the period UUID to test workers. Playwright forwards
  // process.env from globalSetup to workers.
  process.env.E2E_LOCKED_PERIOD_ID = LOCKED_PERIOD_ID;
}

export const PAYROLL_E2E_FIXTURE = {
  LOCKED_PERIOD_ID,
  LOCKED_CALCULATION_ID,
  PERIOD_START,
  PERIOD_END,
} as const;
