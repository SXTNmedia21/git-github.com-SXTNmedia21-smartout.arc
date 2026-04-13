"use client";

/**
 * MalShiftCell — A single grid cell in the schedule grid.
 * Renders assigned employees, ghost proposal tags, empty slot placeholders
 * with inline employee picker, and optional task tags for a given
 * (date x config) intersection.
 *
 * Cells in shift-type columns are droppable targets for DnD from the
 * "Ikke tildelt" column. Unassigned cells make their tags draggable.
 */

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { GridCell, GridColumn, MalEmployeeAssignment, MalTask } from "@smartout/schedule";
import { UNASSIGNED_CONFIG_ID } from "@smartout/schedule";
import type { ShiftProposalCreate } from "./schedule-types";
import type { ScheduleEmployee } from "../_hooks/use-employees";
import { MalEmployeeTag } from "./shift-employee-tag";
import { MalGhostTag } from "./shift-ghost-tag";
import { MalTaskTag } from "./shift-task-tag";
import { GridEmployeePicker } from "./grid-employee-picker";

type MalShiftCellProps = {
  cell: GridCell;
  column: GridColumn;
  showTasks: boolean;
  /** Ghost proposals for this cell, filtered by parent */
  ghostProposals?: ShiftProposalCreate[];
  onEmployeeClick?: (assignment: MalEmployeeAssignment) => void;
  onTaskClick?: (task: MalTask) => void;
  /** Called when an employee is picked from the "+ Tilordne" popover */
  onAssignEmployee?: (dateId: string, column: GridColumn, employee: ScheduleEmployee) => void;
  onApproveProposal?: (id: string) => void;
  onRejectProposal?: (id: string) => void;
};

export function MalShiftCell({
  cell,
  column,
  showTasks,
  ghostProposals,
  onEmployeeClick,
  onTaskClick,
  onAssignEmployee,
  onApproveProposal,
  onRejectProposal,
}: MalShiftCellProps) {
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null);

  const isUnassignedColumn = column.configId === UNASSIGNED_CONFIG_ID;
  const isShiftTypeColumn = !isUnassignedColumn;

  // Shift-type cells are droppable targets for DnD from the unassigned column
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${cell.dateId}-${column.configId}`,
    data: { column, dateId: cell.dateId },
    disabled: isUnassignedColumn,
  });

  const ghostCount = ghostProposals?.length ?? 0;
  const adjustedEmptySlots = Math.max(0, cell.emptySlots - ghostCount);

  return (
    <div
      ref={isShiftTypeColumn ? setNodeRef : undefined}
      className={`group border-border hover:bg-muted/50 flex min-h-[44px] cursor-pointer flex-wrap items-start gap-[3px] border-r border-b p-[5px] transition-[background] duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] ${isOver ? "bg-orange-500/10 ring-2 ring-orange-500/30 ring-inset" : ""} ${isUnassignedColumn ? "bg-muted/20 border-dashed" : ""}`}
    >
      {cell.assignments.map((assignment) => (
        <MalEmployeeTag
          key={assignment.shiftId}
          assignment={assignment}
          onClick={() => onEmployeeClick?.(assignment)}
          draggable={isUnassignedColumn}
        />
      ))}

      {/* 2. Ghost proposals — pending approval */}
      {ghostProposals?.map((proposal) => (
        <MalGhostTag
          key={proposal.id}
          proposal={proposal}
          onApprove={onApproveProposal ?? (() => {})}
          onReject={onRejectProposal ?? (() => {})}
        />
      ))}

      {/* 3. Empty slot placeholders — each with its own employee picker */}
      {Array.from({ length: adjustedEmptySlots }).map((_, i) => (
        <GridEmployeePicker
          key={`${cell.dateId}-${cell.configId}-empty-${i}`}
          departmentId={column.departmentId}
          open={openPickerIndex === i}
          onOpenChange={(open) => setOpenPickerIndex(open ? i : null)}
          onSelect={(employee) => {
            onAssignEmployee?.(cell.dateId, column, employee);
            setOpenPickerIndex(null);
          }}
        >
          <button
            type="button"
            className="border-border text-muted-foreground inline-flex cursor-pointer items-center rounded-lg border border-dashed px-2 py-[3px] text-[9px] opacity-30 transition-all duration-[250ms] group-hover:opacity-100 hover:border-orange-500 hover:text-orange-500"
          >
            + Tilordne
          </button>
        </GridEmployeePicker>
      ))}

      {/* 4. Task tags — shown only when the task layer is toggled on */}
      {showTasks &&
        cell.tasks.map((task) => (
          <MalTaskTag key={task.taskId} task={task} onClick={() => onTaskClick?.(task)} />
        ))}
    </div>
  );
}
