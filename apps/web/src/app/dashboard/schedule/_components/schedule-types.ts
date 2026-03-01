// ============================================
// schedule-types.ts
// Type definitions for the schedule module's local state.
// These types are designed to map 1:1 to the future database
// tables (MODULE_03 §15) so the migration is a drop-in replacement.
// Connected to: packages/types/src/enums.ts (shared enums)
// Connected to: schedule-context.tsx (state consumer)
// ============================================

import type { DayCategory, TaskStatus } from "@smartout/types";

// ── Absence types (future: move to @smartout/types) ─────────
// MODULE_03 §7 + Norwegian labor law categories
export type AbsenceType =
  | "sick_leave"
  | "parental_leave"
  | "vacation"
  | "unpaid_leave"
  | "military"
  | "training"
  | "welfare";

// ── Request type (availability signaling) ───────────────────
export type RequestType = "available" | "not_available" | "prefer_not" | "prefer";

// ── Shift lifecycle (MODULE_03 §11) ─────────────────────────
// 6 states: created → assigned → published → active → completed → unpublished
export type ShiftStatus =
  | "created"
  | "assigned"
  | "published"
  | "active"
  | "completed"
  | "unpublished";

// ── Shift (maps to future schedule_shift table) ─────────────
export type Shift = {
  id: string;
  /** null = unassigned shift (created state) */
  employeeId: string | null;
  dateId: string;
  role: string;
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

// ── Re-exports for convenience ──────────────────────────────
export type { DayCategory, TaskStatus };
