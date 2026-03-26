"use client";

/**
 * Data hook for Mal-modus (template-based schedule grid).
 * Resolves department → templates → template shifts + schedule shifts + tasks,
 * and combines everything into a MalGridData structure ready for the grid UI.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

import type { MalColumn, MalCell, MalGridData, MalEmployeeAssignment, MalTask } from "./mal-types";
import { cellKey } from "./mal-types";
import { malKeys } from "./mal-query-keys";

/** Norwegian day names for the grid header */
const DAY_NAMES: string[] = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
  "Søndag",
];
const DAY_SHORT: string[] = ["MAN", "TIR", "ONS", "TOR", "FRE", "LØR", "SØN"];

/** Add N days to a YYYY-MM-DD date string */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Calculate decimal work hours from HH:MM time strings — handles overnight shifts */
function calcHours(start: string, end: string): number {
  const parts = (s: string) => s.split(":").map(Number);
  const [sh = 0, sm = 0] = parts(start);
  const [eh = 0, em = 0] = parts(end);
  let hours = eh - sh + (em - sm) / 60;
  if (hours <= 0) hours += 24; // overnight shift wraps past midnight
  return hours;
}

/** Generate two-letter initials from a full name */
function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Deterministic avatar color from an employee ID — keeps colors stable across renders */
const AVATAR_COLORS: string[] = [
  "oklch(0.75 0.15 30)",
  "oklch(0.75 0.15 90)",
  "oklch(0.75 0.15 150)",
  "oklch(0.75 0.15 210)",
  "oklch(0.75 0.15 270)",
  "oklch(0.75 0.15 330)",
];
function avatarColor(id: string): string {
  let hash = 0;
  for (const c of id) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

export function useMalData(params: {
  workspaceId: string;
  departmentName: string;
  weekStart: string;
  templateId: string | null;
  showTasks: boolean;
}) {
  const { workspaceId, departmentName, weekStart, templateId, showTasks } = params;
  const supabase = createClient();

  // Step 1: Resolve department_id from name — cached for 5 minutes since departments rarely change
  const departmentQuery = useQuery({
    queryKey: malKeys.department(workspaceId, departmentName),
    enabled: !!workspaceId && !!departmentName,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department")
        .select("department_id")
        .eq("workspace_id", workspaceId)
        .eq("name", departmentName)
        .single();
      if (error) throw error;
      return data.department_id;
    },
  });

  const departmentId = departmentQuery.data ?? null;

  // Step 2: Fetch all templates for this department — used to populate the template selector
  const templatesQuery = useQuery({
    queryKey: malKeys.templates(workspaceId, departmentId ?? ""),
    enabled: !!departmentId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_template")
        .select("schedule_template_id, name, department_id")
        .eq("department_id", departmentId!)
        .order("name");
      if (error) throw error;
      return data.map((t) => ({ id: t.schedule_template_id, name: t.name }));
    },
  });

  const templates = templatesQuery.data ?? [];
  // Fall back to the first available template when none is explicitly selected
  const activeTemplateId = templateId ?? templates[0]?.id ?? null;

  // Step 3: Fetch template shifts (columns), actual schedule shifts, and tasks in parallel.
  // Re-fetches when week or template changes. showTasks included in key so toggling tasks
  // doesn't show stale cached data from a non-task fetch.
  const gridQuery = useQuery({
    queryKey: [...malKeys.shifts(workspaceId, weekStart, activeTemplateId ?? ""), showTasks],
    enabled: !!activeTemplateId && !!departmentId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 6);

      // Tasks require a two-step query: first get session IDs for the dept+week,
      // then fetch tasks linked to those sessions. This is simpler than relying on
      // PostgREST implicit join filtering which can behave unexpectedly with nulls.
      const fetchTasks = async () => {
        if (!showTasks || !departmentId) return [];

        const { data: sessions, error: sessErr } = await supabase
          .from("department_session")
          .select("department_session_id, session_date")
          .eq("department_id", departmentId)
          .gte("session_date", weekStart)
          .lte("session_date", weekEnd);

        if (sessErr) throw sessErr;
        if (!sessions || sessions.length === 0) return [];

        const sessionIds = sessions.map((s) => s.department_session_id);

        // session_task uses "id" as PK (not session_task_id — confirmed from database.types.ts)
        const { data: taskRows, error: taskErr } = await supabase
          .from("session_task")
          .select("id, title, status, department_session_id")
          .in("department_session_id", sessionIds);

        if (taskErr) throw taskErr;

        // Attach session_date to each task so we can map it to a grid day
        const sessionDateById = new Map(
          sessions.map((s) => [s.department_session_id, s.session_date]),
        );
        return (taskRows ?? []).map((t) => ({
          taskId: t.id,
          title: t.title,
          status: t.status,
          session_date: sessionDateById.get(t.department_session_id) ?? null,
        }));
      };

      const [templateShiftsRes, scheduleShiftsRes, tasks] = await Promise.all([
        // Template shifts define the grid columns (roles and times)
        supabase
          .from("schedule_template_shift")
          .select("*")
          .eq("template_id", activeTemplateId!)
          .order("start_time"),

        // Actual shifts for the week — only those linked to a template shift (mal-modus shifts).
        // Use the column-name hint syntax (profile:employee_id) so PostgREST picks the right FK.
        // The generated types show a SelectQueryError for multi-FK joins, so we cast via unknown.
        supabase
          .from("schedule_shift")
          .select("*, profile:employee_id(profile_id, first_name, last_name)")
          .eq("workspace_id", workspaceId)
          .gte("shift_date", weekStart)
          .lte("shift_date", weekEnd)
          .not("template_shift_id", "is", null),

        fetchTasks(),
      ]);

      if (templateShiftsRes.error) throw templateShiftsRes.error;
      if (scheduleShiftsRes.error) throw scheduleShiftsRes.error;

      const templateShifts = templateShiftsRes.data;
      const scheduleShifts = scheduleShiftsRes.data;

      // Build MalColumn array from template shifts — these become the grid headers
      const columns: MalColumn[] = templateShifts.map((ts) => {
        const hours = calcHours(ts.start_time, ts.end_time);
        return {
          templateShiftId: ts.schedule_template_shift_id,
          role: ts.role,
          startTime: ts.start_time,
          endTime: ts.end_time,
          workHours: hours,
          slotCount: ts.slot_count ?? 1,
          dayCategory: ts.day_category ?? "",
          indicator: ts.indicator ?? "",
        };
      });

      // Build the 7-day array for the week — maps JS's Sunday=0 to our Monday=0 convention
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const dateId = addDays(weekStart, i);
        const dayOfWeek = new Date(dateId + "T00:00:00").getDay();
        const mappedIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        return {
          index: i,
          dateId,
          label: DAY_NAMES[mappedIndex] ?? DAY_NAMES[0]!,
          shortLabel: DAY_SHORT[mappedIndex] ?? DAY_SHORT[0]!,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        };
      });

      // Initialize empty cells for every day × column combination
      const cells = new Map<string, MalCell>();
      for (const day of weekDays) {
        for (const col of columns) {
          const key = cellKey(day.dateId, col.templateShiftId);
          cells.set(key, {
            dayIndex: day.index,
            dateId: day.dateId,
            templateShiftId: col.templateShiftId,
            assignments: [],
            tasks: [],
            emptySlots: col.slotCount,
          });
        }
      }

      // Populate cells with employee assignments from schedule_shift rows
      for (const shift of scheduleShifts) {
        if (!shift.template_shift_id) continue;
        const key = cellKey(shift.shift_date, shift.template_shift_id);
        const cell = cells.get(key);
        if (!cell) continue;

        const profile = shift.profile as unknown as {
          profile_id: string;
          first_name: string;
          last_name: string;
        } | null;
        const name = profile ? `${profile.first_name} ${profile.last_name}` : "Ukjent";

        const assignment: MalEmployeeAssignment = {
          shiftId: shift.schedule_shift_id,
          employeeId: shift.employee_id ?? "",
          employeeName: name,
          avatarColor: avatarColor(shift.employee_id ?? shift.schedule_shift_id),
          initials: initials(name),
          status: (shift.status as MalEmployeeAssignment["status"]) ?? "created",
          hasSwapRequest: false, // TODO: check swap_request table once available
          hasUnreadMessage: false, // TODO: check messages table once available
        };
        cell.assignments.push(assignment);

        // Recalculate empty slots based on actual fill level
        const col = columns.find((c) => c.templateShiftId === shift.template_shift_id);
        cell.emptySlots = Math.max(0, (col?.slotCount ?? 1) - cell.assignments.length);
      }

      // Populate tasks — tasks are dept-level (not tied to a specific shift column),
      // so we only attach them to the first column to avoid duplication in the grid.
      const firstColumn = columns[0];
      if (firstColumn) {
        for (const task of tasks) {
          if (!task.session_date) continue;
          const key = cellKey(task.session_date, firstColumn.templateShiftId);
          const cell = cells.get(key);
          if (!cell) continue;
          cell.tasks.push({
            taskId: task.taskId,
            title: task.title,
            status: task.status as MalTask["status"],
          });
        }
      }

      // Aggregate stats across all cells
      const totalSlots = columns.reduce((sum, c) => sum + c.slotCount, 0) * 7;
      let filledSlots = 0;
      let totalHours = 0;
      let taskCount = 0;
      let swapRequests = 0;

      cells.forEach((cell) => {
        filledSlots += cell.assignments.length;
        taskCount += cell.tasks.length;
        const col = columns.find((c) => c.templateShiftId === cell.templateShiftId);
        if (col) {
          totalHours += cell.assignments.length * col.workHours;
        }
        swapRequests += cell.assignments.filter((a) => a.hasSwapRequest).length;
      });

      // Fallback hourly rate — will be replaced by season_budget.avg_hourly_wage once wired up
      const hourlyRate = 230;
      const estimatedCost = totalHours * hourlyRate;

      const templateName = templates.find((t) => t.id === activeTemplateId)?.name ?? "";

      const gridData: MalGridData = {
        columns,
        cells,
        weekDays,
        templateId: activeTemplateId!,
        templateName,
        stats: {
          totalSlots,
          filledSlots,
          totalHours,
          estimatedCost,
          taskCount,
          swapRequests,
          emptySlots: totalSlots - filledSlots,
        },
      };

      return gridData;
    },
  });

  return {
    data: gridQuery.data ?? null,
    isLoading: departmentQuery.isLoading || templatesQuery.isLoading || gridQuery.isLoading,
    error: departmentQuery.error || templatesQuery.error || gridQuery.error,
    templates,
    departmentId,
  };
}
