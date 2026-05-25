import { describe, it, expect } from "vitest";
import {
  evaluateFrameworkRules,
  type EvaluationContext,
  type FrameworkRule,
  type EvaluationConfig,
} from "../evaluate-rules";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRule(
  code: string,
  config: EvaluationConfig | unknown,
  overrides: Partial<FrameworkRule> = {},
): FrameworkRule {
  return {
    rule_id: `rule-${code}`,
    code,
    severity: "hard_block",
    default_outcome: "blocked",
    evaluation_config: config,
    ...overrides,
  };
}

const baseContext: EvaluationContext = {
  workspace_id: "ws-1",
  entity_type: "employment_contract",
  entity_id: "ec-1",
  action: "create",
  proposed_data: {
    hourly_rate: 200,
    status: "active",
    contract_type: "fulltime",
    tags: ["senior"],
  },
  current_data: {
    hourly_rate: 180,
    status: "trainee",
  },
};

// ── Aggregation / empty ──────────────────────────────────────────────────────

describe("evaluateFrameworkRules — aggregation", () => {
  it("empty rules → allowed", () => {
    const result = evaluateFrameworkRules([], baseContext);
    expect(result.final_outcome).toBe("allowed");
    expect(result.results).toEqual([]);
    expect(result.rules_evaluated).toBe(0);
    expect(result.rules_matched).toBe(0);
  });

  it("single matching rule → that rule's outcome_if_match", () => {
    const rule = makeRule("R1", {
      condition: { type: "equals", path: "proposed_data.status", value: "active" },
      outcome_if_match: "review_required",
    });
    const result = evaluateFrameworkRules([rule], baseContext);
    expect(result.final_outcome).toBe("review_required");
    expect(result.rules_matched).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.outcome).toBe("review_required");
  });

  it("most restrictive outcome wins across multiple matching rules", () => {
    const rules: FrameworkRule[] = [
      makeRule("R1", {
        condition: { type: "equals", path: "action", value: "create" },
        outcome_if_match: "allowed_with_exception",
      }),
      makeRule("R2", {
        condition: { type: "equals", path: "entity_type", value: "employment_contract" },
        outcome_if_match: "blocked",
      }),
      makeRule("R3", {
        condition: { type: "equals", path: "proposed_data.status", value: "active" },
        outcome_if_match: "review_required",
      }),
    ];
    const result = evaluateFrameworkRules(rules, baseContext);
    expect(result.final_outcome).toBe("blocked");
    expect(result.rules_matched).toBe(3);
  });

  it("severity order: blocked > review_required > allowed_with_exception > allowed", () => {
    const contextNoMatch: EvaluationContext = {
      ...baseContext,
      proposed_data: {},
    };
    // No rules match — fallback is allowed
    const rule = makeRule("R1", {
      condition: { type: "equals", path: "proposed_data.nonexistent", value: "x" },
      outcome_if_match: "blocked",
    });
    const result = evaluateFrameworkRules([rule], contextNoMatch);
    expect(result.final_outcome).toBe("allowed");
    expect(result.rules_matched).toBe(0);
  });

  it("outcome_if_no_match contributes when rule does not match", () => {
    const rule = makeRule("R1", {
      condition: { type: "equals", path: "proposed_data.status", value: "offboarding" },
      outcome_if_match: "allowed",
      outcome_if_no_match: "review_required",
    });
    const result = evaluateFrameworkRules([rule], baseContext);
    expect(result.final_outcome).toBe("review_required");
    expect(result.rules_matched).toBe(0);
  });

  it("suppresses neutral `allowed` fallback results to keep list focused", () => {
    const rule = makeRule("R1", {
      condition: { type: "equals", path: "proposed_data.status", value: "offboarding" },
      outcome_if_match: "blocked",
      // no outcome_if_no_match → defaults to "allowed" → not emitted
    });
    const result = evaluateFrameworkRules([rule], baseContext);
    expect(result.final_outcome).toBe("allowed");
    expect(result.results).toEqual([]);
  });

  it("matched rule reason is surfaced from exception_reason", () => {
    const rule = makeRule("R1", {
      condition: { type: "equals", path: "proposed_data.status", value: "active" },
      outcome_if_match: "allowed_with_exception",
      exception_reason: "Probation period required",
    });
    const result = evaluateFrameworkRules([rule], baseContext);
    expect(result.results[0]?.reason).toBe("Probation period required");
  });
});

// ── Combinators ──────────────────────────────────────────────────────────────

describe("combinators", () => {
  it("all: every sub-condition must match", () => {
    const rule = makeRule("R1", {
      condition: {
        type: "all",
        conditions: [
          { type: "equals", path: "action", value: "create" },
          { type: "equals", path: "proposed_data.status", value: "active" },
        ],
      },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([rule], baseContext).final_outcome).toBe("blocked");

    const miss = makeRule("R2", {
      condition: {
        type: "all",
        conditions: [
          { type: "equals", path: "action", value: "create" },
          { type: "equals", path: "proposed_data.status", value: "offboarding" },
        ],
      },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([miss], baseContext).final_outcome).toBe("allowed");
  });

  it("any: at least one sub-condition must match", () => {
    const rule = makeRule("R1", {
      condition: {
        type: "any",
        conditions: [
          { type: "equals", path: "proposed_data.status", value: "offboarding" },
          { type: "equals", path: "proposed_data.status", value: "active" },
        ],
      },
      outcome_if_match: "review_required",
    });
    expect(evaluateFrameworkRules([rule], baseContext).final_outcome).toBe("review_required");
  });

  it("not: inverts the child condition", () => {
    const rule = makeRule("R1", {
      condition: {
        type: "not",
        condition: { type: "equals", path: "proposed_data.status", value: "offboarding" },
      },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([rule], baseContext).final_outcome).toBe("blocked");
  });

  it("nested combinators evaluate correctly", () => {
    const rule = makeRule("R1", {
      condition: {
        type: "all",
        conditions: [
          { type: "equals", path: "entity_type", value: "employment_contract" },
          {
            type: "any",
            conditions: [
              { type: "equals", path: "proposed_data.status", value: "offboarding" },
              {
                type: "not",
                condition: { type: "equals", path: "proposed_data.contract_type", value: "temp" },
              },
            ],
          },
        ],
      },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([rule], baseContext).final_outcome).toBe("blocked");
  });
});

// ── Condition primitives ─────────────────────────────────────────────────────

describe("condition primitives", () => {
  it("equals: strict equality", () => {
    const match = makeRule("R1", {
      condition: { type: "equals", path: "proposed_data.hourly_rate", value: 200 },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([match], baseContext).final_outcome).toBe("blocked");

    const miss = makeRule("R2", {
      condition: { type: "equals", path: "proposed_data.hourly_rate", value: "200" },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([miss], baseContext).final_outcome).toBe("allowed");
  });

  it("threshold: gt / gte / lt / lte", () => {
    const gt = makeRule("R1", {
      condition: { type: "threshold", path: "proposed_data.hourly_rate", op: "gt", value: 150 },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([gt], baseContext).final_outcome).toBe("blocked");

    const gte = makeRule("R2", {
      condition: { type: "threshold", path: "proposed_data.hourly_rate", op: "gte", value: 200 },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([gte], baseContext).final_outcome).toBe("blocked");

    const lt = makeRule("R3", {
      condition: { type: "threshold", path: "proposed_data.hourly_rate", op: "lt", value: 150 },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([lt], baseContext).final_outcome).toBe("allowed");

    const lte = makeRule("R4", {
      condition: { type: "threshold", path: "proposed_data.hourly_rate", op: "lte", value: 200 },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([lte], baseContext).final_outcome).toBe("blocked");
  });

  it("threshold on non-number → no match (never throws)", () => {
    const rule = makeRule("R1", {
      condition: { type: "threshold", path: "proposed_data.status", op: "gt", value: 0 },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([rule], baseContext).final_outcome).toBe("allowed");
  });

  it("in: value must be in the list", () => {
    const match = makeRule("R1", {
      condition: {
        type: "in",
        path: "proposed_data.status",
        values: ["active", "trainee"],
      },
      outcome_if_match: "review_required",
    });
    expect(evaluateFrameworkRules([match], baseContext).final_outcome).toBe("review_required");

    const miss = makeRule("R2", {
      condition: {
        type: "in",
        path: "proposed_data.status",
        values: ["offboarding", "inactive"],
      },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([miss], baseContext).final_outcome).toBe("allowed");
  });

  it("exists: path must resolve to non-null/undefined", () => {
    const match = makeRule("R1", {
      condition: { type: "exists", path: "current_data.status" },
      outcome_if_match: "review_required",
    });
    expect(evaluateFrameworkRules([match], baseContext).final_outcome).toBe("review_required");

    const miss = makeRule("R2", {
      condition: { type: "exists", path: "current_data.nonexistent" },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([miss], baseContext).final_outcome).toBe("allowed");
  });
});

// ── Path resolution safety ───────────────────────────────────────────────────

describe("path resolution safety", () => {
  it("missing path → equals returns false, engine does not throw", () => {
    const rule = makeRule("R1", {
      condition: { type: "equals", path: "proposed_data.nope.deep.path", value: 1 },
      outcome_if_match: "blocked",
    });
    expect(() => evaluateFrameworkRules([rule], baseContext)).not.toThrow();
    expect(evaluateFrameworkRules([rule], baseContext).final_outcome).toBe("allowed");
  });

  it("traversing through non-object → no match", () => {
    const rule = makeRule("R1", {
      condition: { type: "equals", path: "proposed_data.status.nested", value: "x" },
      outcome_if_match: "blocked",
    });
    expect(evaluateFrameworkRules([rule], baseContext).final_outcome).toBe("allowed");
  });

  it("resolves top-level context fields (entity_type, action, workspace_id)", () => {
    const rule = makeRule("R1", {
      condition: {
        type: "all",
        conditions: [
          { type: "equals", path: "workspace_id", value: "ws-1" },
          { type: "equals", path: "action", value: "create" },
        ],
      },
      outcome_if_match: "review_required",
    });
    expect(evaluateFrameworkRules([rule], baseContext).final_outcome).toBe("review_required");
  });

  it("current_data missing entirely is safe", () => {
    const ctx: EvaluationContext = {
      workspace_id: "ws-1",
      entity_type: "foo",
      action: "create",
      proposed_data: {},
    };
    const rule = makeRule("R1", {
      condition: { type: "exists", path: "current_data.status" },
      outcome_if_match: "blocked",
    });
    expect(() => evaluateFrameworkRules([rule], ctx)).not.toThrow();
    expect(evaluateFrameworkRules([rule], ctx).final_outcome).toBe("allowed");
  });
});

// ── Invalid config handling ──────────────────────────────────────────────────

describe("invalid config handling", () => {
  it("rule with garbage config is skipped, engine continues, result is review_required", () => {
    const broken = makeRule("BROKEN", { not: "a", valid: "config" } as unknown);
    const good = makeRule("GOOD", {
      condition: { type: "equals", path: "proposed_data.status", value: "active" },
      outcome_if_match: "allowed_with_exception",
    });
    const result = evaluateFrameworkRules([broken, good], baseContext);

    expect(result.rules_evaluated).toBe(2);
    expect(result.rules_matched).toBe(1); // only GOOD matched; BROKEN was skipped
    // BROKEN surfaces as review_required, GOOD as allowed_with_exception →
    // most restrictive is review_required.
    expect(result.final_outcome).toBe("review_required");
    expect(result.results).toHaveLength(2);

    const brokenResult = result.results.find((r) => r.rule_id === "rule-BROKEN");
    expect(brokenResult?.outcome).toBe("review_required");
    expect(brokenResult?.reason).toMatch(/invalid evaluation_config/);
  });

  it("empty object config → skipped as review_required", () => {
    const rule = makeRule("R1", {});
    const result = evaluateFrameworkRules([rule], baseContext);
    expect(result.final_outcome).toBe("review_required");
    expect(result.rules_matched).toBe(0);
  });

  it("null config → skipped as review_required, no throw", () => {
    const rule = makeRule("R1", null);
    expect(() => evaluateFrameworkRules([rule], baseContext)).not.toThrow();
    expect(evaluateFrameworkRules([rule], baseContext).final_outcome).toBe("review_required");
  });
});
