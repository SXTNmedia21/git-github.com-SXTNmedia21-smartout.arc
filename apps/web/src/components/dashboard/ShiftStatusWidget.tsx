"use client";

/**
 * ShiftStatusWidget — Compact live shift status card for the tactical dashboard.
 * Shows how many employees are clocked in, on break, waiting, or late.
 * Links to the full shift clock view.
 */

import Link from "next/link";
import { Clock, Coffee, AlertTriangle, ChevronRight } from "lucide-react";
import { useLiveShifts, type LiveShiftEntry } from "@/app/dashboard/_hooks/use-live-shifts";

const STATUS_CONFIG = {
  clocked_in: { color: "bg-emerald-500", label: "På vakt" },
  on_break: { color: "bg-blue-400", label: "Pause" },
  waiting: { color: "bg-muted-foreground/40", label: "Venter" },
  late: { color: "bg-orange-400", label: "Forsinket" },
} as const;

export function ShiftStatusWidget() {
  const { data, isLoading } = useLiveShifts();

  if (isLoading) {
    return (
      <div className="border-border bg-background animate-pulse rounded-2xl border p-5">
        <div className="bg-muted h-5 w-32 rounded" />
        <div className="bg-muted mt-3 h-4 w-48 rounded" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-8 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.entries.length === 0) return null;

  const total = data.clockedIn + data.onBreak + data.waiting + data.late;
  const displayEntries = data.entries.slice(0, 8);

  return (
    <div className="border-border bg-background rounded-2xl border p-5 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Clock className="text-foreground h-4 w-4" />
            <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <h3 className="text-foreground text-sm font-bold">Aktive vakter</h3>
        </div>
        <Link
          href="/dashboard/shift-clock"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium transition-colors"
        >
          Se alle <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Summary line */}
      <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
        {data.clockedIn > 0 && (
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {data.clockedIn} på vakt
          </span>
        )}
        {data.onBreak > 0 && (
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            {data.onBreak} på pause
          </span>
        )}
        {data.waiting > 0 && (
          <span className="flex items-center gap-1">
            <div className="bg-muted-foreground/40 h-1.5 w-1.5 rounded-full" />
            {data.waiting} venter
          </span>
        )}
        {data.late > 0 && (
          <span className="flex items-center gap-1 text-orange-500">
            <AlertTriangle className="h-3 w-3" />
            {data.late} forsinket
          </span>
        )}
      </div>

      {/* Entry list */}
      <div className="space-y-1">
        {displayEntries.map((entry) => (
          <ShiftEntryRow key={entry.shiftId} entry={entry} />
        ))}
      </div>

      {total > 8 && (
        <p className="text-muted-foreground mt-2 text-center text-[11px]">
          +{total - 8} flere vakter
        </p>
      )}
    </div>
  );
}

function ShiftEntryRow({ entry }: { entry: LiveShiftEntry }) {
  const cfg = STATUS_CONFIG[entry.status];

  return (
    <div className="hover:bg-muted/50 flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors">
      {/* Status indicator */}
      <div className={`h-2 w-2 shrink-0 rounded-full ${cfg.color}`} />

      {/* Avatar */}
      <div className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold">
        {entry.initials}
      </div>

      {/* Name + role */}
      <div className="min-w-0 flex-1">
        <span className="text-foreground truncate text-xs font-semibold">{entry.employeeName}</span>
        {entry.role && (
          <span className="text-muted-foreground ml-1.5 text-[10px]">{entry.role}</span>
        )}
      </div>

      {/* Duration or time info */}
      <span className="text-muted-foreground shrink-0 text-[11px] font-medium">
        {entry.status === "clocked_in" || entry.status === "on_break" ? (
          <span className="flex items-center gap-1">
            {entry.status === "on_break" && <Coffee className="h-3 w-3 text-blue-400" />}
            {entry.duration}
          </span>
        ) : entry.status === "late" ? (
          <span className="text-orange-500">+{entry.minutesLate}m</span>
        ) : (
          <span>{entry.startTime}</span>
        )}
      </span>
    </div>
  );
}
