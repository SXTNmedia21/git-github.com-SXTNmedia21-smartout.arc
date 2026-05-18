/**
 * use-day-lines.types.ts — Shared row and status types for day-line components.
 *
 * Why here: OpenCloseEditPopover, DayLineCreateSheet, and AttachRoutineDialog all
 * consume DayLineRow. Colocating the type prevents import fan-out and avoids
 * placing runtime-only client types in @smartout/types (server-safe package).
 *
 * References: ADR-0367.
 */

export type DayLineRow = {
  day_line_id: string;
  workspace_id: string;
  department_session_id: string;
  department_id: string;
  location_id: string;
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

export type DayLineStatus = "draft" | "active" | "closed" | "locked" | "cancelled";
