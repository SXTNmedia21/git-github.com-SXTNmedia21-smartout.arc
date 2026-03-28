// ============================================
// risk-priority.ts
// Prioritizes cockpit risk lists in a stable,
// deterministic order for predictable UI output.
// ============================================

export type RiskSeverity = "critical" | "warning" | "info";

export type StaffingRisk = {
  id: string;
  severity: RiskSeverity;
  uncoveredShifts: number;
  affectedTeams: number;
  occurredAt: string;
};

export type OperationalRisk = {
  id: string;
  severity: RiskSeverity;
  blockingDeviations: number;
  overdueTasks: number;
  upcomingTasks: number;
  occurredAt: string;
};

const SEVERITY_WEIGHT: Record<RiskSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/**
 * Converts an ISO-like timestamp to a comparable number.
 *
 * Why: We want invalid timestamps to consistently sort last without throwing.
 *
 * @param occurredAt - Timestamp value from one risk item.
 * @returns Parsed epoch milliseconds, or negative infinity when invalid.
 */
function parseOccurredAt(occurredAt: string): number {
  const parsed = Date.parse(occurredAt);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/**
 * Compares risks by shared, deterministic tie-break rules.
 *
 * Why: Both staffing and operational risk lists need stable ordering so
 * equal-priority rows do not jump around between renders.
 *
 * @param left - Left item in comparator.
 * @param right - Right item in comparator.
 * @returns Negative when left should appear first, positive when right first.
 */
function compareSharedRiskPriority(
  left: { id: string; severity: RiskSeverity; occurredAt: string },
  right: { id: string; severity: RiskSeverity; occurredAt: string },
): number {
  const bySeverity = SEVERITY_WEIGHT[right.severity] - SEVERITY_WEIGHT[left.severity];
  if (bySeverity !== 0) {
    return bySeverity;
  }

  const rightTimestamp = parseOccurredAt(right.occurredAt);
  const leftTimestamp = parseOccurredAt(left.occurredAt);
  if (rightTimestamp > leftTimestamp) {
    return 1;
  }
  if (rightTimestamp < leftTimestamp) {
    return -1;
  }

  return left.id.localeCompare(right.id);
}

/**
 * Prioritizes staffing risks for cockpit consumption.
 *
 * Why: Staffing gaps should surface by urgency first (severity and uncovered
 * shifts), while preserving stable ties across refreshes.
 *
 * @param risks - Raw staffing risk list.
 * @returns New array sorted from highest to lowest staffing urgency.
 */
export function prioritizeStaffingRisks(risks: StaffingRisk[]): StaffingRisk[] {
  return [...risks].sort((left, right) => {
    const byUncoveredShifts = right.uncoveredShifts - left.uncoveredShifts;
    if (byUncoveredShifts !== 0) {
      return byUncoveredShifts;
    }

    const byAffectedTeams = right.affectedTeams - left.affectedTeams;
    if (byAffectedTeams !== 0) {
      return byAffectedTeams;
    }

    return compareSharedRiskPriority(left, right);
  });
}

/**
 * Prioritizes operational risks for cockpit consumption.
 *
 * Why: Blocking deviations and overdue tasks represent immediate operational
 * debt, while upcoming tasks are planning pressure that should still be visible
 * without being treated as overdue/deviation debt.
 *
 * @param risks - Raw operational risk list.
 * @returns New array sorted from highest to lowest operational urgency.
 */
export function prioritizeOperationalRisks(risks: OperationalRisk[]): OperationalRisk[] {
  return [...risks].sort((left, right) => {
    const byBlockingDeviations = right.blockingDeviations - left.blockingDeviations;
    if (byBlockingDeviations !== 0) {
      return byBlockingDeviations;
    }

    const byOverdueTasks = right.overdueTasks - left.overdueTasks;
    if (byOverdueTasks !== 0) {
      return byOverdueTasks;
    }

    const byUpcomingTasks = right.upcomingTasks - left.upcomingTasks;
    if (byUpcomingTasks !== 0) {
      return byUpcomingTasks;
    }

    return compareSharedRiskPriority(left, right);
  });
}
