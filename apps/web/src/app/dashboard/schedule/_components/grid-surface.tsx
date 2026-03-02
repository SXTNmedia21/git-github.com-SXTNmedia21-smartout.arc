"use client";

import type { ReactNode } from "react";

type GridSurfaceProps = {
  isDark: boolean;
  centerContent: ReactNode;
  dayInspector: ReactNode;
  weekSpan: 1 | 2;
  setWeekSpan: (v: 1 | 2) => void;
};

/**
 * Grid surface container for the schedule grid content and day inspector.
 * The day inspector is now a fixed-position bottom sheet, rendered as a portal-like
 * overlay rather than an inline sibling.
 */
export function GridSurface({
  isDark,
  centerContent,
  dayInspector,
  weekSpan,
  setWeekSpan,
}: GridSurfaceProps) {
  return (
    <div
      className={`relative z-10 flex w-full flex-1 flex-col overflow-hidden ${isDark ? "bg-[#020202]/60" : "bg-zinc-100/50"} print:block print:h-auto print:overflow-visible print:bg-white`}
    >
      <div className="relative flex flex-1 overflow-hidden print:block print:h-auto print:overflow-visible">
        <main className="relative flex-1 overflow-x-auto overflow-y-auto print:block print:h-auto print:overflow-visible">
          {centerContent}
        </main>
        {dayInspector}
      </div>

      {/* Week span toggle footer */}
      <div
        className={`flex shrink-0 items-center justify-center gap-2 border-t px-4 py-2.5 ${
          isDark ? "border-white/[0.04] bg-[#0a0a0c]/80" : "border-zinc-200 bg-white/80"
        } backdrop-blur-md print:hidden`}
      >
        <div
          className={`flex rounded-lg border p-0.5 ${
            isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-100"
          }`}
        >
          <button
            onClick={() => setWeekSpan(1)}
            className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
              weekSpan === 1
                ? isDark
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            1 uke
          </button>
          <button
            onClick={() => setWeekSpan(2)}
            className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
              weekSpan === 2
                ? isDark
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            2 uker
          </button>
        </div>
      </div>
    </div>
  );
}
