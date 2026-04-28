// packages/ai/src/capabilities/schedule/tools.ts
//
// Server-side schedule query tools for the Botsson agent.
// These tools provide employee-centric and department-level schedule data.
// All tools are read-only in v1.0 — no write operations.
//
// Timezone contract (D2, 2026-04-24):
//   schedule_shift.start_time / end_time are TIMESTAMPTZ stored as UTC.
//   The user lives in Europe/Oslo. All day-boundary queries MUST anchor
//   to Oslo wall-clock (via startOfOsloDay / endOfOsloDay), and every
//   row returned to the LLM MUST include a pre-formatted `local` block
//   so the model never does UTC→Oslo conversion in its head and says
//   "Lørdag" when it is Fredag 22:00 Oslo.

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { startOfOsloDay, endOfOsloDay, enrichShiftRowWithOsloTime } from "./oslo-time.js";

/**
 * Get the current employee's upcoming shifts for the next N days.
 * Returns shift times, positions, departments, locations, and status.
 */
export const getMyShifts = defineTool({
  name: "get_my_shifts",
  description:
    "Get the current employee's upcoming shifts for the next N days. Returns shift times, positions, departments, and status.",
  capability: "schedule",
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
    const supabase = ctx.supabaseAdmin;
    // D2 fix: anchor day boundaries to Europe/Oslo, not raw UTC.
    // Raw `new Date().toISOString()` = UTC "now", which at 23:30 UTC Friday
    // (01:30 Oslo Saturday) would miss shifts that started earlier on the
    // Oslo Friday. `startOfOsloDay(now)` = 00:00 Oslo today, so the
    // employee gets their full Oslo-day view.
    // `until` = start of the Oslo day that is `days` days from today
    // (= exclusive upper-bound at midnight Oslo). We advance by
    // (days + 1) * 26h to safely skip past DST seams, then startOfOsloDay
    // normalises back to the exact midnight. Result: 7 Oslo days, not 7*24h.
    // Refs: Council 2026-04-28 voice + tool perf, ADR-0192 (Oslo TZ canonical).
    const nowDate = new Date();
    const nowOslo = startOfOsloDay(nowDate);
    const untilRef = new Date(nowOslo.getTime() + params.days * 24 * 3600_000 + 3600_000);
    const until = startOfOsloDay(untilRef);

    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        "id, start_time, end_time, position, status, department:department_id(name), location:location_id(name)",
      )
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .gte("start_time", nowOslo.toISOString())
      .lte("start_time", until.toISOString())
      .order("start_time", { ascending: true });

    if (error) return `Error loading shifts: ${error.message}`;
    if (!data || data.length === 0) return "No upcoming shifts found.";
    // Enrich every row with Oslo-localized weekday + time so the LLM
    // quotes the correct day. Raw UTC ISO stays in `start_time` /
    // `end_time` for any downstream consumer that wants it.
    const enriched = data.map((row) => enrichShiftRowWithOsloTime(row));
    return JSON.stringify(enriched);
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
  capability: "schedule",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift ID to check colleagues for"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

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
    const enriched = data.map((row) => enrichShiftRowWithOsloTime(row));
    return JSON.stringify(enriched);
  },
});

/**
 * Get the full department schedule for today.
 * Returns all shifts across all employees for a specific department.
 */
export const getTodaySchedule = defineTool({
  name: "get_today_schedule",
  description: "Get the full department schedule for today (all shifts across all employees)",
  capability: "schedule",
  schema: z.object({
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Department ID. If omitted, uses the employee's primary department."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    // D2 fix: "today" means the Oslo calendar day, not the server's
    // local (UTC) day. setHours() on a fresh Date would compute
    // midnight in the SERVER's timezone, which on Vercel/Droplet is UTC,
    // causing a Friday 22:00 Oslo shift to appear on the wrong day once
    // the UTC clock rolls past 00:00 (23:00/00:00 Oslo).
    const now = new Date();
    const todayStart = startOfOsloDay(now);
    const todayEnd = endOfOsloDay(now);

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
    const enriched = data.map((row) => enrichShiftRowWithOsloTime(row));
    return JSON.stringify(enriched);
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
  capability: "schedule",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift ID to get details for"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        "id, start_time, end_time, position, status, notes, department:department_id(name), location:location_id(name), profile:profile_id(display_name)",
      )
      .eq("id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (error || !data) return "Shift not found.";
    return JSON.stringify(enrichShiftRowWithOsloTime(data));
  },
});
