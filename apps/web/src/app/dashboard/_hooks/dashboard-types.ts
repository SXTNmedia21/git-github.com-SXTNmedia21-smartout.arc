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

export type ProtocolOverviewItem = {
  protocolId: string;
  protocolName: string;
  protocolDescription: string | null;
  policyType: string;
  totalAssigned: number;
  completedCount: number;
  pendingCount: number;
  expiredCount: number;
  completionPercent: number;
};

export type ProtocolAssignee = {
  assignmentId: string;
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  status: "pending" | "completed" | "expired";
  assignedAt: string;
  completedAt: string | null;
};

export type JourneyStep = {
  stepId: string;
  title: string;
  description: string | null;
  stepOrder: number;
  isRequired: boolean;
  estimatedMinutes: number | null;
  isCompleted: boolean;
};

export type JourneyPhase = {
  name: string;
  type: "procedures" | "test" | "confirmation";
  total: number;
  completed: number;
  status: "completed" | "in_progress" | "not_started";
};

export type ProtocolJourneyData = {
  phases: JourneyPhase[];
  steps: JourneyStep[];
};
