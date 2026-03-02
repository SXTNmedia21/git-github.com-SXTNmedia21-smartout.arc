/**
 * Shared types for dashboard hooks and components.
 * Connected to: dashboard-keys.ts, all use-*.ts hooks, SignalCard, ActionStrip
 */

export type ActionItemType =
  | "shift_gaps"
  | "pending_contracts"
  | "stuck_onboarding"
  | "pending_protocols"
  | "stale_invitations";

export type ActionPriority = "critical" | "warning" | "info";

export type ActionItem = {
  type: ActionItemType;
  count: number;
  priority: ActionPriority;
  label: string;
};

export type ActionCounts = {
  shiftGaps: number;
  pendingContracts: number;
  stuckOnboarding: number;
  pendingProtocols: number;
  staleInvitations: number;
  total: number;
};

export type SignalStatus = "good" | "warning" | "critical";

export type SignalCardData = {
  label: string;
  value: string | number;
  target?: string;
  status: SignalStatus;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  isPlaceholder?: boolean;
};

export type DayCoverage = {
  date: string;
  dayLabel: string;
  totalShifts: number;
  assignedShifts: number;
  fillPercent: number;
};

export type PipelineData = {
  activeStaff: number;
  newHires30d: number;
  departures30d: number;
  onboarding: number;
};

export type TrainingReadinessData = {
  totalAssignments: number;
  completed: number;
  pending: number;
  expired: number;
  readinessPercent: number;
};

export type DepartmentShiftGroup = {
  departmentId: string;
  departmentName: string;
  departmentColor: string | null;
  shifts: DepartmentShiftDetail[];
  totalHours: number;
  staffCount: number;
};

export type DepartmentShiftDetail = {
  shiftId: string;
  employeeName: string | null;
  employeeId: string | null;
  role: string;
  startTime: string;
  endTime: string;
  workHours: number;
  status: string;
};
