"use client";

import { useEffect, useState } from "react";
import { Clock, Copy } from "lucide-react";
import { DragOverlay, useDndMonitor } from "@dnd-kit/core";
import type { DragPreviewData } from "./schedule-data";

export function ScheduleDragOverlay({ isDark }: { isDark: boolean }) {
  const [activeDragItem, setActiveDragItem] = useState<DragPreviewData | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);

  useDndMonitor({
    onDragStart(event) {
      setActiveDragItem((event.active.data.current as DragPreviewData | undefined) ?? null);
      const nativeEvent = event.activatorEvent as MouseEvent | TouchEvent | KeyboardEvent;
      const ctrlHeld = "ctrlKey" in nativeEvent && (nativeEvent.ctrlKey || nativeEvent.metaKey);
      setIsCopyMode(ctrlHeld);
    },
    onDragCancel() {
      setActiveDragItem(null);
      setIsCopyMode(false);
    },
    onDragEnd() {
      setActiveDragItem(null);
      setIsCopyMode(false);
    },
  });

  // Track Ctrl/Meta during drag for live visual feedback
  useEffect(() => {
    if (!activeDragItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") setIsCopyMode(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") setIsCopyMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [activeDragItem]);

  const isShift = activeDragItem?.type === "shift";

  return (
    <DragOverlay zIndex={1000} dropAnimation={null}>
      {activeDragItem ? (
        <div
          className={`p-2 md:p-3 ${isDark ? "bg-[#0a0a0c]" : "bg-white"} flex w-48 scale-105 rotate-2 cursor-grabbing flex-col gap-1 rounded-xl border ${isCopyMode && isShift ? "border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.3)]" : "border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.3)]"} opacity-90`}
        >
          {isCopyMode && isShift && (
            <div className="mb-0.5 flex items-center gap-1 text-[9px] font-bold tracking-wider text-emerald-400 uppercase">
              <Copy className="h-2.5 w-2.5" />
              Kopier
            </div>
          )}
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
