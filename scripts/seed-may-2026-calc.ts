/**
 * scripts/seed-may-2026-calc.ts
 *
 * WHAT: One-shot seed script for payroll.calculation + payroll.calculation_line
 *       rows for the May 2026 Demo Restaurant workspace.
 *
 * WHY: Phase 1 has no "Kjør beregning" UI button (SMA-319). This script
 *      populates the calculation tables from the simulation fixture so
 *      LinesTable.tsx at /dashboard/payroll/[periodId] shows real data.
 *
 * HOW: Runs the same pipeline as may-2026-simulation.test.ts, then maps
 *      fixture synthetic IDs to real DB UUIDs (deterministic pattern from seed-
 *      may-2026-demo.sql comment block), then INSERTs rows via service role.
 *
 * ID MAPPING (from supabase/seed-may-2026-demo.sql):
 *   prof-sim-NNN  → f1000000-0000-0000-0000-0000000000NN  (hex NN of NNN)
 *   sh-sim-NNN    → e1000000-0000-0000-0000-0000000000NN  (hex NN of NNN)
 *   workspace     → b1000000-0000-0000-0000-000000000001
 *   period        → a1000000-0000-0000-0000-000000000001
 *
 * IDEMPOTENT: Deletes existing payroll.calculation_line + payroll.calculation
 *             rows for this period before inserting (pre-delete pattern so
 *             re-runs produce clean state without FK conflicts).
 *
 * RUN:
 *   export SUPABASE_URL="http://127.0.0.1:54321"
 *   export SUPABASE_SERVICE_ROLE_KEY="<from: npx supabase status>"
 *   npx tsx scripts/seed-may-2026-calc.ts
 *
 * NOTE ON AMOUNTS: payroll.calculation columns base_pay / total_supplements /
 *   total_deductions / total_pay are NUMERIC(10,2) — NOK, not øre. Divide bigint
 *   øre by 100 before inserting. payroll.calculation_line.amount is also NUMERIC(10,2).
 *
 * NOTE ON MANUAL SUPPLEMENTS: The hook (use-payroll-lines.ts) sums base_pay +
 *   total_supplements - total_deductions = total_pay per-shift. Manual supplements
 *   (bonus, tips, deductions) are period-level aggregates in AggregatedPeriod but
 *   not per-shift. We insert one synthetic "manual supplement" calculation row per
 *   profile that has manual_supplement_ore != 0n, using an arbitrary shift anchor
 *   (the first shift for that profile). total_pay on the anchor row includes the
 *   manual supplement amount so the profile total in LinesTable is correct.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

import {
  interpretShift,
  evaluateSupplements,
  applyStackingPolicy,
  snapshotShiftCost,
  aggregatePeriod,
  nokToOre,
  oreToNok,
} from "@smartout/payroll-calculate";

import type {
  ShiftInput,
  TimeEntryInput,
  SupplementRuleInput,
  TariffRateInput,
  WorkspaceSettings,
  PayrollProfile,
  ManualSupplementInput,
  PublicHoliday,
  InterpretedShift,
  SnapshottedShiftCost,
} from "@smartout/payroll-calculate";

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "b1000000-0000-0000-0000-000000000001";
const PERIOD_ID = "a1000000-0000-0000-0000-000000000001";

// ── ID mapping helpers ─────────────────────────────────────────────────────────

/**
 * Maps fixture profile_id (prof-sim-NNN) to real UUID.
 * Pattern: f1000000-0000-0000-0000-0000000000NN where NN = decimal(NNN) zero-padded.
 * Note: seed-may-2026-demo.sql uses decimal padding (not hex) despite the "hex NN" comment.
 * Shift 10 → ...000000000010, shift 64 → ...000000000064.
 */
function profileIdToUUID(fixtureId: string): string {
  const match = fixtureId.match(/^prof-sim-(\d+)$/);
  if (!match) throw new Error(`Unexpected profile fixture id: ${fixtureId}`);
  const n = parseInt(match[1], 10);
  const dec = n.toString().padStart(2, "0");
  return `f1000000-0000-0000-0000-0000000000${dec}`;
}

/**
 * Maps fixture shift_id (sh-sim-NNN) to real UUID.
 * Pattern: e1000000-0000-0000-0000-0000000000NN where NN = decimal(NNN) zero-padded.
 * Note: seed-may-2026-demo.sql uses decimal padding (not hex) despite the "hex NN" comment.
 * Shift 10 → ...000000000010, shift 64 → ...000000000064.
 */
function shiftIdToUUID(fixtureId: string): string {
  const match = fixtureId.match(/^sh-sim-(\d+)$/);
  if (!match) throw new Error(`Unexpected shift fixture id: ${fixtureId}`);
  const n = parseInt(match[1], 10);
  const dec = n.toString().padStart(2, "0");
  return `e1000000-0000-0000-0000-0000000000${dec}`;
}

/** Convert bigint øre to NOK number (2 decimal precision) */
function oreToNokNumber(ore: bigint): number {
  return Number(ore) / 100;
}

// ── Fixture loading ────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_DIR = join(
  __dirname,
  "../packages/payroll-calculate/__tests__/may-2026-simulation/input",
);

function loadFixture<T>(filename: string): T {
  const raw = readFileSync(join(FIXTURE_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

// ── Pipeline (mirrors may-2026-simulation.test.ts exactly) ────────────────────

function runPipeline() {
  const workspaceSettings = loadFixture<WorkspaceSettings>("workspace_settings.json");
  const profiles =
    loadFixture<Array<PayrollProfile & { baseHourlyRateNok: number }>>("profiles.json");
  const shifts = loadFixture<ShiftInput[]>("shifts.json");
  const timeEntries = loadFixture<TimeEntryInput[]>("time_entries.json");
  const tariff = loadFixture<TariffRateInput[]>("tariff.json");
  const rules = loadFixture<SupplementRuleInput[]>("rules.json");
  const publicHolidays = loadFixture<PublicHoliday[]>("public_holidays.json");
  const manualSupplements = loadFixture<ManualSupplementInput[]>("manual_supplements.json");

  const profileMap = new Map(profiles.map((p) => [p.profile_id, p]));
  const entryByShift = new Map(timeEntries.map((te) => [te.shift_id, te]));

  const interpretedShifts: InterpretedShift[] = [];
  const snapshots: SnapshottedShiftCost[] = [];

  for (const shift of shifts) {
    const timeEntry = entryByShift.get(shift.shift_id);
    if (!timeEntry) continue; // should not happen for this fixture (all 64 have entries)

    const profile = profileMap.get(shift.profile_id);
    if (!profile) continue;

    // Step 1: interpret shift
    const interpreted = interpretShift(shift, timeEntry, publicHolidays, workspaceSettings);

    // Step 2: evaluate supplements + stacking policy
    const allFiredSupplements = interpreted.buckets.flatMap((bucket) => {
      const fired = evaluateSupplements(
        bucket,
        shift,
        rules,
        tariff,
        workspaceSettings,
        profile.baseHourlyRateNok,
      );
      return applyStackingPolicy(fired, workspaceSettings.supplement_stacking_policy);
    });

    const interpretedWithSupps: InterpretedShift = {
      ...interpreted,
      fired_supplements: allFiredSupplements,
    };
    interpretedShifts.push(interpretedWithSupps);

    // Step 3: snapshot cost
    const snap = snapshotShiftCost(
      interpretedWithSupps,
      tariff,
      profile,
      profile.baseHourlyRateNok,
    );
    snapshots.push(snap);
  }

  // Monthly salary map (prof-sim-001: 50k, prof-sim-002: 45k)
  const monthlySalaryByProfile = new Map<string, bigint>([
    ["prof-sim-001", nokToOre(50_000)],
    ["prof-sim-002", nokToOre(45_000)],
  ]);

  // Step 4: aggregate period
  const aggregated = aggregatePeriod(
    snapshots,
    manualSupplements,
    [], // tips handled as manual_supplements in this simulation
    "period-may-2026",
    monthlySalaryByProfile,
  );

  return { snapshots, aggregated, shifts, timeEntries, profiles, tariff };
}

// ── classify line type ────────────────────────────────────────────────────────

function lineTypeFromPayCode(payCode: string): string {
  if (payCode === "base_hourly" || payCode === "base_monthly") return "base";
  if (payCode === "overtime") return "overtime";
  if (payCode === "meal_allowance") return "meal";
  // Negative manual supplements = deductions
  if (payCode === "uniformstrekk" || payCode === "forskudd") return "deduction";
  return "supplement";
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log("Running pipeline...");
  const { snapshots, aggregated, shifts, timeEntries, profiles } = runPipeline();

  console.log(`  ${snapshots.length} shift snapshots`);
  console.log(`  ${aggregated.length} profile aggregates`);

  // Build lookup maps
  const snapshotByShiftId = new Map(snapshots.map((s) => [s.shift_id, s]));
  const aggregatedByProfileId = new Map(aggregated.map((a) => [a.profile_id, a]));
  const profileMap = new Map(profiles.map((p) => [p.profile_id, p]));

  // First shift per profile (for manual supplement anchor rows)
  const firstShiftByProfile = new Map<string, ShiftInput>();
  for (const shift of shifts) {
    if (!firstShiftByProfile.has(shift.profile_id)) {
      firstShiftByProfile.set(shift.profile_id, shift);
    }
  }

  // ── Idempotent cleanup ───────────────────────────────────────────────────
  console.log("Deleting existing calculation rows for this period...");

  // Delete lines first (FK child), then calculations (FK parent)
  const { data: existingCalcs } = await supabase
    .schema("payroll")
    .from("calculation")
    .select("id")
    .eq("period_id", PERIOD_ID)
    .eq("workspace_id", WORKSPACE_ID);

  if (existingCalcs && existingCalcs.length > 0) {
    const calcIds = existingCalcs.map((c: { id: string }) => c.id);

    const { error: linesDelErr } = await supabase
      .schema("payroll")
      .from("calculation_line")
      .delete()
      .in("calculation_id", calcIds);

    if (linesDelErr) {
      console.error("Failed to delete existing lines:", linesDelErr);
      process.exit(1);
    }

    const { error: calcDelErr } = await supabase
      .schema("payroll")
      .from("calculation")
      .delete()
      .eq("period_id", PERIOD_ID)
      .eq("workspace_id", WORKSPACE_ID);

    if (calcDelErr) {
      console.error("Failed to delete existing calculations:", calcDelErr);
      process.exit(1);
    }

    console.log(`  Deleted ${existingCalcs.length} existing calculations.`);
  } else {
    console.log("  No existing calculations to delete.");
  }

  // ── Build calculation rows (one per shift) ────────────────────────────────
  let totalLinesInserted = 0;

  // For monthly employees, we need to distribute their monthly salary across
  // their shifts for per-shift base_pay. But the hook aggregates per-profile
  // across shifts, so it doesn't matter — we can put 0 base_pay on each
  // shift for monthly employees and then add a separate "monthly" row.
  // Simpler: use aggregated period totals and spread across a single synthetic
  // "calculation" row per profile (one row per profile = simpler, still works
  // because hook aggregates by profile_id, not by shift).
  //
  // BUT: the hook groups by schedule_shift_id for dedup, so we MUST use real
  // schedule_shift_id FK values. We insert one row per REAL shift (64 rows).
  //
  // For monthly employees: base_pay = 0 per shift, total_pay from snapshots.
  // The monthly_salary is added as a separate synthetic row (see below).

  const calcInserts: Array<Record<string, unknown>> = [];
  const lineInsertsByCalcKey: Array<{ calcKey: string; lines: Array<Record<string, unknown>> }> =
    [];

  // Track per-profile cumulative amounts to compute manual supplement delta
  const perProfileManualOre = new Map<string, bigint>();
  for (const agg of aggregated) {
    perProfileManualOre.set(agg.profile_id, agg.manual_supplement_ore);
  }

  // Process per-shift rows
  for (const shift of shifts) {
    const snap = snapshotByShiftId.get(shift.shift_id);
    if (!snap) continue;

    const teEntry = timeEntries.find((te) => te.shift_id === shift.shift_id);
    if (!teEntry) continue;

    const profileFixtureId = shift.profile_id;
    const shiftUUID = shiftIdToUUID(shift.shift_id);
    const profileUUID = profileIdToUUID(profileFixtureId);

    // Derive worked minutes from snapshot lines (interpretedShift.worked_minutes)
    // We need the interpreted data — get from snapshot's lines context.
    // Actually, we ran interpretShift which sets worked_minutes. We can recompute:
    // worked_minutes = net_working_minutes from interpreted result.
    // Since we don't store interpretedShifts individually, compute from timestamps:
    const scheduledStart = shift.scheduled_start;
    const scheduledEnd = shift.scheduled_end;
    const actualStart = teEntry.punch_in;
    const actualEnd = teEntry.punch_out ?? shift.scheduled_end;

    // gross_minutes from actual punch times (or scheduled fallback)
    const grossMs = new Date(actualEnd).getTime() - new Date(actualStart).getTime();
    const grossMinutes = Math.floor(grossMs / 60000);

    // break minutes: unpaid = scheduled_break_minutes, paid = 0 (simple model)
    const breakMinutesUnpaid = shift.scheduled_break_minutes ?? 0;
    const netWorkingMinutes = Math.max(0, grossMinutes - breakMinutesUnpaid);

    // Amounts in NOK (from øre)
    const basePayNok = oreToNokNumber(snap.base_pay_ore);
    const totalSupplementsNok = oreToNokNumber(snap.total_supplements_ore);
    const totalDeductionsNok = 0; // deductions are in manual supplements (period-level)
    const totalPayNok = oreToNokNumber(snap.total_ore);

    // base_rate: hourly rate for hourly employees, 0 for monthly
    const profile = profileMap.get(profileFixtureId);
    const baseRateNok = profile?.salary_type === "hourly" ? (profile.baseHourlyRateNok ?? 0) : 0;

    const calcKey = `shift-${shift.shift_id}`;

    calcInserts.push({
      workspace_id: WORKSPACE_ID,
      period_id: PERIOD_ID,
      schedule_shift_id: shiftUUID,
      profile_id: profileUUID,
      shift_date: shift.shift_date,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      actual_start: actualStart,
      actual_end: actualEnd,
      gross_minutes: grossMinutes,
      break_minutes_paid: 0,
      break_minutes_unpaid: breakMinutesUnpaid,
      net_working_minutes: netWorkingMinutes,
      base_rate: baseRateNok,
      base_pay: basePayNok,
      total_supplements: totalSupplementsNok,
      total_deductions: totalDeductionsNok,
      total_pay: totalPayNok,
      calculation_version: 1,
    });

    // Per-shift lines (from snapshot.lines)
    const shiftLines: Array<Record<string, unknown>> = snap.lines.map((line) => ({
      workspace_id: WORKSPACE_ID,
      salary_code: line.pay_code,
      line_type: lineTypeFromPayCode(line.pay_code),
      description: line.description,
      hours: line.hours ?? null,
      rate: line.rate_nok ?? null,
      amount: oreToNokNumber(line.amount_ore),
      supplement_rule_id: null, // rule_id from fixture is synthetic, no FK in DB
      metadata: {
        provenance: line.provenance,
        shift_fixture_id: shift.shift_id,
      },
    }));

    lineInsertsByCalcKey.push({ calcKey, lines: shiftLines });
  }

  // ── Monthly salary rows: one synthetic row per monthly-salary employee ────
  // Monthly employees (prof-sim-001, prof-sim-002) need their monthly salary
  // recorded somewhere. The shift-level snapshot has base_pay_ore=0 for them.
  // Add one extra calculation row per monthly profile, using their first real
  // shift as FK anchor, with base_pay = monthly_salary and total_pay = monthly_salary.
  // calculation_version = 2 so it doesn't conflict with the per-shift rows.
  //
  // UPDATE: Actually the hook deduplicates by schedule_shift_id using the MAX version.
  // Version 2 on the SAME shift_id would be picked up as the "latest" version —
  // that would REPLACE the shift-level data with monthly-only data. Bad.
  //
  // Better approach: merge monthly salary into the FIRST shift for that profile
  // (version 1), adding it to base_pay directly. This correctly reflects
  // "this period they earned their monthly salary + supplements from shifts."
  //
  // But that distorts per-shift data. The cleanest approach for the UI:
  // monthly salary goes into a SEPARATE calculation_line on any one shift row,
  // and the total_pay on that shift row includes it. We add it to the FIRST shift.

  const monthlyByProfile: Record<string, bigint> = {
    "prof-sim-001": nokToOre(50_000),
    "prof-sim-002": nokToOre(45_000),
  };

  // Track which shift we'll augment for monthly + manual supplements
  const firstShiftFixtureIdByProfile = new Map<string, string>();
  for (const shift of shifts) {
    if (!firstShiftFixtureIdByProfile.has(shift.profile_id)) {
      firstShiftFixtureIdByProfile.set(shift.profile_id, shift.shift_id);
    }
  }

  // For each profile, add manual supplement and monthly salary to one calc row
  for (const agg of aggregated) {
    const profileFixtureId = agg.profile_id;
    const firstShiftFixtureId = firstShiftFixtureIdByProfile.get(profileFixtureId);
    if (!firstShiftFixtureId) continue;

    // Find the calc insert for the first shift of this profile
    const calcIdx = calcInserts.findIndex(
      (c) => c.schedule_shift_id === shiftIdToUUID(firstShiftFixtureId),
    );
    if (calcIdx === -1) continue;

    // Lines to add (monthly salary + manual supplements)
    const extraLines: Array<Record<string, unknown>> = [];

    // Monthly salary
    const monthlySalaryOre = monthlyByProfile[profileFixtureId];
    if (monthlySalaryOre !== undefined && monthlySalaryOre > 0n) {
      const monthlySalaryNok = oreToNokNumber(monthlySalaryOre);
      // Augment the calc row's base_pay and total_pay
      calcInserts[calcIdx].base_pay = (calcInserts[calcIdx].base_pay as number) + monthlySalaryNok;
      calcInserts[calcIdx].total_pay =
        (calcInserts[calcIdx].total_pay as number) + monthlySalaryNok;

      extraLines.push({
        workspace_id: WORKSPACE_ID,
        salary_code: "base_monthly",
        line_type: "base",
        description: "Månedlig grunnlønn",
        hours: null,
        rate: null,
        amount: monthlySalaryNok,
        supplement_rule_id: null,
        metadata: { source: "monthly_salary", profile_fixture_id: profileFixtureId },
      });
    }

    // Manual supplements for this profile (bonus, tips, forskudd, uniformstrekk, etc.)
    const manualOre = agg.manual_supplement_ore;
    if (manualOre !== 0n) {
      const manualNok = oreToNokNumber(manualOre);
      if (manualNok > 0) {
        // Positive manual → supplement
        calcInserts[calcIdx].total_supplements =
          (calcInserts[calcIdx].total_supplements as number) + manualNok;
      } else {
        // Negative manual → deduction
        calcInserts[calcIdx].total_deductions =
          (calcInserts[calcIdx].total_deductions as number) + Math.abs(manualNok);
      }
      // total_pay includes manual supplements (from aggregatePeriod: total = gross + manual + tips)
      calcInserts[calcIdx].total_pay = (calcInserts[calcIdx].total_pay as number) + manualNok;

      extraLines.push({
        workspace_id: WORKSPACE_ID,
        salary_code: manualNok >= 0 ? "manual_supplement" : "trekk",
        line_type: manualNok >= 0 ? "supplement" : "deduction",
        description:
          manualNok >= 0 ? "Manuelle tillegg (bonus, drikkepenger)" : "Trekk (forskudd, uniform)",
        hours: null,
        rate: null,
        amount: manualNok,
        supplement_rule_id: null,
        metadata: { source: "manual_supplement_aggregate", profile_fixture_id: profileFixtureId },
      });
    }

    // Attach extra lines to the first-shift key
    const lineEntry = lineInsertsByCalcKey.find(
      (le) => le.calcKey === `shift-${firstShiftFixtureId}`,
    );
    if (lineEntry) {
      lineEntry.lines.push(...extraLines);
    }
  }

  // ── Insert calculations ────────────────────────────────────────────────────
  console.log(`Inserting ${calcInserts.length} calculation rows...`);

  // Insert in batches of 20 to avoid request size limits
  const BATCH_SIZE = 20;
  const calcIdMap = new Map<string, string>(); // calcKey → inserted DB id

  for (let i = 0; i < calcInserts.length; i += BATCH_SIZE) {
    const batch = calcInserts.slice(i, i + BATCH_SIZE);
    const { data: inserted, error } = await supabase
      .schema("payroll")
      .from("calculation")
      .insert(batch)
      .select("id, schedule_shift_id");

    if (error) {
      console.error(`Calculation insert batch ${i}–${i + BATCH_SIZE} failed:`, error);
      process.exit(1);
    }

    // Map shift UUID → inserted calculation id
    for (const row of inserted ?? []) {
      // Find the calcKey by schedule_shift_id
      const calc = calcInserts.find((c) => c.schedule_shift_id === row.schedule_shift_id);
      if (calc) {
        // Determine calcKey from shift UUID
        const fixtureShiftId = shifts.find(
          (s) => shiftIdToUUID(s.shift_id) === row.schedule_shift_id,
        )?.shift_id;
        if (fixtureShiftId) {
          calcIdMap.set(`shift-${fixtureShiftId}`, row.id);
        }
      }
    }
  }

  console.log(`  Inserted ${calcIdMap.size} calculations.`);

  // ── Insert calculation lines ───────────────────────────────────────────────
  console.log("Inserting calculation lines...");

  for (const { calcKey, lines } of lineInsertsByCalcKey) {
    const calcId = calcIdMap.get(calcKey);
    if (!calcId) {
      console.warn(`  No calc id found for ${calcKey} — skipping lines`);
      continue;
    }

    const linesWithCalcId = lines.map((l) => ({ ...l, calculation_id: calcId }));

    for (let i = 0; i < linesWithCalcId.length; i += BATCH_SIZE) {
      const batch = linesWithCalcId.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.schema("payroll").from("calculation_line").insert(batch);

      if (error) {
        console.error(`Line insert for ${calcKey} failed:`, error);
        process.exit(1);
      }

      totalLinesInserted += batch.length;
    }
  }

  console.log(`  Inserted ${totalLinesInserted} calculation lines.`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");

  // Top 3 earners by total_pay (from aggregated period)
  const sorted = [...aggregated].sort((a, b) => Number(b.total_ore - a.total_ore));
  console.log("Top earners (total lønnsgrunnlag):");
  for (const agg of sorted.slice(0, 3)) {
    const profileUUID = profileIdToUUID(agg.profile_id);
    console.log(`  ${agg.profile_id} (${profileUUID}): ${oreToNok(agg.total_ore).toFixed(2)} NOK`);
  }

  const totalOre = aggregated.reduce((sum, a) => sum + a.total_ore, 0n);
  console.log(`\nTotal workspace lønnsgrunnlag: ${oreToNok(totalOre).toFixed(2)} NOK`);
  console.log(`Calculations: ${calcIdMap.size}`);
  console.log(`Lines: ${totalLinesInserted}`);
  console.log("\nDone. Refresh /dashboard/payroll/a1000000-0000-0000-0000-000000000001");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
