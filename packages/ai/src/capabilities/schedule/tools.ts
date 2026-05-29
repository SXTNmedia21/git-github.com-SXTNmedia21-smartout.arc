// packages/ai/src/capabilities/schedule/tools.ts
//
// Server-side schedule query tools for the Botsson agent.
// Provides employee-centric, admin/manager workspace-level, and date-aware tools.
// All tools are read-only — no write operations.
//
// Timezone contract (D2, 2026-04-24):
//   schedule_shift.start_time / end_time are TIMESTAMPTZ stored as UTC.
//   The user lives in Europe/Oslo. All day-boundary queries MUST anchor
//   to Oslo wall-clock (via startOfOsloDay / endOfOsloDay), and every
//   row returned to the LLM MUST include a pre-formatted `local` block
//   so the model never does UTC→Oslo conversion in its head and says
//   "Lørdag" when it is Fredag 22:00 Oslo.
//
// Role-based tools (2026-05-11):
//   get_workspace_schedule — admin/manager/owner only. Returns all shifts for a
//     given date across the workspace (or filtered by department). Fixes the
//     false-negative class where admins got "No upcoming shifts found" because
//     the employee tools filtered on ctx.profileId.
//   get_date_schedule_for_me — employee date tool. Like get_my_shifts but for a
//     specific date instead of a rolling N-day window.

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { emit } from "@smartout/telemetry";
import {
  startOfOsloDay,
  endOfOsloDay,
  enrichShiftRowWithOsloTime,
  osloWeekdayFromDateStr,
} from "./oslo-time.js";

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

    // Real schedule_shift schema: schedule_shift_id (PK), employee_id (FK to
    // profile.profile_id), shift_date (DATE), start_time/end_time (TIME — no
    // date), role, department_id (NULLABLE — canonical link via position).
    // Day-window query goes through shift_date in Oslo wall-clock.
    const todayDateStr = nowOslo.toISOString().slice(0, 10);
    const untilDateStr = until.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        // ADR-0430 Rule 3: location now joins through shift_session → shift_session_day_line → day_line → location.
        // schedule_shift.location_id is a stale planning-layer scalar (drops in M4).
        // The cascade-correct path: shift_session (1:1 via UNIQUE FK) → shift_session_day_line (1:N) → day_line → location.
        // We take the first day_line's location for the scalar "where" string the LLM reads.
        "schedule_shift_id, shift_date, start_time, end_time, role, status, department:department_id(name), shift_session(shift_session_day_line(day_line(location(name))))",
      )
      .eq("employee_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .gte("shift_date", todayDateStr)
      .lte("shift_date", untilDateStr)
      .order("shift_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) return JSON.stringify({ error: "db_query_failed", detail: error.message });
    if (!data || data.length === 0)
      return JSON.stringify({
        empty: true,
        scope: "personal",
        window: "next_n_days",
        days: params.days,
      });
    // Compose readable Oslo-localized entries. start_time/end_time are TIME
    // strings (HH:MM:SS), shift_date is DATE — combine for the LLM so it
    // quotes the correct day + time and never does conversion in its head.
    const enriched = data.map((row) => ({
      schedule_shift_id: row.schedule_shift_id,
      shift_date: row.shift_date,
      start_time: row.start_time,
      end_time: row.end_time,
      role: row.role,
      status: row.status,
      department: row.department,
      // Flatten: cascade path shift_session → [shift_session_day_line] → day_line → location.
      // Use first day_line (index 0) — handles the common single-area shift.
      // Multi-zone shifts (M:N) will show the primary area; full zone list is available via shift_zone.
      // PostgREST typegen returns arrays at every embed level, including 1:1 FK.
      location:
        // Take first element at each level: shift_session[0] → shift_session_day_line[0] → day_line[0] → location[0].
        row.shift_session?.[0]?.shift_session_day_line?.[0]?.day_line?.[0]?.location?.[0] ?? null,
      local: {
        // G10 fix (2026-05-25): osloWeekdayFromDateStr() anchors to noon UTC
        // so the Oslo Intl formatter always resolves the correct calendar day.
        // Do NOT use new Date(`${date}T00:00:00+02:00`) — hardcodes CEST offset
        // and is wrong during winter (CET = +01:00).
        // Timezone contract: Europe/Oslo (hardcoded V1; V2 reads workspace.timezone).
        weekday: osloWeekdayFromDateStr(row.shift_date),
        date: row.shift_date,
        start: `${row.shift_date} ${row.start_time}`,
        end: `${row.shift_date} ${row.end_time}`,
      },
    }));
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
      .eq("schedule_shift_id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (shiftError || !shift)
      return JSON.stringify({ error: "shift_not_found", shift_id: params.shift_id });

    // Find overlapping shifts in the same department
    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        "schedule_shift_id, profile:profile_id(display_name, profile_id), position, start_time, end_time",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", shift.department_id)
      .lt("start_time", shift.end_time)
      .gt("end_time", shift.start_time)
      .neq("profile_id", ctx.profileId)
      .order("start_time", { ascending: true });

    if (error) return JSON.stringify({ error: "db_query_failed", detail: error.message });
    if (!data || data.length === 0)
      return JSON.stringify({ empty: true, scope: "colleagues", shift_id: params.shift_id });
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

    if (!deptId)
      return JSON.stringify({
        error: "no_department",
        actor_role: "must_be_employee_with_department",
        profile_id_kind: "non_operational",
      });

    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        "schedule_shift_id, start_time, end_time, position, status, profile:profile_id(display_name)",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", deptId)
      .gte("start_time", todayStart.toISOString())
      .lte("start_time", todayEnd.toISOString())
      .order("start_time", { ascending: true });

    if (error) return JSON.stringify({ error: "db_query_failed", detail: error.message });
    if (!data || data.length === 0)
      return JSON.stringify({ empty: true, scope: "department", date: "today" });
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
        // ADR-0430 Rule 3: location joins through shift_session → shift_session_day_line → day_line → location.
        "schedule_shift_id, start_time, end_time, position, status, notes, department:department_id(name), shift_session(shift_session_day_line(day_line(location(name)))), profile:profile_id(display_name)",
      )
      .eq("schedule_shift_id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (error || !data)
      return JSON.stringify({ error: "shift_not_found", shift_id: params.shift_id });
    // Flatten cascade path before enriching: expose location at top level to preserve output shape.
    const { shift_session: _ss, ...rest } = data;
    const flattened = {
      ...rest,
      // PostgREST typegen: all embed levels return arrays. Take [0] at each level.
      location: _ss?.[0]?.shift_session_day_line?.[0]?.day_line?.[0]?.location?.[0] ?? null,
    };
    return JSON.stringify(enrichShiftRowWithOsloTime(flattened));
  },
});

/**
 * Get all shifts across the workspace for a specific date.
 *
 * Use ONLY when the current actor is admin, manager, or owner and asks about
 * anyone's shifts on a specific date (e.g. "vis vaktplan for lørdag 16",
 * "hvem jobber 2026-05-17?", "bemanning denne lørdagen").
 *
 * Employees who want their OWN shifts on a date should use
 * get_date_schedule_for_me instead.
 *
 * ADR-0078: display_name is PII — tool is chat-only (no voice path for workspace
 * schedules containing display_names). Channel guard enforced here.
 * ADR-0151: workspace_id derives from ctx.workspaceId (server-side), not from
 * request body.
 */
export const getWorkspaceSchedule = defineTool({
  name: "get_workspace_schedule",
  description:
    "Get all shifts across the workspace for a specific date. Use ONLY when the current actor is admin, manager, or owner and asks about anyone's shifts on a specific date. Returns shift times, employee names, department, location, and role. Requires admin/manager/owner role.",
  capability: "schedule",
  schema: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
      .describe("The calendar date to query (YYYY-MM-DD)"),
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Optional department UUID to narrow the query"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0078: display_name is PII — voice channel is forbidden for workspace
    // schedule (it would expose employee names in audio).
    if (ctx.channel === "voice") {
      return JSON.stringify({
        error: "channel_forbidden",
        reason: "pii_in_voice",
        detail: "Av sikkerhetshensyn kan ikke vaktplanoversikt vises via stemme. Bruk chat.",
      });
    }

    // Role gate: admin/manager/owner only.
    // ctx.userContext is set by session-context BFF at session start.
    const role = ctx.userContext?.role;
    const allowed: Array<string | undefined> = ["admin", "manager", "owner"];
    if (!allowed.includes(role)) {
      return JSON.stringify({
        error: "forbidden",
        reason: "role_insufficient",
        required: ["admin", "manager", "owner"],
        actual: role ?? "unknown",
      });
    }

    const supabase = ctx.supabaseAdmin;
    let query = supabase
      .from("schedule_shift")
      .select(
        // ADR-0430 Rule 3: location joins through shift_session → shift_session_day_line → day_line → location.
        "schedule_shift_id, shift_date, start_time, end_time, role, status, department:department_id(name), shift_session(shift_session_day_line(day_line(location(name)))), profile:employee_id(display_name)",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("shift_date", params.date)
      .order("department_id", { ascending: true })
      .order("start_time", { ascending: true });

    if (params.department_id) {
      query = query.eq("department_id", params.department_id);
    }

    const { data, error } = await query;

    if (error) return JSON.stringify({ error: "db_query_failed", detail: error.message });
    if (!data || data.length === 0) {
      return JSON.stringify({
        empty: true,
        date: params.date,
        department_id: params.department_id ?? null,
        scope: "workspace",
      });
    }

    const enriched = data.map((row) => ({
      schedule_shift_id: row.schedule_shift_id,
      shift_date: row.shift_date,
      start_time: row.start_time,
      end_time: row.end_time,
      role: row.role,
      status: row.status,
      department: row.department,
      // ADR-0430 Rule 3: flatten cascade path to preserve output shape { name }.
      // PostgREST typegen returns arrays at every embed level, including 1:1 FK.
      location:
        // Take first element at each level: shift_session[0] → shift_session_day_line[0] → day_line[0] → location[0].
        row.shift_session?.[0]?.shift_session_day_line?.[0]?.day_line?.[0]?.location?.[0] ?? null,
      profile: row.profile,
      local: {
        // G10 fix (2026-05-25): see getMyShifts comment above.
        // Timezone contract: Europe/Oslo (hardcoded V1).
        weekday: osloWeekdayFromDateStr(row.shift_date),
        date: row.shift_date,
        start: `${row.shift_date} ${row.start_time}`,
        end: `${row.shift_date} ${row.end_time}`,
      },
    }));

    void emit({
      event: "agent.schedule.workspace_queried",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: {
          date: params.date,
          department_id: params.department_id ?? null,
          result_count: enriched.length,
          scope: "workspace",
        },
      },
    });

    return JSON.stringify(enriched);
  },
});

/**
 * Get the current employee's shifts for a specific date.
 *
 * Use when an employee asks about their OWN shifts on a named date
 * (e.g. "jobber jeg lørdag 16?", "hva er vakten min fredag?").
 * For rolling N-day windows, use get_my_shifts instead.
 * Admin/manager wanting ANYONE's shifts on a date should use
 * get_workspace_schedule.
 *
 * Voice-safe: returns only the caller's own shifts, no other PII.
 * ADR-0151: workspace_id and employee_id derive from ctx server-side.
 */
export const getDateScheduleForMe = defineTool({
  name: "get_date_schedule_for_me",
  description:
    "Get the current employee's own shifts for a specific calendar date. Use when an employee asks about their shifts on a named date. Returns shift times, position, department, location, and status. Voice-safe.",
  capability: "schedule",
  schema: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
      .describe("The calendar date to query (YYYY-MM-DD)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("schedule_shift")
      .select(
        // ADR-0430 Rule 3: location joins through shift_session → shift_session_day_line → day_line → location.
        "schedule_shift_id, shift_date, start_time, end_time, role, status, department:department_id(name), shift_session(shift_session_day_line(day_line(location(name))))",
      )
      .eq("employee_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("shift_date", params.date)
      .order("start_time", { ascending: true });

    if (error) return JSON.stringify({ error: "db_query_failed", detail: error.message });
    if (!data || data.length === 0) {
      return JSON.stringify({ empty: true, date: params.date, scope: "personal" });
    }

    const enriched = data.map((row) => ({
      schedule_shift_id: row.schedule_shift_id,
      shift_date: row.shift_date,
      start_time: row.start_time,
      end_time: row.end_time,
      role: row.role,
      status: row.status,
      department: row.department,
      // ADR-0430 Rule 3: flatten cascade path to preserve output shape { name }.
      // PostgREST typegen returns arrays at every embed level, including 1:1 FK.
      location:
        // Take first element at each level: shift_session[0] → shift_session_day_line[0] → day_line[0] → location[0].
        row.shift_session?.[0]?.shift_session_day_line?.[0]?.day_line?.[0]?.location?.[0] ?? null,
      local: {
        // G10 fix (2026-05-25): see getMyShifts comment above.
        // Timezone contract: Europe/Oslo (hardcoded V1).
        weekday: osloWeekdayFromDateStr(row.shift_date),
        date: row.shift_date,
        start: `${row.shift_date} ${row.start_time}`,
        end: `${row.shift_date} ${row.end_time}`,
      },
    }));

    void emit({
      event: "agent.schedule.date_queried_self",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: {
          date: params.date,
          result_count: enriched.length,
          scope: "personal",
        },
      },
    });

    return JSON.stringify(enriched);
  },
});
