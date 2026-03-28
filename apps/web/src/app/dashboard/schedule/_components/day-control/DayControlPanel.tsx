// ============================================
// day-control/DayControlPanel.tsx
// Main panel for the Day Control Center bottom sheet.
// Compact header with date + quick stats, 4 tabs, broadcast footer.
// Connected to: DayControlSheet.tsx (container)
// ============================================
"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  X,
  Info,
  MessageSquare,
  CalendarCheck,
  ListTodo,
  DollarSign,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
} from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useScheduleUI } from "../schedule-ui-context";
import { formatDateLabel } from "./shared";
import { TabButton } from "./shared";
import { OversiktTab } from "./OversiktTab";
import { MeldingerTab } from "./MeldingerTab";
import { BookingsTab } from "./BookingsTab";
import { BudgetTab } from "./BudgetTab";
import { StaffingTab } from "./StaffingTab";
import { BroadcastFooter } from "./BroadcastFooter";
import { DaySessionProvider } from "./DaySessionProvider";
import { SessionTasksTab } from "./SessionTasksTab";
import { OkonomiTab } from "./OkonomiTab";
import { useDaySession } from "./use-day-session";

type TabId =
  | "oversikt"
  | "meldinger"
  | "bookings"
  | "oppgaver"
  | "budsjett"
  | "bemanning"
  | "okonomi";

/**
 * Hosts the day control panel inside the shared day-session provider.
 *
 * Why: the panel shell and its tabs must read from the same integrated state.
 *
 * Returns: the wrapped day control panel for the selected day.
 */
export function DayControlPanel({
  date,
  onClose,
  onNavigate,
}: {
  date: string | null;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
}) {
  if (!date) return null;

  return (
    <DaySessionProvider key={date} dateId={date}>
      <DayControlPanelContent date={date} onClose={onClose} onNavigate={onNavigate} />
    </DaySessionProvider>
  );
}

/**
 * Renders the visual day control shell after shared state is available.
 *
 * Why: this inner component can safely read day-session data without mixing
 * provider setup with presentational layout.
 *
 * Returns: the day control panel UI.
 */
function DayControlPanelContent({
  date,
  onClose,
  onNavigate,
}: {
  date: string;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const { dayControlFullscreen, setDayControlFullscreen } = useScheduleUI();
  const [activeTab, setActiveTab] = useState<TabId>("oversikt");
  const { snapshot, dayBookings, dayMessages } = useDaySession();

  const dateLabel = useMemo(() => formatDateLabel(date), [date]);

  // Count items per tab for badge display
  const dayStats = useMemo(() => {
    const taskCount = snapshot?.summary.taskCount ?? 0;
    const taskDone = snapshot?.summary.completedTaskCount ?? 0;
    return {
      staffCount: snapshot?.summary.staffCount ?? 0,
      messageCount: dayMessages.length,
      bookingCount: dayBookings.length,
      taskCount,
      taskDone,
    };
  }, [dayBookings.length, dayMessages.length, snapshot]);

  const handleClose = useCallback(() => {
    setDayControlFullscreen(false);
    onClose();
  }, [setDayControlFullscreen, onClose]);

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [date, handleClose]);

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Header */}
      <div className={`shrink-0 border-b ${isDark ? "border-border" : "border-border"}`}>
        <div className="flex items-center gap-3 px-5 py-3">
          {/* Date navigation */}
          {onNavigate && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={() => onNavigate("prev")}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1 transition-colors"
                title="Forrige dag"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => onNavigate("next")}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1 transition-colors"
                title="Neste dag"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Title */}
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-bold tracking-widest text-orange-400 uppercase">
              Kontrollsenter
            </span>
            <h2 className="text-foreground truncate text-sm leading-tight font-black tracking-tight">
              {dateLabel}
            </h2>
          </div>

          {/* Quick stats badges */}
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <QuickStat
              icon={<Users className="h-3 w-3" />}
              value={dayStats.staffCount}
              label="ansatte"
            />
            <QuickStat
              icon={<Clock className="h-3 w-3" />}
              value={dayStats.bookingCount}
              label="bookinger"
            />
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => setDayControlFullscreen(!dayControlFullscreen)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1.5 transition-all"
              title={dayControlFullscreen ? "Minimer" : "Fullskjerm"}
            >
              {dayControlFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1.5 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="no-scrollbar border-border/50 flex gap-0 overflow-x-auto border-t px-5">
          <TabButton
            active={activeTab === "oversikt"}
            onClick={() => setActiveTab("oversikt")}
            icon={<Info className="h-3 w-3" />}
            label="Oversikt"
          />
          <TabButton
            active={activeTab === "meldinger"}
            onClick={() => setActiveTab("meldinger")}
            icon={<MessageSquare className="h-3 w-3" />}
            label="Dagsinfo"
            badge={dayStats.messageCount}
          />
          <TabButton
            active={activeTab === "bookings"}
            onClick={() => setActiveTab("bookings")}
            icon={<CalendarCheck className="h-3 w-3" />}
            label="Reservasjoner"
            badge={dayStats.bookingCount}
          />
          <TabButton
            active={activeTab === "oppgaver"}
            onClick={() => setActiveTab("oppgaver")}
            icon={<ListTodo className="h-3 w-3" />}
            label="Oppgaver"
            badge={dayStats.taskCount > 0 ? dayStats.taskCount - dayStats.taskDone : undefined}
          />
          <TabButton
            active={activeTab === "budsjett"}
            onClick={() => setActiveTab("budsjett")}
            icon={<DollarSign className="h-3 w-3" />}
            label="Budsjett"
          />
          <TabButton
            active={activeTab === "bemanning"}
            onClick={() => setActiveTab("bemanning")}
            icon={<Users className="h-3 w-3" />}
            label="Bemanning"
          />
          <TabButton
            active={activeTab === "okonomi"}
            onClick={() => setActiveTab("okonomi")}
            icon={<DollarSign className="h-3 w-3" />}
            label="Okonomi"
          />
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "oversikt" && <OversiktTab dateId={date} />}
        {activeTab === "meldinger" && <MeldingerTab dateId={date} />}
        {activeTab === "bookings" && <BookingsTab dateId={date} />}
        {activeTab === "oppgaver" && <SessionTasksTab />}
        {activeTab === "budsjett" && <BudgetTab dateId={date} />}
        {activeTab === "bemanning" && <StaffingTab dateId={date} />}
        {activeTab === "okonomi" && <OkonomiTab dateId={date} />}
      </div>

      {/* Footer */}
      <BroadcastFooter dateId={date} />
    </div>
  );
}

// ── Quick Stat ───────────────────────────────────────────────

function QuickStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-muted/50 text-muted-foreground flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold">
      {icon}
      <span className="text-foreground/80">{value}</span>
      <span className="hidden lg:inline">{label}</span>
    </div>
  );
}
