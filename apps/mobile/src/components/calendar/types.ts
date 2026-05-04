/**
 * Shared types for the calendar feature.
 *
 * CalendarItem is the unified display model — all data sources (schedule_shift,
 * session_task, schedule_day_booking, deviations) are mapped to this shape by
 * useCalendarItems() before reaching any presentational primitive.
 *
 * Staff/Department are passed down from screen-level hooks; primitives never
 * fetch data directly.
 */

export type Department = "kjokken" | "sal" | "bar" | "event";

export type CalendarItem = {
  id: string;
  type: "shift" | "task" | "booking" | "deviation" | "note";
  /** Day-of-month (1..31). Derived from ISO date string by the hook layer. */
  date: number;
  title: string;
  /** Formatted time range or single time, e.g. "15:00–23:00" or "17:00". */
  time?: string;
  dept: Department;
  status: "upcoming" | "todo" | "done" | "completed" | "overdue" | "confirmed";
  // shift-only
  role?: string;
  zone?: string;
  isShiftLead?: boolean;
  /** Duration in planned hours (for DayCrewCluster totalling). */
  planned?: number;
  /** Owner profile id (for scope filtering in ShiftList). */
  owner?: string;
  // booking-only
  guests?: number;
  tables?: string;
  contact?: string;
  // task-only
  priority?: "high" | "normal" | "low";
  /** Subtitle / secondary description shown below title. */
  sub?: string;
};

export type Staff = {
  id: string;
  name: string;
  role: string;
  dept: Department;
  initials: string;
  color: string;
};
