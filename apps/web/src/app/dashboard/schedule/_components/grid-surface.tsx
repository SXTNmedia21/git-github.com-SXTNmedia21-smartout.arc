"use client";

import type { ReactNode } from "react";

type GridSurfaceProps = {
  isDark: boolean;
  centerContent: ReactNode;
  dayInspector: ReactNode;
};

/**
 * Grid surface container for the schedule grid content and day inspector.
 * The sidebar is rendered separately at a higher level so it can span
 * the full height of the schedule container (alongside command bar and status strip).
 */
export function GridSurface({ isDark, centerContent, dayInspector }: GridSurfaceProps) {
  return (
    <div
      className={`relative z-10 flex w-full flex-1 overflow-hidden ${isDark ? "bg-[#020202]/60" : "bg-zinc-100/50"} print:block print:h-auto print:overflow-visible print:bg-white`}
    >
      <main className="relative flex flex-1 shrink-0 overflow-auto print:block print:h-auto print:overflow-visible">
        {centerContent}
      </main>
      {dayInspector}
    </div>
  );
}
