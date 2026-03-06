"use client";

import React, { useCallback, useContext } from "react";
import {
  Users,
  Briefcase,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  AlertCircle,
  GripVertical,
} from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ShiftCard, AbsenceCard } from "./grid-cards";
import type { DayColumn } from "./schedule-data";
import { useScheduleUI } from "./schedule-ui-context";
import { useShifts, useUpdateShift } from "../_hooks/use-shifts";
import { useAbsences } from "../_hooks/use-absences";
import type { ScheduleEmployee } from "../_hooks/use-employees";
import { DayContextMenu } from "./day-context-menu";
import type { Shift as ScheduleShift, Absence } from "./schedule-types";
import { SCHEDULE_LAYERS } from "./schedule-layers";

// ---------------------------------------------------------------------------
// GridContent — daily schedule grid (the perf-critical DnD subtree)
// ---------------------------------------------------------------------------
export function GridContent({
  isSidebarOpen,
  setIsSidebarOpen,
  onDateClick,
  filterSituation = "Alle",
  activeStatusFilter = null,
  visibleDays,
  employees,
  highlightedDayId,
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick: (d: string) => void;
  filterSituation?: string;
  activeStatusFilter?: string | null;
  visibleDays: DayColumn[];
  employees: ScheduleEmployee[];
  highlightedDayId?: string | null;
}) {
  const { isDark, scheduleView } = useContext(DashboardContext);
  // Derive week range from the actual visible day columns (respects navigation offset + week span)
  const weekStart = visibleDays[0]?.id ?? "";
  const weekEnd = visibleDays[visibleDays.length - 1]?.id ?? "";
  const { data: shiftsData = [] } = useShifts(weekStart, weekEnd);
  const { data: absencesData = [] } = useAbsences(weekStart, weekEnd);
  const { setCreateShiftContext, setAbsencePopover, setSelectedShift, setSelectedEmployee } =
    useScheduleUI();

  const updateShift = useUpdateShift(weekStart);

  // ── Filter shifts based on activeStatusFilter ──────────────
  const filteredShifts = React.useMemo(() => {
    if (!activeStatusFilter) return shiftsData;
    switch (activeStatusFilter) {
      case "draft":
        return shiftsData.filter((s) => s.status === "created" || s.status === "assigned");
      case "published":
        return shiftsData.filter((s) => s.status === "published");
      case "active":
        return shiftsData.filter((s) => s.status === "active");
      case "completed":
        return shiftsData.filter((s) => s.status === "completed");
      default:
        return shiftsData;
    }
  }, [shiftsData, activeStatusFilter]);

  // ── Filter employees to only show those with matching data ──
  const filteredEmployees = React.useMemo(() => {
    if (!activeStatusFilter) return employees;
    // Absence filter: show only employees with absences
    if (activeStatusFilter === "absence") {
      const employeesWithAbsences = new Set(absencesData.map((a) => a.employeeId));
      return employees.filter((emp) => employeesWithAbsences.has(emp.id));
    }
    // Overtime risk: employees exceeding contracted hours
    if (activeStatusFilter === "overtime_risk") {
      const CONTRACTED = 37.5;
      const hoursByEmp = new Map<string, number>();
      for (const s of shiftsData) {
        if (s.employeeId) {
          hoursByEmp.set(s.employeeId, (hoursByEmp.get(s.employeeId) ?? 0) + s.workHours);
        }
      }
      return employees.filter((emp) => (hoursByEmp.get(emp.id) ?? 0) > CONTRACTED);
    }
    // Compliance risk: employees exceeding AML max hours
    if (activeStatusFilter === "compliance_risk") {
      const AML_MAX = 40;
      const hoursByEmp = new Map<string, number>();
      for (const s of shiftsData) {
        if (s.employeeId) {
          hoursByEmp.set(s.employeeId, (hoursByEmp.get(s.employeeId) ?? 0) + s.workHours);
        }
      }
      return employees.filter((emp) => (hoursByEmp.get(emp.id) ?? 0) > AML_MAX);
    }
    // Status-based filters: show employees who have matching shifts
    if (["draft", "published", "active", "completed"].includes(activeStatusFilter)) {
      const employeeIdsWithShifts = new Set(
        filteredShifts.map((s) => s.employeeId).filter(Boolean),
      );
      return employees.filter((emp) => employeeIdsWithShifts.has(emp.id));
    }
    return employees;
  }, [employees, activeStatusFilter, filteredShifts, absencesData, shiftsData]);

  /** Handle time change from Shift+drag resize handles */
  const handleTimeChange = useCallback(
    (shiftId: string, newStart: string, newEnd: string) => {
      // Recalculate work hours from the new times
      const startMins =
        parseInt(newStart.split(":")[0] ?? "0", 10) * 60 +
        parseInt(newStart.split(":")[1] ?? "0", 10);
      let endMins =
        parseInt(newEnd.split(":")[0] ?? "0", 10) * 60 + parseInt(newEnd.split(":")[1] ?? "0", 10);
      if (endMins <= startMins) endMins += 24 * 60;
      const workHours = Math.max(0, (endMins - startMins) / 60);

      updateShift.mutate({
        id: shiftId,
        patch: { startTime: newStart, endTime: newEnd, workHours },
      });
    },
    [updateShift],
  );

  /** Index shifts by employee::day key for O(1) lookup in grid cells */
  const shiftsByEmployeeDay = React.useMemo(() => {
    const index = new Map<string, ScheduleShift[]>();
    for (const shift of filteredShifts) {
      if (!shift.employeeId) continue;
      const key = `${shift.employeeId}::${shift.dateId}`;
      const existing = index.get(key);
      if (existing) {
        existing.push(shift);
      } else {
        index.set(key, [shift]);
      }
    }
    return index;
  }, [filteredShifts]);

  /** Index absences by employee::day key */
  const absencesByEmployeeDay = React.useMemo(() => {
    const index = new Map<string, Absence[]>();
    for (const absence of absencesData) {
      const key = `${absence.employeeId}::${absence.dateId}`;
      const existing = index.get(key);
      if (existing) {
        existing.push(absence);
      } else {
        index.set(key, [absence]);
      }
    }
    return index;
  }, [absencesData]);

  /** Compute hours and shift count per employee from real shift data */
  const employeeStats = React.useMemo(() => {
    const stats = new Map<string, { hours: number; shiftCount: number }>();
    for (const shift of filteredShifts) {
      if (!shift.employeeId) continue;
      const existing = stats.get(shift.employeeId) ?? { hours: 0, shiftCount: 0 };
      existing.hours += shift.workHours;
      existing.shiftCount += 1;
      stats.set(shift.employeeId, existing);
    }
    return stats;
  }, [filteredShifts]);

  return (
    <div className="flex w-full flex-col">
      <DayHeaders
        isDark={isDark}
        scheduleView={scheduleView}
        visibleDays={visibleDays}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        onDateClick={onDateClick}
        highlightedDayId={highlightedDayId ?? null}
      />

      <div className="w-full flex-1 pb-20">
        {scheduleView === "ansatt" && (
          <SortableContext
            items={filteredEmployees.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col">
              {filteredEmployees.map((emp) => (
                <SortableEmployeeRow
                  key={emp.id}
                  employee={emp}
                  employeeStats={employeeStats.get(emp.id)}
                  days={visibleDays}
                  shiftsByEmployeeDay={shiftsByEmployeeDay}
                  absencesByEmployeeDay={absencesByEmployeeDay}
                  onCreateShift={setCreateShiftContext}
                  onAbsencePopover={setAbsencePopover}
                  onSelectShift={setSelectedShift}
                  onSelectEmployee={setSelectedEmployee}
                  onTimeChange={handleTimeChange}
                />
              ))}
            </div>
          </SortableContext>
        )}

        {scheduleView === "jobb" && (
          <div className="flex flex-col">
            {Array.from(new Set(filteredEmployees.map((e) => e.jobTitle || e.role))).map(
              (jobTitle) => {
                const employeesInRole = filteredEmployees.filter(
                  (e) => (e.jobTitle || e.role) === jobTitle,
                );
                return (
                  <React.Fragment key={jobTitle}>
                    <GroupHeader
                      title={jobTitle}
                      count={employeesInRole.length}
                      days={visibleDays}
                    />
                    {employeesInRole.map((emp) => (
                      <EmployeeRow
                        key={emp.id}
                        employee={emp}
                        employeeStats={employeeStats.get(emp.id)}
                        days={visibleDays}
                        shiftsByEmployeeDay={shiftsByEmployeeDay}
                        absencesByEmployeeDay={absencesByEmployeeDay}
                        onCreateShift={setCreateShiftContext}
                        onAbsencePopover={setAbsencePopover}
                        onSelectShift={setSelectedShift}
                        onSelectEmployee={setSelectedEmployee}
                        onTimeChange={handleTimeChange}
                        subtitle={emp.team}
                      />
                    ))}
                  </React.Fragment>
                );
              },
            )}
          </div>
        )}

        {scheduleView === "team" && (
          <div className="flex flex-col">
            {Array.from(new Set(filteredEmployees.map((e) => e.team || "Uten team"))).map(
              (team) => {
                const employeesInTeam = filteredEmployees.filter(
                  (e) => (e.team || "Uten team") === team,
                );
                return (
                  <React.Fragment key={team}>
                    <GroupHeader title={team} count={employeesInTeam.length} days={visibleDays} />
                    {employeesInTeam.map((emp) => (
                      <EmployeeRow
                        key={emp.id}
                        employee={emp}
                        employeeStats={employeeStats.get(emp.id)}
                        days={visibleDays}
                        shiftsByEmployeeDay={shiftsByEmployeeDay}
                        absencesByEmployeeDay={absencesByEmployeeDay}
                        onCreateShift={setCreateShiftContext}
                        onAbsencePopover={setAbsencePopover}
                        onSelectShift={setSelectedShift}
                        onSelectEmployee={setSelectedEmployee}
                        onTimeChange={handleTimeChange}
                        subtitle={emp.jobTitle || emp.role}
                      />
                    ))}
                  </React.Fragment>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DayHeaders — sticky top + sticky left corner
// ---------------------------------------------------------------------------
const DayHeaders = React.memo(function DayHeaders({
  isDark,
  scheduleView,
  visibleDays,
  isSidebarOpen,
  setIsSidebarOpen,
  onDateClick,
  highlightedDayId,
}: {
  isDark: boolean;
  scheduleView: string;
  visibleDays: DayColumn[];
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick: (d: string) => void;
  highlightedDayId: string | null;
}) {
  return (
    <div className="sticky top-0 flex w-full" style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}>
      {/* Sticky corner cell */}
      <div
        className={`w-[260px] shrink-0 border-r border-b border-white/[0.04] ${isDark ? "bg-[#0a0a0c]/95" : "bg-white/95"} sticky left-0 flex h-16 flex-col justify-center p-3 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl`}
        style={{ zIndex: SCHEDULE_LAYERS.stickyCorner }}
      >
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-500 uppercase">
            <Users className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-600"}`} />
            {scheduleView === "ansatt" ? "Ansatte" : scheduleView === "jobb" ? "Roller" : "Team"}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`rounded-md p-1 text-zinc-500 hover:text-white ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} transition-colors`}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Day column headers — fixed width */}
      {visibleDays.map((day) => (
        <DroppableDayHeader
          key={day.id}
          day={day}
          isDark={isDark}
          onDateClick={onDateClick}
          isHighlighted={highlightedDayId === day.id}
        />
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// DroppableDayHeader — single day column header with DnD drop target
// ---------------------------------------------------------------------------
function DroppableDayHeader({
  day,
  isDark,
  onDateClick,
  isHighlighted,
}: {
  day: DayColumn;
  isDark: boolean;
  onDateClick: (d: string) => void;
  isHighlighted: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `day-header::${day.id}` });

  return (
    <div
      ref={setNodeRef}
      data-schedule-day-id={day.id}
      className={`min-w-0 flex-1 border-r border-b border-white/[0.03] ${isDark ? "bg-[#0a0a0c]/90" : "bg-white/95"} group/day relative flex h-16 cursor-pointer flex-col justify-center p-2 backdrop-blur-xl transition-colors hover:bg-white/5 ${day.isToday ? "bg-orange-500/[0.06]" : ""} ${isOver ? "rounded-lg border-dashed border-orange-500/50 bg-orange-500/20" : ""} ${day.situation === "__dimmed__" ? "opacity-30" : ""} ${isHighlighted ? "shadow-[0_0_0_1px_rgba(251,146,60,0.35)] ring-2 ring-orange-400/70 ring-inset" : ""}`}
      onClick={() => onDateClick(day.id)}
    >
      {day.coverageAlert ? (
        <div className="absolute top-0 left-0 h-1 w-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]" />
      ) : (
        <div className="absolute top-0 left-0 h-0.5 w-full bg-emerald-500/10" />
      )}

      {/* Top: Date label + context menu */}
      <div className="flex items-start justify-between">
        <h2
          className={`flex items-center gap-1.5 truncate text-sm tracking-tight ${day.isToday ? "font-black text-orange-400" : day.isHoliday ? "font-black text-rose-400" : isDark ? "font-semibold text-zinc-400" : "font-semibold text-zinc-700"}`}
        >
          {day.label}
          {day.isToday ? (
            <span className="h-1 w-1 shrink-0 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
          ) : null}
        </h2>
        <div onClick={(e) => e.stopPropagation()}>
          <DayContextMenu dateId={day.id} dateLabel={day.label} isDark={isDark} />
        </div>
      </div>

      {/* Compact stats */}
      <div className="mt-1 flex items-center gap-2 text-[10px] leading-none font-medium text-zinc-500/70">
        <span className="flex items-center gap-0.5" title="Ansatte">
          <Users className="h-2.5 w-2.5" /> {day.staff}
        </span>
        <span className="flex items-center gap-0.5" title="Vakter">
          <Briefcase className="h-2.5 w-2.5" /> {day.shifts}
        </span>
        {day.coverageAlert ? (
          <span title={day.coverageAlert}>
            <AlertCircle className="h-2.5 w-2.5 text-red-500" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupHeader — team/role divider row (memoized)
// ---------------------------------------------------------------------------
export const GroupHeader = React.memo(function GroupHeader({
  title,
  count,
  days,
}: {
  title: string;
  count: number;
  days: DayColumn[];
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className="group/header flex w-full">
      <div
        className={`w-[260px] shrink-0 border-r border-b border-white/[0.04] ${isDark ? "bg-white/[0.03]" : "bg-zinc-100"} relative sticky left-0 flex h-9 items-center justify-between px-4 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}
        style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}
      >
        <span
          className={`text-[11px] font-bold ${isDark ? "text-white" : "text-zinc-900"} tracking-wider uppercase`}
        >
          {title}
        </span>
        <span
          className={`text-[10px] font-medium text-zinc-400 ${isDark ? "bg-white/10" : "bg-zinc-200"} rounded px-1.5 py-0.5`}
        >
          {count}
        </span>
      </div>
      {days.map((day) => (
        <div
          key={day.id}
          className={`min-w-0 flex-1 border-r border-b ${isDark ? "border-white/[0.04]" : "border-zinc-200"} h-9 bg-white/[0.01]`}
        />
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// SortableEmployeeRow — thin useSortable wrapper around EmployeeRow
// ---------------------------------------------------------------------------
type SortableEmployeeRowProps = {
  employee: ScheduleEmployee;
  employeeStats?: { hours: number; shiftCount: number };
  subtitle?: string;
  days: DayColumn[];
  shiftsByEmployeeDay: Map<string, ScheduleShift[]>;
  absencesByEmployeeDay: Map<string, Absence[]>;
  onCreateShift: (ctx: { dateId?: string; employeeId?: string } | null) => void;
  onAbsencePopover: (ctx: { employeeId: string; dateId: string } | null) => void;
  onSelectShift: (id: string | null) => void;
  onSelectEmployee?: (id: string) => void;
  onTimeChange?: (shiftId: string, newStart: string, newEnd: string) => void;
};

function SortableEmployeeRow(props: SortableEmployeeRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.employee.id,
    data: { type: "employee-sort" },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? SCHEDULE_LAYERS.stickyCorner : undefined,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <EmployeeRow {...props} dragHandleListeners={listeners} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmployeeRow — entire row for one employee (memoized to prevent cascade)
// ---------------------------------------------------------------------------
export const EmployeeRow = React.memo(function EmployeeRow({
  employee,
  employeeStats,
  subtitle,
  days,
  shiftsByEmployeeDay,
  absencesByEmployeeDay,
  onCreateShift,
  onAbsencePopover,
  onSelectShift,
  onSelectEmployee,
  onTimeChange,
  dragHandleListeners,
}: {
  employee: ScheduleEmployee;
  employeeStats?: { hours: number; shiftCount: number };
  subtitle?: string;
  days: DayColumn[];
  shiftsByEmployeeDay: Map<string, ScheduleShift[]>;
  absencesByEmployeeDay: Map<string, Absence[]>;
  onCreateShift: (ctx: { dateId?: string; employeeId?: string } | null) => void;
  onAbsencePopover: (ctx: { employeeId: string; dateId: string } | null) => void;
  onSelectShift: (id: string | null) => void;
  onSelectEmployee?: (id: string) => void;
  onTimeChange?: (shiftId: string, newStart: string, newEnd: string) => void;
  dragHandleListeners?: ReturnType<typeof useSortable>["listeners"];
}) {
  const { isDark, scheduleCompactMode: isCompact } = useContext(DashboardContext);
  const scheduledHours = employeeStats?.hours ?? 0;
  const shiftCount = employeeStats?.shiftCount ?? 0;
  const contractedHours = 37.5;
  const percentage = Math.min((scheduledHours / contractedHours) * 100, 100);
  const isOvertime = scheduledHours > contractedHours;

  let barColor = "bg-zinc-600";
  if (isOvertime) barColor = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]";
  else if (percentage >= 95) barColor = "bg-emerald-500/80";
  else if (percentage >= 70) barColor = "bg-zinc-500";

  return (
    <div className="group/row flex w-full">
      {/* Sticky employee info panel — clickable to open drawer */}
      <div
        className={`w-[260px] shrink-0 border-r border-b border-white/[0.04] ${isDark ? "bg-[#0a0a0c]" : "bg-white"} sticky left-0 flex cursor-pointer items-center shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] transition-colors group-hover/row:bg-white/[0.02] ${isCompact ? "h-[52px] min-h-0 gap-2 p-2" : "min-h-[100px] gap-3 p-3"}`}
        style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}
        onClick={() => onSelectEmployee?.(employee.id)}
      >
        {/* Drag handle + avatar */}
        <div className="relative flex shrink-0 items-center">
          {dragHandleListeners && (
            <div
              {...dragHandleListeners}
              onClick={(e) => e.stopPropagation()}
              className="absolute -left-1 flex h-full cursor-grab items-center text-zinc-600 opacity-0 transition-opacity group-hover/row:opacity-100 active:cursor-grabbing"
            >
              <GripVertical className="h-3 w-3" />
            </div>
          )}
          <div
            className={`flex items-center justify-center rounded-lg border font-black ${employee.avatarColor} ${isCompact ? "h-6 w-6 text-[8px]" : "h-8 w-8 text-[10px]"} ${dragHandleListeners ? "ml-2.5" : ""}`}
          >
            {employee.initials}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`text-[13px] leading-tight font-bold ${isDark ? "text-white" : "text-zinc-900"} truncate transition-colors group-hover/row:text-zinc-300`}
          >
            {employee.name}
          </h3>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-zinc-500">
            {subtitle || employee.jobTitle || employee.role}
          </p>
          {!isCompact && (
            <div className="mt-1.5 space-y-1 pr-1">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase">
                <span className="text-zinc-500">{shiftCount}v</span>
                <span className={isOvertime ? "text-red-400" : "text-zinc-400"}>
                  {scheduledHours.toFixed(1)}
                  <span className="text-zinc-600">/{contractedHours}</span>
                </span>
              </div>
              <div
                className={`h-1 w-full ${isDark ? "bg-white/5" : "bg-zinc-100"} overflow-hidden rounded-full`}
              >
                <div
                  className={`h-full ${barColor} rounded-full transition-all`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Day cells — fixed width for horizontal scroll */}
      {days.map((day) => {
        const cellShifts = shiftsByEmployeeDay.get(`${employee.id}::${day.id}`) ?? [];
        const cellAbsences = absencesByEmployeeDay.get(`${employee.id}::${day.id}`) ?? [];
        const hasContent = cellShifts.length > 0 || cellAbsences.length > 0;

        const absenceLabel = (type: string): "Sykdom" | "Ferie" | "Avspasering" => {
          switch (type) {
            case "sick_leave":
              return "Sykdom";
            case "vacation":
              return "Ferie";
            default:
              return "Avspasering";
          }
        };

        return (
          <MatrixCell
            key={day.id}
            isToday={day.isToday}
            id={`cell::${employee.id}::${day.id}`}
            isCompact={isCompact}
            dimmed={day.situation === "__dimmed__"}
            onAddClick={() => onCreateShift({ dateId: day.id, employeeId: employee.id })}
            onContextMenu={(e) => {
              e.preventDefault();
              onAbsencePopover({ employeeId: employee.id, dateId: day.id });
            }}
          >
            {hasContent ? (
              <div
                className={`flex h-full w-full flex-col pb-1 ${isCompact ? "gap-0.5" : "gap-1.5"}`}
              >
                {cellAbsences.map((absence) => (
                  <AbsenceCard
                    key={absence.id}
                    type={absenceLabel(absence.type)}
                    reason={absence.reason}
                    isCompact={isCompact}
                  />
                ))}
                {cellShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    role={shift.role}
                    time={shift.time}
                    status={shift.status}
                    indicator={shift.indicator}
                    zone={shift.zone}
                    id={shift.id}
                    startTime={shift.startTime}
                    endTime={shift.endTime}
                    isCompact={isCompact}
                    onClick={() => onSelectShift(shift.id)}
                    onTimeChange={
                      onTimeChange
                        ? (newStart, newEnd) => onTimeChange(shift.id, newStart, newEnd)
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : null}
          </MatrixCell>
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------
// MatrixCell — single droppable cell in the employee×day grid
// ---------------------------------------------------------------------------
function MatrixCell({
  children,
  isToday,
  id,
  isCompact,
  dimmed,
  onAddClick,
  onContextMenu,
}: {
  children?: React.ReactNode;
  isToday?: boolean;
  id?: string;
  isCompact?: boolean;
  dimmed?: boolean;
  onAddClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const defaultId = React.useId();
  const droppableId = id || defaultId;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      onContextMenu={onContextMenu}
      className={`min-w-0 flex-1 border-r border-b border-white/[0.03] ${isDark ? "bg-[#050505]" : "bg-zinc-50"}/40 relative flex flex-col gap-1 overflow-hidden shadow-[inset_0_1px_6px_rgba(0,0,0,0.3)] transition-colors ${isCompact ? "h-[52px] min-h-0 p-1" : "min-h-[100px] p-2"} ${isOver ? "z-10 scale-[1.02] rounded-lg border border-dashed border-orange-500/50 bg-orange-500/20" : "group-hover/row:bg-white/[0.02] hover:bg-white/[0.04]"} ${isToday ? "bg-orange-500/[0.06]" : ""} ${dimmed ? "opacity-30" : ""}`}
    >
      {children ? (
        <>
          {children}
          {/* Add button — always hover-only in compact, row-hover in normal */}
          <button
            onClick={onAddClick}
            className={`mt-auto flex w-full shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed ${isDark ? "border-white/[0.06]" : "border-zinc-300"} bg-transparent text-orange-500/0 transition-all hover:border-orange-500/30 hover:bg-white/[0.03] hover:text-orange-500/50 ${isCompact ? "hidden h-5 opacity-0 group-hover/row:block group-hover/row:text-orange-500/30 group-hover/row:opacity-60" : "h-7 opacity-0 group-hover/row:text-orange-500/30 group-hover/row:opacity-60"}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button
          onClick={onAddClick}
          className={`absolute inset-x-2 inset-y-2 rounded-lg border border-dashed ${isDark ? "border-white/[0.06]" : "border-zinc-300"} flex cursor-pointer items-center justify-center bg-transparent text-orange-500/0 opacity-0 transition-all hover:border-orange-500/30 hover:bg-white/[0.03] hover:text-orange-500/50 hover:opacity-100`}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
