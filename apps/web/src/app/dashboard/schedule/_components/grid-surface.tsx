"use client";

import type { ReactNode } from "react";

type GridSurfaceProps = {
  centerContent: ReactNode;
  dayInspector: ReactNode;
};

/**
 * Grid surface container for the schedule grid content and day inspector.
 * Week span toggle has been moved to the header area (page.tsx).
 */
export function GridSurface({ centerContent, dayInspector }: GridSurfaceProps) {
  return (
    <div className="bg-background/60 relative z-10 flex w-full flex-1 flex-col overflow-hidden print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="relative flex flex-1 overflow-hidden print:block print:h-auto print:overflow-visible">
        <main className="relative flex-1 overflow-x-auto overflow-y-auto print:block print:h-auto print:overflow-visible">
          {centerContent}
        </main>
        {dayInspector}
      </div>
    </div>
  );
}
