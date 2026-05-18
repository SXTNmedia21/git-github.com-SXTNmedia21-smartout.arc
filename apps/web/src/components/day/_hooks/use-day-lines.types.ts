/**
 * use-day-lines.types.ts
 *
 * Shared row type for day_line queries. Used by useDayLines hook and
 * AggregatedDayLineList component. Reflects the day_line table with
 * joined location and department name fields.
 */

export type DayLineRow = {
  day_line_id: string;
  workspace_id: string;
  department_session_id: string | null;
  department_id: string | null;
  location_id: string | null;
  business_date: string;
  planned_open: string;
  planned_close: string;
  source_template_id: string | null;
  notes: string | null;
  cancelled_at: string | null;
  is_backfilled: boolean;
  location: { name: string };
  department: { name: string };
};
