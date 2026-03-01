// Shared types and constants for the schedule module.
// Employee data now comes from use-employees.ts hook (Supabase profile query).
// Shift data comes from use-shifts.ts hook (Supabase schedule_shift query).

export type DragPreviewData = {
  title?: string;
  role?: string;
  time?: string;
};

export type DayColumn = {
  id: string;
  label: string;
  staff: number;
  shifts: number;
  cost: string;
  isToday?: boolean;
  isHoliday?: boolean;
  coverageAlert?: string;
  messages?: number;
  tasks?: { done: number; total: number };
  situation: string;
};

/** Physical zones within the venue, for shift assignment dropdowns */
export const AVAILABLE_ZONES = [
  "Hovedkjøkken",
  "Kaldt kjøkken",
  "Bar",
  "Sal 1",
  "Sal 2",
  "Uteservering",
  "Resepsjon",
];
