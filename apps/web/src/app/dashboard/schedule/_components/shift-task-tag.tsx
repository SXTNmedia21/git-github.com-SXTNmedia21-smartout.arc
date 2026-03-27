"use client";

/**
 * MalTaskTag — Compact task indicator tag for the Mal-modus grid.
 * Shows completion state via color and icon: green for done, orange for pending/in-progress.
 */

import { CheckCircle, Clock } from "lucide-react";
import type { MalTask } from "@smartout/schedule";

type MalTaskTagProps = {
  task: MalTask;
  onClick?: () => void;
};

export function MalTaskTag({ task, onClick }: MalTaskTagProps) {
  const isDone = task.status === "completed";

  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:text-foreground group inline-flex cursor-pointer items-center gap-[3px] rounded-md px-[7px] py-[2px] transition-all duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:border-[oklch(0.8_0.01_55)]"
      style={
        isDone
          ? {
              border: "1px solid oklch(0.72 0.17 160 / 0.2)",
              backgroundColor: "oklch(0.72 0.17 160 / 0.04)",
              color: "#22c55e",
            }
          : {
              border: "1px solid oklch(0.65 0.22 40 / 0.2)",
              backgroundColor: "oklch(0.65 0.22 40 / 0.04)",
              color: "#f97316",
            }
      }
    >
      {/* Status icon — CheckCircle for done, Clock for pending/in-progress */}
      {isDone ? (
        <CheckCircle className="h-[10px] w-[10px] shrink-0" />
      ) : (
        <Clock className="h-[10px] w-[10px] shrink-0" />
      )}

      {/* Task title — no wrapping, intentionally compact */}
      <span className="text-[9px] font-bold whitespace-nowrap">{task.title}</span>
    </button>
  );
}
