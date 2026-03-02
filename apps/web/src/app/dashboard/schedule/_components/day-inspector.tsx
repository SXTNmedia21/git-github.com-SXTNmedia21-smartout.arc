// ============================================
// day-inspector.tsx
// Bottom-sheet container for the Day Control Center.
// Slides up from bottom, supports fullscreen expand.
// Connected to: daily-briefing.tsx (panel content)
// Connected to: schedule-ui-context.tsx (fullscreen state)
// ============================================
"use client";

import type { ReactNode } from "react";
import { useScheduleUI } from "./schedule-ui-context";

type DayInspectorProps = {
  isDark: boolean;
  selectedDate: string | null;
  children: ReactNode;
};

export function DayInspector({ isDark, selectedDate, children }: DayInspectorProps) {
  const { dayControlFullscreen } = useScheduleUI();
  const isOpen = !!selectedDate;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Bottom sheet */}
      <aside
        className={`fixed right-0 bottom-0 left-0 z-50 flex flex-col border-t ${
          isDark ? "border-white/10 bg-[#0a0a0c]/98" : "border-zinc-200 bg-white/98"
        } shadow-[0_-20px_50px_rgba(0,0,0,0.4)] backdrop-blur-3xl transition-all duration-300 ease-out ${
          isOpen
            ? dayControlFullscreen
              ? "top-0 translate-y-0 rounded-none"
              : "translate-y-0 rounded-t-2xl"
            : "pointer-events-none translate-y-full"
        } ${!dayControlFullscreen && isOpen ? "h-[70vh] max-h-[70vh]" : ""}`}
      >
        {/* Drag handle indicator */}
        {!dayControlFullscreen && isOpen && (
          <div className="flex shrink-0 justify-center py-2">
            <div className={`h-1 w-10 rounded-full ${isDark ? "bg-white/20" : "bg-zinc-300"}`} />
          </div>
        )}

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </aside>
    </>
  );
}
