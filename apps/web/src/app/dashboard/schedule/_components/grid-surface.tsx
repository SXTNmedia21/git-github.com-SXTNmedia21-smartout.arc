"use client";

import type { ReactNode } from "react";

type GridSurfaceProps = {
  isDark: boolean;
  leftSidebar: ReactNode;
  centerContent: ReactNode;
  dayInspector: ReactNode;
};

export function GridSurface({
  isDark,
  leftSidebar,
  centerContent,
  dayInspector,
}: GridSurfaceProps) {
  return (
    <div
      className={`relative z-10 flex w-full flex-1 overflow-hidden ${isDark ? "bg-[#030303]/50" : "bg-zinc-100/50"} print:block print:h-auto print:overflow-visible print:bg-white`}
    >
      {leftSidebar}
      <main className="relative flex flex-1 shrink-0 overflow-auto print:block print:h-auto print:overflow-visible">
        {centerContent}
      </main>
      {dayInspector}
    </div>
  );
}
