// ============================================
// shift.ts
// Zod schemas for shift tool input validation.
// Maps to the schedule_shift table columns created in
// migration 20260301300000_schedule_shift_table.sql.
// Connected to: schedule-types.ts (frontend Shift type)
// Connected to: src/server.ts (tool input schemas)
// ============================================

import { z } from "zod";

/** Time string in HH:MM format */
const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format");

/** Date string in YYYY-MM-DD format */
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

/** Valid shift statuses matching the shift_status enum */
export const shiftStatusSchema = z.enum([
  "created",
  "assigned",
  "published",
  "active",
  "completed",
  "unpublished",
]);

/** Valid day categories matching the day_category enum */
export const dayCategorySchema = z.enum([
  "morning",
  "midday",
  "afternoon",
  "evening",
  "night",
  "weekend",
]);

/** Input schema for creating a new shift */
export const createShiftInput = z.object({
  workspace_id: z.string().uuid().describe("Workspace UUID"),
  shift_date: dateString.describe("Shift date in YYYY-MM-DD format"),
  role: z.string().min(1).describe("Role name for the shift"),
  start_time: timeString.describe("Start time in HH:MM format"),
  end_time: timeString.describe("End time in HH:MM format"),
  day_category: dayCategorySchema.describe("Time-of-day classification"),
  employee_id: z
    .string()
    .uuid()
    .nullish()
    .describe("Profile UUID of assigned employee, null for unassigned"),
  position_id: z.string().uuid().nullish().describe("Position UUID"),
  team_id: z.string().uuid().nullish().describe("Team UUID"),
  // ADR-0430 M1: schedule_shift.department_id is NOT NULL. The trigger-derive
  // path (position_id → department_id) only fires on UPDATE OF position_id, not
  // on INSERT — so a department MUST be resolved before insert. Supply either
  // department_session_id (strongest — ties to a live session) or department_id.
  department_id: z
    .string()
    .uuid()
    .optional()
    .describe("Department UUID. Required if department_session_id not supplied (M1 NOT NULL)."),
  department_session_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Department session UUID — strongest department resolution path (resolves department_id).",
    ),
  breaks: z.number().int().min(0).default(0).describe("Break duration in minutes"),
  // ADR-0430 M4: scalar `zone` column dropped from schedule_shift. Zone is now
  // an M:N relation via shift_zone (keyed by shift_session_id + day_line_id).
  zone_ids: z
    .array(z.string().uuid())
    .optional()
    .default([])
    .describe("Zone UUIDs to assign this shift to (M:N via shift_zone). ADR-0430."),
  indicator: z
    .enum(["blue", "emerald", "purple", "orange"])
    .default("blue")
    .describe("Color indicator for shift card"),
  notes: z.string().nullish().describe("Optional notes for the shift"),
  status: shiftStatusSchema.default("created").describe("Shift lifecycle status"),
  is_published: z.boolean().default(false).describe("Whether the shift is published"),
});

/** Input schema for updating an existing shift */
export const updateShiftInput = z.object({
  shift_id: z.string().uuid().describe("Schedule shift UUID to update"),
  shift_date: dateString.optional().describe("Shift date in YYYY-MM-DD format"),
  role: z.string().min(1).optional().describe("Role name for the shift"),
  start_time: timeString.optional().describe("Start time in HH:MM format"),
  end_time: timeString.optional().describe("End time in HH:MM format"),
  day_category: dayCategorySchema.optional().describe("Time-of-day classification"),
  employee_id: z
    .string()
    .uuid()
    .nullish()
    .describe("Profile UUID of assigned employee, null to unassign"),
  position_id: z.string().uuid().nullish().describe("Position UUID"),
  team_id: z.string().uuid().nullish().describe("Team UUID"),
  breaks: z.number().int().min(0).optional().describe("Break duration in minutes"),
  // ADR-0430 M4: scalar `zone` dropped. zone_ids REPLACES the zone assignment set
  // for this shift. undefined = leave zones unchanged; [] = clear all assignments.
  zone_ids: z
    .array(z.string().uuid())
    .optional()
    .describe(
      "Replace zone assignments (M:N via shift_zone). undefined = unchanged; [] = clear all. ADR-0430.",
    ),
  indicator: z
    .enum(["blue", "emerald", "purple", "orange"])
    .optional()
    .describe("Color indicator for shift card"),
  notes: z.string().nullish().describe("Optional notes for the shift"),
  status: shiftStatusSchema.optional().describe("Shift lifecycle status"),
  is_published: z.boolean().optional().describe("Whether the shift is published"),
});

/** Input schema for listing shifts with date range filter */
export const listShiftsInput = z.object({
  workspace_id: z.string().uuid().describe("Workspace UUID"),
  date_from: dateString.describe("Start of date range (inclusive) in YYYY-MM-DD"),
  date_to: dateString.describe("End of date range (inclusive) in YYYY-MM-DD"),
  employee_id: z.string().uuid().optional().describe("Filter by employee profile UUID"),
  status: shiftStatusSchema.optional().describe("Filter by shift status"),
  team_id: z.string().uuid().optional().describe("Filter by team UUID"),
});

/** Input schema for getting a single shift */
export const getShiftInput = z.object({
  shift_id: z.string().uuid().describe("Schedule shift UUID"),
});

/** Input schema for deleting a shift */
export const deleteShiftInput = z.object({
  shift_id: z.string().uuid().describe("Schedule shift UUID to delete"),
});

export type CreateShiftInput = z.infer<typeof createShiftInput>;
export type UpdateShiftInput = z.infer<typeof updateShiftInput>;
export type ListShiftsInput = z.infer<typeof listShiftsInput>;
export type GetShiftInput = z.infer<typeof getShiftInput>;
export type DeleteShiftInput = z.infer<typeof deleteShiftInput>;

/**
 * MCP tool result shape — matches CallToolResult from the SDK.
 * Defined locally to avoid fragile deep-import paths.
 */
export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};
