/**
 * Local type definition for the time_entry table.
 *
 * The time_entry table lives in a planned `timesheet` schema which is not yet
 * present in the generated database.types.ts. This local type mirrors the
 * expected row shape so the mobile app can compile while the schema migration
 * is pending. Once the `timesheet` schema is created and types regenerated,
 * this file should be replaced with:
 *   type TimeEntry = Database["timesheet"]["Tables"]["time_entry"]["Row"];
 */

export type TimeEntry = {
  time_entry_id: string;
  shift_id: string;
  profile_id: string;
  workspace_id: string;
  punch_in: string;
  punch_out: string | null;
  breaks: unknown | null;
  punch_in_location: unknown | null;
  status: string;
  created_at: string;
  updated_at: string;
};
