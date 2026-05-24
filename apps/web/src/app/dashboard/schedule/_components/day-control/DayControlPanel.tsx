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
  Activity,
  DollarSign,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useScheduleUI } from "../schedule-ui-context";
import { formatDateLabel } from "./shared";
import { PageTabNav, type PageTab } from "@/components/dashboard/PageTabNav";
import { OversiktTab } from "./OversiktTab";
import { MeldingerTab } from "./MeldingerTab";
import { BookingsTab } from "./BookingsTab";
import { BudgetTab } from "./BudgetTab";
import { StaffingTab } from "./StaffingTab";
import { BroadcastFooter } from "./BroadcastFooter";
import { DaySessionProvider } from "./DaySessionProvider";
import { SessionTasksTab } from "./SessionTasksTab";
import { OkonomiTab } from "./OkonomiTab";
import { TidslinjeTab } from "./TidslinjeTab";
import { useDaySession } from "./use-day-session";
import { pinDayControlPanelContextAction } from "@/app/dashboard/_actions/pin-day-control-panel-context";
import { DayControlToolsBridge } from "./day-control-tools-bridge";

type TabId =
  | "oversikt"
  | "meldinger"
  | "bookings"
  | "oppgaver"
  | "tidslinje"
  | "budsjett"
  | "bemanning"
  | "okonomi";

// TAB_DEFS is now computed inside DayControlPanelContent so badge counts
// from dayStats and settlementStatus can be passed. Constant-shape tabs
// are defined here; badge values are injected at render time.
const BASE_TAB_DEFS = [
  { key: "oversikt" as TabId, label: "Oversikt", icon: Info },
  { key: "meldinger" as TabId, label: "Dagsinfo", icon: MessageSquare },
  { key: "bookings" as TabId, label: "Reservasjoner", icon: CalendarCheck },
  { key: "oppgaver" as TabId, label: "Oppgaver", icon: ListTodo },
  { key: "tidslinje" as TabId, label: "Tidslinje", icon: Activity },
  { key: "budsjett" as TabId, label: "Budsjett", icon: DollarSign },
  { key: "bemanning" as TabId, label: "Bemanning", icon: Users },
  { key: "okonomi" as TabId, label: "Økonomi", icon: DollarSign },
] as const;

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

  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  // Resolve first active department so we can source sessionId + departmentName
  // for the tools-bridge. Mirrors the pattern used in OversiktTab.
  const supabaseForSession = useMemo(() => createClient(), []);
  const { data: firstDept } = useQuery({
    queryKey: ["day-control-panel-dept", workspaceId],
    queryFn: async () => {
      const { data } = await supabaseForSession
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspaceId!)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: activeSessionId } = useQuery({
    queryKey: ["day-control-panel-session", firstDept?.department_id, date],
    queryFn: async () => {
      const { data } = await supabaseForSession
        .from("department_session")
        .select("department_session_id")
        .eq("department_id", firstDept!.department_id)
        .eq("session_date", date)
        .maybeSingle();
      return data?.department_session_id ?? null;
    },
    enabled: !!firstDept?.department_id && !!date,
    staleTime: 60 * 1000,
  });

  // sessionId, departmentId, departmentName resolved from DB (no snapshot.session shape)
  const sessionId = activeSessionId ?? null;
  const departmentId = firstDept?.department_id ?? null;
  const departmentName = firstDept?.name ?? null;

  // Pin active panel context to engine_memory so Botsson has session grounding
  useEffect(() => {
    if (!sessionId || !departmentName) return;
    void pinDayControlPanelContextAction({
      sessionId,
      departmentName,
      date,
    });
  }, [sessionId, departmentName, date]);

  // Lightweight check for settlement status — drives the Okonomi tab badge
  const { data: settlementStatus } = useQuery({
    queryKey: ["settlement-status", workspaceId, date],
    enabled: !!workspaceId && !!date,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("daily_reconciliation")
        .select("status")
        .eq("workspace_id", workspaceId!)
        .eq("reconciliation_date", date)
        .maybeSingle();
      return data?.status ?? null;
    },
  });

  const dateLabel = useMemo(() => formatDateLabel(date), [date]);

  // Compute Norwegian relative day label for the date stepper sub-label
  const relativeDayLabel = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    if (date === todayStr) return "i dag";
    if (date === tomorrowStr) return "i morgen";
    if (date === yesterdayStr) return "i gar";
    const NB_DAY_NAMES = ["sondag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lordag"];
    const d = new Date(date + "T00:00:00");
    return NB_DAY_NAMES[d.getDay()] ?? "";
  }, [date]);

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

  // Compute tab defs with live badge values — must be inside component body
  // because dayStats and settlementStatus are in scope here.
  const tabDefs = useMemo((): ReadonlyArray<PageTab<TabId>> => {
    const remainingTasks = dayStats.taskCount > 0 ? dayStats.taskCount - dayStats.taskDone : null;
    return BASE_TAB_DEFS.map((t) => {
      switch (t.key) {
        case "meldinger":
          return { ...t, badge: dayStats.messageCount > 0 ? dayStats.messageCount : null };
        case "bookings":
          return { ...t, badge: dayStats.bookingCount > 0 ? dayStats.bookingCount : null };
        case "oppgaver":
          return {
            ...t,
            badge: remainingTasks != null && remainingTasks > 0 ? remainingTasks : null,
          };
        case "okonomi":
          return { ...t, badge: settlementStatus === "submitted" ? 1 : null };
        default:
          return { ...t, badge: null };
      }
    });
  }, [dayStats, settlementStatus]);

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
    <>
      {sessionId && departmentId && departmentName ? (
        <DayControlToolsBridge
          sessionId={sessionId}
          departmentId={departmentId}
          departmentName={departmentName}
          dateISO={date}
        />
      ) : null}
      <div className="relative flex h-full w-full flex-col">
        {/* Header */}
        <div className={`shrink-0 border-b ${isDark ? "border-border" : "border-border"}`}>
          <div className="flex items-center gap-3 px-5 py-3">
            {/* Date navigation — Manager Timeline .date-stepper recipe */}
            {onNavigate && (
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={() => onNavigate("prev")}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring h-7 w-7 rounded-full p-0 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  title="Forrige dag"
                  aria-label="Forrige dag"
                >
                  <ChevronLeft className="mx-auto h-4 w-4" />
                </button>
                <button
                  onClick={() => onNavigate("next")}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring h-7 w-7 rounded-full p-0 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  title="Neste dag"
                  aria-label="Neste dag"
                >
                  <ChevronRight className="mx-auto h-4 w-4" />
                </button>
              </div>
            )}

            {/* Title — Manager Timeline .date-current + weekday sub-label */}
            <div className="min-w-0 flex-1">
              <span className="text-accent text-[9px] font-bold tracking-widest uppercase">
                Kontrollsenter
              </span>
              <h2 className="text-foreground flex items-baseline gap-1.5 truncate leading-tight">
                <span className="font-heading text-xl tracking-tight">{dateLabel}</span>
                <em className="text-muted-foreground font-mono text-[11px] not-italic">
                  {relativeDayLabel}
                </em>
              </h2>
            </div>

            {/* Quick stats — Manager Timeline .outlet-pill status-dot recipe */}
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <QuickStat dotColor="bg-foreground/40" value={dayStats.staffCount} label="ansatte" />
              <QuickStat
                dotColor="bg-foreground/40"
                value={dayStats.bookingCount}
                label="bookinger"
              />
            </div>

            {/* Actions — Manager Timeline .icon-btn recipe: 36×36 round-full */}
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={() => setDayControlFullscreen(!dayControlFullscreen)}
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring h-9 w-9 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-[0.96]"
                title={dayControlFullscreen ? "Minimer" : "Fullskjerm"}
                aria-label={dayControlFullscreen ? "Minimer" : "Fullskjerm"}
              >
                {dayControlFullscreen ? (
                  <Minimize2 className="mx-auto h-4 w-4" />
                ) : (
                  <Maximize2 className="mx-auto h-4 w-4" />
                )}
              </button>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring h-9 w-9 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-[0.96]"
                aria-label="Lukk kontrollsenter"
              >
                <X className="mx-auto h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-border/50 border-t px-5 py-2">
            <PageTabNav
              tabs={tabDefs}
              active={activeTab}
              onChange={(k) => setActiveTab(k as TabId)}
              ariaLabel="Kontrollsenter tabs"
            />
          </div>
        </div>

        {/* Tab content */}
        <div
          id={`tab-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-btn-${activeTab}`}
          tabIndex={0}
          className="flex-1 overflow-y-auto p-5"
        >
          {activeTab === "oversikt" && <OversiktTab dateId={date} />}
          {activeTab === "meldinger" && <MeldingerTab dateId={date} />}
          {activeTab === "bookings" && <BookingsTab dateId={date} />}
          {activeTab === "oppgaver" && <SessionTasksTab />}
          {activeTab === "tidslinje" && <TidslinjeTab />}
          {activeTab === "budsjett" && <BudgetTab dateId={date} />}
          {activeTab === "bemanning" && <StaffingTab dateId={date} />}
          {activeTab === "okonomi" && <OkonomiTab dateId={date} />}
        </div>

        {/* Footer */}
        <BroadcastFooter dateId={date} />
      </div>
    </>
  );
}

// ── Quick Stat ───────────────────────────────────────────────
// Manager Timeline .outlet-pill .dot recipe: h-9 pill with status-dot + value + label

function QuickStat({ dotColor, value, label }: { dotColor: string; value: number; label: string }) {
  return (
    <div className="bg-muted/50 text-muted-foreground border-border inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[10px] font-bold">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} aria-hidden />
      <span className="text-foreground/80 tabular-nums">{value}</span>
      <span className="hidden lg:inline">{label}</span>
    </div>
  );
}
