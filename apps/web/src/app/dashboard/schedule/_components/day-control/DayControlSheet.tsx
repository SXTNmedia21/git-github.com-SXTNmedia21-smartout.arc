// ============================================
// day-control/DayControlSheet.tsx
// Bottom-sheet container for the Day Control Center.
// Slides up from bottom, supports fullscreen expand.
// Respects dashboard sidebar (w-16 collapsed / w-64 expanded).
// Escape to close, click backdrop to close.
// ============================================
"use client";

import type { ReactNode } from "react";
import { useCallback, useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useScheduleUI } from "../schedule-ui-context";

type DayControlSheetProps = {
  selectedDate: string | null;
  onClose: () => void;
  children: ReactNode;
};

export function DayControlSheet({ selectedDate, onClose, children }: DayControlSheetProps) {
  const { isDark, isSidebarCollapsed } = useContext(DashboardContext);
  const { dayControlFullscreen, setDayControlFullscreen } = useScheduleUI();
  const isOpen = !!selectedDate;

  const sidebarOffset = isSidebarCollapsed ? "left-16" : "left-64";

  const handleBackdropClick = useCallback(() => {
    setDayControlFullscreen(false);
    onClose();
  }, [onClose, setDayControlFullscreen]);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={handleBackdropClick}
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Bottom sheet */}
      <aside
        className={`fixed right-0 bottom-0 ${sidebarOffset} z-[70] flex flex-col border-t ${
          isDark ? "border-border bg-background/[0.98]" : "border-border bg-card/[0.98]"
        } shadow-[0_-16px_48px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-all duration-300 ease-out ${
          isOpen
            ? dayControlFullscreen
              ? "top-0 translate-y-0 rounded-none"
              : "translate-y-0 rounded-tl-2xl rounded-tr-2xl"
            : "pointer-events-none translate-y-full"
        } ${!dayControlFullscreen && isOpen ? "h-[75vh] max-h-[75vh]" : ""}`}
      >
        {/* Drag handle */}
        {!dayControlFullscreen && isOpen && (
          <div className="flex shrink-0 justify-center py-2.5">
            <div
              className={`h-1 w-10 rounded-full ${isDark ? "bg-muted-foreground/20" : "bg-muted-foreground/30"}`}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </aside>
    </>
  );
}
