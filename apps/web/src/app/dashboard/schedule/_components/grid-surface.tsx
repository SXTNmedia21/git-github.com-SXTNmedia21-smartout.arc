"use client";

import type { ReactNode } from "react";

type GridSurfaceProps = {
  centerContent: ReactNode;
};

/**
 * Grid surface container for the schedule grid content.
 * DayControlSheet renders at page level to avoid stacking context issues.
 */
export function GridSurface({ centerContent }: GridSurfaceProps) {
  return (
    <div className="bg-background/60 relative flex w-full flex-1 flex-col overflow-hidden print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="relative flex flex-1 overflow-hidden print:block print:h-auto print:overflow-visible">
        <main className="relative flex-1 overflow-x-auto overflow-y-auto print:block print:h-auto print:overflow-visible">
          {centerContent}
        </main>
      </div>
    </div>
  );
}
