import { describe, it, expect } from "vitest";
import { evaluateFrameworkRules } from "../evaluate-framework-rules";
import type { FrameworkRule, WorkspaceRuleOverride, ProposedChange, Conflict } from "../types";

function makeRule(
  overrides: Partial<FrameworkRule> & { ruleId: string; code: string },
): FrameworkRule {
  return {
    ruleType: "constraint",
    category: "working_time",
    description: "Test rule",
    defaultOutcome: "blocked",
    severity: "hard_block",
    outcomeOverridable: false,
    configTightenAllowed: true,
    configLoosenAllowed: false,
    overrideMinLevel: null,
    evaluationConfig: {},
    sourceReference: null,
    ...overrides,
  };
}

describe("evaluateFrameworkRules", () => {
  it("returns empty conflicts when no rules match", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "department_operating_hours",
        entityId: "e1",
        changeType: "update",
        before: null,
        after: { open_time: "10:00" },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, [], "2026-04-07");
    expect(result).toHaveLength(0);
  });

  it("returns a conflict when rule matches entity type and threshold exceeded", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        evaluationConfig: {
          entityType: "schedule_shift",
          check: "max_hours",
          threshold: 10,
        },
      }),
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 8 },
        after: { work_hours: 12 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, [], "2026-04-07");
    expect(result).toHaveLength(1);
    expect(result[0]!.ruleId).toBe("r1");
    expect(result[0]!.outcome).toBe("blocked");
    expect(result[0]!.category).toBe("constraint");
  });

  it("does NOT trigger when threshold is not exceeded", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 6 },
        after: { work_hours: 9 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, [], "2026-04-07");
    expect(result).toHaveLength(0);
  });

  it("workspace override changes the outcome when rule is overridable", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        outcomeOverridable: true,
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const overrides: WorkspaceRuleOverride[] = [
      {
        ruleId: "r1",
        overrideOutcome: "allowed_with_exception",
        overrideConfig: {},
        validFrom: null,
        validUntil: null,
      },
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 8 },
        after: { work_hours: 12 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, overrides, "2026-04-07");
    expect(result).toHaveLength(1);
    expect(result[0]!.outcome).toBe("allowed_with_exception");
    expect(result[0]!.exceptionPath).toBe("workspace_override");
  });

  it("non-overridable rule ignores workspace override outcome", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        outcomeOverridable: false,
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const overrides: WorkspaceRuleOverride[] = [
      {
        ruleId: "r1",
        overrideOutcome: "allowed",
        overrideConfig: {},
        validFrom: null,
        validUntil: null,
      },
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 8 },
        after: { work_hours: 12 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, overrides, "2026-04-07");
    expect(result).toHaveLength(1);
    expect(result[0]!.outcome).toBe("blocked"); // Override ignored
  });

  it("expired override is ignored", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        outcomeOverridable: true,
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const overrides: WorkspaceRuleOverride[] = [
      {
        ruleId: "r1",
        overrideOutcome: "allowed_with_exception",
        overrideConfig: {},
        validFrom: "2026-01-01",
        validUntil: "2026-03-31", // Expired before evaluation date
      },
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 8 },
        after: { work_hours: 12 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, overrides, "2026-04-07");
    expect(result).toHaveLength(1);
    expect(result[0]!.outcome).toBe("blocked"); // Expired override ignored
  });

  it("config tightening override lowers threshold", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        configTightenAllowed: true,
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const overrides: WorkspaceRuleOverride[] = [
      {
        ruleId: "r1",
        overrideOutcome: null,
        overrideConfig: { threshold: 8 }, // Tighter than framework default of 10
        validFrom: null,
        validUntil: null,
      },
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 6 },
        after: { work_hours: 9 }, // Over tightened threshold of 8, under framework default of 10
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, overrides, "2026-04-07");
    expect(result).toHaveLength(1); // Triggered by tightened threshold
  });

  it("config loosening override rejected when not allowed", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        configLoosenAllowed: false,
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const overrides: WorkspaceRuleOverride[] = [
      {
        ruleId: "r1",
        overrideOutcome: null,
        overrideConfig: { threshold: 12 }, // Looser than framework default — should be ignored
        validFrom: null,
        validUntil: null,
      },
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 8 },
        after: { work_hours: 11 }, // Over framework threshold of 10, under loosened 12
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, overrides, "2026-04-07");
    expect(result).toHaveLength(1); // Loosening rejected, framework threshold of 10 applies
  });

  it("advisory rules produce soft_warn conflicts", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r2",
        code: "short_notice",
        ruleType: "advisory",
        severity: "soft_warn",
        defaultOutcome: "review_required",
        evaluationConfig: { entityType: "schedule_shift" },
      }),
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "create",
        before: null,
        after: { work_hours: 6 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, [], "2026-04-07");
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("soft_warn");
    expect(result[0]!.category).toBe("advisory");
    expect(result[0]!.outcome).toBe("review_required");
  });
});
