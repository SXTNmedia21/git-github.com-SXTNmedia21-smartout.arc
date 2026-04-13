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

import type {
  MalColumn,
  MalCell,
  MalGridData,
  MalEmployeeAssignment,
  MalTask,
  GridColumn,
  GridCell,
  WeekGridData,
  DayInfo,
} from "./grid-types";
import { cellKey, addDays, gridCellKey, UNASSIGNED_CONFIG_ID } from "./grid-types";
import { gridKeys } from "./grid-query-keys";

/** Norwegian full day names for the grid row primary label */
const DAY_NAMES: string[] = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
  "Søndag",
];

/** Norwegian month names for date formatting in grid rows */
const MONTH_NAMES: string[] = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

/** Format a date string as "5. april" for the grid row secondary label */
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()}. ${MONTH_NAMES[d.getMonth()] ?? "januar"}`;
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

/** Convert HH:MM(:SS) to minutes since midnight — used for nearest-config matching */
function timeToMinutes(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
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

/**
 * @deprecated Use useWeekGridData instead. This legacy hook requires a template
 * to exist and reads columns from schedule_template_shift. Kept during transition.
 */
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
              .select("*, profile:employee_id(profile_id, display_name)")
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

      // Build the 7-day array for the week (Mon → Sun)
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const dateId = addDays(weekStart, i);
        const dayOfWeek = new Date(dateId + "T00:00:00").getDay();
        const mappedIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        return {
          index: i,
          dateId,
          label: DAY_NAMES[mappedIndex] ?? DAY_NAMES[0]!,
          shortLabel: formatDateLabel(dateId),
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
          display_name: string | null;
        } | null;
        const name = profile?.display_name || "Ukjent";

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

// ── New config-driven hook (week-grid redesign) ──────────────────────

/**
 * Config-driven schedule grid hook — reads department_shift_type_config for
 * columns instead of requiring a template. This is the replacement for useMalData.
 *
 * Query cascade:
 *   1. Resolve department(s) by name
 *   2. Fetch department_shift_type_config (columns) + payroll.shift_type (names/colors)
 *   3. Fetch schedule_shift for the week (matched by shift_type_id, no template filter)
 *   4. Optionally fetch session tasks
 */
export function useWeekGridData(params: {
  workspaceId: string;
  departmentName: string;
  weekStart: string;
  showTasks: boolean;
}) {
  const { workspaceId, departmentName, weekStart, showTasks } = params;
  const supabase = createClient();
  const isAllDepartments = departmentName === ALL_DEPARTMENTS;

  // ── Step 1: Resolve department(s) — reuses same pattern as legacy hook ──
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
  const departmentId = departmentIds[0] ?? null;
  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));

  // ── Step 2: Fetch active configs for resolved departments ──
  const configQuery = useQuery({
    queryKey: gridKeys.configs(workspaceId, departmentIds.join(",")),
    enabled: departmentIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_shift_type_config")
        .select(
          `
          id,
          department_id,
          shift_type_id,
          label,
          default_start_time,
          default_end_time,
          default_break_minutes,
          slot_count,
          sort_order,
          is_active
        `,
        )
        .in("department_id", departmentIds)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const configs = configQuery.data ?? [];
  const shiftTypeIds = [...new Set(configs.map((c) => c.shift_type_id))];

  // ── Step 2b: Fetch shift type metadata (name, color) from payroll schema ──
  const shiftTypeQuery = useQuery({
    queryKey: gridKeys.shiftTypes(shiftTypeIds.join(",")),
    enabled: shiftTypeIds.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("shift_type")
        .select("id, name, color")
        .in("id", shiftTypeIds);
      if (error) throw error;
      return data;
    },
  });

  const shiftTypeById = new Map((shiftTypeQuery.data ?? []).map((st) => [st.id, st]));

  // ── Step 3: Fetch schedule shifts for the week (no template filter) ──
  const weekEnd = addDays(weekStart, 6);

  const shiftQuery = useQuery({
    queryKey: gridKeys.weekShifts(workspaceId, weekStart, departmentIds.join(",")),
    enabled: departmentIds.length > 0,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          `
          schedule_shift_id,
          shift_date,
          shift_type_id,
          employee_id,
          start_time,
          end_time,
          status,
          department_id,
          work_hours,
          role,
          profile:employee_id (display_name)
        `,
        )
        .in("department_id", departmentIds)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd);
      if (error) throw error;
      return data;
    },
  });

  // ── Step 4: Fetch tasks (optional, same pattern as legacy) ──
  const taskQuery = useQuery({
    queryKey: gridKeys.tasks(workspaceId, weekStart, departmentIds.join(",")),
    enabled: showTasks && departmentIds.length > 0,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
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
        status: t.status as MalTask["status"],
        sessionDate: sessionDateById.get(t.department_session_id) ?? null,
      }));
    },
  });

  // ── Build WeekGridData from all queries ──
  const isLoading =
    departmentQuery.isLoading ||
    configQuery.isLoading ||
    shiftTypeQuery.isLoading ||
    shiftQuery.isLoading ||
    (showTasks && taskQuery.isLoading);

  const error =
    departmentQuery.error ||
    configQuery.error ||
    shiftTypeQuery.error ||
    shiftQuery.error ||
    taskQuery.error;

  // Only build grid data when all required queries have resolved
  const canBuild = configs.length > 0 && !isLoading && !error;

  const data: WeekGridData | null = canBuild
    ? buildWeekGridData({
        configs,
        shiftTypeById,
        shifts: shiftQuery.data ?? [],
        tasks: taskQuery.data ?? [],
        deptNameById,
        weekStart,
      })
    : null;

  // Columns are useful even before shifts load (for skeleton UI)
  const columns: GridColumn[] = configs.map((cfg) => {
    const st = shiftTypeById.get(cfg.shift_type_id);
    return {
      configId: cfg.id,
      shiftTypeId: cfg.shift_type_id,
      shiftTypeName: st?.name ?? cfg.label,
      shiftTypeColor: st?.color ?? null,
      label: cfg.label,
      startTime: cfg.default_start_time,
      endTime: cfg.default_end_time,
      workHours: calcHours(cfg.default_start_time, cfg.default_end_time),
      breakMinutes: cfg.default_break_minutes,
      slotCount: cfg.slot_count,
      sortOrder: cfg.sort_order,
      departmentId: cfg.department_id,
      departmentName: deptNameById.get(cfg.department_id) ?? "",
    };
  });

  return {
    data,
    isLoading,
    error,
    departmentId,
    columns,
  };
}

// ── Pure builder — assembles WeekGridData from resolved query results ──

function buildWeekGridData(input: {
  configs: ConfigRow[];
  shiftTypeById: Map<string, { id: string; name: string; color: string | null }>;
  shifts: ShiftRow[];
  tasks: TaskRow[];
  deptNameById: Map<string, string>;
  weekStart: string;
}): WeekGridData {
  const { configs, shiftTypeById, shifts, tasks, deptNameById, weekStart } = input;

  // Build columns from config + shift type metadata
  const columns: GridColumn[] = configs.map((cfg) => {
    const st = shiftTypeById.get(cfg.shift_type_id);
    return {
      configId: cfg.id,
      shiftTypeId: cfg.shift_type_id,
      shiftTypeName: st?.name ?? cfg.label,
      shiftTypeColor: st?.color ?? null,
      label: cfg.label,
      startTime: cfg.default_start_time,
      endTime: cfg.default_end_time,
      workHours: calcHours(cfg.default_start_time, cfg.default_end_time),
      breakMinutes: cfg.default_break_minutes,
      slotCount: cfg.slot_count,
      sortOrder: cfg.sort_order,
      departmentId: cfg.department_id,
      departmentName: deptNameById.get(cfg.department_id) ?? "",
    };
  });

  // Build 7-day array (Mon → Sun) — label is the day name, shortLabel is the date
  const weekDays: DayInfo[] = Array.from({ length: 7 }, (_, i) => {
    const dateId = addDays(weekStart, i);
    const dayOfWeek = new Date(dateId + "T00:00:00").getDay();
    const mappedIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return {
      index: i,
      dateId,
      label: DAY_NAMES[mappedIndex] ?? DAY_NAMES[0]!,
      shortLabel: formatDateLabel(dateId),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
  });

  // Build a lookup: group configs by shift_type_id + department_id.
  // A department can have multiple configs for the same shift_type_id (e.g.
  // "Kokk 10-18" and "Kokk Kveld 15-23" both reference shift_type Kokk).
  // We collect all candidates and pick the best match by start time proximity.
  const configsByTypeAndDept = new Map<string, (typeof configs)[number][]>();
  for (const cfg of configs) {
    const key = `${cfg.shift_type_id}::${cfg.department_id}`;
    const existing = configsByTypeAndDept.get(key) ?? [];
    existing.push(cfg);
    configsByTypeAndDept.set(key, existing);
  }

  // Add a synthetic "Ikke tildelt" column for shifts without a shift type.
  // This ensures every shift from Ukeplan is visible in Bemanning.
  const unassignedColumn: GridColumn = {
    configId: UNASSIGNED_CONFIG_ID,
    shiftTypeId: "",
    shiftTypeName: "Ikke tildelt",
    shiftTypeColor: null,
    label: "Ikke tildelt",
    startTime: "00:00",
    endTime: "00:00",
    workHours: 0,
    breakMinutes: 0,
    slotCount: 0,
    sortOrder: 9999,
    departmentId: "",
    departmentName: "",
  };
  columns.push(unassignedColumn);

  // Initialize empty cells for every day × column combination
  const cells = new Map<string, GridCell>();
  for (const day of weekDays) {
    for (const col of columns) {
      const key = gridCellKey(day.dateId, col.configId);
      cells.set(key, {
        dayIndex: day.index,
        dateId: day.dateId,
        configId: col.configId,
        assignments: [],
        tasks: [],
        emptySlots: col.slotCount,
      });
    }
  }

  // Populate cells with shift assignments
  for (const shift of shifts) {
    let targetConfigId: string;

    if (shift.shift_type_id && shift.department_id) {
      // Try to match to a configured shift type column
      const candidates = configsByTypeAndDept.get(`${shift.shift_type_id}::${shift.department_id}`);
      if (candidates && candidates.length > 0) {
        const cfg =
          candidates.length === 1
            ? candidates[0]!
            : candidates.reduce((best, c) => {
                const diffBest = Math.abs(
                  timeToMinutes(best.default_start_time) - timeToMinutes(shift.start_time),
                );
                const diffC = Math.abs(
                  timeToMinutes(c.default_start_time) - timeToMinutes(shift.start_time),
                );
                return diffC < diffBest ? c : best;
              });
        targetConfigId = cfg.id;
      } else {
        targetConfigId = UNASSIGNED_CONFIG_ID;
      }
    } else {
      targetConfigId = UNASSIGNED_CONFIG_ID;
    }

    const key = gridCellKey(shift.shift_date, targetConfigId);
    const cell = cells.get(key);
    if (!cell) continue;

    const profile = shift.profile as unknown as {
      display_name: string | null;
    } | null;
    const name = profile?.display_name || "Ukjent";

    const assignment: MalEmployeeAssignment = {
      shiftId: shift.schedule_shift_id,
      employeeId: shift.employee_id ?? "",
      employeeName: name,
      avatarColor: avatarColor(shift.employee_id ?? shift.schedule_shift_id),
      initials: initials(name),
      status: (shift.status as MalEmployeeAssignment["status"]) ?? "created",
      hasSwapRequest: false,
      hasUnreadMessage: false,
      startTime: shift.start_time ?? undefined,
      endTime: shift.end_time ?? undefined,
      role: (shift as Record<string, unknown>).role as string | undefined,
      departmentId: shift.department_id ?? undefined,
    };
    cell.assignments.push(assignment);

    if (targetConfigId !== UNASSIGNED_CONFIG_ID) {
      const col = columns.find((c) => c.configId === targetConfigId);
      cell.emptySlots = Math.max(0, (col?.slotCount ?? 1) - cell.assignments.length);
    }
  }

  // Populate tasks — attach to first column per department (same logic as legacy)
  const firstColumnPerDept = new Map<string, GridColumn>();
  for (const col of columns) {
    if (!firstColumnPerDept.has(col.departmentId)) {
      firstColumnPerDept.set(col.departmentId, col);
    }
  }
  for (const task of tasks) {
    if (!task.sessionDate) continue;
    for (const [, col] of firstColumnPerDept) {
      const key = gridCellKey(task.sessionDate, col.configId);
      const cell = cells.get(key);
      if (cell) {
        cell.tasks.push({
          taskId: task.taskId,
          title: task.title,
          status: task.status,
        });
        break;
      }
    }
  }

  // Build a map of shift work_hours for accurate stats on unassigned shifts
  const shiftHoursById = new Map<string, number>();
  for (const shift of shifts) {
    const hours =
      shift.work_hours ??
      (shift.start_time && shift.end_time ? calcHours(shift.start_time, shift.end_time) : 0);
    shiftHoursById.set(shift.schedule_shift_id, hours);
  }

  // Aggregate stats — exclude the synthetic unassigned column from slot count
  const totalSlots =
    columns
      .filter((c) => c.configId !== UNASSIGNED_CONFIG_ID)
      .reduce((sum, c) => sum + c.slotCount, 0) * 7;
  let filledSlots = 0;
  let totalHours = 0;
  let taskCount = 0;
  let swapRequests = 0;

  cells.forEach((cell) => {
    if (cell.configId !== UNASSIGNED_CONFIG_ID) {
      filledSlots += cell.assignments.length;
    }
    taskCount += cell.tasks.length;
    const col = columns.find((c) => c.configId === cell.configId);
    if (col && col.configId !== UNASSIGNED_CONFIG_ID) {
      totalHours += cell.assignments.length * col.workHours;
    } else {
      // Unassigned shifts — use each shift's actual hours
      for (const a of cell.assignments) {
        totalHours += shiftHoursById.get(a.shiftId) ?? 0;
      }
    }
    swapRequests += cell.assignments.filter((a) => a.hasSwapRequest).length;
  });

  // TODO: Phase 3 — replace hardcoded rate with shift_type.rate_adjustment_value lookup
  const hourlyRate = 230;
  const estimatedCost = totalHours * hourlyRate;

  return {
    columns,
    cells,
    weekDays,
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
}

// ── Internal types for the builder function ──

type ConfigRow = {
  id: string;
  department_id: string;
  shift_type_id: string;
  label: string;
  default_start_time: string;
  default_end_time: string;
  default_break_minutes: number;
  slot_count: number;
  sort_order: number;
  is_active: boolean;
};

type ShiftRow = {
  schedule_shift_id: string;
  shift_date: string;
  shift_type_id: string | null;
  employee_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  department_id: string | null;
  work_hours: number;
  profile: unknown;
};

type TaskRow = {
  taskId: string;
  title: string;
  status: MalTask["status"];
  sessionDate: string | null;
};
