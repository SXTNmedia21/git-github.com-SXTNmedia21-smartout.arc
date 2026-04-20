"use client";

import { useState } from "react";
import { Check, ChevronDown, Clock } from "lucide-react";
import { cn } from "../lib/utils";
import type { DayHook, DayTask } from "./types";
import { TaskRow } from "./TaskRow";

const TYPE_LABEL: Record<DayHook["type"], string> = {
  pre_open: "Pre-open",
  open: "Åpning",
  scheduled: "Rutine",
  pre_close: "Pre-close",
  close: "Stenging",
};

export function HookTile({
  hook,
  defaultOpen = true,
  onTaskToggle,
}: {
  hook: DayHook;
  defaultOpen?: boolean;
  onTaskToggle?: (task: DayTask) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const done = hook.state === "completed";
  const inProgress = hook.state === "in_progress";
  const panelId = `hook-${hook.id}-panel`;

  return (
    <div className="bg-card border-border overflow-hidden rounded-[14px] border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 bg-transparent p-4 text-left"
      >
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full",
            done
              ? "bg-[color:color-mix(in_oklch,var(--success)_14%,transparent)]"
              : inProgress
                ? "bg-[color:color-mix(in_oklch,var(--brand-orange)_16%,transparent)]"
                : "bg-muted",
          )}
          aria-hidden
        >
          {done ? (
            <Check className="h-3.5 w-3.5 text-[color:var(--success)]" strokeWidth={2.5} />
          ) : (
            <Clock
              className={cn(
                "h-3.5 w-3.5",
                inProgress ? "text-brand-orange" : "text-muted-foreground",
              )}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[13px] font-semibold">{hook.time}</span>
            <span className="text-[14px] font-semibold">{hook.title}</span>
            <span className="text-muted-foreground bg-muted rounded px-1.5 py-[2px] text-[9px] font-bold tracking-[0.14em] uppercase">
              {TYPE_LABEL[hook.type]}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "font-mono text-[12px] font-semibold",
            done
              ? "text-[color:var(--success)]"
              : inProgress
                ? "text-brand-orange"
                : "text-muted-foreground",
          )}
        >
          {hook.progress}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground h-4 w-4 transition-transform duration-200",
            !open && "-rotate-90",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} className="px-4 pb-3 pl-[60px]">
          {hook.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={onTaskToggle ? () => onTaskToggle(task) : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
