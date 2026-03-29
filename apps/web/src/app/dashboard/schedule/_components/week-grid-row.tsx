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
  onAssignClick?: (dateId: string, configId: string) => void;
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
  onAssignClick,
  proposalsByCell,
  onApproveProposal,
  onRejectProposal,
}: MalGridRowProps) {
  return (
    // display: contents lets each child cell sit directly in the parent CSS Grid
    <div style={{ display: "contents" }}>
      {/* Day label — sticky first column, highlights weekends in orange */}
      <div
        className={`border-border bg-card sticky left-0 z-[5] flex items-center gap-1.5 border-r border-b px-3 py-0 text-xs font-bold ${day.isWeekend ? "text-orange-500" : ""}`}
      >
        {/* Short label (e.g. "MAN", "LOR") — fixed width for alignment */}
        <span
          className={`w-[26px] text-[10px] font-bold tracking-[1px] ${day.isWeekend ? "text-orange-500 opacity-60" : "text-muted-foreground"}`}
        >
          {day.shortLabel}
        </span>

        {/* Full date label */}
        {day.label}
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
            showTasks={showTasks}
            onEmployeeClick={onEmployeeClick}
            onTaskClick={onTaskClick}
            onAssignClick={onAssignClick}
            ghostProposals={proposalsByCell?.get(gridCellKey(day.dateId, col.configId))}
            onApproveProposal={onApproveProposal}
            onRejectProposal={onRejectProposal}
          />
        );
      })}
    </div>
  );
}
