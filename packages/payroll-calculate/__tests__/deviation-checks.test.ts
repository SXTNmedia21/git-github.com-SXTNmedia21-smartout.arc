import { describe, it, expect } from "vitest";
import { runDeviationChecks } from "../src/deviation-checks.js";
import type {
  AggregatedPeriod,
  InterpretedShift,
  WorkspaceSettings,
  RegulatoryFrameworkInput,
  PayrollProfile,
  TariffRateInput,
} from "../src/types.js";

const FRAMEWORK: RegulatoryFrameworkInput = {
  min_rest_hours_between_shifts: 11,
  max_daily_hours: 9,
  max_weekly_hours: 40,
  max_weekly_ot_hours: 10,
  forced_break_threshold_minutes: 330,
};

const SETTINGS: WorkspaceSettings = {
  workspace_id: "ws-test",
  is_tariff_bound: true,
  supplement_stacking_policy: "category_exclusive",
  overtime_requires_pre_approval: false,
  overtime_warn_threshold_minutes: 30,
  punch_rounding_minutes: 0,
  punch_rounding_direction: "toward_employee",
  punch_rounding_snap_window_minutes: 10,
  punch_window_early_minutes: 15,
  punch_window_late_minutes: 30,
  punch_grace_after_scheduled_minutes: 60,
  forced_break_reminder_minutes: 300,
  toil_default_max_banked_hours: 80,
  wellness_days_per_year_default: 0,
  split_shift_threshold_minutes: 0,
  split_shift_allowance_amount: 0,
  vacation_pay_pct: 12.0,
  period_type: "monthly",
};

const PROFILE: PayrollProfile = {
  id: "pp-001",
  profile_id: "prof-001",
  workspace_id: "ws-test",
  salary_type: "hourly",
  agreed_weekly_hours: 37.5,
  holiday_allowance_pct: 12.0,
  overtime_mode: "paid_out",
  toil_agreement_signed_at: null,
  toil_max_banked_hours: null,
  seniority_start_date: "2022-01-01",
  tariff_category: "voksen_ufaglart",
  has_fagbrev: false,
  sector_experience_years: 4,
};

const TARIFF_RATES: TariffRateInput[] = [
  {
    id: "trt-min-001",
    workspace_id: null,
    rate_type: "minstelonn_begynner",
    amount: 195.0,
    unit: "kr/t",
    source: "riksavtalen",
    law_version: "2025",
    effective_from: "2025-04-01",
    effective_until: null,
    paragraf_ref: "Riksavtalen §3",
    seniority_level: "begynner",
    role_class: "voksen_ufaglart",
  },
];

function makeShift(overrides: Partial<InterpretedShift>): InterpretedShift {
  return {
    shift_id: "sh-001",
    profile_id: "prof-001",
    workspace_id: "ws-test",
    effective_start: "2026-04-07T06:00:00Z",
    effective_end: "2026-04-07T14:00:00Z",
    scheduled_break_minutes: 30,
    paid_break_minutes: 0,
    unpaid_break_minutes: 30,
    gross_minutes: 480,
    worked_minutes: 450,
    buckets: [],
    fired_supplements: [],
    night_worker_category: null,
    ...overrides,
  };
}

function makeAggregated(profileId: string, totalOre: bigint, grossOre: bigint): AggregatedPeriod {
  return {
    period_id: "period-001",
    profile_id: profileId,
    workspace_id: "ws-test",
    gross_amount_ore: grossOre,
    tips_amount_ore: 0n,
    manual_supplement_ore: 0n,
    total_ore: totalOre,
    lines: [
      {
        pay_code: "base_hourly",
        description: "Base",
        hours: Number(grossOre) / 100 / 200,
        amount_ore: grossOre,
        shift_ids: ["sh-001"],
        supplement_rule_id: null,
      },
    ],
    shift_ids: ["sh-001"],
  };
}

const profileMap = new Map<string, PayrollProfile>([["prof-001", PROFILE]]);

describe("W01 — hviletid violation", () => {
  it("fires W01 ERROR when rest < 11h between shifts", () => {
    const shift1 = makeShift({
      shift_id: "sh-001",
      effective_start: "2026-04-07T06:00:00Z",
      effective_end: "2026-04-07T14:00:00Z",
    });
    const shift2 = makeShift({
      shift_id: "sh-002",
      effective_start: "2026-04-07T23:00:00Z",
      effective_end: "2026-04-08T07:00:00Z",
    }); // 9h gap
    const deviations = runDeviationChecks({
      aggregated: [],
      shifts: [shift1, shift2],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    const w01 = deviations.filter((d) => d.check_id === "W01");
    expect(w01.length).toBe(1);
    expect(w01[0]!.severity).toBe("error");
  });

  it("does NOT fire W01 when rest >= 11h", () => {
    const shift1 = makeShift({
      shift_id: "sh-001",
      effective_start: "2026-04-07T06:00:00Z",
      effective_end: "2026-04-07T14:00:00Z",
    });
    const shift2 = makeShift({
      shift_id: "sh-002",
      effective_start: "2026-04-08T01:30:00Z",
      effective_end: "2026-04-08T09:30:00Z",
    }); // 11.5h gap
    const deviations = runDeviationChecks({
      aggregated: [],
      shifts: [shift1, shift2],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    const w01 = deviations.filter((d) => d.check_id === "W01");
    expect(w01.length).toBe(0);
  });
});

describe("W02 — daily OT cap", () => {
  it("fires W02 WARNING when shift > 9h worked", () => {
    const shift = makeShift({ worked_minutes: 570 }); // 9.5h
    const deviations = runDeviationChecks({
      aggregated: [],
      shifts: [shift],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    const w02 = deviations.filter((d) => d.check_id === "W02");
    expect(w02.length).toBe(1);
    expect(w02[0]!.severity).toBe("warning");
  });

  it("does NOT fire W02 for exactly 9h", () => {
    const shift = makeShift({ worked_minutes: 540 }); // exactly 9h
    const deviations = runDeviationChecks({
      aggregated: [],
      shifts: [shift],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    expect(deviations.filter((d) => d.check_id === "W02").length).toBe(0);
  });
});

describe("W07 — deduction blocked", () => {
  it("fires W07 ERROR when total_ore < 0", () => {
    const agg = makeAggregated("prof-001", -100n, 100000n);
    const deviations = runDeviationChecks({
      aggregated: [agg],
      shifts: [],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    const w07 = deviations.filter((d) => d.check_id === "W07");
    expect(w07.length).toBe(1);
    expect(w07[0]!.severity).toBe("error");
  });

  it("does NOT fire W07 for positive total", () => {
    const agg = makeAggregated("prof-001", 100000n, 100000n);
    const deviations = runDeviationChecks({
      aggregated: [agg],
      shifts: [],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    expect(deviations.filter((d) => d.check_id === "W07").length).toBe(0);
  });
});

describe("W09 — OT pre-approval", () => {
  it("fires W09 when overtime_requires_pre_approval=true and shift has OT", () => {
    const settingsOT = { ...SETTINGS, overtime_requires_pre_approval: true };
    const shift = makeShift({ worked_minutes: 570 }); // > 9h
    const deviations = runDeviationChecks({
      aggregated: [],
      shifts: [shift],
      workspaceSettings: settingsOT,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    const w09 = deviations.filter((d) => d.check_id === "W09");
    expect(w09.length).toBe(1);
    expect(w09[0]!.severity).toBe("warning");
  });

  it("does NOT fire W09 when shift is pre-approved", () => {
    const settingsOT = { ...SETTINGS, overtime_requires_pre_approval: true };
    const shift = makeShift({ worked_minutes: 570 });
    const approved = new Set(["sh-001"]);
    const deviations = runDeviationChecks({
      aggregated: [],
      shifts: [shift],
      workspaceSettings: settingsOT,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
      preApprovedShiftIds: approved,
    });
    expect(deviations.filter((d) => d.check_id === "W09").length).toBe(0);
  });

  it("does NOT fire W09 when overtime_requires_pre_approval=false", () => {
    const shift = makeShift({ worked_minutes: 570 });
    const deviations = runDeviationChecks({
      aggregated: [],
      shifts: [shift],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    expect(deviations.filter((d) => d.check_id === "W09").length).toBe(0);
  });
});

describe("W13 — minstelønn check", () => {
  it("fires W13 ERROR for tariff-bound workspace when effective rate < minstelønn", () => {
    // Employee "begynner", effective rate = 100 NOK/h (below 195 minstelønn)
    // gross = 100 NOK/h * worked_hours = need to compute
    // Agg with 450 worked minutes (7.5h), 100 NOK/h gross = 750 NOK = 75000 øre
    const newProfile = { ...PROFILE, seniority_start_date: "2025-01-01" }; // begynner
    const profMap = new Map<string, PayrollProfile>([["prof-001", newProfile]]);
    const agg: AggregatedPeriod = {
      period_id: "period-001",
      profile_id: "prof-001",
      workspace_id: "ws-test",
      gross_amount_ore: 75000n, // 750 NOK
      tips_amount_ore: 0n,
      manual_supplement_ore: 0n,
      total_ore: 75000n,
      lines: [
        {
          pay_code: "base_hourly",
          description: "Base",
          hours: 7.5,
          amount_ore: 75000n,
          shift_ids: ["sh-001"],
          supplement_rule_id: null,
        },
      ],
      shift_ids: ["sh-001"],
    };
    const deviations = runDeviationChecks({
      aggregated: [agg],
      shifts: [],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profMap,
      tariffRates: TARIFF_RATES,
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    const w13 = deviations.filter((d) => d.check_id === "W13");
    expect(w13.length).toBe(1);
    expect(w13[0]!.severity).toBe("error");
  });

  it("fires W13 WARNING for non-tariff-bound workspace", () => {
    const unboundSettings = { ...SETTINGS, is_tariff_bound: false };
    const newProfile = { ...PROFILE, seniority_start_date: "2025-01-01" }; // begynner
    const profMap = new Map<string, PayrollProfile>([["prof-001", newProfile]]);
    const agg: AggregatedPeriod = {
      period_id: "period-001",
      profile_id: "prof-001",
      workspace_id: "ws-test",
      gross_amount_ore: 75000n, // 750 NOK / 7.5h = 100 NOK/h < 195 minstelønn
      tips_amount_ore: 0n,
      manual_supplement_ore: 0n,
      total_ore: 75000n,
      lines: [
        {
          pay_code: "base_hourly",
          description: "Base",
          hours: 7.5,
          amount_ore: 75000n,
          shift_ids: ["sh-001"],
          supplement_rule_id: null,
        },
      ],
      shift_ids: ["sh-001"],
    };
    const deviations = runDeviationChecks({
      aggregated: [agg],
      shifts: [],
      workspaceSettings: unboundSettings,
      framework: FRAMEWORK,
      profilesByProfileId: profMap,
      tariffRates: TARIFF_RATES,
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    const w13 = deviations.filter((d) => d.check_id === "W13");
    expect(w13.length).toBe(1);
    expect(w13[0]!.severity).toBe("warning");
  });

  it("does NOT fire W13 when effective rate >= minstelønn", () => {
    const newProfile = { ...PROFILE, seniority_start_date: "2025-01-01" }; // begynner, minstelønn=195
    const profMap = new Map<string, PayrollProfile>([["prof-001", newProfile]]);
    const agg: AggregatedPeriod = {
      period_id: "period-001",
      profile_id: "prof-001",
      workspace_id: "ws-test",
      gross_amount_ore: 195000n, // 1950 NOK / 7.5h = 260 NOK/h > 195
      tips_amount_ore: 0n,
      manual_supplement_ore: 0n,
      total_ore: 195000n,
      lines: [
        {
          pay_code: "base_hourly",
          description: "Base",
          hours: 7.5,
          amount_ore: 195000n,
          shift_ids: ["sh-001"],
          supplement_rule_id: null,
        },
      ],
      shift_ids: ["sh-001"],
    };
    const deviations = runDeviationChecks({
      aggregated: [agg],
      shifts: [],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profMap,
      tariffRates: TARIFF_RATES,
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    expect(deviations.filter((d) => d.check_id === "W13").length).toBe(0);
  });
});

describe("W14 — 90%-bedrift", () => {
  it("fires W14 INFO when industryAveragePct < 90 and is_tariff_bound=true", () => {
    const agg = makeAggregated("prof-001", 100000n, 100000n);
    const deviations = runDeviationChecks({
      aggregated: [agg],
      shifts: [],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
      industryAveragePct: 85,
    });
    const w14 = deviations.filter((d) => d.check_id === "W14");
    expect(w14.length).toBe(1);
    expect(w14[0]!.severity).toBe("info");
  });

  it("does NOT fire W14 when industryAveragePct >= 90", () => {
    const agg = makeAggregated("prof-001", 100000n, 100000n);
    const deviations = runDeviationChecks({
      aggregated: [agg],
      shifts: [],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
      industryAveragePct: 92,
    });
    expect(deviations.filter((d) => d.check_id === "W14").length).toBe(0);
  });

  it("does NOT fire W14 when is_tariff_bound=false", () => {
    const unboundSettings = { ...SETTINGS, is_tariff_bound: false };
    const agg = makeAggregated("prof-001", 100000n, 100000n);
    const deviations = runDeviationChecks({
      aggregated: [agg],
      shifts: [],
      workspaceSettings: unboundSettings,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
      industryAveragePct: 85,
    });
    expect(deviations.filter((d) => d.check_id === "W14").length).toBe(0);
  });
});

describe("W10 — forced break reminder", () => {
  it("fires W10 INFO when shift > threshold with no breaks", () => {
    const shift = makeShift({ worked_minutes: 360, scheduled_break_minutes: 0 });
    const deviations = runDeviationChecks({
      aggregated: [],
      shifts: [shift],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    const w10 = deviations.filter((d) => d.check_id === "W10");
    expect(w10.length).toBe(1);
    expect(w10[0]!.severity).toBe("info");
  });

  it("does NOT fire W10 when break is recorded", () => {
    const shift = makeShift({ worked_minutes: 450, scheduled_break_minutes: 30 });
    const deviations = runDeviationChecks({
      aggregated: [],
      shifts: [shift],
      workspaceSettings: SETTINGS,
      framework: FRAMEWORK,
      profilesByProfileId: profileMap,
      tariffRates: [],
      periodStartDate: "2026-04-01",
      evaluationYear: 2026,
    });
    expect(deviations.filter((d) => d.check_id === "W10").length).toBe(0);
  });
});
