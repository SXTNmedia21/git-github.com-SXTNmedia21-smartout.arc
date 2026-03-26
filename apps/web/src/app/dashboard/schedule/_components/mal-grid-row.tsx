"use client";

/**
 * MalGridRow — A single day row in the Mal-modus schedule grid.
 * Renders the day label cell followed by one MalShiftCell per column.
 *
 * Uses `display: contents` so all child cells participate directly in the
 * parent CSS Grid — this component adds no wrapper element of its own.
 */

import { cellKey } from "@smartout/schedule";
import type { MalCell, MalColumn, MalEmployeeAssignment, MalTask } from "@smartout/schedule";
import { MalShiftCell } from "./mal-shift-cell";
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
  columns: MalColumn[];
  cells: Map<string, MalCell>;
  showTasks: boolean;
  onEmployeeClick?: (assignment: MalEmployeeAssignment) => void;
  onTaskClick?: (task: MalTask) => void;
  onAssignClick?: (dateId: string, templateShiftId: string) => void;
  proposalsByCell?: Map<string, ShiftProposalCreate[]>;
  onApproveProposal?: (id: string) => Promise<void>;
  onRejectProposal?: (id: string) => void;
};

/** Fallback cell when a template shift has no data for a given day. */
function emptyCell(dateId: string, templateShiftId: string, dayIndex: number): MalCell {
  return {
    dayIndex,
    dateId,
    templateShiftId,
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
        {/* Short label (e.g. "MAN", "LØR") — fixed width for alignment */}
        <span
          className={`w-[26px] text-[10px] font-bold tracking-[1px] ${day.isWeekend ? "text-orange-500 opacity-60" : "text-muted-foreground"}`}
        >
          {day.shortLabel}
        </span>

        {/* Full date label */}
        {day.label}
      </div>

      {/* One cell per template shift column */}
      {columns.map((col) => {
        const cell =
          cells.get(cellKey(day.dateId, col.templateShiftId)) ??
          emptyCell(day.dateId, col.templateShiftId, day.index);

        return (
          <MalShiftCell
            key={col.templateShiftId}
            cell={cell}
            showTasks={showTasks}
            onEmployeeClick={onEmployeeClick}
            onTaskClick={onTaskClick}
            onAssignClick={onAssignClick}
            ghostProposals={proposalsByCell?.get(`${day.dateId}::${cell.templateShiftId}`)}
            onApproveProposal={onApproveProposal}
            onRejectProposal={onRejectProposal}
          />
        );
      })}
    </div>
  );
}
