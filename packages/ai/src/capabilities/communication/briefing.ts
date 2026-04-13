// packages/ai/src/capabilities/communication/briefing.ts
// Shift briefing composer — reads cascade dimensions D1, D2, D6, K1b
// to produce a concise pre-shift briefing for an employee.
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * compose_shift_briefing — Reads schedule, team, session context, and relevant
 * knowledge to create a concise briefing for an employee's upcoming shift.
 */
export const composeShiftBriefing = defineTool({
  name: "compose_shift_briefing",
  description:
    "Compose a context-aware shift briefing for an employee. Reads schedule, team, session context, and relevant knowledge to create a concise briefing.",
  schema: z.object({
    shift_id: z
      .string()
      .uuid()
      .optional()
      .describe("Specific shift ID, or omit for current/next shift"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const now = new Date().toISOString();
    const today = now.slice(0, 10); // YYYY-MM-DD

    // ── 1. Resolve the target shift (D2) ────────────────────────────────
    let shift: ShiftRow | null = null;

    if (params.shift_id) {
      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, employee_id, department_id, role, shift_date, start_time, end_time, work_hours, notes, status, team_id, location_id",
        )
        .eq("schedule_shift_id", params.shift_id)
        .eq("workspace_id", ctx.workspaceId)
        .single();

      if (error || !data) {
        return JSON.stringify({ error: "Shift not found." });
      }
      shift = data as ShiftRow;
    } else {
      // Find the employee's current or next upcoming shift
      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, employee_id, department_id, role, shift_date, start_time, end_time, work_hours, notes, status, team_id, location_id",
        )
        .eq("employee_id", ctx.profileId)
        .eq("workspace_id", ctx.workspaceId)
        .gte("shift_date", today)
        .in("status", ["draft", "published", "confirmed"])
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1)
        .single();

      if (error || !data) {
        return JSON.stringify({ error: "No upcoming shifts found." });
      }
      shift = data as ShiftRow;
    }

    const departmentId = shift.department_id;
    const shiftDate = shift.shift_date;
    const dayOfWeek = new Date(shiftDate).getDay(); // 0=Sun, 6=Sat

    // ── 2. Parallel fetches: colleagues, session, memories, hours ────────
    const [colleaguesResult, sessionResult, memoriesResult, hoursResult] = await Promise.all([
      // D2: Colleagues on same shift (same department + date)
      supabase
        .from("schedule_shift")
        .select("employee_id, role, start_time, end_time")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", departmentId)
        .eq("shift_date", shiftDate)
        .neq("employee_id", ctx.profileId)
        .in("status", ["published", "confirmed"]),

      // D6: Today's department_session
      departmentId
        ? supabase
            .from("department_session")
            .select(
              "department_session_id, status, planned_open, planned_close, duty_leader_id, handoff_notes, tasks_total, tasks_completed",
            )
            .eq("workspace_id", ctx.workspaceId)
            .eq("department_id", departmentId)
            .eq("session_date", shiftDate)
            .limit(1)
            .single()
        : Promise.resolve({ data: null, error: null }),

      // K1b: Recent engine_memory relevant to the department (scope = department or workspace)
      departmentId
        ? supabase
            .from("engine_memory")
            .select("content, memory_type, importance, created_at")
            .eq("workspace_id", ctx.workspaceId)
            .gte("importance", 0.5)
            .order("created_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),

      // D1: Department operating hours for today
      departmentId
        ? supabase
            .from("department_operating_hours")
            .select("open_time, close_time, is_closed")
            .eq("workspace_id", ctx.workspaceId)
            .eq("department_id", departmentId)
            .eq("day_of_week", dayOfWeek)
            .limit(1)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // ── 3. Compose the briefing ─────────────────────────────────────────
    const colleagues = (colleaguesResult.data ?? []).map((c) => ({
      employee_id: c.employee_id,
      role: c.role,
      start_time: c.start_time,
      end_time: c.end_time,
    }));

    const session = sessionResult.data
      ? {
          status: sessionResult.data.status,
          planned_open: sessionResult.data.planned_open,
          planned_close: sessionResult.data.planned_close,
          duty_leader_id: sessionResult.data.duty_leader_id,
          handoff_notes: sessionResult.data.handoff_notes,
          tasks_total: sessionResult.data.tasks_total,
          tasks_completed: sessionResult.data.tasks_completed,
        }
      : null;

    const memories = (memoriesResult.data ?? []).map((m) => ({
      content: m.content,
      type: m.memory_type,
      importance: m.importance,
    }));

    const hours = hoursResult.data
      ? {
          open_time: hoursResult.data.open_time,
          close_time: hoursResult.data.close_time,
          is_closed: hoursResult.data.is_closed,
        }
      : null;

    const briefing = {
      shift: {
        id: shift.schedule_shift_id,
        role: shift.role,
        date: shift.shift_date,
        start: shift.start_time,
        end: shift.end_time,
        hours: shift.work_hours,
        notes: shift.notes,
        status: shift.status,
      },
      team: {
        colleague_count: colleagues.length,
        colleagues,
      },
      session,
      department_hours: hours,
      announcements: memories,
    };

    return JSON.stringify(briefing);
  },
});

/** Internal type matching the select columns from schedule_shift. */
type ShiftRow = {
  schedule_shift_id: string;
  employee_id: string | null;
  department_id: string | null;
  role: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  work_hours: number;
  notes: string | null;
  status: string;
  team_id: string | null;
  location_id: string | null;
};
