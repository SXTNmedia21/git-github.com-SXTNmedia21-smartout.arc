// ============================================
// day-control/TimelineView.tsx
// Gantt-style timeline bar chart for shift visualization.
// Shows 06:00–23:00 with colored bars per employee shift.
// ============================================
"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

const TIMELINE_START = 6;
const TIMELINE_END = 23;
const TIMELINE_HOURS = TIMELINE_END - TIMELINE_START;

export type TimelineEntry = {
  shiftId: string;
  name: string;
  initials: string;
  avatarColor: string;
  role: string;
  startHour: number;
  endHour: number;
  time: string;
  status: string;
};

export function TimelineView({
  entries,
  onShiftClick,
}: {
  entries: TimelineEntry[];
  onShiftClick: (id: string) => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const hours = Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => TIMELINE_START + i);

  // Current time marker
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const showNowLine = currentHour >= TIMELINE_START && currentHour <= TIMELINE_END;
  const nowPct = ((currentHour - TIMELINE_START) / TIMELINE_HOURS) * 100;

  return (
    <div
      className={`overflow-x-auto rounded-xl border ${isDark ? "border-border bg-muted/20" : "border-border bg-muted/40"} p-3`}
    >
      {/* Hour labels */}
      <div className="mb-2 flex">
        <div className="w-20 shrink-0" />
        <div className="relative flex-1">
          <div className="flex justify-between">
            {hours.map((h) => (
              <span key={h} className="text-muted-foreground w-0 text-center text-[9px] font-bold">
                {String(h).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Grid lines + bars */}
      {entries.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">Ingen vakter</p>
      ) : (
        entries.map((entry) => {
          const startPct = Math.max(0, ((entry.startHour - TIMELINE_START) / TIMELINE_HOURS) * 100);
          const endHour = entry.endHour <= entry.startHour ? entry.endHour + 24 : entry.endHour;
          const endPct = Math.min(100, ((endHour - TIMELINE_START) / TIMELINE_HOURS) * 100);
          const widthPct = endPct - startPct;

          return (
            <div key={entry.shiftId} className="group/timeline mb-1.5 flex items-center">
              {/* Avatar + name */}
              <div className="flex w-20 shrink-0 items-center gap-1.5 pr-2">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[7px] font-black ${entry.avatarColor}`}
                >
                  {entry.initials}
                </div>
                <span className="text-foreground/80 truncate text-[10px] font-bold">
                  {entry.name.split(" ")[0]}
                </span>
              </div>

              {/* Bar container */}
              <div
                className={`relative h-7 flex-1 rounded-md ${isDark ? "bg-muted/40" : "bg-muted"}`}
              >
                {/* Grid lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="bg-border/30 absolute top-0 h-full w-px"
                    style={{ left: `${((h - TIMELINE_START) / TIMELINE_HOURS) * 100}%` }}
                  />
                ))}

                {/* Now marker */}
                {showNowLine && (
                  <div
                    className="absolute top-0 z-10 h-full w-0.5 bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)]"
                    style={{ left: `${nowPct}%` }}
                  />
                )}

                {/* Shift bar */}
                <button
                  onClick={() => onShiftClick(entry.shiftId)}
                  className="absolute top-1 h-5 cursor-pointer rounded-md bg-orange-500/70 shadow-sm transition-all group-hover/timeline:bg-orange-500/90 hover:bg-orange-500"
                  style={{
                    left: `${startPct}%`,
                    width: `${Math.max(widthPct, 2)}%`,
                  }}
                  title={`${entry.name} — ${entry.time} — ${entry.role}`}
                >
                  <span className="truncate px-1.5 text-[8px] font-bold text-white drop-shadow-sm">
                    {entry.time}
                  </span>
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
