/**
 * use-day-lines.types.ts
 *
 * Shared types for the day_line read surface (ADR-0367 §4.1).
 * DayLineRow reflects the database shape + joined location/department names
 * as returned by useDayLines.
 *
 * Status is NEVER stored — always derived via deriveDayLineStatus().
 */

export type DayLineStatus = "draft" | "active" | "closed" | "locked" | "cancelled";

/**
 * Full day_line row with joined area metadata.
 * Field order mirrors the database columns (ADR-0367 §4.1).
 */
export type DayLineRow = {
  day_line_id: string;
  workspace_id: string;
  department_session_id: string;
  department_id: string;
  location_id: string;
  business_date: string; // ISO date string "YYYY-MM-DD"
  planned_open: string; // "HH:MM:SS"
  planned_close: string; // "HH:MM:SS"
  source_template_id: string | null;
  notes: string | null;
  cancelled_at: string | null;
  is_backfilled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from location.name */
  location_name: string;
  /** Joined from department.name */
  department_name: string;
};
