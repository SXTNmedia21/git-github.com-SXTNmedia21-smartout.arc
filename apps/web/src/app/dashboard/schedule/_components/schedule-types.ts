// ============================================
// schedule-types.ts
// Type definitions for the schedule module's local state.
// These types are designed to map 1:1 to the future database
// tables (MODULE_03 §15) so the migration is a drop-in replacement.
// Connected to: packages/types/src/enums.ts (shared enums)
// Connected to: _hooks/use-shifts.ts, _hooks/use-schedule-computed.ts (data consumers)
// ============================================

import type {
  AbsenceType,
  DayCategory,
  RequestType,
  ShiftStatus,
  TaskStatus,
} from "@smartout/types";

// ── Re-exports from @smartout/types for convenience ─────────
export type { AbsenceType, DayCategory, RequestType, ShiftStatus, TaskStatus };

// ── Shift (maps to future schedule_shift table) ─────────────
export type Shift = {
  id: string;
  /** null = unassigned shift (created state) */
  employeeId: string | null;
  dateId: string;
  role: string;
  /** FK to payroll.shift_type — links to canonical shift type */
  shiftTypeId?: string;
  /** FK to department (cascade A1) */
  departmentId?: string;
  /** FK to location (cascade A1) */
  locationId?: string;
  /** future FK to position table */
  positionId?: string;
  /** future FK to team table */
  teamId?: string;
  /** Display format: "08:00 - 16:00" */
  time: string;
  /** Start time for calculations: "08:00" */
  startTime: string;
  /** End time for calculations: "16:00" */
  endTime: string;
  /** Calculated: endTime - startTime - breaks (in hours) */
  workHours: number;
  status: ShiftStatus;
  /** From @smartout/types — morning, midday, afternoon, evening, night, weekend */
  dayCategory: DayCategory;
  /** Kitchen zone, floor section, etc. */
  zone?: string;
  /** Color indicator for the shift card: blue, emerald, purple, orange */
  indicator: string;
  /** Derived from status, kept for quick filtering */
  isPublished: boolean;
  /** Break duration in minutes */
  breaks: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  /** Timestamp when the employee confirmed/acknowledged the shift */
  confirmedAt?: string;
  /** Profile ID of the employee who confirmed */
  confirmedBy?: string;
};

// ── Absence (maps to future absence table) ──────────────────
// MODULE_03 §7: Absences are separate from shifts
export type Absence = {
  id: string;
  employeeId: string;
  dateId: string;
  /** sick_leave, vacation, parental_leave, etc. */
  type: AbsenceType;
  /** Availability signaling */
  requestType?: RequestType;
  reason?: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  status: "pending" | "approved" | "rejected";
};

// ── Template (maps to future shift_template table) ──────────
// MODULE_03 §13.1: Templates can include/exclude staff assignments
export type ShiftTemplate = {
  id: string;
  name: string;
  department: string;
  departmentId: string | null;
  shifts: Omit<Shift, "id" | "dateId" | "createdAt" | "updatedAt" | "isPublished">[];
  /** MODULE_03 §13.1: optionally include/exclude staff when saving */
  includeAssignments: boolean;
  /** Employee name (future: profile_id) */
  createdBy: string;
  createdAt: string;
};

// ── Day Message ─────────────────────────────────────────────
export type DayMessage = {
  id: string;
  dateId: string;
  title: string;
  content: string;
  /** "all" | "leaders" | team name for scoped messages */
  audience: "all" | "leaders" | string;
  visibility: "all_day" | "until_16" | "permanent";
  author: string;
  isAlert: boolean;
  createdAt: string;
};

// ── Day Task ────────────────────────────────────────────────
export type DayTask = {
  id: string;
  dateId: string;
  label: string;
  /** From @smartout/types: pending, in_progress, completed, etc. */
  status: TaskStatus;
  category: "all" | "routine" | "delegated";
  assignedTo?: string;
  completedAt?: string;
  highlight: boolean;
};

// ── Day Booking ─────────────────────────────────────────────
export type DayBooking = {
  id: string;
  dateId: string;
  title: string;
  guestCount: number;
  menu: string;
  time: string;
  location: string;
  status: "confirmed" | "pending" | "cancelled";
  isVip: boolean;
  notes?: string;
  contactPerson?: string;
};

// ── Open Shift ──────────────────────────────────────────────
export type OpenShift = {
  id: string;
  title: string;
  time: string;
  startTime: string;
  endTime: string;
  department?: string;
  role?: string;
  dayCategory?: DayCategory;
};

// ── Clipboard (copy/paste day operations) ───────────────────
export type DayClipboard = {
  sourceDate: string;
  sourceDateLabel: string;
  shifts: Omit<Shift, "id" | "dateId" | "createdAt" | "updatedAt">[];
  absences: Omit<Absence, "id" | "dateId">[];
};

// ── Shift History (local audit trail) ───────────────────────
export type ShiftHistoryEntry = {
  id: string;
  shiftId: string;
  eventType: "created" | "updated" | "status_changed" | "assigned" | "moved" | "deleted";
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  /** "System" or employee name */
  actor: string;
};

// ── Day selection for batch operations (MODULE_03 §5) ───────
export type SelectedDays = Set<string>;

// ── Agent shift proposals (ghost cards) ─────────────────────
// Agent-initiated create/update produce proposals that require human approval.

// ── Proposal source discriminator (ADR-0289 / Fase 4) ───────
// "agent_response" is active in V0. "proactive" and "scheduled" are
// reserved for future sorties — shape is forwards-compatible from day one.
export type ProposalSource =
  | "agent_response" // User asked Botsson, Botsson proposes
  | "proactive" // Reserved: Botsson detects pattern unprompted
  | "scheduled"; // Reserved: cron/event-triggered suggestion

export type ShiftProposalCreate = {
  id: string;
  type: "create";
  source?: ProposalSource; // ← added (Fase 4 / ADR-0289)
  employeeId: string;
  employeeName?: string;
  dateId: string;
  role: string;
  startTime: string;
  endTime: string;
  workHours: number;
  dayCategory: string;
  indicator: string;
  breaks: number;
  /** Links proposal to a grid column (department_shift_type_config.id). */
  shiftTypeConfigId?: string;
};

export type ShiftProposalUpdate = {
  id: string;
  type: "update";
  source?: ProposalSource; // ← added (Fase 4 / ADR-0289)
  shiftId: string;
  employeeId: string;
  dateId: string;
  patch: Record<string, unknown>;
};

export type ShiftProposalDelete = {
  id: string;
  type: "delete";
  source?: ProposalSource; // ← added (Fase 4 / ADR-0289)
  shiftId: string;
  employeeId: string;
  dateId: string;
};

export type ShiftProposal = ShiftProposalCreate | ShiftProposalUpdate | ShiftProposalDelete;
