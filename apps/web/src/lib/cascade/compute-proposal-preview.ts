/**
 * computeProposalPreview — Cascade C4 Governance
 *
 * Pure function: computes the impact of a proposed hours/department-type change.
 * No DB access — caller provides current state snapshot.
 *
 * Used by ChangeProposalDialog to show preview before admin approves.
 */

export type ProposalDepartment = {
  departmentId: string;
  name: string;
  departmentType: string;
  isDerived: boolean;
  openOffsetMinutes: number;
  closeOffsetMinutes: number;
};

export type ProposalSession = {
  sessionId: string;
  departmentId: string;
  sessionDate: string;
  status: string;
};

export type ProposalShift = {
  shiftId: string;
  departmentId: string;
  status: string;
  date: string;
};

export type ProposalPreviewInput = {
  changeType: "workspace_hours" | "department_hours" | "department_type";
  proposedChange: Record<string, unknown>;
  departments: ProposalDepartment[];
  futureSessions: ProposalSession[];
  futureShifts: ProposalShift[];
};

export type ProposalPreviewResult = {
  affectedDepartments: ProposalDepartment[];
  affectedSessions: ProposalSession[];
  autoAdjustShifts: ProposalShift[];
  impactedConfirmedShifts: ProposalShift[];
};

const AUTO_ADJUST_STATUSES = new Set(["created", "assigned"]);
const CONFIRMED_STATUSES = new Set(["confirmed", "published"]);
const ACTIVE_SESSION_STATUSES = new Set(["upcoming", "active", "pending_signoff"]);

export function computeProposalPreview(input: ProposalPreviewInput): ProposalPreviewResult {
  // 1. Determine affected departments
  const affectedDepartments =
    input.changeType === "workspace_hours"
      ? input.departments.filter((d) => d.isDerived)
      : input.changeType === "department_type"
        ? input.departments
        : input.departments;

  const affectedDeptIds = new Set(affectedDepartments.map((d) => d.departmentId));

  // 2. Affected future sessions (only upcoming/active, exclude past/closed)
  const affectedSessions = input.futureSessions.filter(
    (s) => affectedDeptIds.has(s.departmentId) && ACTIVE_SESSION_STATUSES.has(s.status),
  );

  // 3. Separate shifts into auto-adjust vs impacted-confirmed
  const relevantShifts = input.futureShifts.filter((s) => affectedDeptIds.has(s.departmentId));

  const autoAdjustShifts = relevantShifts.filter((s) => AUTO_ADJUST_STATUSES.has(s.status));
  const impactedConfirmedShifts = relevantShifts.filter((s) => CONFIRMED_STATUSES.has(s.status));

  return {
    affectedDepartments,
    affectedSessions,
    autoAdjustShifts,
    impactedConfirmedShifts,
  };
}
