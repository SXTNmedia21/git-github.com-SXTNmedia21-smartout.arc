import { describe, it, expect } from "vitest";
import { evaluateSupplements } from "../src/evaluate-supplements.js";
import { applyStackingPolicy } from "../src/stacking.js";
import type {
  TimeBucket,
  ShiftInput,
  SupplementRuleInput,
  TariffRateInput,
  WorkspaceSettings,
} from "../src/types.js";
import { oreToNok } from "../src/cents.js";

const BASE_SETTINGS: WorkspaceSettings = {
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

const BASE_SHIFT: ShiftInput = {
  shift_id: "sh-test",
  profile_id: "prof-test",
  workspace_id: "ws-test",
  start_time: "2026-04-07T19:00:00Z",
  end_time: "2026-04-07T23:00:00Z",
  scheduled_start: "2026-04-07T19:00:00Z",
  scheduled_end: "2026-04-07T23:00:00Z",
  scheduled_break_minutes: 0,
  shift_date: "2026-04-07",
  night_worker_category: null,
  custom_rate: null,
  custom_rate_type: null,
};

/** Create a bucket with oslo-correct classification */
function makeBucket(opts: {
  from: string;
  minutes: number;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  classification: TimeBucket["classification"];
}): TimeBucket {
  const toMs = new Date(opts.from).getTime() + opts.minutes * 60_000;
  return {
    from: opts.from,
    to: new Date(toMs).toISOString(),
    minutes: opts.minutes,
    weekday: opts.weekday,
    classification: opts.classification,
  };
}

const KVELDS_RULE: SupplementRuleInput = {
  id: "rule-kveldstiilegg-001",
  workspace_id: null,
  is_active: true,
  supplement_type: "normal",
  rate_type: "fixed_per_hour",
  rate_value: 42.41,
  tariff_rate_table_id: "trt-supp-001",
  match_predicate: {
    windows: [{ weekdays: [1, 2, 3, 4, 5, 6, 7], time_from: "21:00", time_to: "23:59" }],
  },
  paragraf_ref: "Riksavtalen §6",
  version_hash: "v2025-001",
  valid_from: "2025-04-01",
  valid_until: null,
};

const NATT_NATTVAKT_RULE: SupplementRuleInput = {
  id: "rule-natt-nattvakt-001",
  workspace_id: null,
  is_active: true,
  supplement_type: "normal",
  rate_type: "fixed_per_hour",
  rate_value: 42.41,
  tariff_rate_table_id: "trt-supp-002",
  match_predicate: {
    windows: [{ weekdays: [1, 2, 3, 4, 5, 6, 7], time_from: "00:00", time_to: "06:00" }],
    night_worker_category: "night_watch",
  },
  paragraf_ref: "Riksavtalen §6",
  version_hash: "v2025-002",
  valid_from: "2025-04-01",
  valid_until: null,
};

const HELGE_RULE: SupplementRuleInput = {
  id: "rule-helgetillegg-001",
  workspace_id: null,
  is_active: true,
  supplement_type: "week_based",
  rate_type: "fixed_per_hour",
  rate_value: 56.02,
  tariff_rate_table_id: "trt-supp-005",
  match_predicate: {
    windows: [{ weekdays: [6, 7], time_from: "00:00", time_to: "23:59" }],
  },
  paragraf_ref: "Riksavtalen §6",
  version_hash: "v2025-005",
  valid_from: "2025-04-01",
  valid_until: null,
};

const TARIFF_RATES: TariffRateInput[] = [
  {
    id: "trt-supp-001",
    workspace_id: null,
    rate_type: "kveldstillegg",
    amount: 42.41,
    unit: "kr/t",
    source: "riksavtalen",
    law_version: "2025",
    effective_from: "2025-04-01",
    effective_until: null,
    paragraf_ref: "Riksavtalen §6",
    seniority_level: null,
    role_class: null,
  },
  {
    id: "trt-supp-002",
    workspace_id: null,
    rate_type: "nattillegg_nattvakt",
    amount: 42.41,
    unit: "kr/t",
    source: "riksavtalen",
    law_version: "2025",
    effective_from: "2025-04-01",
    effective_until: null,
    paragraf_ref: "Riksavtalen §6",
    seniority_level: null,
    role_class: null,
  },
  {
    id: "trt-supp-005",
    workspace_id: null,
    rate_type: "helgetillegg",
    amount: 56.02,
    unit: "kr/t",
    source: "riksavtalen",
    law_version: "2025",
    effective_from: "2025-04-01",
    effective_until: null,
    paragraf_ref: "Riksavtalen §6",
    seniority_level: null,
    role_class: null,
  },
];

describe("evaluateSupplements", () => {
  it("fires kveldstillegg for evening bucket (Tue 21:00-23:00 Oslo = 19:00-21:00 UTC)", () => {
    // 21:00-23:00 Oslo = 19:00-21:00 UTC in CEST (UTC+2)
    // The window in predicate is 21:00-23:59 Oslo wall time
    // Our bucket is tagged with Oslo-local classifications
    // We need a bucket whose oslo-local time falls in 21:00-23:59
    // 2026-04-07T19:00:00Z = 21:00 CEST = 21:00 Oslo
    const bucket = makeBucket({
      from: "2026-04-07T19:00:00Z", // 21:00 Oslo
      minutes: 120, // 2h
      weekday: 2, // Tuesday
      classification: "evening",
    });
    const fired = evaluateSupplements(
      bucket,
      BASE_SHIFT,
      [KVELDS_RULE],
      TARIFF_RATES,
      BASE_SETTINGS,
      200,
    );
    expect(fired.length).toBe(1);
    expect(fired[0]!.rule_id).toBe("rule-kveldstiilegg-001");
    expect(fired[0]!.amount_ore).toBeGreaterThan(0n);
    // 42.41 kr/t * 2h = 84.82 NOK = 8482 øre. Rounding: 42.41*100/60 = 70 øre/min * 120 = 8400 øre
    // Note: floor division 4241/60 = 70, so 70 * 120 = 8400 øre = 84.00 NOK
    expect(fired[0]!.amount_ore).toBe(8400n);
  });

  it("fires nattillegg for night_watch bucket", () => {
    // 00:00-06:00 Oslo = 22:00-04:00 UTC in CEST
    // 2026-04-07T22:00:00Z = 00:00 Oslo Apr 8
    const bucket = makeBucket({
      from: "2026-04-07T22:00:00Z", // 00:00 Oslo
      minutes: 360, // 6h
      weekday: 3, // Wednesday (Oslo day Apr 8)
      classification: "night",
    });
    const shiftWithNight = { ...BASE_SHIFT, night_worker_category: "night_watch" as const };
    const fired = evaluateSupplements(
      bucket,
      shiftWithNight,
      [NATT_NATTVAKT_RULE],
      TARIFF_RATES,
      BASE_SETTINGS,
      200,
    );
    expect(fired.length).toBe(1);
    expect(fired[0]!.rule_id).toBe("rule-natt-nattvakt-001");
    // 42.41 kr/t for 6h: 70 øre/min * 360 = 25200 øre
    expect(fired[0]!.amount_ore).toBe(25200n);
  });

  it("does NOT fire nattillegg when night_worker_category does not match", () => {
    const bucket = makeBucket({
      from: "2026-04-07T22:00:00Z",
      minutes: 360,
      weekday: 3,
      classification: "night",
    });
    // Shift has category "manual" but rule requires "night_watch"
    const shiftManual = { ...BASE_SHIFT, night_worker_category: "manual" as const };
    const fired = evaluateSupplements(
      bucket,
      shiftManual,
      [NATT_NATTVAKT_RULE],
      TARIFF_RATES,
      BASE_SETTINGS,
      200,
    );
    expect(fired.length).toBe(0);
  });

  it("fires helgetillegg on Saturday bucket", () => {
    // Saturday 08:00-14:00 Oslo
    const bucket = makeBucket({
      from: "2026-04-11T06:00:00Z", // 08:00 Oslo
      minutes: 360,
      weekday: 6, // Saturday
      classification: "weekend_sat",
    });
    const fired = evaluateSupplements(
      bucket,
      BASE_SHIFT,
      [HELGE_RULE],
      TARIFF_RATES,
      BASE_SETTINGS,
      200,
    );
    expect(fired.length).toBe(1);
    // 56.02 kr/t: 5602/60 = 93 øre/min (floor) * 360 = 33480 øre
    expect(fired[0]!.amount_ore).toBe(33480n);
  });

  it("does NOT fire helgetillegg on Tuesday bucket", () => {
    const bucket = makeBucket({
      from: "2026-04-07T06:00:00Z", // Tuesday
      minutes: 360,
      weekday: 2,
      classification: "day_normal",
    });
    const fired = evaluateSupplements(
      bucket,
      BASE_SHIFT,
      [HELGE_RULE],
      TARIFF_RATES,
      BASE_SETTINGS,
      200,
    );
    expect(fired.length).toBe(0);
  });

  it("returns empty for no rules", () => {
    const bucket = makeBucket({
      from: "2026-04-07T19:00:00Z",
      minutes: 120,
      weekday: 2,
      classification: "evening",
    });
    const fired = evaluateSupplements(bucket, BASE_SHIFT, [], TARIFF_RATES, BASE_SETTINGS, 200);
    expect(fired.length).toBe(0);
  });

  it("skips inactive rules", () => {
    const inactiveRule = { ...KVELDS_RULE, is_active: false };
    const bucket = makeBucket({
      from: "2026-04-07T19:00:00Z",
      minutes: 120,
      weekday: 2,
      classification: "evening",
    });
    const fired = evaluateSupplements(
      bucket,
      BASE_SHIFT,
      [inactiveRule],
      TARIFF_RATES,
      BASE_SETTINGS,
      200,
    );
    expect(fired.length).toBe(0);
  });

  it("falls back to rule.rate_value when tariff ID not found", () => {
    const ruleMissingTariff = { ...KVELDS_RULE, tariff_rate_table_id: "non-existent-id" };
    const bucket = makeBucket({
      from: "2026-04-07T19:00:00Z",
      minutes: 60,
      weekday: 2,
      classification: "evening",
    });
    const fired = evaluateSupplements(
      bucket,
      BASE_SHIFT,
      [ruleMissingTariff],
      [],
      BASE_SETTINGS,
      200,
    );
    expect(fired.length).toBe(1);
    expect(fired[0]!.provenance.rate_source).toBe("rule_fallback");
  });

  it("marks applies_only_if_bound when workspace is not tariff bound", () => {
    const unboundSettings = { ...BASE_SETTINGS, is_tariff_bound: false };
    const bucket = makeBucket({
      from: "2026-04-07T19:00:00Z",
      minutes: 60,
      weekday: 2,
      classification: "evening",
    });
    const fired = evaluateSupplements(
      bucket,
      BASE_SHIFT,
      [KVELDS_RULE],
      TARIFF_RATES,
      unboundSettings,
      200,
    );
    expect(fired.length).toBe(1);
    expect(fired[0]!.provenance.applies_only_if_bound).toBe(true);
  });
});

describe("applyStackingPolicy", () => {
  const makeFireds = () => [
    {
      rule_id: "r1",
      supplement_type: "normal",
      rate_type: "fixed_per_hour",
      tariff_rate_table_id: null,
      rate_value_nok: 42.41,
      amount_ore: 4241n,
      quantity_minutes: 60,
      provenance: { rate_source: "rule_fallback" as const },
    },
    {
      rule_id: "r2",
      supplement_type: "normal",
      rate_type: "fixed_per_hour",
      tariff_rate_table_id: null,
      rate_value_nok: 56.02,
      amount_ore: 5602n,
      quantity_minutes: 60,
      provenance: { rate_source: "rule_fallback" as const },
    },
    {
      rule_id: "r3",
      supplement_type: "holiday",
      rate_type: "fixed_per_hour",
      tariff_rate_table_id: null,
      rate_value_nok: 100.0,
      amount_ore: 10000n,
      quantity_minutes: 60,
      provenance: { rate_source: "rule_fallback" as const },
    },
  ];

  it("all_stack: retains all supplements", () => {
    const result = applyStackingPolicy(makeFireds(), "all_stack");
    expect(result.length).toBe(3);
  });

  it("highest_only: retains only highest amount", () => {
    const result = applyStackingPolicy(makeFireds(), "highest_only");
    expect(result.length).toBe(1);
    expect(result[0]!.rule_id).toBe("r3"); // 10000 øre is highest
  });

  it("category_exclusive: highest per supplement_type", () => {
    const result = applyStackingPolicy(makeFireds(), "category_exclusive");
    expect(result.length).toBe(2); // r2 wins over r1 (both 'normal'), r3 is 'holiday'
    const types = result.map((r) => r.supplement_type).sort();
    expect(types).toEqual(["holiday", "normal"]);
    const normalSup = result.find((r) => r.supplement_type === "normal");
    expect(normalSup!.rule_id).toBe("r2"); // 5602 > 4241
  });

  it("returns empty for empty input", () => {
    expect(applyStackingPolicy([], "all_stack")).toEqual([]);
    expect(applyStackingPolicy([], "highest_only")).toEqual([]);
    expect(applyStackingPolicy([], "category_exclusive")).toEqual([]);
  });
});
