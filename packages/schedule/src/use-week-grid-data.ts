"use client";

/**
 * Data hook for Mal-modus (template-based schedule grid).
 * Resolves department(s) → templates → template shifts + schedule shifts + tasks,
 * and combines everything into a MalGridData structure ready for the grid UI.
 *
 * When departmentName is "Alle avdelinger", all departments are included.
 * Columns carry departmentId + departmentName so the grid can render
 * department group separators.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

import type { MalColumn, MalCell, MalGridData, MalEmployeeAssignment, MalTask } from "./grid-types";
import { cellKey, addDays } from "./grid-types";
import { gridKeys } from "./grid-query-keys";

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

const ALL_DEPARTMENTS = "Alle avdelinger";

export function useMalData(params: {
  workspaceId: string;
  departmentName: string;
  weekStart: string;
  templateId: string | null;
  showTasks: boolean;
}) {
  const { workspaceId, departmentName, weekStart, templateId, showTasks } = params;
  const supabase = createClient();
  const isAllDepartments = departmentName === ALL_DEPARTMENTS;

  // Step 1: Resolve department(s) — single or all
  const departmentQuery = useQuery({
    queryKey: gridKeys.department(workspaceId, departmentName),
    enabled: !!workspaceId && !!departmentName,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (isAllDepartments) {
        const { data, error } = await supabase
          .from("department")
          .select("department_id, name")
          .eq("workspace_id", workspaceId)
          .order("name");
        if (error) throw error;
        return data.map((d) => ({ id: d.department_id, name: d.name }));
      }
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspaceId)
        .eq("name", departmentName)
        .single();
      if (error) throw error;
      return [{ id: data.department_id, name: data.name }];
    },
  });

  const departments = departmentQuery.data ?? [];
  const departmentIds = departments.map((d) => d.id);
  // For backwards compat — single department ID (first resolved)
  const departmentId = departmentIds[0] ?? null;

  // Step 2: Fetch templates across all resolved departments
  const templatesQuery = useQuery({
    queryKey: gridKeys.templates(workspaceId, departmentIds.join(",")),
    enabled: departmentIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_template")
        .select("schedule_template_id, name, department_id")
        .in("department_id", departmentIds)
        .order("name");
      if (error) throw error;
      return data.map((t) => ({
        id: t.schedule_template_id,
        name: t.name,
        departmentId: t.department_id,
      }));
    },
  });

  const templates = templatesQuery.data ?? [];
  // Fall back to the first available template when none is explicitly selected
  const activeTemplateId = templateId ?? templates[0]?.id ?? null;

  // Build a department name lookup from resolved departments
  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));

  // Step 3: Fetch template shifts (columns), actual schedule shifts, and tasks in parallel.
  const gridQuery = useQuery({
    queryKey: [
      ...gridKeys.shifts(workspaceId, weekStart, activeTemplateId ?? ""),
      showTasks,
      departmentIds.join(","),
    ],
    enabled: !!activeTemplateId && departmentIds.length > 0,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 6);

      // Tasks: fetch for all resolved departments
      const fetchTasks = async () => {
        if (!showTasks || departmentIds.length === 0) return [];

        const { data: sessions, error: sessErr } = await supabase
          .from("department_session")
          .select("department_session_id, session_date, department_id")
          .in("department_id", departmentIds)
          .gte("session_date", weekStart)
          .lte("session_date", weekEnd);

        if (sessErr) throw sessErr;
        if (!sessions || sessions.length === 0) return [];

        const sessionIds = sessions.map((s) => s.department_session_id);

        const { data: taskRows, error: taskErr } = await supabase
          .from("session_task")
          .select("id, title, status, department_session_id")
          .in("department_session_id", sessionIds);

        if (taskErr) throw taskErr;

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

      // Fetch template shifts — for the active template only
      const templateShiftsRes = await supabase
        .from("schedule_template_shift")
        .select("*, schedule_template!inner(department_id)")
        .eq("template_id", activeTemplateId!)
        .order("start_time");

      if (templateShiftsRes.error) throw templateShiftsRes.error;
      const templateShifts = templateShiftsRes.data;
      const templateShiftIds = templateShifts.map((ts) => ts.schedule_template_shift_id);

      // Fetch actual shifts and tasks in parallel
      const [scheduleShiftsRes, tasks] = await Promise.all([
        templateShiftIds.length > 0
          ? supabase
              .from("schedule_shift")
              .select("*, profile:employee_id(profile_id, first_name, last_name)")
              .eq("workspace_id", workspaceId)
              .gte("shift_date", weekStart)
              .lte("shift_date", weekEnd)
              .in("template_shift_id", templateShiftIds)
          : Promise.resolve({ data: [] as never[], error: null }),

        fetchTasks(),
      ]);

      if (scheduleShiftsRes.error) throw scheduleShiftsRes.error;
      const scheduleShifts = scheduleShiftsRes.data;

      // Build MalColumn array — columns carry department info for group headers
      const columns: MalColumn[] = templateShifts.map((ts) => {
        const hours = calcHours(ts.start_time, ts.end_time);
        const tmpl = ts.schedule_template as unknown as { department_id: string };
        const deptId = tmpl?.department_id ?? "";
        return {
          templateShiftId: ts.schedule_template_shift_id,
          role: ts.role,
          startTime: ts.start_time,
          endTime: ts.end_time,
          workHours: hours,
          slotCount: ts.slot_count ?? 1,
          dayCategory: ts.day_category ?? "",
          indicator: ts.indicator ?? "",
          departmentId: deptId,
          departmentName: deptNameById.get(deptId) ?? "",
        };
      });

      // Build the 7-day array for the week
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

      // Populate cells with employee assignments
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
          hasSwapRequest: false,
          hasUnreadMessage: false,
        };
        cell.assignments.push(assignment);

        const col = columns.find((c) => c.templateShiftId === shift.template_shift_id);
        cell.emptySlots = Math.max(0, (col?.slotCount ?? 1) - cell.assignments.length);
      }

      // Populate tasks — attach to the first column per department
      const firstColumnPerDept = new Map<string, MalColumn>();
      for (const col of columns) {
        if (!firstColumnPerDept.has(col.departmentId)) {
          firstColumnPerDept.set(col.departmentId, col);
        }
      }
      for (const task of tasks) {
        if (!task.session_date) continue;
        // Attach to first column of any department (tasks are dept-level)
        for (const [, col] of firstColumnPerDept) {
          const key = cellKey(task.session_date, col.templateShiftId);
          const cell = cells.get(key);
          if (cell) {
            cell.tasks.push({
              taskId: task.taskId,
              title: task.title,
              status: task.status as MalTask["status"],
            });
            break;
          }
        }
      }

      // Aggregate stats
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
