/**
 * evaluateFrameworkRules — Cascade Phase B
 *
 * Pure function: evaluates shift/schedule actions against framework rules
 * with employee context. No DB access — caller provides pre-loaded rules.
 *
 * Severity ranking: blocked > review_required > allowed_with_exception > allowed
 */

import type {
  EntityContext,
  EvaluationOutcomeLevel,
  EvaluationResult,
  FrameworkRuleRow,
  RuleHit,
  WorkspaceRuleOverrideRow,
} from "./types";

const SEVERITY_RANK: Record<EvaluationOutcomeLevel, number> = {
  allowed: 0,
  allowed_with_exception: 1,
  review_required: 2,
  blocked: 3,
};

function findValidOverride(
  ruleId: string,
  overrides: WorkspaceRuleOverrideRow[],
  date: string,
): WorkspaceRuleOverrideRow | null {
  const override = overrides.find((o) => o.ruleId === ruleId);
  if (!override) return null;
  if (override.validFrom && date < override.validFrom) return null;
  if (override.validUntil && date > override.validUntil) return null;
  return override;
}

function resolveOutcome(
  rule: FrameworkRuleRow,
  override: WorkspaceRuleOverrideRow | null,
): { outcome: EvaluationOutcomeLevel; overrideApplied: boolean; overrideId?: string } {
  if (override?.overrideOutcome && rule.outcomeOverridable) {
    return {
      outcome: override.overrideOutcome,
      overrideApplied: true,
      overrideId: override.overrideId,
    };
  }
  return { outcome: rule.defaultOutcome, overrideApplied: false };
}

/**
 * Check if a rule is violated by the given entity context.
 * Returns null if rule does not apply, or a reason string if it does.
 */
function checkRule(rule: FrameworkRuleRow, ctx: EntityContext): string | null {
  const config = rule.evaluationConfig as Record<string, unknown>;
  const check = config.check as string | undefined;

  if (!check) return null;

  switch (check) {
    case "daily_hours": {
      const threshold = config.threshold_hours as number;
      if (ctx.dailyHoursWorked !== undefined && ctx.dailyHoursWorked > threshold) {
        return `Daily hours ${ctx.dailyHoursWorked}h exceeds ${threshold}h limit`;
      }
      return null;
    }

    case "weekly_hours": {
      const threshold = config.threshold_hours as number;
      if (ctx.weeklyHoursWorked !== undefined && ctx.weeklyHoursWorked > threshold) {
        return `Weekly hours ${ctx.weeklyHoursWorked}h exceeds ${threshold}h limit`;
      }
      return null;
    }

    case "gap_between_shifts": {
      const threshold = config.threshold_hours as number;
      if (!ctx.lastShiftEnd) return null;
      // Calculate gap from lastShiftEnd to now (date at start of day as fallback)
      const lastEnd = new Date(ctx.lastShiftEnd).getTime();
      const dayStart = new Date(ctx.date + "T00:00:00Z").getTime();
      const gapMs = dayStart - lastEnd;
      const gapHours = gapMs / (1000 * 60 * 60);
      if (gapHours < threshold) {
        return `Rest period ${gapHours.toFixed(1)}h is less than required ${threshold}h`;
      }
      return null;
    }

    case "night_work_age": {
      const maxAge = config.max_age as number;
      if (ctx.employeeAge !== undefined && ctx.employeeAge <= maxAge) {
        return `Employee age ${ctx.employeeAge} is under ${maxAge + 1} — night work restricted`;
      }
      return null;
    }

    case "daily_hours_age": {
      const maxAge = config.max_age as number;
      const threshold = config.threshold_hours as number;
      if (
        ctx.employeeAge !== undefined &&
        ctx.employeeAge <= maxAge &&
        ctx.dailyHoursWorked !== undefined &&
        ctx.dailyHoursWorked > threshold
      ) {
        return `Under-${maxAge + 1} employee: daily hours ${ctx.dailyHoursWorked}h exceeds ${threshold}h limit`;
      }
      return null;
    }

    case "overtime_agreement": {
      const thresholdDaily = config.threshold_daily as number;
      const thresholdWeekly = config.threshold_weekly as number;
      const dailyExceeds =
        ctx.dailyHoursWorked !== undefined && ctx.dailyHoursWorked > thresholdDaily;
      const weeklyExceeds =
        ctx.weeklyHoursWorked !== undefined && ctx.weeklyHoursWorked > thresholdWeekly;
      if (dailyExceeds || weeklyExceeds) {
        return "Overtime detected — written agreement required";
      }
      return null;
    }

    case "sunday_holiday_shift": {
      // Check if date is a Sunday (day 0 in ISO week = Monday, day 6 = Sunday)
      const dateObj = new Date(ctx.date + "T12:00:00Z");
      const jsDay = dateObj.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      if (jsDay === 0) {
        return "Shift scheduled on Sunday — agreement required";
      }
      // Holiday check would use public_holiday table, but that's loaded by caller
      // For now, just check Sunday
      return null;
    }

    case "split_shift_gap": {
      // Not evaluated here — requires multi-shift context
      return null;
    }

    default:
      return null;
  }
}

/**
 * Evaluate pre-loaded framework rules against an entity context.
 * Pure function — no DB access.
 *
 * @param entityContext - The shift/schedule context to evaluate
 * @param rules - Pre-filtered framework rules (caller filters by trigger type)
 * @param workspaceOverrides - Active workspace-level rule overrides
 */
export function evaluateFrameworkRules(
  entityContext: EntityContext,
  rules: FrameworkRuleRow[],
  workspaceOverrides: WorkspaceRuleOverrideRow[],
): EvaluationResult {
  const hits: RuleHit[] = [];

  for (const rule of rules) {
    const reason = checkRule(rule, entityContext);
    if (reason === null) continue;

    const override = findValidOverride(rule.ruleId, workspaceOverrides, entityContext.date);
    const { outcome, overrideApplied, overrideId } = resolveOutcome(rule, override);

    hits.push({
      ruleId: rule.ruleId,
      ruleName: rule.description,
      ruleType: rule.ruleType,
      outcome,
      reason,
      overrideApplied,
      overrideId,
    });
  }

  if (hits.length === 0) {
    return { outcome: "allowed", hits: [], worstHit: null };
  }

  // Find worst outcome
  const worstHit = hits.reduce((worst, hit) =>
    SEVERITY_RANK[hit.outcome] > SEVERITY_RANK[worst.outcome] ? hit : worst,
  );

  return {
    outcome: worstHit.outcome,
    hits,
    worstHit,
  };
}
