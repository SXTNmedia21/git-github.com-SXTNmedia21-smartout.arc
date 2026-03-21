/**
 * evaluate_framework_rules — Cascade Phase B, Minimal Foundation Skeleton
 *
 * Evaluates proposed changes against framework rules with override capability grammar.
 * This skeleton implements:
 * - Entity-type matching via evaluationConfig.entityType
 * - Basic threshold evaluation (max_hours check)
 * - Override capability grammar: outcome override, config tightening/loosening, temporal validity
 *
 * NOT yet implemented (requires integrated schema + real framework seed data):
 * - Full FrameworkContext object loading
 * - Multi-rule interaction (rule chaining, precedence between conflicting rules)
 * - Complex evaluation strategies beyond threshold checks
 * - Employee-specific context (contract hours, age, seniority)
 *
 * Spec: Section 3 Phase B, Function #3
 */

import type {
  Conflict,
  ConflictCategory,
  FrameworkRule,
  ProposedChange,
  WorkspaceRuleOverride,
  EvaluationOutcome,
} from "./types";

const RULE_TYPE_TO_CATEGORY: Record<string, ConflictCategory> = {
  gate: "constraint",
  constraint: "constraint",
  advisory: "advisory",
  commercial: "commercial",
};

function ruleApplies(rule: FrameworkRule, change: ProposedChange): boolean {
  const configEntityType = (rule.evaluationConfig as Record<string, unknown>).entityType;
  if (!configEntityType) return false;
  return configEntityType === change.entityType;
}

/**
 * Find the applicable override for a rule, respecting temporal validity.
 * Returns null if no valid override exists.
 */
function findValidOverride(
  ruleId: string,
  overrides: WorkspaceRuleOverride[],
  evaluationDate: string,
): WorkspaceRuleOverride | null {
  const override = overrides.find((o) => o.ruleId === ruleId);
  if (!override) return null;

  // Check temporal validity
  if (override.validFrom && evaluationDate < override.validFrom) return null;
  if (override.validUntil && evaluationDate > override.validUntil) return null;

  return override;
}

/**
 * Merge config overrides with framework defaults, respecting tighten/loosen capability.
 * Returns the effective evaluationConfig to use for evaluation.
 */
function mergeConfig(
  rule: FrameworkRule,
  override: WorkspaceRuleOverride | null,
): Record<string, unknown> {
  const baseConfig = rule.evaluationConfig as Record<string, unknown>;
  if (!override || !override.overrideConfig || Object.keys(override.overrideConfig).length === 0) {
    return baseConfig;
  }

  const merged = { ...baseConfig };
  const overrideConfig = override.overrideConfig as Record<string, unknown>;

  for (const [key, overrideValue] of Object.entries(overrideConfig)) {
    const baseValue = baseConfig[key];

    // Only merge numeric thresholds for now — the tighten/loosen grammar
    if (typeof baseValue === "number" && typeof overrideValue === "number") {
      const isTightening = overrideValue < baseValue; // Lower threshold = stricter
      const isLoosening = overrideValue > baseValue;

      if (isTightening && rule.configTightenAllowed) {
        merged[key] = overrideValue;
      } else if (isLoosening && rule.configLoosenAllowed) {
        merged[key] = overrideValue;
      }
      // Otherwise: keep base value (override rejected)
    }
  }

  return merged;
}

/**
 * Evaluate whether a rule is triggered by a proposed change.
 * Uses the effective (potentially overridden) config.
 */
function ruleTriggered(
  rule: FrameworkRule,
  change: ProposedChange,
  effectiveConfig: Record<string, unknown>,
): boolean {
  const check = effectiveConfig.check as string | undefined;

  if (!check) {
    // Rule matches entity type but has no specific check — always triggered
    return true;
  }

  if (check === "max_hours" && typeof effectiveConfig.threshold === "number") {
    const afterHours = (change.after as Record<string, unknown> | null)?.work_hours;
    if (typeof afterHours === "number" && afterHours > effectiveConfig.threshold) {
      return true;
    }
    return false;
  }

  // Unknown check type — trigger the rule (safe default for foundation skeleton)
  return true;
}

function resolveOutcome(
  rule: FrameworkRule,
  override: WorkspaceRuleOverride | null,
): EvaluationOutcome {
  if (override?.overrideOutcome && rule.outcomeOverridable) {
    return override.overrideOutcome;
  }
  return rule.defaultOutcome;
}

/**
 * @param evaluationDate - ISO date string (YYYY-MM-DD) for override temporal validity checks
 */
export function evaluateFrameworkRules(
  proposedChanges: ProposedChange[],
  rules: FrameworkRule[],
  workspaceOverrides: WorkspaceRuleOverride[],
  evaluationDate: string,
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const change of proposedChanges) {
    for (const rule of rules) {
      if (!ruleApplies(rule, change)) continue;

      const override = findValidOverride(rule.ruleId, workspaceOverrides, evaluationDate);
      const effectiveConfig = mergeConfig(rule, override);

      if (!ruleTriggered(rule, change, effectiveConfig)) continue;

      const outcome = resolveOutcome(rule, override);

      conflicts.push({
        category: RULE_TYPE_TO_CATEGORY[rule.ruleType] ?? "constraint",
        severity: rule.severity,
        outcome,
        ruleId: rule.ruleId,
        entityType: change.entityType,
        entityId: change.entityId,
        description: rule.description,
        exceptionPath: outcome === "allowed_with_exception" ? "workspace_override" : undefined,
      });
    }
  }

  return conflicts;
}
