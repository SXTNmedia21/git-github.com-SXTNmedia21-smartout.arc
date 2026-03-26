"use client";

/**
 * MalShiftCell — A single grid cell in the Mal-modus schedule grid.
 * Renders assigned employees, ghost proposal tags, empty slot placeholders,
 * and optional task tags for a given (date x template shift) intersection.
 */

import type { MalCell, MalEmployeeAssignment, MalTask } from "@smartout/schedule";
import type { ShiftProposalCreate } from "./schedule-types";
import { MalEmployeeTag } from "./mal-employee-tag";
import { MalGhostTag } from "./mal-ghost-tag";
import { MalTaskTag } from "./mal-task-tag";

type MalShiftCellProps = {
  cell: MalCell;
  showTasks: boolean;
  /** Ghost proposals for this cell, filtered by parent */
  ghostProposals?: ShiftProposalCreate[];
  onEmployeeClick?: (assignment: MalEmployeeAssignment) => void;
  onTaskClick?: (task: MalTask) => void;
  onAssignClick?: (dateId: string, templateShiftId: string) => void;
  onApproveProposal?: (id: string) => void;
  onRejectProposal?: (id: string) => void;
};

export function MalShiftCell({
  cell,
  showTasks,
  ghostProposals,
  onEmployeeClick,
  onTaskClick,
  onAssignClick,
  onApproveProposal,
  onRejectProposal,
}: MalShiftCellProps) {
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

      {/* 3. Empty slot placeholders — adjusted for ghost proposals */}
      {Array.from({ length: adjustedEmptySlots }).map((_, i) => (
        <button
          key={`${cell.dateId}-${cell.templateShiftId}-empty-${i}`}
          type="button"
          onClick={() => onAssignClick?.(cell.dateId, cell.templateShiftId)}
          className="border-border text-muted-foreground inline-flex cursor-pointer items-center rounded-lg border border-dashed px-2 py-[3px] text-[9px] opacity-30 transition-all duration-[250ms] group-hover:opacity-100 hover:border-orange-500 hover:text-orange-500"
        >
          + Tilordne
        </button>
      ))}

      {/* 4. Task tags — shown only when the task layer is toggled on */}
      {showTasks &&
        cell.tasks.map((task) => (
          <MalTaskTag key={task.taskId} task={task} onClick={() => onTaskClick?.(task)} />
        ))}
    </div>
  );
}
