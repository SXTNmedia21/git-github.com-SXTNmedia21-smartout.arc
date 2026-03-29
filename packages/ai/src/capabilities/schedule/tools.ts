// packages/ai/src/capabilities/schedule/tools.ts
//
// Server-side schedule query tools for the Botsson agent.
// These tools provide employee-centric and department-level schedule data.
// All tools are read-only in v1.0 — no write operations.

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get the current employee's upcoming shifts for the next N days.
 * Returns shift times, positions, departments, locations, and status.
 */
export const getMyShifts = defineTool({
  name: "get_my_shifts",
  description:
    "Get the current employee's upcoming shifts for the next N days. Returns shift times, positions, departments, and status.",
  schema: z.object({
    days: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .default(7)
      .describe("Number of days to look ahead (default: 7)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const now = new Date().toISOString();
    const until = new Date(Date.now() + params.days * 86400000).toISOString();

    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        "id, start_time, end_time, position, status, department:department_id(name), location:location_id(name)",
      )
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .gte("start_time", now)
      .lte("start_time", until)
      .order("start_time", { ascending: true });

    if (error) return `Error loading shifts: ${error.message}`;
    if (!data || data.length === 0) return "No upcoming shifts found.";
    return JSON.stringify(data);
  },
});

/**
 * Get colleagues working the same shift.
 * Finds all employees scheduled to work at the same time in the same department.
 */
export const getShiftColleagues = defineTool({
  name: "get_shift_colleagues",
  description:
    "Get colleagues working the same shift (who else is scheduled at the same time in the same department)",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift ID to check colleagues for"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // First get the target shift's time and department
    const { data: shift, error: shiftError } = await supabase
      .from("schedule_shift")
      .select("start_time, end_time, department_id")
      .eq("id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (shiftError || !shift) return "Shift not found.";

    // Find overlapping shifts in the same department
    const { data, error } = await supabase
      .from("schedule_shift")
      .select("id, profile:profile_id(display_name, profile_id), position, start_time, end_time")
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", shift.department_id)
      .lt("start_time", shift.end_time)
      .gt("end_time", shift.start_time)
      .neq("profile_id", ctx.profileId)
      .order("start_time", { ascending: true });

    if (error) return `Error loading colleagues: ${error.message}`;
    if (!data || data.length === 0) return "No other colleagues found for this shift.";
    return JSON.stringify(data);
  },
});

/**
 * Get the full department schedule for today.
 * Returns all shifts across all employees for a specific department.
 */
export const getTodaySchedule = defineTool({
  name: "get_today_schedule",
  description: "Get the full department schedule for today (all shifts across all employees)",
  schema: z.object({
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Department ID. If omitted, uses the employee's primary department."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let deptId = params.department_id;
    if (!deptId) {
      const { data: profile } = await supabase
        .from("profile")
        .select("department_id")
        .eq("profile_id", ctx.profileId)
        .eq("workspace_id", ctx.workspaceId)
        .single();
      deptId = profile?.department_id;
    }

    if (!deptId) return "No department found for this employee.";

    const { data, error } = await supabase
      .from("schedule_shift")
      .select("id, start_time, end_time, position, status, profile:profile_id(display_name)")
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", deptId)
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", todayEnd.toISOString())
      .order("start_time", { ascending: true });

    if (error) return `Error loading schedule: ${error.message}`;
    if (!data || data.length === 0) return "No shifts scheduled for today.";
    return JSON.stringify(data);
  },
});

/**
 * Get full details for a specific shift.
 * Includes time, position, department, location, and related employee info.
 */
export const getShiftDetail = defineTool({
  name: "get_shift_detail",
  description:
    "Get full details for a specific shift including time, position, department, location, and notes",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift ID to get details for"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        "id, start_time, end_time, position, status, notes, department:department_id(name), location:location_id(name), profile:profile_id(display_name)",
      )
      .eq("id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (error || !data) return "Shift not found.";
    return JSON.stringify(data);
  },
});
