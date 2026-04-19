import { Camera, Check, Shield } from "lucide-react";
import { cn } from "@smartout/ui";
import type { DayTask } from "./types";

export function TaskRow({ task, onToggle }: { task: DayTask; onToggle?: () => void }) {
  const { done, active, overdue } = task;
  return (
    <div
      className={cn(
        "border-border flex items-center gap-3 border-b py-2.5",
        overdue && "border-l-2 border-l-[color:var(--destructive)] pl-2",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        aria-label={
          done ? `Marker ${task.title} som ikke-gjort` : `Marker ${task.title} som ferdig`
        }
        aria-pressed={done}
        className={cn(
          "grid h-5.5 w-5.5 shrink-0 place-items-center rounded-md border-[1.75px] transition-all",
          done
            ? "border-[color:var(--success)] bg-[color:var(--success)]"
            : active
              ? "border-brand-orange ring-brand-orange/15 ring-[3px]"
              : "border-border",
          !onToggle && "cursor-default",
          onToggle && "cursor-pointer",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[13px] font-medium",
            done ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {task.title}
        </div>
        {task.note ? (
          <div className="text-muted-foreground mt-0.5 text-[11px]">{task.note}</div>
        ) : null}
      </div>
      {task.compliance ? (
        <Shield
          className={cn(
            "h-[13px] w-[13px]",
            done ? "text-muted-foreground" : "text-[color:var(--warning)]",
          )}
          aria-label="Compliance"
        />
      ) : null}
      {task.evidence ? (
        <span className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]">
          <Camera className="h-3 w-3" aria-hidden />
          {task.evidence}
        </span>
      ) : null}
      <span className="text-muted-foreground min-w-[60px] text-right text-[11px]">
        {task.owner}
      </span>
    </div>
  );
}
