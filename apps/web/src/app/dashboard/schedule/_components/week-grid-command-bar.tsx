"use client";

// Mal-specific command bar — department selector, view toggle (Vakter/Oppgaver), and week navigation.
// Used in the "mal modus" (template mode) schedule view, separate from the live planner bar.

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { LocationPopover } from "./planner-command-bar";

type MalCommandBarProps = {
  isDark: boolean;
  departmentName: string;
  departmentOptions: string[];
  onDepartmentChange: (name: string) => void;
  showTasks: boolean;
  onShowTasksChange: (show: boolean) => void;
  weekLabel: string; // e.g. "Uke 14"
  onPrevWeek: () => void;
  onNextWeek: () => void;
};

export function MalCommandBar({
  isDark,
  departmentName,
  departmentOptions,
  onDepartmentChange,
  showTasks,
  onShowTasksChange,
  weekLabel,
  onPrevWeek,
  onNextWeek,
}: MalCommandBarProps) {
  return (
    <div className="border-border bg-card/85 relative z-[2] flex min-h-[34px] items-center justify-between border-b px-4 py-[5px] backdrop-blur-[12px]">
      {/* Left side: title, department selector, view toggle */}
      <div className="flex items-center gap-2">
        {/* Title */}
        <h1 className="flex items-center gap-1.5 text-xs font-extrabold tracking-tight">
          <CalendarDays className="h-4 w-4 text-orange-500" />
          Vaktplan
        </h1>

        <div className="bg-border h-3.5 w-px" />

        {/* Department selector — reuses LocationPopover from the live planner bar */}
        <LocationPopover
          isDark={isDark}
          value={departmentName}
          onChange={onDepartmentChange}
          options={departmentOptions}
        />

        <div className="bg-border h-3.5 w-px" />

        <span className="text-muted-foreground text-[11px] font-bold">Vakter</span>

        {/* View toggle: Vakter | Oppgaver */}
        <div className="border-border bg-muted flex rounded-lg border p-[2px]">
          <button
            onClick={() => onShowTasksChange(false)}
            className={`cursor-pointer rounded-md border-none px-2.5 py-[3px] text-[10px] font-bold transition-all ${
              !showTasks ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Vakter
          </button>
          <button
            onClick={() => onShowTasksChange(true)}
            className={`cursor-pointer rounded-md border-none px-2.5 py-[3px] text-[10px] font-bold transition-all ${
              showTasks ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Oppgaver
          </button>
        </div>
      </div>

      {/* Right side: week navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevWeek}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center rounded-md p-1 transition-colors"
          aria-label="Forrige uke"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <span className="font-mono text-xs font-bold">{weekLabel}</span>

        <button
          onClick={onNextWeek}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center rounded-md p-1 transition-colors"
          aria-label="Neste uke"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
