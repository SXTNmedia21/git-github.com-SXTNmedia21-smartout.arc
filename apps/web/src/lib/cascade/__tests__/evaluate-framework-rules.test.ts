import { describe, it, expect } from "vitest";
import { evaluateFrameworkRules } from "../evaluate-framework-rules";
import type { EntityContext, FrameworkRuleRow, WorkspaceRuleOverrideRow } from "../types";

function makeRule(overrides: Partial<FrameworkRuleRow> = {}): FrameworkRuleRow {
  return {
    ruleId: "rule-1",
    code: "test_rule",
    ruleType: "gate",
    category: "working_hours",
    description: "Test rule",
    defaultOutcome: "blocked",
    severity: "hard_block",
    outcomeOverridable: false,
    evaluationConfig: {},
    sourceReference: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<EntityContext> = {}): EntityContext {
  return {
    date: "2026-03-22",
    ...overrides,
  };
}

describe("evaluateFrameworkRules", () => {
  it("returns allowed with no hits when no rules provided", () => {
    const result = evaluateFrameworkRules(makeContext(), [], []);
    expect(result.outcome).toBe("allowed");
    expect(result.hits).toHaveLength(0);
    expect(result.worstHit).toBeNull();
  });

  it("blocks when daily hours exceed maximum", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "max-daily",
        code: "max_daily_hours",
        description: "Maximum 9 hours daily",
        evaluationConfig: { threshold_hours: 9, check: "daily_hours" },
      }),
    ];

    const result = evaluateFrameworkRules(makeContext({ dailyHoursWorked: 10 }), rules, []);

    expect(result.outcome).toBe("blocked");
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].ruleId).toBe("max-daily");
  });

  it("allows when daily hours within limit", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "max-daily",
        code: "max_daily_hours",
        evaluationConfig: { threshold_hours: 9, check: "daily_hours" },
      }),
    ];

    const result = evaluateFrameworkRules(makeContext({ dailyHoursWorked: 8 }), rules, []);

    expect(result.outcome).toBe("allowed");
    expect(result.hits).toHaveLength(0);
  });

  it("blocks when weekly hours exceed maximum", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "max-weekly",
        code: "max_weekly_hours",
        evaluationConfig: { threshold_hours: 40, check: "weekly_hours" },
      }),
    ];

    const result = evaluateFrameworkRules(makeContext({ weeklyHoursWorked: 42 }), rules, []);

    expect(result.outcome).toBe("blocked");
    expect(result.hits).toHaveLength(1);
  });

  it("blocks when rest period is insufficient", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "min-rest",
        code: "min_rest_between_shifts",
        evaluationConfig: { threshold_hours: 11, check: "gap_between_shifts" },
      }),
    ];

    const now = new Date("2026-03-22T14:00:00Z");
    const lastEnd = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString();

    const result = evaluateFrameworkRules(
      makeContext({ lastShiftEnd: lastEnd, date: "2026-03-22" }),
      rules,
      [],
    );

    expect(result.outcome).toBe("blocked");
  });

  it("allows when rest period is sufficient", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "min-rest",
        code: "min_rest_between_shifts",
        evaluationConfig: { threshold_hours: 11, check: "gap_between_shifts" },
      }),
    ];

    // Last shift ended at 12:00 on March 21 — 12h before March 22 00:00
    const result = evaluateFrameworkRules(
      makeContext({ lastShiftEnd: "2026-03-21T12:00:00Z", date: "2026-03-22" }),
      rules,
      [],
    );

    expect(result.outcome).toBe("allowed");
  });

  it("blocks under-18 night work", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "under18-night",
        code: "under18_no_night",
        evaluationConfig: {
          max_age: 17,
          restricted_start: "21:00",
          restricted_end: "06:00",
          check: "night_work_age",
        },
      }),
    ];

    const result = evaluateFrameworkRules(makeContext({ employeeAge: 16 }), rules, []);

    expect(result.outcome).toBe("blocked");
    expect(result.hits[0].ruleId).toBe("under18-night");
  });

  it("allows night work for adults", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "under18-night",
        code: "under18_no_night",
        evaluationConfig: {
          max_age: 17,
          check: "night_work_age",
        },
      }),
    ];

    const result = evaluateFrameworkRules(makeContext({ employeeAge: 22 }), rules, []);

    expect(result.outcome).toBe("allowed");
  });

  it("blocks under-18 exceeding daily hours", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "under18-daily",
        code: "under18_max_daily",
        evaluationConfig: {
          max_age: 17,
          threshold_hours: 8,
          check: "daily_hours_age",
        },
      }),
    ];

    const result = evaluateFrameworkRules(
      makeContext({ employeeAge: 16, dailyHoursWorked: 9 }),
      rules,
      [],
    );

    expect(result.outcome).toBe("blocked");
  });

  it("worst outcome wins when multiple rules trigger", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "rule-advisory",
        code: "advisory_rule",
        ruleType: "advisory",
        defaultOutcome: "allowed_with_exception",
        evaluationConfig: { threshold_hours: 9, check: "daily_hours" },
      }),
      makeRule({
        ruleId: "rule-gate",
        code: "gate_rule",
        ruleType: "gate",
        defaultOutcome: "blocked",
        evaluationConfig: { threshold_hours: 40, check: "weekly_hours" },
      }),
    ];

    const result = evaluateFrameworkRules(
      makeContext({ dailyHoursWorked: 10, weeklyHoursWorked: 42 }),
      rules,
      [],
    );

    expect(result.outcome).toBe("blocked");
    expect(result.hits).toHaveLength(2);
    expect(result.worstHit?.ruleId).toBe("rule-gate");
  });

  it("workspace override loosens a rule outcome", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "overtime-rule",
        code: "overtime_requires_agreement",
        defaultOutcome: "review_required",
        outcomeOverridable: true,
        evaluationConfig: { threshold_hours: 9, check: "daily_hours" },
      }),
    ];

    const overrides: WorkspaceRuleOverrideRow[] = [
      {
        overrideId: "override-1",
        ruleId: "overtime-rule",
        overrideOutcome: "allowed_with_exception",
        overrideConfig: {},
        validFrom: null,
        validUntil: null,
      },
    ];

    const result = evaluateFrameworkRules(makeContext({ dailyHoursWorked: 10 }), rules, overrides);

    expect(result.outcome).toBe("allowed_with_exception");
    expect(result.hits[0].overrideApplied).toBe(true);
    expect(result.hits[0].overrideId).toBe("override-1");
  });

  it("ignores expired override", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "overtime-rule",
        code: "overtime_requires_agreement",
        defaultOutcome: "review_required",
        outcomeOverridable: true,
        evaluationConfig: { threshold_hours: 9, check: "daily_hours" },
      }),
    ];

    const overrides: WorkspaceRuleOverrideRow[] = [
      {
        overrideId: "override-1",
        ruleId: "overtime-rule",
        overrideOutcome: "allowed",
        overrideConfig: {},
        validFrom: "2025-01-01",
        validUntil: "2025-12-31",
      },
    ];

    const result = evaluateFrameworkRules(
      makeContext({ dailyHoursWorked: 10, date: "2026-03-22" }),
      rules,
      overrides,
    );

    expect(result.outcome).toBe("review_required");
    expect(result.hits[0].overrideApplied).toBe(false);
  });

  it("all rules pass returns allowed", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "max-daily",
        code: "max_daily_hours",
        evaluationConfig: { threshold_hours: 9, check: "daily_hours" },
      }),
      makeRule({
        ruleId: "max-weekly",
        code: "max_weekly_hours",
        evaluationConfig: { threshold_hours: 40, check: "weekly_hours" },
      }),
    ];

    const result = evaluateFrameworkRules(
      makeContext({ dailyHoursWorked: 7, weeklyHoursWorked: 35 }),
      rules,
      [],
    );

    expect(result.outcome).toBe("allowed");
    expect(result.hits).toHaveLength(0);
  });

  it("sunday shift requires review", () => {
    const rules: FrameworkRuleRow[] = [
      makeRule({
        ruleId: "sunday-rule",
        code: "sunday_holiday_agreement",
        ruleType: "constraint",
        defaultOutcome: "review_required",
        evaluationConfig: { check: "sunday_holiday_shift" },
      }),
    ];

    // 2026-03-22 is a Sunday
    const result = evaluateFrameworkRules(makeContext({ date: "2026-03-22" }), rules, []);

    expect(result.outcome).toBe("review_required");
  });
});
