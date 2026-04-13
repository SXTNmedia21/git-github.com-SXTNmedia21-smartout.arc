/**
 * Shared types for the Mal-modus (template-based schedule view).
 * Used by both web and mobile surfaces.
 */

export type MalColumn = {
  templateShiftId: string;
  role: string;
  startTime: string;
  endTime: string;
  workHours: number;
  slotCount: number;
  dayCategory: string;
  indicator: string;
  departmentId: string;
  departmentName: string;
};

export type MalEmployeeAssignment = {
  shiftId: string;
  employeeId: string;
  employeeName: string;
  avatarColor: string;
  initials: string;
  status: "created" | "assigned" | "published" | "active" | "completed" | "unpublished";
  hasSwapRequest: boolean;
  hasUnreadMessage: boolean;
  /** Shift start time (HH:MM) — used in tooltip and for DnD placement */
  startTime?: string;
  /** Shift end time (HH:MM) */
  endTime?: string;
  /** Role/position label from the shift */
  role?: string;
  /** Department ID the shift belongs to */
  departmentId?: string;
};

export type MalTask = {
  taskId: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
};

export type MalCell = {
  dayIndex: number;
  dateId: string;
  templateShiftId: string;
  assignments: MalEmployeeAssignment[];
  tasks: MalTask[];
  emptySlots: number;
};

export type MalGridData = {
  columns: MalColumn[];
  cells: Map<string, MalCell>;
  weekDays: {
    index: number;
    dateId: string;
    label: string;
    shortLabel: string;
    isWeekend: boolean;
  }[];
  templateId: string;
  templateName: string;
  stats: {
    totalSlots: number;
    filledSlots: number;
    totalHours: number;
    estimatedCost: number;
    taskCount: number;
    swapRequests: number;
    emptySlots: number;
  };
};

/** Key for cell lookup: `${dateId}::${templateShiftId}` */
export function cellKey(dateId: string, templateShiftId: string): string {
  return `${dateId}::${templateShiftId}`;
}

/** Add N days to a YYYY-MM-DD date string */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── New grid-first types (week-grid redesign) ──────────────

/** Column derived from department_shift_type_config — no template dependency */
export type GridColumn = {
  configId: string;
  shiftTypeId: string;
  shiftTypeName: string;
  shiftTypeColor: string | null;
  label: string;
  startTime: string;
  endTime: string;
  workHours: number;
  breakMinutes: number;
  slotCount: number;
  sortOrder: number;
  departmentId: string;
  departmentName: string;
};

/** Single day × column intersection in the grid */
export type GridCell = {
  dayIndex: number;
  dateId: string;
  configId: string;
  assignments: MalEmployeeAssignment[];
  tasks: MalTask[];
  emptySlots: number;
};

/** Aggregated stats for the entire week grid */
export type GridStats = {
  totalSlots: number;
  filledSlots: number;
  totalHours: number;
  estimatedCost: number;
  taskCount: number;
  swapRequests: number;
  emptySlots: number;
};

/** One day in the 7-day week header */
export type DayInfo = {
  index: number;
  dateId: string;
  label: string;
  shortLabel: string;
  isWeekend: boolean;
};

/** Complete grid data structure — template-free, config-driven */
export type WeekGridData = {
  columns: GridColumn[];
  cells: Map<string, GridCell>;
  weekDays: DayInfo[];
  stats: GridStats;
};

/**
 * Synthetic configId for shifts that have no shift_type_id.
 * These appear in the "Ikke tildelt" column so every shift in the week
 * is visible in Bemanning, even if it was created without a shift type.
 */
export const UNASSIGNED_CONFIG_ID = "__unassigned__";

/** Cell key for grid lookup: `${dateId}::${configId}` */
export function gridCellKey(dateId: string, configId: string): string {
  return `${dateId}::${configId}`;
}
