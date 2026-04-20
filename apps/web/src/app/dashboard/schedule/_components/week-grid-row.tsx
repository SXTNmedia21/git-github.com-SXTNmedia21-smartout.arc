"use client";

/**
 * MalGridRow — A single day row in the schedule grid.
 * Renders the day label cell followed by one MalShiftCell per column.
 *
 * Uses `display: contents` so all child cells participate directly in the
 * parent CSS Grid — this component adds no wrapper element of its own.
 */

import { gridCellKey } from "@smartout/schedule";
import type { GridCell, GridColumn, MalEmployeeAssignment, MalTask } from "@smartout/schedule";
import { MalShiftCell } from "./week-grid-cell";
import type { ShiftProposalCreate } from "./schedule-types";
import type { ScheduleEmployee } from "../_hooks/use-employees";

type DayInfo = {
  index: number;
  dateId: string;
  label: string;
  shortLabel: string;
  isWeekend: boolean;
};

type MalGridRowProps = {
  day: DayInfo;
  columns: GridColumn[];
  cells: Map<string, GridCell>;
  showTasks: boolean;
  onEmployeeClick?: (assignment: MalEmployeeAssignment) => void;
  onTaskClick?: (task: MalTask) => void;
  /** Called when an employee is picked from a cell's picker */
  onAssignEmployee?: (dateId: string, column: GridColumn, employee: ScheduleEmployee) => void;
  proposalsByCell?: Map<string, ShiftProposalCreate[]>;
  onApproveProposal?: (id: string) => Promise<void>;
  onRejectProposal?: (id: string) => void;
};

/** Fallback cell when a config column has no data for a given day. */
function emptyCell(dateId: string, configId: string, dayIndex: number): GridCell {
  return {
    dayIndex,
    dateId,
    configId,
    assignments: [],
    tasks: [],
    emptySlots: 0,
  };
}

export function MalGridRow({
  day,
  columns,
  cells,
  showTasks,
  onEmployeeClick,
  onTaskClick,
  onAssignEmployee,
  proposalsByCell,
  onApproveProposal,
  onRejectProposal,
}: MalGridRowProps) {
  return (
    // display: contents lets each child cell sit directly in the parent CSS Grid
    <div style={{ display: "contents" }}>
      {/* Day label — sticky first column, day name large + date small */}
      <div
        className={`border-border bg-card sticky left-0 z-[5] flex flex-col justify-center border-r border-b px-3 py-1.5 ${day.isWeekend ? "text-orange-500" : ""}`}
      >
        <span className="text-[13px] leading-tight font-bold">{day.label}</span>
        <span
          className={`text-[10px] leading-tight ${day.isWeekend ? "text-orange-500/60" : "text-muted-foreground"}`}
        >
          {day.shortLabel}
        </span>
      </div>

      {/* One cell per shift type config column */}
      {columns.map((col) => {
        const cell =
          cells.get(gridCellKey(day.dateId, col.configId)) ??
          emptyCell(day.dateId, col.configId, day.index);

        return (
          <MalShiftCell
            key={col.configId}
            cell={cell}
            column={col}
            showTasks={showTasks}
            onEmployeeClick={onEmployeeClick}
            onTaskClick={onTaskClick}
            onAssignEmployee={onAssignEmployee}
            ghostProposals={proposalsByCell?.get(gridCellKey(day.dateId, col.configId))}
            onApproveProposal={onApproveProposal}
            onRejectProposal={onRejectProposal}
          />
        );
      })}
    </div>
  );
}
