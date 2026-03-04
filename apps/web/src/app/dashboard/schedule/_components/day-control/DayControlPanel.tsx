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
import { useWeekRange } from "../../_hooks/use-week-range";
import { useShifts } from "../../_hooks/use-shifts";
import { useDayMessages, useDayTasks, useDayBookings } from "../../_hooks/use-day-content";
import type { Shift, DayMessage, DayTask, DayBooking } from "../schedule-types";
import { formatDateLabel } from "./shared";
import { TabButton } from "./shared";
import { OversiktTab } from "./OversiktTab";
import { MeldingerTab } from "./MeldingerTab";
import { BookingsTab } from "./BookingsTab";
import { OppgaverTab } from "./OppgaverTab";
import { BudgetTab } from "./BudgetTab";
import { StaffingTab } from "./StaffingTab";
import { BroadcastFooter } from "./BroadcastFooter";

type TabId = "oversikt" | "meldinger" | "bookings" | "oppgaver" | "budsjett" | "bemanning";

export function DayControlPanel({
  date,
  onClose,
  onNavigate,
}: {
  date: string | null;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const { dayControlFullscreen, setDayControlFullscreen } = useScheduleUI();
  const [activeTab, setActiveTab] = useState<TabId>("oversikt");

  // Quick stats for header badges
  const { weekStart, weekEnd } = useWeekRange();
  const { data: shifts = [] as Shift[] } = useShifts(weekStart, weekEnd);
  const { data: messages = [] as DayMessage[] } = useDayMessages(weekStart, weekEnd);
  const { data: tasks = [] as DayTask[] } = useDayTasks(weekStart, weekEnd);
  const { data: bookings = [] as DayBooking[] } = useDayBookings(weekStart, weekEnd);

  const dateLabel = useMemo(() => formatDateLabel(date), [date]);

  // Count items per tab for badge display
  const dayStats = useMemo(() => {
    if (!date)
      return { staffCount: 0, messageCount: 0, bookingCount: 0, taskCount: 0, taskDone: 0 };
    const dayShifts = shifts.filter((s: Shift) => s.dateId === date);
    const staffCount = new Set(dayShifts.map((s) => s.employeeId).filter(Boolean)).size;
    const messageCount = messages.filter((m: DayMessage) => m.dateId === date).length;
    const bookingCount = bookings.filter((b: DayBooking) => b.dateId === date).length;
    const dayTasks = tasks.filter((t: DayTask) => t.dateId === date);
    const taskCount = dayTasks.length;
    const taskDone = dayTasks.filter((t) => t.status === "completed").length;
    return { staffCount, messageCount, bookingCount, taskCount, taskDone };
  }, [date, shifts, messages, bookings, tasks]);

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
    if (date) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [date, handleClose]);

  if (!date) return null;

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
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "oversikt" && <OversiktTab dateId={date} />}
        {activeTab === "meldinger" && <MeldingerTab dateId={date} />}
        {activeTab === "bookings" && <BookingsTab dateId={date} />}
        {activeTab === "oppgaver" && <OppgaverTab dateId={date} />}
        {activeTab === "budsjett" && <BudgetTab dateId={date} />}
        {activeTab === "bemanning" && <StaffingTab dateId={date} />}
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
