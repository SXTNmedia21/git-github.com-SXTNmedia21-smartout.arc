"use client";

/**
 * MalShiftCell — A single grid cell in the schedule grid.
 * Renders assigned employees, ghost proposal tags, empty slot placeholders
 * with inline employee picker, and optional task tags for a given
 * (date x config) intersection.
 */

import { useState } from "react";
import type { GridCell, GridColumn, MalEmployeeAssignment, MalTask } from "@smartout/schedule";
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
  // Track which empty slot (by index) has its picker open
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null);

  // Adjust empty slots: subtract ghost proposals that will become real shifts
  const ghostCount = ghostProposals?.length ?? 0;
  const adjustedEmptySlots = Math.max(0, cell.emptySlots - ghostCount);

  return (
    <div className="group border-border hover:bg-muted/50 flex min-h-[44px] cursor-pointer flex-wrap items-start gap-[3px] border-r border-b p-[5px] transition-[background] duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]">
      {/* 1. Assigned employees — real shifts */}
      {cell.assignments.map((assignment) => (
        <MalEmployeeTag
          key={assignment.shiftId}
          assignment={assignment}
          onClick={() => onEmployeeClick?.(assignment)}
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
