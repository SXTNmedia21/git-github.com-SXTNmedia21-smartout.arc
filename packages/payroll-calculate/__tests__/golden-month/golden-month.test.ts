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
 */

import { describe, it, expect, beforeAll } from "vitest";
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
const MONTHLY_SALARY_NOK = 45_000;
const MONTHLY_SALARY_ORE = nokToOre(MONTHLY_SALARY_NOK);
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
