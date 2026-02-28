"use client";

import React, { useContext } from "react";
import {
  Users,
  Briefcase,
  MoreVertical,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  ListTodo,
} from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ShiftCard, AbsenceCard } from "./grid-cards";
import {
  dummyEmployees,
  dummyDays,
  dailyShifts,
  type Employee,
  type DayColumn,
  type Shift,
} from "./schedule-data";

// ---------------------------------------------------------------------------
// GridContent — daily schedule grid (the perf-critical DnD subtree)
// ---------------------------------------------------------------------------
export function GridContent({
  isSidebarOpen,
  setIsSidebarOpen,
  onDateClick,
  filterSituation = "Alle",
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick: (d: string) => void;
  filterSituation?: string;
}) {
  const { isDark, scheduleView } = useContext(DashboardContext);

  const visibleDays = React.useMemo(
    () =>
      dummyDays.filter((day) => filterSituation === "Alle" || day.situation === filterSituation),
    [filterSituation],
  );

  const shiftsByEmployeeDay = React.useMemo(() => {
    const index = new Map<string, Shift[]>();
    for (const shift of dailyShifts) {
      const key = `${shift.employeeId}::${shift.dateId}`;
      const existing = index.get(key);
      if (existing) {
        existing.push(shift);
      } else {
        index.set(key, [shift]);
      }
    }
    return index;
  }, []);

  return (
    <div className="flex w-full min-w-fit flex-col">
      <DayHeaders
        isDark={isDark}
        scheduleView={scheduleView}
        visibleDays={visibleDays}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        onDateClick={onDateClick}
      />

      <div className="w-fit min-w-full flex-1 pb-20">
        {scheduleView === "ansatt" && (
          <div className="flex flex-col">
            {dummyEmployees.map((emp) => (
              <EmployeeRow
                key={emp.id}
                employee={emp}
                days={visibleDays}
                shiftsByEmployeeDay={shiftsByEmployeeDay}
              />
            ))}
          </div>
        )}

        {scheduleView === "jobb" && (
          <div className="flex flex-col">
            {Array.from(new Set(dummyEmployees.map((e) => e.role))).map((role) => {
              const employeesInRole = dummyEmployees.filter((e) => e.role === role);
              return (
                <React.Fragment key={role}>
                  <GroupHeader title={role} count={employeesInRole.length} days={visibleDays} />
                  {employeesInRole.map((emp) => (
                    <EmployeeRow
                      key={emp.id}
                      employee={emp}
                      days={visibleDays}
                      shiftsByEmployeeDay={shiftsByEmployeeDay}
                      subtitle={emp.team}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {scheduleView === "team" && (
          <div className="flex flex-col">
            {Array.from(new Set(dummyEmployees.map((e) => e.team))).map((team) => {
              const employeesInTeam = dummyEmployees.filter((e) => e.team === team);
              return (
                <React.Fragment key={team}>
                  <GroupHeader title={team} count={employeesInTeam.length} days={visibleDays} />
                  {employeesInTeam.map((emp) => (
                    <EmployeeRow
                      key={emp.id}
                      employee={emp}
                      days={visibleDays}
                      shiftsByEmployeeDay={shiftsByEmployeeDay}
                      subtitle={emp.role}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DayHeaders — sticky column headers (no DnD hooks — stable render)
// ---------------------------------------------------------------------------
const DayHeaders = React.memo(function DayHeaders({
  isDark,
  scheduleView,
  visibleDays,
  isSidebarOpen,
  setIsSidebarOpen,
  onDateClick,
}: {
  isDark: boolean;
  scheduleView: string;
  visibleDays: DayColumn[];
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick: (d: string) => void;
}) {
  return (
    <div className="sticky top-0 z-40 flex w-fit min-w-full">
      <div
        className={`w-[200px] shrink-0 border-r border-b border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]/95" : "bg-white/95"} sticky left-0 z-50 flex h-24 flex-col justify-between p-4 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl xl:h-28`}
      >
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-zinc-500 uppercase xl:text-[10px]">
            <Users className={`h-3.5 w-3.5 ${isDark ? "text-zinc-400" : "text-zinc-600"}`} />
            Grupper
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
        <div
          className={`mt-auto rounded-lg border border-white/5 px-2 py-1 ${isDark ? "bg-[#050505]" : "bg-zinc-50"}`}
        >
          <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
            Visning:{" "}
            {scheduleView === "ansatt" ? "Ansatt" : scheduleView === "jobb" ? "Rolle" : "Team"}
          </span>
        </div>
      </div>

      {visibleDays.map((day) => (
        <div
          key={day.id}
          className={`w-[280px] shrink-0 border-r border-b border-white/5 sm:w-[320px] lg:w-[400px] ${isDark ? "bg-[#0a0a0c]/90" : "bg-white/95"} group/day flex h-24 cursor-pointer flex-col justify-between p-2 backdrop-blur-xl transition-colors hover:bg-white/5 xl:h-28 ${day.isToday ? "bg-orange-500/[0.02]" : ""}`}
          onClick={() => onDateClick(day.label)}
        >
          {day.coverageAlert ? (
            <div className="absolute top-0 left-0 h-1 w-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          ) : (
            <div className="absolute top-0 left-0 h-1 w-full bg-green-500/20" />
          )}

          <div className="flex items-start justify-between">
            <h2
              className={`flex items-center gap-1.5 truncate text-[11px] font-black tracking-tight sm:text-xs ${day.isToday ? "text-orange-400" : day.isHoliday ? "text-rose-400" : isDark ? "text-zinc-300" : "text-zinc-700"}`}
            >
              {day.label}
              {day.isToday ? (
                <span className="h-1 w-1 shrink-0 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
              ) : null}
            </h2>
            <button
              className={`shrink-0 p-1 text-zinc-500 hover:text-white ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-md transition-colors`}
            >
              <MoreVertical className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-auto flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] leading-none font-bold tracking-widest text-zinc-500 uppercase xl:gap-2 xl:text-[11px]">
              <span className="flex items-center gap-0.5" title="Ansatte">
                <Users className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {day.staff}
              </span>
              <span className="flex items-center gap-0.5" title="Vakter">
                <Briefcase className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {day.shifts}
              </span>
              {day.messages !== undefined ? (
                <span
                  className={`flex items-center gap-0.5 ${day.messages > 0 ? "text-blue-400" : ""}`}
                  title="Meldinger for dagen"
                >
                  <MessageSquare className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {day.messages}
                </span>
              ) : null}
              {day.tasks ? (
                <span
                  className={`flex items-center gap-0.5 ${day.tasks.done < day.tasks.total ? "text-orange-400" : "text-emerald-400"}`}
                  title="Oppmøte / Gjøremål"
                >
                  <ListTodo className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {day.tasks.done}/
                  {day.tasks.total}
                </span>
              ) : null}
            </div>
            {day.coverageAlert ? (
              <div className="flex w-fit max-w-full items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-1 py-0.5 text-[10px] font-bold text-red-500">
                <AlertCircle className="h-2.5 w-2.5 shrink-0" />{" "}
                <span className="truncate">{day.coverageAlert}</span>
              </div>
            ) : (
              <div className="flex w-fit max-w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] font-bold text-zinc-500">
                <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-green-500/50" />{" "}
                <span className="truncate">Optimal dekning</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

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
    <div className="group/header flex w-fit min-w-full">
      <div
        className={`w-[200px] shrink-0 border-r border-b border-white/5 xl:w-[250px] ${isDark ? "bg-white/5" : "bg-zinc-100"} relative sticky left-0 z-30 flex h-8 items-center justify-between px-3 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}
      >
        <span
          className={`text-[10px] font-bold xl:text-xs ${isDark ? "text-white" : "text-zinc-900"} tracking-wider uppercase`}
        >
          {title}
        </span>
        <span
          className={`text-[9px] font-medium text-zinc-400 ${isDark ? "bg-white/10" : "bg-zinc-200"} rounded px-1.5 py-0.5`}
        >
          {count}
        </span>
      </div>
      {days.map((day) => (
        <div
          key={day.id}
          className={`w-[280px] shrink-0 border-r border-b sm:w-[320px] lg:w-[400px] ${isDark ? "border-white/5" : "border-zinc-200"} h-8 bg-white/[0.02]`}
        />
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// EmployeeRow — entire row for one employee (memoized to prevent cascade)
// ---------------------------------------------------------------------------
export const EmployeeRow = React.memo(function EmployeeRow({
  employee,
  subtitle,
  days,
  shiftsByEmployeeDay,
}: {
  employee: Employee;
  subtitle?: string;
  days: DayColumn[];
  shiftsByEmployeeDay: Map<string, Shift[]>;
}) {
  const { isDark } = useContext(DashboardContext);
  const scheduledHours = parseFloat(employee.hours) || 0;
  const contractedHours = 37.5;
  const percentage = Math.min((scheduledHours / contractedHours) * 100, 100);
  const isOvertime = scheduledHours > contractedHours;

  let barColor = "bg-zinc-500";
  if (isOvertime) barColor = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
  else if (percentage >= 95) barColor = "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]";
  else if (percentage >= 70) barColor = "bg-orange-500";

  return (
    <div className="group/row flex w-fit min-w-full">
      {/* Sticky employee info panel */}
      <div
        className={`w-[200px] shrink-0 border-r border-b border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]" : "bg-white"} sticky left-0 z-30 flex h-28 items-center gap-2 p-2 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] transition-colors group-hover/row:bg-white/[0.02]`}
      >
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[9px] font-black ${employee.avatarColor}`}
        >
          {employee.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`text-[11px] font-bold xl:text-[12px] ${isDark ? "text-white" : "text-zinc-900"} truncate leading-tight transition-colors group-hover/row:text-orange-400`}
          >
            {employee.name}
          </h3>
          <p className="mb-1 truncate text-[10px] leading-tight text-zinc-500 xl:text-[11px]">
            {subtitle || employee.role}
          </p>
          <div className="mt-1 space-y-1 pr-2">
            <div className="flex items-center justify-between text-[9px] font-bold tracking-widest uppercase">
              <span className="text-zinc-500">{employee.shifts} vakter</span>
              <span
                className={
                  isOvertime
                    ? "text-red-400"
                    : percentage >= 95
                      ? "text-green-400"
                      : "text-zinc-400"
                }
              >
                {employee.hours} <span className="text-zinc-600">/{contractedHours}</span>
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
        </div>
      </div>

      {/* Day cells */}
      {days.map((day) => {
        const dayShifts = shiftsByEmployeeDay.get(`${employee.id}::${day.id}`) ?? [];

        return (
          <MatrixCell key={day.id} isToday={day.isToday}>
            {dayShifts.length > 0 ? (
              <div className="flex h-full w-full flex-col gap-1 pb-1">
                {dayShifts.map((shift) =>
                  shift.type === "absence" ? (
                    <AbsenceCard
                      key={shift.id}
                      type={shift.absenceType as "Sykdom" | "Ferie" | "Avspasering"}
                      reason={shift.reason}
                    />
                  ) : (
                    <ShiftCard
                      key={shift.id}
                      role={shift.role!}
                      time={shift.time!}
                      status={shift.status!}
                      indicator={shift.indicator!}
                      zone={shift.zone}
                      id={shift.id}
                    />
                  ),
                )}
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
}: {
  children?: React.ReactNode;
  isToday?: boolean;
  id?: string;
}) {
  const { isDark } = useContext(DashboardContext);
  const defaultId = React.useId();
  const droppableId = id || defaultId;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={`w-[280px] shrink-0 border-r border-b border-white/5 sm:w-[320px] lg:w-[400px] ${isDark ? "bg-[#050505]" : "bg-zinc-50"}/40 relative flex h-28 flex-col gap-1 overflow-hidden p-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-colors ${isOver ? "z-10 scale-[1.02] rounded-lg border border-dashed border-orange-500/50 bg-orange-500/20" : "group-hover/row:bg-white/[0.02] hover:bg-white/[0.04]"} ${isToday ? "bg-orange-500/[0.02]" : ""}`}
    >
      {children ? (
        children
      ) : (
        <button
          className={`absolute inset-x-1.5 inset-y-1.5 rounded-md border border-dashed ${isDark ? "border-white/10" : "border-zinc-300"} flex cursor-pointer items-center justify-center bg-white/[0.01] text-orange-500/0 opacity-0 transition-all hover:border-orange-500/30 hover:bg-white/[0.03] hover:text-orange-500/50 hover:opacity-100`}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
