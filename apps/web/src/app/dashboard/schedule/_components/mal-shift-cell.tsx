"use client";

/**
 * MalShiftCell — A single grid cell in the Mal-modus schedule grid.
 * Renders assigned employees, empty slot placeholders, and optional task tags
 * for a given (date × template shift) intersection.
 */

import type { MalCell, MalEmployeeAssignment, MalTask } from "@smartout/schedule";
import { MalEmployeeTag } from "./mal-employee-tag";
import { MalTaskTag } from "./mal-task-tag";

type MalShiftCellProps = {
  cell: MalCell;
  showTasks: boolean;
  onEmployeeClick?: (assignment: MalEmployeeAssignment) => void;
  onTaskClick?: (task: MalTask) => void;
  onAssignClick?: (dateId: string, templateShiftId: string) => void;
};

export function MalShiftCell({
  cell,
  showTasks,
  onEmployeeClick,
  onTaskClick,
  onAssignClick,
}: MalShiftCellProps) {
  return (
    <div className="group border-border hover:bg-muted/50 flex min-h-[44px] cursor-pointer flex-wrap items-start gap-[3px] border-r border-b p-[5px] transition-[background] duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]">
      {/* Assigned employees — rendered first for visual priority */}
      {cell.assignments.map((assignment) => (
        <MalEmployeeTag
          key={assignment.shiftId}
          assignment={assignment}
          onClick={() => onEmployeeClick?.(assignment)}
        />
      ))}

      {/* Empty slot placeholders — dashed tags that invite assignment */}
      {Array.from({ length: cell.emptySlots }).map((_, i) => (
        <button
          // Using date+shift+index as key since empty slots have no identity
          key={`${cell.dateId}-${cell.templateShiftId}-empty-${i}`}
          type="button"
          onClick={() => onAssignClick?.(cell.dateId, cell.templateShiftId)}
          className="border-border text-muted-foreground inline-flex cursor-pointer items-center rounded-lg border border-dashed px-2 py-[3px] text-[9px] opacity-30 transition-all duration-[250ms] group-hover:opacity-100 hover:border-orange-500 hover:text-orange-500"
        >
          + Tilordne
        </button>
      ))}

      {/* Task tags — shown only when the task layer is toggled on */}
      {showTasks &&
        cell.tasks.map((task) => (
          <MalTaskTag key={task.taskId} task={task} onClick={() => onTaskClick?.(task)} />
        ))}
    </div>
  );
}
