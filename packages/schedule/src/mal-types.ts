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
