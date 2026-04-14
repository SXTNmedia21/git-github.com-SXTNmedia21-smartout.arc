/**
 * Framework rule evaluation engine (Phase E / WP1).
 *
 * Pure, deterministic evaluator for `framework_rule.evaluation_config`. Given a list
 * of rules and an evaluation context (entity, action, proposed/current data), returns
 * an aggregated outcome where the most restrictive matched rule wins.
 *
 * Why pure: this module is called from Next.js server components, Edge Functions,
 * and consumers of @smartout/data. It has no DB client, no side effects, no logging
 * beyond the returned `EvaluationResult[]`. Callers emit() for audit.
 *
 * Contract: ADR-0090.
 * Canonical model: I1 + 6D + 4C. This is the C4 Governance runtime — "Confident
 * != Authorized". C1 determines belief, C4 (this engine) determines permission.
 */

import { z } from "zod";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Mirrors the `evaluation_outcome` Postgres enum. Kept local so this module does
 * not depend on @smartout/supabase's generated types (which would make @smartout/data
 * bundle larger and harder to consume from Edge Functions).
 */
export type EvaluationOutcome =
  | "allowed"
  | "allowed_with_exception"
  | "review_required"
  | "blocked";

/** Structural subset of `framework_rule` that this engine reads. */
export type FrameworkRule = {
  rule_id: string;
  code: string;
  severity: string;
  default_outcome: EvaluationOutcome;
  evaluation_config: unknown;
};

/** Everything the evaluator needs to resolve a `path` inside a condition. */
export type EvaluationContext = {
  workspace_id: string;
  entity_type: string;
  entity_id?: string;
  action: "create" | "update" | "delete";
  proposed_data: Record<string, unknown>;
  current_data?: Record<string, unknown>;
};

/** Per-rule result. `outcome` is what this rule contributed to the aggregate. */
export type EvaluationResult = {
  rule_id: string;
  outcome: EvaluationOutcome;
  severity: string;
  /** Human-readable explanation. `exception_reason` from the config when matched. */
  reason?: string;
};

export type AggregatedEvaluation = {
  final_outcome: EvaluationOutcome;
  results: EvaluationResult[];
  rules_evaluated: number;
  rules_matched: number;
};

// ── Condition / config schema (ADR-0090) ─────────────────────────────────────

const evaluationOutcomeSchema = z.enum([
  "allowed",
  "allowed_with_exception",
  "review_required",
  "blocked",
]);

type ConditionShape =
  | { type: "all"; conditions: ConditionShape[] }
  | { type: "any"; conditions: ConditionShape[] }
  | { type: "not"; condition: ConditionShape }
  // `value` is `unknown` and therefore typed as optional by Zod inference; we
  // treat the absent and `undefined` cases the same way (no match).
  | { type: "equals"; path: string; value?: unknown }
  | { type: "threshold"; path: string; op: "gt" | "gte" | "lt" | "lte"; value: number }
  | { type: "in"; path: string; values: unknown[] }
  | { type: "exists"; path: string };

/**
 * Recursive condition schema. Zod's `z.lazy` is required because the combinators
 * (`all`/`any`/`not`) reference the condition type itself.
 */
const conditionSchema: z.ZodType<ConditionShape> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("all"), conditions: z.array(conditionSchema) }),
    z.object({ type: z.literal("any"), conditions: z.array(conditionSchema) }),
    z.object({ type: z.literal("not"), condition: conditionSchema }),
    z.object({ type: z.literal("equals"), path: z.string().min(1), value: z.unknown() }),
    z.object({
      type: z.literal("threshold"),
      path: z.string().min(1),
      op: z.enum(["gt", "gte", "lt", "lte"]),
      value: z.number(),
    }),
    z.object({
      type: z.literal("in"),
      path: z.string().min(1),
      values: z.array(z.unknown()),
    }),
    z.object({ type: z.literal("exists"), path: z.string().min(1) }),
  ]),
);

export const EvaluationConfigSchema = z.object({
  condition: conditionSchema,
  outcome_if_match: evaluationOutcomeSchema,
  outcome_if_no_match: evaluationOutcomeSchema.optional(),
  exception_reason: z.string().optional(),
});

export type EvaluationConfig = z.infer<typeof EvaluationConfigSchema>;
export type Condition = ConditionShape;

// ── Path resolution ──────────────────────────────────────────────────────────

/**
 * Resolves a dotted path against the evaluation context. Missing segments return
 * `undefined` — callers must treat undefined as "condition does not match",
 * never as an error. This makes the engine crash-free on malformed data.
 */
function resolvePath(context: EvaluationContext, path: string): unknown {
  if (path.length === 0) return undefined;

  const segments = path.split(".");
  let current: unknown = context;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

// ── Condition evaluation ─────────────────────────────────────────────────────

function evaluateCondition(condition: Condition, context: EvaluationContext): boolean {
  switch (condition.type) {
    case "all":
      return condition.conditions.every((c) => evaluateCondition(c, context));

    case "any":
      return condition.conditions.some((c) => evaluateCondition(c, context));

    case "not":
      return !evaluateCondition(condition.condition, context);

    case "equals": {
      const actual = resolvePath(context, condition.path);
      if (actual === undefined) return false;
      return actual === condition.value;
    }

    case "threshold": {
      const actual = resolvePath(context, condition.path);
      if (typeof actual !== "number") return false;
      switch (condition.op) {
        case "gt":
          return actual > condition.value;
        case "gte":
          return actual >= condition.value;
        case "lt":
          return actual < condition.value;
        case "lte":
          return actual <= condition.value;
      }
      return false;
    }

    case "in": {
      const actual = resolvePath(context, condition.path);
      if (actual === undefined) return false;
      return condition.values.includes(actual);
    }

    case "exists": {
      const actual = resolvePath(context, condition.path);
      return actual !== undefined && actual !== null;
    }
  }
}

// ── Outcome aggregation ──────────────────────────────────────────────────────

/**
 * Severity ranking. Higher value = more restrictive. The aggregated final_outcome
 * is the outcome with the highest severity across all matched rules.
 */
const OUTCOME_SEVERITY: Record<EvaluationOutcome, number> = {
  allowed: 0,
  allowed_with_exception: 1,
  review_required: 2,
  blocked: 3,
};

function moreRestrictive(a: EvaluationOutcome, b: EvaluationOutcome): EvaluationOutcome {
  return OUTCOME_SEVERITY[a] >= OUTCOME_SEVERITY[b] ? a : b;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluates every rule against the context and returns the most restrictive
 * aggregated outcome plus per-rule results.
 *
 * Invariants:
 * - Empty `rules` → `{ final_outcome: "allowed", results: [], rules_evaluated: 0, rules_matched: 0 }`.
 * - Rules whose `evaluation_config` fails schema validation are SKIPPED, not thrown.
 *   A single broken rule must not brick the engine. Skipped rules count toward
 *   `rules_evaluated` but not `rules_matched`, and produce a `review_required`
 *   result tagged with the reason so callers can surface the breakage.
 * - Missing paths in conditions evaluate to false, never throw.
 */
export function evaluateFrameworkRules(
  rules: FrameworkRule[],
  context: EvaluationContext,
): AggregatedEvaluation {
  const results: EvaluationResult[] = [];
  let final: EvaluationOutcome = "allowed";
  let matched = 0;

  for (const rule of rules) {
    const parsed = EvaluationConfigSchema.safeParse(rule.evaluation_config);

    if (!parsed.success) {
      // Broken config: surface as review_required so the platform notices, but
      // continue evaluating the rest. This preserves "a single bad rule cannot
      // crash the platform" (ADR-0090).
      const reason = `invalid evaluation_config for rule ${rule.code}: ${parsed.error.issues
        .map((i) => i.message)
        .join("; ")}`;
      const outcome: EvaluationOutcome = "review_required";
      results.push({
        rule_id: rule.rule_id,
        outcome,
        severity: rule.severity,
        reason,
      });
      final = moreRestrictive(final, outcome);
      continue;
    }

    const config = parsed.data;
    const didMatch = evaluateCondition(config.condition, context);

    if (didMatch) {
      matched += 1;
      const outcome = config.outcome_if_match;
      results.push({
        rule_id: rule.rule_id,
        outcome,
        severity: rule.severity,
        reason: config.exception_reason,
      });
      final = moreRestrictive(final, outcome);
    } else {
      const fallback = config.outcome_if_no_match ?? "allowed";
      // Only emit a result when the fallback contributes something. `allowed` is
      // the neutral element, so suppressing it keeps the result list focused on
      // rules that actually influenced the outcome.
      if (fallback !== "allowed") {
        results.push({
          rule_id: rule.rule_id,
          outcome: fallback,
          severity: rule.severity,
        });
        final = moreRestrictive(final, fallback);
      }
    }
  }

  return {
    final_outcome: final,
    results,
    rules_evaluated: rules.length,
    rules_matched: matched,
  };
}
