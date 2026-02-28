"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { DragOverlay, useDndMonitor } from "@dnd-kit/core";
import type { DragPreviewData } from "./schedule-data";

export function ScheduleDragOverlay({ isDark }: { isDark: boolean }) {
  const [activeDragItem, setActiveDragItem] = useState<DragPreviewData | null>(null);

  useDndMonitor({
    onDragStart(event) {
      setActiveDragItem((event.active.data.current as DragPreviewData | undefined) ?? null);
    },
    onDragCancel() {
      setActiveDragItem(null);
    },
    onDragEnd() {
      setActiveDragItem(null);
    },
  });

  return (
    <DragOverlay zIndex={1000} dropAnimation={null}>
      {activeDragItem ? (
        <div
          className={`p-2 md:p-3 ${isDark ? "bg-[#0a0a0c]" : "bg-white"} flex w-48 scale-105 rotate-2 cursor-grabbing flex-col gap-1 rounded-xl border border-orange-500/50 opacity-90 shadow-[0_0_30px_rgba(249,115,22,0.3)]`}
        >
          <h4
            className={`text-[12px] font-bold ${isDark ? "text-white" : "text-zinc-900"} leading-tight`}
          >
            {String(activeDragItem.title || activeDragItem.role || "Vakt")}
          </h4>
          <div className="text-[10px] font-medium text-orange-400">
            <Clock className="mr-1 inline h-3 w-3" />
            {String(activeDragItem.time || "Tid")}
          </div>
        </div>
      ) : null}
    </DragOverlay>
  );
}
