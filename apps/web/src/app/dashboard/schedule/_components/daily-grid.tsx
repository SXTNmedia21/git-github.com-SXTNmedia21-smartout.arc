"use client";

import React, { useContext } from "react";
import {
  Users,
  Briefcase,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  AlertCircle,
  GripVertical,
} from "lucide-react";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ShiftCard, AbsenceCard } from "./grid-cards";
import { GhostShiftCard } from "./ghost-shift-card";
import type { ScheduleDensity } from "./density-selector";
import { PulseHeatmap, PulseMiniCard } from "./density-pulse-cell";
import type { DayColumn } from "./schedule-data";
import { useScheduleUI } from "./schedule-ui-context";
import type { ScheduleEmployee } from "../_hooks/use-employees";
import type { ShiftReadinessEntry } from "../_hooks/use-shift-readiness-check";
import { DayContextMenu } from "./day-context-menu";
import type { Shift as ScheduleShift, Absence, ShiftProposal } from "./schedule-types";
import { SCHEDULE_LAYERS } from "./schedule-layers";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ShiftUnlockHint, type MissingProtocol } from "./ShiftUnlockHint";

/** Maps hook rows into the slimmer `MissingProtocol` list for the unlock hint. */
function pendingToMissing(entry: ShiftReadinessEntry | undefined): MissingProtocol[] {
  return (entry?.pendingProtocols ?? []).map((p) => ({
    protocol_id: p.protocol_id,
    name: p.name,
    steps_remaining: p.steps_remaining,
    test_pending: p.test_pending,
    confirmation_pending: p.confirmation_pending,
  }));
}

// ---------------------------------------------------------------------------
// GridContent — daily schedule grid (the perf-critical DnD subtree)
// ---------------------------------------------------------------------------
export function GridContent({
  isSidebarOpen,
  setIsSidebarOpen,
  onDateClick,
  filterSituation: _filterSituation = "Alle",
  activeStatusFilter = null,
  visibleDays,
  employees,
  shifts,
  absences,
  highlightedDayId,
  weekStart,
  onTimeChange,
  proposals = [],
  onApproveProposal,
  onRejectProposal,
  conflictedShiftIds,
  readinessMap,
  shiftTimeEntries,
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick: (d: string) => void;
  filterSituation?: string;
  activeStatusFilter?: string | null;
  visibleDays: DayColumn[];
  employees: ScheduleEmployee[];
  shifts: ScheduleShift[];
  absences: Absence[];
  highlightedDayId?: string | null;
  weekStart: string;
  onTimeChange?: (shiftId: string, newStart: string, newEnd: string) => void;
  proposals?: ShiftProposal[];
  onApproveProposal?: (id: string) => Promise<void>;
  onRejectProposal?: (id: string) => void;
  conflictedShiftIds?: Set<string>;
  readinessMap?: Map<string, ShiftReadinessEntry>;
  /** Map shift_id → { punchIn, punchOut } for tooltip display. */
  shiftTimeEntries?: Map<string, { punchIn: string | null; punchOut: string | null }>;
}) {
  const { isDark, scheduleView, scheduleDensity } = useContext(DashboardContext);
  const { active } = useDndContext();
  const { setCreateShiftContext, setAbsencePopover, setSelectedShift, setSelectedEmployee } =
    useScheduleUI();
  const rowListRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollElement, setScrollElement] = React.useState<HTMLElement | null>(null);
  const enableDroppable = active !== null;

  // ── Filter shifts based on activeStatusFilter ──────────────
  const filteredShifts = React.useMemo(() => {
    if (!activeStatusFilter) return shifts;
    switch (activeStatusFilter) {
      case "draft":
        return shifts.filter((s) => s.status === "created" || s.status === "assigned");
      case "published":
        return shifts.filter((s) => s.status === "published");
      case "active":
        return shifts.filter((s) => s.status === "active");
      case "completed":
        return shifts.filter((s) => s.status === "completed");
      case "open_shifts":
        return shifts.filter((s) => !s.employeeId);
      default:
        return shifts;
    }
  }, [shifts, activeStatusFilter]);

  // ── Filter employees to only show those with matching data ──
  const filteredEmployees = React.useMemo(() => {
    if (!activeStatusFilter) return employees;
    // Absence filter: show only employees with absences
    if (activeStatusFilter === "absence") {
      const employeesWithAbsences = new Set(absences.map((a) => a.employeeId));
      return employees.filter((emp) => employeesWithAbsences.has(emp.id));
    }
    // Coverage risk: employees assigned to days with coverage alerts
    if (activeStatusFilter === "coverage_risk") {
      const daysWithAlerts = new Set(visibleDays.filter((d) => d.coverageAlert).map((d) => d.id));
      const employeesOnAlertDays = new Set<string>();
      for (const s of shifts) {
        if (s.employeeId && daysWithAlerts.has(s.dateId)) {
          employeesOnAlertDays.add(s.employeeId);
        }
      }
      return employees.filter((emp) => employeesOnAlertDays.has(emp.id));
    }
    // Open shifts: show employees with unassigned shifts (no employeeId)
    if (activeStatusFilter === "open_shifts") {
      // Show all employees so they can be assigned to open shifts
      return employees;
    }
    // Overtime risk: employees exceeding contracted hours
    if (activeStatusFilter === "overtime_risk") {
      const CONTRACTED = 37.5;
      const hoursByEmp = new Map<string, number>();
      for (const s of shifts) {
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
      for (const s of shifts) {
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
  }, [employees, activeStatusFilter, filteredShifts, absences, shifts, visibleDays]);

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
    for (const absence of absences) {
      const key = `${absence.employeeId}::${absence.dateId}`;
      const existing = index.get(key);
      if (existing) {
        existing.push(absence);
      } else {
        index.set(key, [absence]);
      }
    }
    return index;
  }, [absences]);

  /** Index proposals by employee::day key for ghost card rendering */
  const proposalsByEmployeeDay = React.useMemo(() => {
    const index = new Map<string, ShiftProposal[]>();
    for (const proposal of proposals) {
      const key = `${proposal.employeeId}::${proposal.dateId}`;
      const existing = index.get(key);
      if (existing) {
        existing.push(proposal);
      } else {
        index.set(key, [proposal]);
      }
    }
    return index;
  }, [proposals]);

  /** Index unfiltered shifts by day for day-level menu actions */
  const shiftsByDate = React.useMemo(() => {
    const index = new Map<string, ScheduleShift[]>();
    for (const shift of shifts) {
      const existing = index.get(shift.dateId);
      if (existing) {
        existing.push(shift);
      } else {
        index.set(shift.dateId, [shift]);
      }
    }
    return index;
  }, [shifts]);

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

  React.useEffect(() => {
    if (scheduleView !== "ansatt") {
      setScrollElement(null);
      return;
    }
    const findScrollableParent = (node: HTMLElement | null): HTMLElement | null => {
      let current = node?.parentElement ?? null;
      while (current) {
        const style = window.getComputedStyle(current);
        if (style.overflowY === "auto" || style.overflowY === "scroll") return current;
        current = current.parentElement;
      }
      return null;
    };
    setScrollElement(findScrollableParent(rowListRef.current));
  }, [scheduleView, filteredEmployees.length]);

  const estimateRowSize = React.useCallback(() => {
    // Pulse row height: 40px when any conflict in row (computed in cell render),
    // 28px baseline for heatmap-only. Use 40 as pessimistic estimate so the
    // virtualizer never underestimates (rows without conflicts will self-correct).
    switch (scheduleDensity) {
      case "cozy":
        return 120;
      case "compact":
        return 56;
      case "pulse":
        return 40; // pessimistic — conflict-row height
      default:
        return 100; // "default"
    }
  }, [scheduleDensity]);

  const rowVirtualizer = useVirtualizer({
    count: scheduleView === "ansatt" ? filteredEmployees.length : 0,
    getScrollElement: () => scrollElement,
    estimateSize: estimateRowSize,
    overscan: 4,
    enabled: scheduleView === "ansatt" && scrollElement !== null,
  });

  // Force virtualizer to recalculate when density changes
  React.useEffect(() => {
    rowVirtualizer.measure();
  }, [scheduleDensity, rowVirtualizer]);

  const virtualRows = scheduleView === "ansatt" ? rowVirtualizer.getVirtualItems() : [];

  /** Group once for role/team views to avoid repeated O(n²) filter scans. */
  const employeesByRole = React.useMemo(() => {
    const map = new Map<string, ScheduleEmployee[]>();
    for (const employee of filteredEmployees) {
      const roleKey = employee.jobTitle || employee.role || "Ukjent";
      const list = map.get(roleKey) ?? [];
      list.push(employee);
      map.set(roleKey, list);
    }
    return Array.from(map.entries());
  }, [filteredEmployees]);

  /** Group once for team view to avoid repeated O(n²) filter scans. */
  const employeesByTeam = React.useMemo(() => {
    const map = new Map<string, ScheduleEmployee[]>();
    for (const employee of filteredEmployees) {
      const teamKey = employee.team || "Uten team";
      const list = map.get(teamKey) ?? [];
      list.push(employee);
      map.set(teamKey, list);
    }
    return Array.from(map.entries());
  }, [filteredEmployees]);

  /** Group once for location view. */
  const employeesByLocation = React.useMemo(() => {
    const map = new Map<string, ScheduleEmployee[]>();
    for (const employee of filteredEmployees) {
      const locKey = employee.locationName || "Uten lokasjon";
      const list = map.get(locKey) ?? [];
      list.push(employee);
      map.set(locKey, list);
    }
    return Array.from(map.entries());
  }, [filteredEmployees]);

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
        shiftsByDate={shiftsByDate}
        weekStart={weekStart}
        enableDroppable={enableDroppable}
      />

      <div className="w-full flex-1 pb-20">
        {scheduleView === "ansatt" && (
          <SortableContext
            items={virtualRows
              .map((row) => filteredEmployees[row.index]?.id)
              .filter((id): id is string => typeof id === "string")}
            strategy={verticalListSortingStrategy}
          >
            <div
              ref={rowListRef}
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {virtualRows.map((virtualRow) => {
                const employee = filteredEmployees[virtualRow.index];
                if (!employee) return null;
                return (
                  <div
                    key={employee.id}
                    className="absolute top-0 left-0 w-full overflow-hidden"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                      height: `${virtualRow.size}px`,
                    }}
                  >
                    <SortableEmployeeRow
                      employee={employee}
                      employeeStats={employeeStats.get(employee.id)}
                      days={visibleDays}
                      shiftsByEmployeeDay={shiftsByEmployeeDay}
                      absencesByEmployeeDay={absencesByEmployeeDay}
                      proposalsByEmployeeDay={proposalsByEmployeeDay}
                      onCreateShift={setCreateShiftContext}
                      onAbsencePopover={setAbsencePopover}
                      onSelectShift={setSelectedShift}
                      onSelectEmployee={setSelectedEmployee}
                      onTimeChange={onTimeChange}
                      onApproveProposal={onApproveProposal}
                      onRejectProposal={onRejectProposal}
                      enableDroppable={enableDroppable}
                      conflictedShiftIds={conflictedShiftIds}
                      readinessPercent={readinessMap?.get(employee.id)?.readinessPercent}
                      missingProtocols={pendingToMissing(readinessMap?.get(employee.id))}
                      shiftTimeEntries={shiftTimeEntries}
                    />
                  </div>
                );
              })}
              {virtualRows.length === 0 && filteredEmployees.length > 0 && (
                <div className="space-y-2 border-b border-white/[0.03] p-2">
                  {Array.from({ length: 3 }).map((_, skeletonIndex) => (
                    <div
                      key={`employee-virtual-skeleton-${skeletonIndex + 1}`}
                      className={`grid gap-2`}
                      style={{
                        gridTemplateColumns: `260px repeat(${visibleDays.length}, minmax(0, 1fr))`,
                      }}
                    >
                      <div className="bg-muted h-[52px] animate-pulse rounded-lg" />
                      {Array.from({ length: visibleDays.length }).map((__, cellIndex) => (
                        <div
                          key={`employee-virtual-skeleton-cell-${skeletonIndex + 1}-${cellIndex + 1}`}
                          className="bg-muted/50 h-[52px] animate-pulse rounded-lg"
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SortableContext>
        )}

        {scheduleView === "jobb" && (
          <div className="flex flex-col">
            {employeesByRole.map(([jobTitle, employeesInRole]) => {
              return (
                <React.Fragment key={jobTitle}>
                  <GroupHeader title={jobTitle} count={employeesInRole.length} days={visibleDays} />
                  {employeesInRole.map((emp) => (
                    <EmployeeRow
                      key={emp.id}
                      employee={emp}
                      employeeStats={employeeStats.get(emp.id)}
                      days={visibleDays}
                      shiftsByEmployeeDay={shiftsByEmployeeDay}
                      absencesByEmployeeDay={absencesByEmployeeDay}
                      proposalsByEmployeeDay={proposalsByEmployeeDay}
                      onCreateShift={setCreateShiftContext}
                      onAbsencePopover={setAbsencePopover}
                      onSelectShift={setSelectedShift}
                      onSelectEmployee={setSelectedEmployee}
                      onTimeChange={onTimeChange}
                      onApproveProposal={onApproveProposal}
                      onRejectProposal={onRejectProposal}
                      enableDroppable={enableDroppable}
                      subtitle={emp.team}
                      readinessPercent={readinessMap?.get(emp.id)?.readinessPercent}
                      missingProtocols={pendingToMissing(readinessMap?.get(emp.id))}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {scheduleView === "team" && (
          <div className="flex flex-col">
            {employeesByTeam.map(([team, employeesInTeam]) => {
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
                      proposalsByEmployeeDay={proposalsByEmployeeDay}
                      onCreateShift={setCreateShiftContext}
                      onAbsencePopover={setAbsencePopover}
                      onSelectShift={setSelectedShift}
                      onSelectEmployee={setSelectedEmployee}
                      onTimeChange={onTimeChange}
                      onApproveProposal={onApproveProposal}
                      onRejectProposal={onRejectProposal}
                      enableDroppable={enableDroppable}
                      subtitle={emp.jobTitle || emp.role}
                      readinessPercent={readinessMap?.get(emp.id)?.readinessPercent}
                      missingProtocols={pendingToMissing(readinessMap?.get(emp.id))}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {scheduleView === "lokasjon" && (
          <div className="flex flex-col">
            {employeesByLocation.map(([location, employeesInLocation]) => {
              return (
                <React.Fragment key={location}>
                  <GroupHeader
                    title={location}
                    count={employeesInLocation.length}
                    days={visibleDays}
                  />
                  {employeesInLocation.map((emp) => (
                    <EmployeeRow
                      key={emp.id}
                      employee={emp}
                      employeeStats={employeeStats.get(emp.id)}
                      days={visibleDays}
                      shiftsByEmployeeDay={shiftsByEmployeeDay}
                      absencesByEmployeeDay={absencesByEmployeeDay}
                      proposalsByEmployeeDay={proposalsByEmployeeDay}
                      onCreateShift={setCreateShiftContext}
                      onAbsencePopover={setAbsencePopover}
                      onSelectShift={setSelectedShift}
                      onSelectEmployee={setSelectedEmployee}
                      onTimeChange={onTimeChange}
                      onApproveProposal={onApproveProposal}
                      onRejectProposal={onRejectProposal}
                      enableDroppable={enableDroppable}
                      subtitle={emp.departmentName}
                      readinessPercent={readinessMap?.get(emp.id)?.readinessPercent}
                      missingProtocols={pendingToMissing(readinessMap?.get(emp.id))}
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
  shiftsByDate,
  weekStart,
  enableDroppable,
}: {
  isDark: boolean;
  scheduleView: string;
  visibleDays: DayColumn[];
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick: (d: string) => void;
  highlightedDayId: string | null;
  shiftsByDate: Map<string, ScheduleShift[]>;
  weekStart: string;
  enableDroppable: boolean;
}) {
  return (
    <div className="sticky top-0 flex w-full" style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}>
      {/* Sticky corner cell */}
      <div
        className={`border-border bg-background/95 sticky left-0 flex h-16 w-[260px] shrink-0 flex-col justify-center border-r border-b p-3 shadow-[2px_0_8px_-6px_rgba(0,0,0,0.35)]`}
        style={{ zIndex: SCHEDULE_LAYERS.stickyCorner }}
      >
        <div className="flex w-full items-center justify-between">
          <div className="text-foreground/60 flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
            <Users className="text-foreground/50 h-4 w-4" />
            {scheduleView === "ansatt"
              ? "Ansatte"
              : scheduleView === "jobb"
                ? "Roller"
                : scheduleView === "lokasjon"
                  ? "Lokasjoner"
                  : "Team"}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-foreground/50 hover:text-foreground hover:bg-muted rounded-md p-1 transition-colors"
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
          dayShifts={shiftsByDate.get(day.id) ?? []}
          weekStart={weekStart}
          enableDroppable={enableDroppable}
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
  dayShifts,
  weekStart,
  enableDroppable,
}: {
  day: DayColumn;
  isDark: boolean;
  onDateClick: (d: string) => void;
  isHighlighted: boolean;
  dayShifts: ScheduleShift[];
  weekStart: string;
  enableDroppable: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-header::${day.id}`,
    disabled: !enableDroppable,
  });

  return (
    <div
      ref={setNodeRef}
      data-schedule-day-id={day.id}
      className={`border-border bg-background/90 group/day hover:bg-muted relative flex h-16 flex-1 cursor-pointer flex-col justify-center border-r border-b p-2 transition-colors ${day.isToday ? "bg-orange-500/[0.06]" : ""} ${isOver ? "rounded-lg border-dashed border-orange-500/50 bg-orange-500/20" : ""} ${day.situation === "__dimmed__" ? "opacity-30" : ""} ${isHighlighted ? "shadow-[inset_0_0_0_2px_rgba(251,146,60,0.7)]" : ""}`}
      style={{ minWidth: "100px" }}
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
          className={`flex items-center gap-1.5 truncate text-sm tracking-tight ${day.isToday ? "font-black text-orange-400" : day.isHoliday ? "font-black text-rose-400" : "text-muted-foreground font-semibold"}`}
        >
          {day.label}
          {day.isToday ? (
            <span className="h-1 w-1 shrink-0 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
          ) : null}
        </h2>
        <div onClick={(e) => e.stopPropagation()}>
          <DayContextMenu
            dateId={day.id}
            dateLabel={day.label}
            isDark={isDark}
            dayShifts={dayShifts}
            weekStart={weekStart}
          />
        </div>
      </div>

      {/* Compact stats */}
      <div className="text-foreground/50 mt-1 flex items-center gap-2 text-[10px] leading-none font-medium">
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
  const { isDark: _isDark } = useContext(DashboardContext);
  return (
    <div className="group/header flex w-full">
      <div
        className={`border-border bg-muted/30 relative sticky left-0 flex h-9 w-[260px] shrink-0 items-center justify-between border-r border-b px-4 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}
        style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}
      >
        <span className={`text-foreground text-[11px] font-bold tracking-wider uppercase`}>
          {title}
        </span>
        <span
          className={`text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium`}
        >
          {count}
        </span>
      </div>
      {days.map((day) => (
        <div
          key={day.id}
          style={{ minWidth: "100px" }}
          className={`border-border bg-muted/10 h-9 flex-1 border-r border-b`}
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
  proposalsByEmployeeDay?: Map<string, ShiftProposal[]>;
  onCreateShift: (ctx: { dateId?: string; employeeId?: string } | null) => void;
  onAbsencePopover: (ctx: { employeeId: string; dateId: string } | null) => void;
  onSelectShift: (id: string | null) => void;
  onSelectEmployee?: (id: string) => void;
  onTimeChange?: (shiftId: string, newStart: string, newEnd: string) => void;
  onApproveProposal?: (id: string) => Promise<void>;
  onRejectProposal?: (id: string) => void;
  enableDroppable: boolean;
  conflictedShiftIds?: Set<string>;
  readinessPercent?: number;
  missingProtocols?: MissingProtocol[];
  shiftTimeEntries?: Map<string, { punchIn: string | null; punchOut: string | null }>;
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
  proposalsByEmployeeDay,
  onCreateShift,
  onAbsencePopover,
  onSelectShift,
  onSelectEmployee,
  onTimeChange,
  onApproveProposal,
  onRejectProposal,
  dragHandleListeners,
  enableDroppable,
  conflictedShiftIds,
  readinessPercent,
  missingProtocols,
  shiftTimeEntries,
}: {
  employee: ScheduleEmployee;
  employeeStats?: { hours: number; shiftCount: number };
  subtitle?: string;
  days: DayColumn[];
  shiftsByEmployeeDay: Map<string, ScheduleShift[]>;
  absencesByEmployeeDay: Map<string, Absence[]>;
  proposalsByEmployeeDay?: Map<string, ShiftProposal[]>;
  onCreateShift: (ctx: { dateId?: string; employeeId?: string } | null) => void;
  onAbsencePopover: (ctx: { employeeId: string; dateId: string } | null) => void;
  onSelectShift: (id: string | null) => void;
  onSelectEmployee?: (id: string) => void;
  onTimeChange?: (shiftId: string, newStart: string, newEnd: string) => void;
  onApproveProposal?: (id: string) => Promise<void>;
  onRejectProposal?: (id: string) => void;
  dragHandleListeners?: ReturnType<typeof useSortable>["listeners"];
  enableDroppable: boolean;
  conflictedShiftIds?: Set<string>;
  shiftTimeEntries?: Map<string, { punchIn: string | null; punchOut: string | null }>;
  readinessPercent?: number;
  missingProtocols?: MissingProtocol[];
}) {
  const { isDark: _isDark, scheduleDensity } = useContext(DashboardContext);
  // Derive isCompact for the sticky employee panel + legacy props that take a boolean.
  // "cozy" and "default" both use the normal row height; "compact" and "pulse" compress.
  const isCompact = scheduleDensity === "compact" || scheduleDensity === "pulse";
  const scheduledHours = employeeStats?.hours ?? 0;
  const shiftCount = employeeStats?.shiftCount ?? 0;
  const contractedHours = 37.5;
  const percentage = Math.min((scheduledHours / contractedHours) * 100, 100);
  const isOvertime = scheduledHours > contractedHours;

  let barColor = "bg-muted-foreground";
  if (isOvertime) barColor = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]";
  else if (percentage >= 95) barColor = "bg-emerald-500/80";
  else if (percentage >= 70) barColor = "bg-muted-foreground";

  return (
    <div className="flex w-full flex-col">
      <div className="group/row flex w-full">
        {/* Sticky employee info panel — clickable to open drawer */}
        <div
          className={`border-border bg-background group-hover/row:bg-muted/50 sticky left-0 flex w-[260px] shrink-0 cursor-pointer items-center border-r border-b shadow-[2px_0_8px_-6px_rgba(0,0,0,0.35)] transition-colors ${isCompact ? "h-[52px] min-h-0 gap-2 p-2" : "h-[100px] gap-3 p-3"}`}
          style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}
          onClick={() => onSelectEmployee?.(employee.id)}
        >
          {/* Drag handle + avatar */}
          <div className="relative flex shrink-0 items-center">
            {dragHandleListeners && (
              <div
                {...dragHandleListeners}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground absolute -left-1 flex h-full cursor-grab items-center opacity-0 transition-opacity group-hover/row:opacity-100 active:cursor-grabbing"
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
            <div className="flex items-center gap-1.5">
              <h3
                className={`text-foreground group-hover/row:text-foreground/80 truncate text-[13px] leading-tight font-bold transition-colors`}
              >
                {employee.name}
              </h3>
              {readinessPercent !== undefined && readinessPercent < 100 && (
                <span
                  className="inline-flex shrink-0 items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400"
                  title={`${readinessPercent}% opplæring fullført`}
                >
                  {readinessPercent}%
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-tight">
              {subtitle || employee.jobTitle || employee.role}
            </p>
            {!isCompact && (
              <div className="mt-1.5 space-y-1 pr-1">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase">
                  <span className="text-muted-foreground">{shiftCount}v</span>
                  <span className={isOvertime ? "text-red-400" : "text-muted-foreground"}>
                    {scheduledHours.toFixed(1)}
                    <span className="text-muted-foreground/70">/{contractedHours}</span>
                  </span>
                </div>
                <div className={`bg-muted h-1 w-full overflow-hidden rounded-full`}>
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
          const cellProposals = proposalsByEmployeeDay?.get(`${employee.id}::${day.id}`) ?? [];
          const hasContent =
            cellShifts.length > 0 || cellAbsences.length > 0 || cellProposals.length > 0;

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

          // Pulse mode: determine if any shift in this cell has a conflict
          const cellHasConflict =
            scheduleDensity === "pulse" && cellShifts.some((s) => conflictedShiftIds?.has(s.id));

          return (
            <MatrixCell
              key={day.id}
              isToday={day.isToday}
              id={`cell::${employee.id}::${day.id}`}
              isCompact={isCompact}
              density={scheduleDensity}
              cellHasConflict={cellHasConflict}
              dimmed={day.situation === "__dimmed__"}
              enableDroppable={enableDroppable}
              onAddClick={() => onCreateShift({ dateId: day.id, employeeId: employee.id })}
              onContextMenu={(e) => {
                e.preventDefault();
                onAbsencePopover({ employeeId: employee.id, dateId: day.id });
              }}
            >
              {/* Pulse mode — heatmap or conflict-escape mini-cards */}
              {scheduleDensity === "pulse" ? (
                cellShifts.length === 0 ? null : cellHasConflict ? ( // Empty heatmap cell — bg-muted/20 applied by MatrixCellBase in pulse+empty state
                  // Conflict escape — one PulseMiniCard per conflicting shift
                  <div className="flex h-full w-full flex-col gap-0.5 p-0.5">
                    {cellShifts.map((shift) => (
                      <PulseMiniCard
                        key={shift.id}
                        shift={{
                          id: shift.id,
                          role: shift.role,
                          startTime: shift.startTime,
                          endTime: shift.endTime,
                          indicator: shift.indicator,
                          hasConflict: conflictedShiftIds?.has(shift.id) ?? false,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  // Heatmap — majority indicator color at 60% opacity
                  <PulseHeatmap indicators={cellShifts.map((s) => s.indicator)} />
                )
              ) : hasContent ? (
                // Normal tiers (cozy / default / compact)
                <div
                  className={`flex h-full w-full flex-col justify-center pb-1 ${isCompact ? "gap-0.5" : "gap-1"}`}
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
                      zone={shift.zones?.[0]?.name ?? shift.zone}
                      id={shift.id}
                      startTime={shift.startTime}
                      endTime={shift.endTime}
                      isCompact={isCompact}
                      confirmedAt={shift.confirmedAt}
                      hasConflict={conflictedShiftIds?.has(shift.id)}
                      cellShiftCount={cellShifts.length}
                      punchInAt={shiftTimeEntries?.get(shift.id)?.punchIn}
                      punchOutAt={shiftTimeEntries?.get(shift.id)?.punchOut}
                      employeeName={employee.name}
                      workHours={shift.workHours}
                      onClick={() => onSelectShift(shift.id)}
                      onTimeChange={
                        onTimeChange
                          ? (newStart, newEnd) => onTimeChange(shift.id, newStart, newEnd)
                          : undefined
                      }
                    />
                  ))}
                  {cellProposals
                    .filter((p) => p.type !== "delete")
                    .map((proposal) => (
                      <GhostShiftCard
                        key={proposal.id}
                        proposal={proposal as Exclude<typeof proposal, { type: "delete" }>}
                        employeeName={employee.name}
                        isCompact={isCompact}
                        onApprove={() => void onApproveProposal?.(proposal.id)}
                        onReject={() => onRejectProposal?.(proposal.id)}
                      />
                    ))}
                </div>
              ) : null}
            </MatrixCell>
          );
        })}
      </div>
      {missingProtocols && missingProtocols.length > 0 && (
        <ShiftUnlockHint missingProtocols={missingProtocols} />
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// MatrixCell — single droppable cell in the employee×day grid
// ---------------------------------------------------------------------------

/** Derives CSS height class for the cell based on density + conflict state. */
function cellHeightClass(density: ScheduleDensity | undefined, cellHasConflict: boolean): string {
  switch (density) {
    case "cozy":
      return "h-[120px] p-2";
    case "compact":
      return "h-[52px] min-h-0 p-1";
    case "pulse":
      // 40px for conflict-escape, 28px for heatmap baseline
      return cellHasConflict ? "h-[40px] min-h-0 p-0.5" : "h-[28px] min-h-0 p-0";
    default:
      // "default" + undefined fallback
      return "h-[100px] p-2";
  }
}

function MatrixCell({
  children,
  isToday,
  id,
  isCompact,
  density,
  cellHasConflict = false,
  dimmed,
  enableDroppable,
  onAddClick,
  onContextMenu,
}: {
  children?: React.ReactNode;
  isToday?: boolean;
  id?: string;
  isCompact?: boolean;
  density?: ScheduleDensity;
  cellHasConflict?: boolean;
  dimmed?: boolean;
  enableDroppable?: boolean;
  onAddClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const defaultId = React.useId();
  const droppableId = id || defaultId;
  if (!enableDroppable) {
    return (
      <MatrixCellBase
        isToday={isToday}
        isCompact={isCompact}
        density={density}
        cellHasConflict={cellHasConflict}
        dimmed={dimmed}
        isOver={false}
        onAddClick={onAddClick}
        onContextMenu={onContextMenu}
      >
        {children}
      </MatrixCellBase>
    );
  }

  return (
    <MatrixCellDroppable
      droppableId={droppableId}
      isToday={isToday}
      isCompact={isCompact}
      density={density}
      cellHasConflict={cellHasConflict}
      dimmed={dimmed}
      onAddClick={onAddClick}
      onContextMenu={onContextMenu}
    >
      {children}
    </MatrixCellDroppable>
  );
}

function MatrixCellDroppable({
  droppableId,
  children,
  isToday,
  isCompact,
  density,
  cellHasConflict,
  dimmed,
  onAddClick,
  onContextMenu,
}: {
  droppableId: string;
  children?: React.ReactNode;
  isToday?: boolean;
  isCompact?: boolean;
  density?: ScheduleDensity;
  cellHasConflict?: boolean;
  dimmed?: boolean;
  onAddClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <MatrixCellBase
      isToday={isToday}
      isCompact={isCompact}
      density={density}
      cellHasConflict={cellHasConflict}
      dimmed={dimmed}
      isOver={isOver}
      containerRef={setNodeRef}
      onAddClick={onAddClick}
      onContextMenu={onContextMenu}
    >
      {children}
    </MatrixCellBase>
  );
}

function MatrixCellBase({
  children,
  isToday,
  isCompact,
  density,
  cellHasConflict = false,
  dimmed,
  isOver,
  containerRef,
  onAddClick,
  onContextMenu,
}: {
  children?: React.ReactNode;
  isToday?: boolean;
  isCompact?: boolean;
  density?: ScheduleDensity;
  cellHasConflict?: boolean;
  dimmed?: boolean;
  isOver: boolean;
  containerRef?: (node: HTMLDivElement | null) => void;
  onAddClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { isDark: _isDark } = useContext(DashboardContext);
  // Pulse mode empty cell gets a subtle muted background
  const isPulseEmpty = density === "pulse" && !children;
  const heightPaddingClass = cellHeightClass(density, cellHasConflict);

  return (
    <div
      ref={containerRef}
      onContextMenu={onContextMenu}
      style={{ minWidth: "100px" }}
      data-testid="schedule-cell"
      className={`border-border bg-background/40 relative flex flex-1 flex-col gap-1 overflow-hidden border-r border-b transition-colors ${heightPaddingClass} ${isOver ? "z-10 rounded-lg border border-dashed border-orange-500/50 bg-orange-500/20" : isPulseEmpty ? "bg-muted/20" : "group-hover/row:bg-muted/30 hover:bg-muted/50"} ${isToday ? "bg-orange-500/[0.06]" : ""} ${dimmed ? "opacity-30" : ""}`}
    >
      {children ? (
        <>
          {children}
          {/* Add button — always hover-only in compact/pulse, row-hover in normal */}
          {density !== "pulse" && (
            <button
              onClick={onAddClick}
              className={`border-border mt-auto flex w-full shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed bg-transparent text-orange-500/0 transition-colors hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-orange-500/50 ${isCompact ? "hidden h-5 opacity-0 group-hover/row:block group-hover/row:text-orange-500/30 group-hover/row:opacity-60" : "h-7 opacity-0 group-hover/row:text-orange-500/30 group-hover/row:opacity-60"}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      ) : density !== "pulse" ? (
        <button
          onClick={onAddClick}
          className={`border-border absolute inset-x-2 inset-y-2 flex cursor-pointer items-center justify-center rounded-lg border border-dashed bg-transparent text-orange-500/0 opacity-0 transition-colors hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-orange-500/50 hover:opacity-100`}
        >
          <Plus className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
