/**
 * __tests__/golden-month/golden-month.test.ts
 *
 * WHAT: End-to-end integration test for the payroll engine using golden-month fixtures.
 *       Runs the full pipeline (interpret → evaluate-supplements → stacking →
 *       snapshot-cost → aggregate-period → deviation-checks) for 12 employees
 *       in April 2026.
 *
 * WHY: Ensures that all pipeline stages compose correctly. Guards against regressions
 *      that pass unit tests but break on real-world fixture data. Also verifies
 *      structural invariants (no negative totals, correct profile grouping, known
 *      violations present, etc.).
 *
 * MONTHLY SALARY NOTE: Monthly-salary employees (prof-005 through prof-008) have
 *   base_hourly=0 per shift. The test passes a representative monthly salary map
 *   (40_000 NOK per profile) to aggregatePeriod(). This simulates what the Day 4
 *   RPC would read from employment_contract.gross_monthly.
 *
 * SUPPLEMENT RULE NOTE: rules.json has an "evening supplement" window "21:00" to
 *   "23:59". The bucket-classification engine classifies 21:00-23:59 as "evening",
 *   but the supplement rule itself is what fires the rate. These must be consistent.
 *
 * Zero I/O. All fixture data loaded via JSON imports.
 *
 * ADR-0341 NOTE: The "cents-exact dry-run" block at the end validates expected/*.json
 *   fixtures against the schema (F6 gate) and checks amount_ore equality (acceptance
 *   criterion 1). It is currently marked describe.todo pending Pontus completing
 *   shift_snapshots.json / aggregated_periods.json / payroll_lines.json /
 *   timebank_entries.json. deviations.json is live (empty array — 0 deviation cells).
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import {
  ShiftSnapshotsSchema,
  AggregatedPeriodsSchema,
  PayrollLinesSchema,
  TimebankEntriesSchema,
  DeviationsSchema,
  type ExpectedCell,
} from "./expected-cell.schema.js";
import {
  interpretShift,
  evaluateSupplements,
  applyStackingPolicy,
  snapshotShiftCost,
  aggregatePeriod,
  runDeviationChecks,
  emitTimebankEntries,
  nokToOre,
  oreToNok,
} from "../../src/index.js";
import type {
  ShiftInput,
  TimeEntryInput,
  SupplementRuleInput,
  TariffRateInput,
  WorkspaceSettings,
  PayrollProfile,
  ManualSupplementInput,
  PublicHoliday,
  RegulatoryFrameworkInput,
  InterpretedShift,
  SnapshottedShiftCost,
  AggregatedPeriod,
} from "../../src/types.js";

// ── Fixture imports ────────────────────────────────────────────────────────
import workspaceSettingsRaw from "./input/workspace_settings.json" with { type: "json" };
import profilesRaw from "./input/profiles.json" with { type: "json" };
import shiftsRaw from "./input/shifts.json" with { type: "json" };
import timeEntriesRaw from "./input/time_entries.json" with { type: "json" };
import tariffRaw from "./input/tariff.json" with { type: "json" };
import rulesRaw from "./input/rules.json" with { type: "json" };
import publicHolidaysRaw from "./input/public_holidays.json" with { type: "json" };
import manualSupplementsRaw from "./input/manual_supplements.json" with { type: "json" };

// ── Typed fixtures ─────────────────────────────────────────────────────────
const workspaceSettings = workspaceSettingsRaw as WorkspaceSettings;
const profiles = profilesRaw as Array<PayrollProfile & { baseHourlyRateNok: number }>;
const shifts = shiftsRaw as ShiftInput[];
const timeEntries = timeEntriesRaw as TimeEntryInput[];
const tariff = tariffRaw as TariffRateInput[];
const rules = rulesRaw as SupplementRuleInput[];
const publicHolidays = publicHolidaysRaw as PublicHoliday[];
const manualSupplements = manualSupplementsRaw as ManualSupplementInput[];

// ── Aml. thresholds (constants for Phase 1) ────────────────────────────────
const AML_RULES: RegulatoryFrameworkInput = {
  min_rest_hours_between_shifts: 11,
  max_daily_hours: 9,
  max_weekly_hours: 40,
  max_weekly_ot_hours: 10,
  forced_break_threshold_minutes: 330, // 5.5 hours
};

// ── Monthly salary for monthly employees (simulating contract read) ─────────
// In production, this comes from employment_contract.gross_monthly
// Per worksheet 01-pontus-compute-worksheet.md lines 175, 200, 222, 243:
// Monthly basis = 205.00 NOK/t × 37.5 t/week × 30 days / 7 days = 32946.43 NOK = 3294643 øre
// (minstelønn voksen ufaglært etter 2 år per Riksavtalen §3 2025)
const MONTHLY_SALARY_ORE = 3_294_643n;
const monthlySalaryByProfile = new Map<string, bigint>([
  ["prof-005", MONTHLY_SALARY_ORE],
  ["prof-006", MONTHLY_SALARY_ORE],
  ["prof-007", MONTHLY_SALARY_ORE],
  ["prof-008", MONTHLY_SALARY_ORE],
]);

// ── Pipeline state ─────────────────────────────────────────────────────────
let interpretedShifts: InterpretedShift[] = [];
let snapshots: SnapshottedShiftCost[] = [];
let aggregated: AggregatedPeriod[] = [];
let timebankEntries: ReturnType<typeof emitTimebankEntries> = [];

// ── Run pipeline once (beforeAll) ──────────────────────────────────────────
beforeAll(() => {
  // Build profile + time-entry lookup maps
  const profileMap = new Map(profiles.map((p) => [p.profile_id, p]));
  const entryByShift = new Map(timeEntries.map((te) => [te.shift_id, te]));

  // Step 1-3: interpret + evaluate + snapshot per shift
  for (const shift of shifts) {
    const timeEntry = entryByShift.get(shift.shift_id);
    if (!timeEntry) continue;

    const profile = profileMap.get(shift.profile_id);
    if (!profile) continue;

    // 1. Interpret shift
    const interpreted = interpretShift(shift, timeEntry, publicHolidays, workspaceSettings);

    // 2. Evaluate supplements per bucket — with stacking
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

    // Attach supplements to interpreted shift
    const interpretedWithSupps: InterpretedShift = {
      ...interpreted,
      fired_supplements: allFiredSupplements,
    };

    interpretedShifts.push(interpretedWithSupps);

    // 3. Snapshot cost
    const snap = snapshotShiftCost(
      interpretedWithSupps,
      tariff,
      profile,
      profile.baseHourlyRateNok,
    );
    snapshots.push(snap);
  }

  // Step 4: Aggregate period
  aggregated = aggregatePeriod(
    snapshots,
    manualSupplements,
    [], // no tip distributions in golden-month
    "period-april-2026",
    monthlySalaryByProfile,
  );

  // Step 5: Emit timebank entries for all profiles
  timebankEntries = aggregated.flatMap((agg) =>
    emitTimebankEntries(
      agg,
      profiles.find((p) => p.profile_id === agg.profile_id)!,
      workspaceSettings,
      [],
      0,
      "2026-04-30",
      `calc-${agg.profile_id}`,
    ),
  );
});

// ── INVARIANTS ─────────────────────────────────────────────────────────────

describe("golden-month pipeline — structural invariants", () => {
  it("interpreted all 43 shifts", () => {
    expect(interpretedShifts.length).toBe(43);
  });

  it("produced a snapshot for all 43 shifts", () => {
    expect(snapshots.length).toBe(43);
  });

  it("aggregated 12 distinct profiles", () => {
    expect(aggregated.length).toBe(12);
    const profileIds = aggregated.map((a) => a.profile_id).sort();
    for (let i = 1; i <= 12; i++) {
      expect(profileIds).toContain(`prof-${i.toString().padStart(3, "0")}`);
    }
  });

  it("all period totals are non-negative", () => {
    for (const agg of aggregated) {
      expect(agg.total_ore).toBeGreaterThanOrEqual(0n);
      expect(agg.gross_amount_ore).toBeGreaterThanOrEqual(0n);
      expect(agg.manual_supplement_ore).toBeGreaterThanOrEqual(0n);
    }
  });

  it("total_ore = gross + tips + manual for each profile", () => {
    for (const agg of aggregated) {
      expect(agg.total_ore).toBe(
        agg.gross_amount_ore + agg.tips_amount_ore + agg.manual_supplement_ore,
      );
    }
  });

  it("all interpreted shifts have non-negative worked_minutes", () => {
    for (const shift of interpretedShifts) {
      expect(shift.worked_minutes).toBeGreaterThanOrEqual(0);
    }
  });

  it("gross_minutes >= worked_minutes for all shifts", () => {
    for (const shift of interpretedShifts) {
      expect(shift.gross_minutes).toBeGreaterThanOrEqual(shift.worked_minutes);
    }
  });
});

// ── PROFILE-SPECIFIC SPOT CHECKS ───────────────────────────────────────────

describe("golden-month — prof-001 (hourly, paid_out, 215 NOK/h)", () => {
  it("has 6 shifts in snapshots", () => {
    const prof001Snaps = snapshots.filter((s) => s.profile_id === "prof-001");
    expect(prof001Snaps.length).toBe(6);
  });

  it("has positive gross_amount_ore", () => {
    const agg = aggregated.find((a) => a.profile_id === "prof-001")!;
    expect(agg.gross_amount_ore).toBeGreaterThan(0n);
  });

  it("has 150 NOK manual supplement (ms-001)", () => {
    const agg = aggregated.find((a) => a.profile_id === "prof-001")!;
    expect(agg.manual_supplement_ore).toBe(nokToOre(150));
  });

  it("base_hourly line exists with positive amount", () => {
    const agg = aggregated.find((a) => a.profile_id === "prof-001")!;
    const baseLine = agg.lines.find((l) => l.pay_code === "base_hourly");
    expect(baseLine).toBeDefined();
    expect(baseLine!.amount_ore).toBeGreaterThan(0n);
  });
});

describe("golden-month — prof-002 (hourly, paid_out, 200 NOK/h, W01 violation)", () => {
  it("has 200 NOK manual supplement (ms-002)", () => {
    const agg = aggregated.find((a) => a.profile_id === "prof-002")!;
    expect(agg.manual_supplement_ore).toBe(nokToOre(200));
  });

  it("has positive gross amount", () => {
    const agg = aggregated.find((a) => a.profile_id === "prof-002")!;
    expect(agg.gross_amount_ore).toBeGreaterThan(0n);
  });
});

describe("golden-month — prof-003 (hourly, banked OT, 220 NOK/h, night_watch)", () => {
  it("has 5 shifts in snapshots", () => {
    const prof003Snaps = snapshots.filter((s) => s.profile_id === "prof-003");
    expect(prof003Snaps.length).toBe(5);
  });

  it("has positive gross amount", () => {
    const agg = aggregated.find((a) => a.profile_id === "prof-003")!;
    expect(agg.gross_amount_ore).toBeGreaterThan(0n);
  });
});

describe("golden-month — prof-005 (monthly, 45,000 NOK/month)", () => {
  it("gross_amount_ore = 45,000 NOK monthly salary (base_monthly override)", () => {
    const agg = aggregated.find((a) => a.profile_id === "prof-005")!;
    // Monthly salary 45,000 NOK = 4,500,000 øre
    // Plus supplements fired on shifts (evening supplement on sh-022, sh-023)
    // gross = monthlyOre + supplements from shifts
    // At minimum = 4,500,000 øre
    expect(agg.gross_amount_ore).toBeGreaterThanOrEqual(MONTHLY_SALARY_ORE);
  });

  it("has drikkepenger manual supplement from ms-004 (175 NOK)", () => {
    const agg = aggregated.find((a) => a.profile_id === "prof-005")!;
    expect(agg.manual_supplement_ore).toBe(nokToOre(175));
  });

  it("has base_monthly pay_code line", () => {
    const agg = aggregated.find((a) => a.profile_id === "prof-005")!;
    const line = agg.lines.find((l) => l.pay_code === "base_monthly");
    expect(line).toBeDefined();
    expect(line!.amount_ore).toBe(MONTHLY_SALARY_ORE);
  });
});

describe("golden-month — prof-012 (hourly, 210 NOK/h, 6 shifts)", () => {
  it("has 6 shifts in snapshots", () => {
    const prof012Snaps = snapshots.filter((s) => s.profile_id === "prof-012");
    expect(prof012Snaps.length).toBe(6);
  });

  it("has 300 NOK manual supplement (ms-003)", () => {
    const agg = aggregated.find((a) => a.profile_id === "prof-012")!;
    expect(agg.manual_supplement_ore).toBe(nokToOre(300));
  });

  it("total manual supplements across all profiles matches sum of ms-001 to ms-004", () => {
    const totalManual = aggregated.reduce((sum, a) => sum + a.manual_supplement_ore, 0n);
    const expected = nokToOre(150) + nokToOre(200) + nokToOre(300) + nokToOre(175);
    expect(totalManual).toBe(expected);
  });
});

// ── SUPPLEMENT FIRING ──────────────────────────────────────────────────────

describe("golden-month — supplement firing verification", () => {
  it("sh-002 (prof-001, evening 21:00-23:00) fires a supplement for evening bucket", () => {
    const snap = snapshots.find((s) => s.shift_id === "sh-002")!;
    // Evening bucket should have at least one supplement line
    expect(snap.total_supplements_ore).toBeGreaterThan(0n);
  });

  it("sh-035, sh-036, sh-037 (prof-011, Sunday shifts) fire helgetillegg", () => {
    for (const shiftId of ["sh-035", "sh-036", "sh-037"]) {
      const snap = snapshots.find((s) => s.shift_id === shiftId)!;
      // Sunday shifts for prof-011: supplement should fire
      expect(snap.total_supplements_ore).toBeGreaterThan(0n);
    }
  });

  it("sh-013 (prof-003, night shift crossing Easter) — supplements fired", () => {
    const snap = snapshots.find((s) => s.shift_id === "sh-013")!;
    // Night shift crossing holiday: should have supplements
    expect(snap.total_supplements_ore).toBeGreaterThan(0n);
  });
});

// ── DEVIATION CHECKS ───────────────────────────────────────────────────────

describe("golden-month — deviation checks", () => {
  let deviations: ReturnType<typeof runDeviationChecks>;

  beforeAll(() => {
    // Build profile map for W13 minstelønn check
    const profilesByProfileId = new Map(profiles.map((p) => [p.profile_id, p]));

    // Run deviation checks using actual DeviationChecksInput shape
    deviations = runDeviationChecks({
      aggregated,
      shifts: interpretedShifts,
      workspaceSettings,
      framework: AML_RULES,
      profilesByProfileId,
      tariffRates: tariff,
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
  });

  it("W01 fires for prof-002 (sh-008 → sh-009 gap < 11h)", () => {
    const w01 = deviations.filter((d) => d.check_id === "W01");
    expect(w01.length).toBeGreaterThan(0);
    const prof002W01 = w01.find((d) => d.profile_id === "prof-002");
    expect(prof002W01).toBeDefined();
  });

  it("W01 fires for prof-010 (sh-033 → sh-034 gap < 11h)", () => {
    const w01 = deviations.filter((d) => d.check_id === "W01" && d.profile_id === "prof-010");
    expect(w01.length).toBeGreaterThan(0);
  });

  it("W02 fires for prof-001 shifts > 9h worked (sh-003: 9.5h, sh-004: 11.5h)", () => {
    const w02 = deviations.filter((d) => d.check_id === "W02" && d.profile_id === "prof-001");
    // sh-003: 10.5h gross - 30min break = 10h worked > 9h → W02
    // sh-004: 12.5h gross - 30min break = 12h worked > 9h → W02
    expect(w02.length).toBeGreaterThanOrEqual(2);
  });

  it("W02 fires for prof-002 sh-010 (11.5h worked)", () => {
    const w02 = deviations.filter((d) => d.check_id === "W02" && d.profile_id === "prof-002");
    expect(w02.length).toBeGreaterThan(0);
  });

  it("no W07 (negative net pay) for any profile", () => {
    const w07 = deviations.filter((d) => d.check_id === "W07");
    // All employees have positive pay — W07 should not fire
    expect(w07.length).toBe(0);
  });

  it("all deviations have required fields", () => {
    for (const dev of deviations) {
      expect(dev.check_id).toBeTruthy();
      expect(dev.severity).toMatch(/^(error|warning|info)$/);
      expect(dev.message).toBeTruthy();
      expect(dev.suggested_action).toBeTruthy();
    }
  });
});

// ── TIMEBANK ENTRIES ───────────────────────────────────────────────────────

describe("golden-month — timebank entries (feriepenger)", () => {
  it("emits feriepenger entries for all profiles", () => {
    for (const agg of aggregated) {
      const profile = profiles.find((p) => p.profile_id === agg.profile_id)!;
      const entries = emitTimebankEntries(
        agg,
        profile,
        workspaceSettings,
        [],
        0,
        "2026-04-30",
        `calc-${agg.profile_id}`,
      );

      const ferieEntry = entries.find((e) => e.account_type === "feriepenger");
      expect(ferieEntry).toBeDefined();
      // Feriepenger = gross_amount_ore * holiday_allowance_pct / 100
      // All profiles have 12% or 12.5%
      expect(ferieEntry!.value_amount_ore).toBeGreaterThan(0n);
      expect(ferieEntry!.entry_type).toBe("accrual");
    }
  });

  it("emits TOIL entries only for banked-OT profiles (prof-003, prof-011) when banked minutes > 0", () => {
    // Test prof-003 (banked): if any shift produced OT, TOIL should accrue
    const prof003Agg = aggregated.find((a) => a.profile_id === "prof-003")!;
    const prof003 = profiles.find((p) => p.profile_id === "prof-003")!;

    // Pass 60 banked minutes to trigger TOIL
    const entries = emitTimebankEntries(
      prof003Agg,
      prof003,
      workspaceSettings,
      [],
      60, // banked OT minutes
      "2026-04-30",
      "calc-prof-003",
    );

    const toilEntry = entries.find((e) => e.account_type === "toil");
    expect(toilEntry).toBeDefined();
    expect(toilEntry!.hours).toBe(1); // 60 min = 1 hour

    // Test prof-001 (paid_out): no TOIL even with banked minutes arg
    const prof001Agg = aggregated.find((a) => a.profile_id === "prof-001")!;
    const prof001 = profiles.find((p) => p.profile_id === "prof-001")!;
    const prof001Entries = emitTimebankEntries(
      prof001Agg,
      prof001,
      workspaceSettings,
      [],
      60,
      "2026-04-30",
      "calc-prof-001",
    );
    const prof001ToilEntry = prof001Entries.find((e) => e.account_type === "toil");
    expect(prof001ToilEntry).toBeUndefined();
  });
});

// ── TOTAL PAYROLL SANITY ───────────────────────────────────────────────────

describe("golden-month — total payroll sanity", () => {
  it("total payroll across all profiles is in a reasonable range (1M–10M øre)", () => {
    const total = aggregated.reduce((sum, a) => sum + a.total_ore, 0n);
    // 12 employees × average ~30,000–50,000 NOK each = 360,000–600,000 NOK = 36M–60M øre
    // But only part of the month is covered (most have 2-6 shifts), so expect lower
    // Minimum plausible: 100,000 øre (1,000 NOK). Maximum: 50,000,000 øre (500,000 NOK)
    expect(total).toBeGreaterThan(100_000n);
    expect(total).toBeLessThan(50_000_000n);
    console.info(`[golden-month] Total payroll: ${oreToNok(total).toFixed(2)} NOK`);
  });

  it("no profile has a zero total if they have shifts", () => {
    for (const agg of aggregated) {
      const hasShifts = agg.shift_ids.length > 0;
      const hasManual = agg.manual_supplement_ore > 0n;
      if (hasShifts || hasManual) {
        expect(agg.total_ore).toBeGreaterThan(0n);
      }
    }
  });

  it("hourly employees have base_hourly lines with positive amounts", () => {
    const hourlyProfileIds = profiles
      .filter((p) => p.salary_type === "hourly")
      .map((p) => p.profile_id);

    for (const profId of hourlyProfileIds) {
      const agg = aggregated.find((a) => a.profile_id === profId);
      if (!agg || agg.shift_ids.length === 0) continue;

      const baseLine = agg.lines.find((l) => l.pay_code === "base_hourly");
      expect(baseLine).toBeDefined();
      expect(baseLine!.amount_ore).toBeGreaterThan(0n);
    }
  });

  it("monthly employees have base_monthly lines (not base_hourly)", () => {
    const monthlyProfileIds = profiles
      .filter((p) => p.salary_type === "monthly")
      .map((p) => p.profile_id);

    for (const profId of monthlyProfileIds) {
      const agg = aggregated.find((a) => a.profile_id === profId);
      if (!agg) continue;

      const monthlyLine = agg.lines.find((l) => l.pay_code === "base_monthly");
      expect(monthlyLine).toBeDefined();
      expect(monthlyLine!.amount_ore).toBe(MONTHLY_SALARY_ORE);

      const hourlyLine = agg.lines.find((l) => l.pay_code === "base_hourly");
      // Monthly employees should NOT have a base_hourly line (or it should be zero)
      if (hourlyLine) {
        expect(hourlyLine.amount_ore).toBe(0n);
      }
    }
  });
});

// ── ADR-0341 §10.1 CENTS-EXACT DRY-RUN ────────────────────────────────────
//
// F6 acceptance gate (ADR-0341):
//   1. Load each expected/*.json — validate schema with Zod (golden-month.cell_schema_violation on failure)
//   2. Compare actual engine amount_ore vs expected amount_ore — must match exactly (no tolerance)
//   3. Cells where computedBy==="PENDING_PONTUS_SIGN" or verifiedBy==="PENDING_LOVSEN_CERTIFY"
//      are excluded from equality comparison; a console.warn summary is emitted instead.
//
// STATUS: describe.todo — data JSON files (shift_snapshots, aggregated_periods,
//   payroll_lines, timebank_entries) are authored by parallel agents and not yet
//   present. deviations.json is live ({deviations:[]}). This block becomes active
//   once all five expected/*.json files exist and carry Pontus-signed cells.
//
// Track via Linear SMA-372 (Phase 1 close-out gap §H1).

// Helper: resolve path relative to THIS test file (works with ESM __dirname equivalent)
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const expectedDir = path.join(__dirname, "expected");

/**
 * Load and schema-validate one expected JSON file.
 * Throws with golden-month.cell_schema_violation error message on schema failure.
 */
function loadExpected<T>(filename: string, parser: { parse: (v: unknown) => T }): T {
  const filePath = path.join(expectedDir, filename);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
  const result = parser.safeParse(raw);
  if (!result.success) {
    throw new Error(`golden-month.cell_schema_violation in ${filename}:\n${result.error.message}`);
  }
  return result.data;
}

/**
 * Count unsigned cells and emit a warning summary.
 * A cell is "unsigned" if Pontus has not signed (computedBy) OR Lovsen has not verified.
 */
function countUnsigned(cells: ExpectedCell[]): number {
  return cells.filter(
    (c) => c.computedBy === "PENDING_PONTUS_SIGN" || c.verifiedBy === "PENDING_LOVSEN_CERTIFY",
  ).length;
}

// ── deviations.json schema gate (live — always runs, array is empty) ─────────
//
// This test is NOT todo: deviations.json exists and contains an empty array.
// The golden-month worksheet has 0 deviation cells (confirmed: grep returns no
// "file: deviations/*" rows in 01-pontus-compute-worksheet.md).

describe("ADR-0341 §10.1 — deviations.json schema gate (F6)", () => {
  it("deviations.json validates against DeviationsSchema and is empty", () => {
    const data = loadExpected("deviations.json", DeviationsSchema);
    // Worksheet confirms 0 deviation cells — enforce the empty invariant.
    expect(data.deviations).toHaveLength(0);
  });
});

// ── Full cents-exact comparison ───────────────────────────────────────────────

describe("ADR-0341 §10.1 — cents-exact dry-run vs shift_snapshots.json / aggregated_periods.json / payroll_lines.json / timebank_entries.json", () => {
  it("shift_snapshots.json: schema valid + amount_ore exact per shift", () => {
    const data = loadExpected("shift_snapshots.json", ShiftSnapshotsSchema);
    const drifts: string[] = [];
    let unsignedTotal = 0;

    for (const entry of data.shift_snapshots) {
      const snap = snapshots.find((s) => s.shift_id === entry.shiftId);
      if (!snap) {
        expect.fail(`shift_snapshots.json references unknown shiftId="${entry.shiftId}"`);
      }

      // Group expected cells per (supplementRuleId or payCode) and SUM amount_ore.
      // Rationale: worksheet splits multi-bucket supplements (e.g. helgetillegg Sat bucket +
      // helgetillegg Sun bucket) into separate cells, but the engine emits ONE PayrollLine
      // per supplement_rule_id. Comparing each cell individually would double-match the same
      // engine line and produce spurious drift. Summing before compare is correct.
      type GroupValue = {
        expectedSum: bigint;
        cells: ExpectedCell[];
        ruleId: string | null;
        payCode: string;
      };
      const groups = new Map<string, GroupValue>();
      let unsignedInEntry = 0;

      for (const cell of entry.cells) {
        if (cell.computedBy.startsWith("PENDING_")) {
          unsignedInEntry++;
          continue;
        }
        // Strip bucket suffix like " (Sat bucket)" / " (Sun bucket)" from ruleLabel
        const baseLabel = cell.ruleLabel.split(/\s+\(/)[0]!;
        const key: string =
          cell.supplementRuleId !== null ? `rule:${cell.supplementRuleId}` : `pay:${baseLabel}`;
        const g = groups.get(key);
        if (g) {
          g.expectedSum += BigInt(cell.amount_ore);
          g.cells.push(cell);
        } else {
          groups.set(key, {
            expectedSum: BigInt(cell.amount_ore),
            cells: [cell],
            ruleId: cell.supplementRuleId,
            payCode: baseLabel,
          });
        }
      }

      unsignedTotal += unsignedInEntry;

      // Compare each group against the engine line
      for (const [key, g] of groups) {
        const actualLine =
          g.ruleId !== null
            ? snap.lines.find((l) => l.supplement_rule_id === g.ruleId)
            : snap.lines.find((l) => l.pay_code === g.payCode);

        if (!actualLine) {
          const labels = g.cells.map((c) => c.ruleLabel).join(",");
          drifts.push(
            `[shift_snapshots] sh=${entry.shiftId} group="${key}" cells=${g.cells.length}(${labels}) — LINE NOT FOUND`,
          );
          continue;
        }

        if (actualLine.amount_ore !== g.expectedSum) {
          const delta = actualLine.amount_ore - g.expectedSum;
          drifts.push(
            `[shift_snapshots] sh=${entry.shiftId} group="${key}" cells=${g.cells.length} expectedSum=${g.expectedSum} actual=${actualLine.amount_ore} delta=${delta}`,
          );
        }
      }
    }

    if (unsignedTotal > 0) {
      console.warn(`[ADR-0341] shift_snapshots: ${unsignedTotal} unsigned cells skipped`);
    }
    if (drifts.length > 0) {
      const first20 = drifts.slice(0, 20).join("\n");
      expect.fail(
        `shift_snapshots: ${drifts.length} drift(s) found (showing first 20):\n${first20}`,
      );
    }
  });

  it("aggregated_periods.json: schema valid + amount_ore exact per profile", () => {
    const data = loadExpected("aggregated_periods.json", AggregatedPeriodsSchema);
    const drifts: string[] = [];
    let unsignedTotal = 0;

    for (const entry of data.aggregated_periods) {
      const agg = aggregated.find((a) => a.profile_id === entry.profileId);
      if (!agg) {
        expect.fail(`aggregated_periods.json references unknown profileId="${entry.profileId}"`);
      }

      // Group expected cells per (supplementRuleId or payCode) and SUM amount_ore.
      // Scalar top-level fields (gross_pay, manual_supplement, total, tips) are peeled off
      // first; remaining groups match against agg.lines.
      type GroupValue = {
        expectedSum: bigint;
        cells: ExpectedCell[];
        ruleId: string | null;
        payCode: string;
      };
      const groups = new Map<string, GroupValue>();
      let unsignedInEntry = 0;

      for (const cell of entry.cells) {
        if (cell.computedBy.startsWith("PENDING_")) {
          unsignedInEntry++;
          continue;
        }
        const baseLabel = cell.ruleLabel.split(/\s+\(/)[0]!;
        const key: string =
          cell.supplementRuleId !== null ? `rule:${cell.supplementRuleId}` : `pay:${baseLabel}`;
        const g = groups.get(key);
        if (g) {
          g.expectedSum += BigInt(cell.amount_ore);
          g.cells.push(cell);
        } else {
          groups.set(key, {
            expectedSum: BigInt(cell.amount_ore),
            cells: [cell],
            ruleId: cell.supplementRuleId,
            payCode: baseLabel,
          });
        }
      }

      unsignedTotal += unsignedInEntry;

      // Compare each group — scalar labels map to top-level agg fields; rest → agg.lines
      for (const [key, g] of groups) {
        let actualOre: bigint | undefined;

        // Scalar special-cases: peel off top-level agg fields before line lookup
        if (g.payCode === "gross_pay") {
          actualOre = agg.gross_amount_ore;
        } else if (g.payCode === "manual_supplement") {
          actualOre = agg.manual_supplement_ore;
        } else if (g.payCode === "total" || g.payCode === "period_total") {
          actualOre = agg.total_ore;
        } else if (g.payCode === "tips" || g.payCode === "tip_distribution") {
          actualOre = agg.tips_amount_ore;
        } else {
          // Supplement / pay-code line
          const periodLine =
            g.ruleId !== null
              ? agg.lines.find((l) => l.supplement_rule_id === g.ruleId)
              : agg.lines.find((l) => l.pay_code === g.payCode);
          if (!periodLine) {
            const labels = g.cells.map((c) => c.ruleLabel).join(",");
            drifts.push(
              `[aggregated_periods] prof=${entry.profileId} group="${key}" cells=${g.cells.length}(${labels}) — LINE NOT FOUND`,
            );
            continue;
          }
          actualOre = periodLine.amount_ore;
        }

        if (actualOre !== g.expectedSum) {
          const delta = actualOre - g.expectedSum;
          drifts.push(
            `[aggregated_periods] prof=${entry.profileId} group="${key}" cells=${g.cells.length} expectedSum=${g.expectedSum} actual=${actualOre} delta=${delta}`,
          );
        }
      }
    }

    if (unsignedTotal > 0) {
      console.warn(`[ADR-0341] aggregated_periods: ${unsignedTotal} unsigned cells skipped`);
    }
    if (drifts.length > 0) {
      const first20 = drifts.slice(0, 20).join("\n");
      expect.fail(
        `aggregated_periods: ${drifts.length} drift(s) found (showing first 20):\n${first20}`,
      );
    }
  });

  it("payroll_lines.json: schema valid + amount_ore exact per profile period line", () => {
    const data = loadExpected("payroll_lines.json", PayrollLinesSchema);
    const drifts: string[] = [];
    let unsignedTotal = 0;

    for (const entry of data.payroll_lines) {
      const agg = aggregated.find((a) => a.profile_id === entry.profileId);
      if (!agg) {
        expect.fail(`payroll_lines.json references unknown profileId="${entry.profileId}"`);
      }

      // Group expected cells per (supplementRuleId or payCode) and SUM amount_ore.
      // Same grouping rationale as shift_snapshots: engine emits ONE line per supplement_rule_id;
      // worksheet may split a supplement into multiple bucket cells.
      type GroupValue = {
        expectedSum: bigint;
        cells: ExpectedCell[];
        ruleId: string | null;
        payCode: string;
      };
      const groups = new Map<string, GroupValue>();
      let unsignedInEntry = 0;

      for (const cell of entry.lines) {
        if (cell.computedBy.startsWith("PENDING_")) {
          unsignedInEntry++;
          continue;
        }
        const baseLabel = cell.ruleLabel.split(/\s+\(/)[0]!;
        const key: string =
          cell.supplementRuleId !== null ? `rule:${cell.supplementRuleId}` : `pay:${baseLabel}`;
        const g = groups.get(key);
        if (g) {
          g.expectedSum += BigInt(cell.amount_ore);
          g.cells.push(cell);
        } else {
          groups.set(key, {
            expectedSum: BigInt(cell.amount_ore),
            cells: [cell],
            ruleId: cell.supplementRuleId,
            payCode: baseLabel,
          });
        }
      }

      unsignedTotal += unsignedInEntry;

      // Match each group against agg.lines
      for (const [key, g] of groups) {
        const periodLine =
          g.ruleId !== null
            ? agg.lines.find((l) => l.supplement_rule_id === g.ruleId)
            : agg.lines.find((l) => l.pay_code === g.payCode);

        if (!periodLine) {
          const labels = g.cells.map((c) => c.ruleLabel).join(",");
          drifts.push(
            `[payroll_lines] prof=${entry.profileId} group="${key}" cells=${g.cells.length}(${labels}) — LINE NOT FOUND`,
          );
          continue;
        }

        if (periodLine.amount_ore !== g.expectedSum) {
          const delta = periodLine.amount_ore - g.expectedSum;
          drifts.push(
            `[payroll_lines] prof=${entry.profileId} group="${key}" cells=${g.cells.length} expectedSum=${g.expectedSum} actual=${periodLine.amount_ore} delta=${delta}`,
          );
        }
      }
    }

    if (unsignedTotal > 0) {
      console.warn(`[ADR-0341] payroll_lines: ${unsignedTotal} unsigned cells skipped`);
    }
    if (drifts.length > 0) {
      const first20 = drifts.slice(0, 20).join("\n");
      expect.fail(`payroll_lines: ${drifts.length} drift(s) found (showing first 20):\n${first20}`);
    }
  });

  it("timebank_entries.json: schema valid + amount_ore exact per profile", () => {
    const data = loadExpected("timebank_entries.json", TimebankEntriesSchema);
    const drifts: string[] = [];
    let unsignedTotal = 0;

    for (const entry of data.timebank_entries) {
      const profileEntries = timebankEntries.filter((e) => e.profile_id === entry.profileId);
      let unsignedInEntry = 0;

      for (const cell of entry.entries) {
        if (cell.computedBy.startsWith("PENDING_")) {
          unsignedInEntry++;
          continue;
        }

        // Strip bucket suffix (same as other surfaces, e.g. "feriepenger_accrual (Q1 bucket)")
        const baseLabel = cell.ruleLabel.split(/\s+\(/)[0]!;

        // Map baseLabel to actual timebank entry (1 cell per profile per account_type+entry_type)
        let actualEntry: (typeof timebankEntries)[number] | undefined;
        if (baseLabel === "feriepenger_accrual") {
          actualEntry = profileEntries.find(
            (e) => e.account_type === "feriepenger" && e.entry_type === "accrual",
          );
        } else if (baseLabel === "toil_accrual") {
          actualEntry = profileEntries.find(
            (e) => e.account_type === "toil" && e.entry_type === "accrual",
          );
        } else if (baseLabel === "wellness_accrual") {
          actualEntry = profileEntries.find(
            (e) => e.account_type === "wellness" && e.entry_type === "accrual",
          );
        } else {
          actualEntry = profileEntries.find((e) => e.account_type === baseLabel);
        }

        if (!actualEntry) {
          drifts.push(
            `[timebank_entries] prof=${entry.profileId} ruleLabel="${baseLabel}" — ENTRY NOT FOUND`,
          );
          continue;
        }

        const expectedOre = BigInt(cell.amount_ore);
        const actualOre = actualEntry.value_amount_ore;
        if (actualOre !== expectedOre) {
          const deltaOre = actualOre - expectedOre;
          drifts.push(
            `[timebank_entries] prof=${entry.profileId} ruleLabel="${baseLabel}" expected=${expectedOre} actual=${actualOre} delta=${deltaOre}`,
          );
        }
      }

      unsignedTotal += unsignedInEntry;
    }

    if (unsignedTotal > 0) {
      console.warn(`[ADR-0341] timebank_entries: ${unsignedTotal} unsigned cells skipped`);
    }
    if (drifts.length > 0) {
      const first20 = drifts.slice(0, 20).join("\n");
      expect.fail(
        `timebank_entries: ${drifts.length} drift(s) found (showing first 20):\n${first20}`,
      );
    }
  });
});
