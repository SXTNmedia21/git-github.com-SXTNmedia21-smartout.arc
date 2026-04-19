import { cn } from "@smartout/ui";
import type { DayShift } from "./types";

const DEPT_BORDER: Record<string, string> = {
  kitchen: "border-l-[color:var(--dept-kitchen)]",
  floor: "border-l-[color:var(--dept-floor)]",
  bar: "border-l-[color:var(--dept-bar)]",
  event: "border-l-[color:var(--dept-event)]",
  storage: "border-l-[color:var(--dept-storage)]",
};

const DEPT_BG: Record<string, string> = {
  kitchen: "bg-[color:var(--dept-kitchen)]",
  floor: "bg-[color:var(--dept-floor)]",
  bar: "bg-[color:var(--dept-bar)]",
  event: "bg-[color:var(--dept-event)]",
  storage: "bg-[color:var(--dept-storage)]",
};

function statusPresentation(shift: DayShift) {
  if (shift.status === "active") {
    return {
      color: "text-[color:var(--success)]",
      dot: "bg-[color:var(--success)]",
      label: shift.breakState === "pause" ? "Pause" : "Aktiv",
    };
  }
  if (shift.status === "completed") {
    return {
      color: "text-muted-foreground",
      dot: "bg-muted-foreground",
      label: "Ferdig",
    };
  }
  return {
    color: "text-[color:var(--info)]",
    dot: "bg-[color:var(--info)]",
    label: "Kommer",
  };
}

export function ShiftCard({
  shift,
  variant = "default",
  onClick,
}: {
  shift: DayShift;
  variant?: "default" | "compact" | "detailed";
  onClick?: () => void;
}) {
  const status = statusPresentation(shift);
  const deptBorder = DEPT_BORDER[shift.deptKey] ?? "border-l-muted-foreground";
  const deptBg = DEPT_BG[shift.deptKey] ?? "bg-muted";

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "bg-card border-border flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-left transition-all",
          onClick && "hover:border-brand-orange/30 cursor-pointer",
          !onClick && "cursor-default",
        )}
      >
        <span className={cn("h-8 w-[3px] rounded-sm", deptBg)} aria-hidden />
        <span className="w-[90px] font-mono text-[13px] font-semibold tabular-nums">
          {shift.start}–{shift.end}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{shift.displayName}</span>
          <span className="text-muted-foreground block text-[11px]">{shift.role}</span>
        </span>
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", status.dot, shift.live && "animate-pulse")}
        />
        <span className={cn("w-[50px] text-right text-[11px] font-semibold", status.color)}>
          {status.label}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "bg-card border-border rounded-[14px] border border-l-[3px] p-4 text-left transition-all",
        deptBorder,
        onClick && "hover:border-brand-orange/30 cursor-pointer",
        !onClick && "cursor-default",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[15px] font-semibold tabular-nums">
          {shift.start} – {shift.end}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "h-[7px] w-[7px] rounded-full",
              status.dot,
              shift.live && "animate-pulse",
            )}
          />
          <span className={cn("text-[10px] font-bold tracking-[0.1em] uppercase", status.color)}>
            {status.label}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span
          className="bg-muted text-foreground grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold"
          aria-hidden
        >
          {shift.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">
            {shift.displayName}
            {shift.isMe ? (
              <span className="text-brand-orange ml-1.5 text-[11px] font-medium">(deg)</span>
            ) : null}
          </div>
          <div className="text-muted-foreground text-[12px]">{shift.role}</div>
        </div>
        {variant === "detailed" ? (
          <div className="text-muted-foreground text-right font-mono text-[11px] tabular-nums">
            <div>
              {shift.actualHours.toFixed(1)}t / {shift.plannedHours.toFixed(1)}t
            </div>
          </div>
        ) : null}
      </div>
    </button>
  );
}
