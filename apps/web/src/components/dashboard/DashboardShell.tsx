"use client";

import { useState, useRef, useEffect, useCallback, createContext, useMemo } from "react";
import dynamic from "next/dynamic";
import type { MissionId } from "@smartout/ai/missions";
import { useWorkspaceOptional } from "@/lib/workspace-context";

const VoiceAssistant = dynamic(() => import("@/components/voice-assistant"), {
  ssr: false,
});

const ROUTE_MISSION_MAP: Record<string, MissionId> = {
  "/dashboard": "mr-botsson",
  "/dashboard/schedule": "shift-assistant",
  "/dashboard/governance": "haccp-inspector",
  "/dashboard/operations": "mr-botsson",
  "/dashboard/chat": "mr-botsson",
  "/dashboard/people": "mr-botsson",
  "/dashboard/reports": "mr-botsson",
  "/dashboard/season": "mr-botsson",
  "/dashboard/organization": "mr-botsson",
  "/dashboard/onboarding-assistant": "onboarding-interview",
  "/dashboard/ai": "mr-botsson",
  "/dashboard/settings": "mr-botsson",
  "/dashboard/help": "mr-botsson",
  "/dashboard/my-schedule": "shift-assistant",
  "/dashboard/my-training": "mr-botsson",
  "/dashboard/my-cv": "mr-botsson",
  "/dashboard/my-salary": "mr-botsson",
};

function resolveMissionForRoute(pathname: string): MissionId {
  const direct = ROUTE_MISSION_MAP[pathname];
  if (direct) return direct;
  const match = Object.keys(ROUTE_MISSION_MAP)
    .filter((prefix) => pathname.startsWith(prefix) && prefix !== "/dashboard")
    .sort((a, b) => b.length - a.length)[0];
  return (match !== undefined ? ROUTE_MISSION_MAP[match] : undefined) ?? "mr-botsson";
}

export type AdminViewType = "tactical" | "strategic" | "reconciliation" | "activity" | "guardian";
export type ScheduleLayoutMode = "daily" | "weekly" | "monthly" | "list";
export type ScheduleViewMode = "ansatt" | "jobb" | "team";
type VoiceSessionContext = {
  page: string;
  story: string;
  workingElements: string[];
  availableInputs: string[];
};

function buildVoiceSessionContext(pathname: string, adminView: AdminViewType): VoiceSessionContext {
  if (pathname === "/dashboard") {
    if (adminView === "guardian") {
      return {
        page: "dashboard.guardian",
        story:
          "Du er i event center. Forklar hva systemet fanger opp, hvorfor signalene betyr noe, og hvilken handling lederen bør ta nå.",
        workingElements: [
          "Guardian signal stream",
          "Mission control panel",
          "Critical alerts list",
          "Compliance checkpoints",
        ],
        availableInputs: [
          "Active guardian signals",
          "Workspace context",
          "Current admin view (guardian)",
          "User follow-up questions",
        ],
      };
    }

    return {
      page: "dashboard.overview",
      story:
        "Du er i showcase-oversikt. Fortell hva som skjer nå, hva Smartout tolker, og hva neste beste steg er i demoen.",
      workingElements: [
        "Showcase step strip",
        "Action strip",
        "Strategic KPI cards",
        "Top tactical/strategic view switcher",
      ],
      availableInputs: [
        "Current dashboard view",
        "Action item counters",
        "Workspace context",
        "User-selected showcase step",
      ],
    };
  }

  if (pathname.startsWith("/dashboard/schedule")) {
    return {
      page: "dashboard.schedule",
      story:
        "Du viser templates og operativ kontroll. Forklar hvordan teamet standardiserer uker og justerer bemanning raskt.",
      workingElements: [
        "Template load/save controls",
        "Layout switcher (uke/rullerende/maned/vaktliste)",
        "Publish button",
        "Date and period navigation",
      ],
      availableInputs: [
        "Schedule layout mode",
        "Date offset and period size",
        "Draft count",
        "Realtime schedule updates",
      ],
    };
  }

  if (pathname.startsWith("/dashboard/reports")) {
    return {
      page: "dashboard.reports",
      story:
        "Du viser analytics. Knyt tall til beslutninger: hva har skjedd, hva betyr det, og hva bør lederen prioritere.",
      workingElements: [
        "Report tabs",
        "Trend charts",
        "Staffing insights",
        "Training/readiness summaries",
      ],
      availableInputs: [
        "Selected report tab",
        "Chart data loaded in current view",
        "Workspace metrics",
        "User-selected analysis focus",
      ],
    };
  }

  if (pathname.startsWith("/onboarding")) {
    return {
      page: "onboarding",
      story:
        "Du viser system intelligence. Forklar hvordan Smartout finner bedriftsdata, foreslar struktur, og reduserer manuelt oppsett.",
      workingElements: [
        "Business discovery cards",
        "Section progress flow",
        "Procedures/departments setup",
        "Welcome activation summary",
      ],
      availableInputs: [
        "Current onboarding section",
        "Detected company data",
        "Manual field corrections",
        "Section completion state",
      ],
    };
  }

  return {
    page: "dashboard.generic",
    story:
      "Forklar hva brukeren ser pa denne siden, hvilke handlinger som er tilgjengelige, og hva neste naturlige steg er.",
    workingElements: ["Current page widgets", "Primary navigation", "Context bar"],
    availableInputs: ["Current route", "Workspace context", "User intent"],
  };
}

export const DashboardContext = createContext({
  isAdminMode: true,
  setIsAdminMode: (_val: boolean) => {
    void _val;
  },
  isDark: true,
  setIsDark: (_val: boolean) => {
    void _val;
  },
  adminView: "tactical" as AdminViewType,
  setAdminView: (_val: AdminViewType) => {
    void _val;
  },
  scheduleLayout: "daily" as ScheduleLayoutMode,
  setScheduleLayout: (_val: ScheduleLayoutMode) => {
    void _val;
  },
  scheduleView: "ansatt" as ScheduleViewMode,
  setScheduleView: (_val: ScheduleViewMode) => {
    void _val;
  },
  activeLocation: "Alle Lokasjoner",
  setActiveLocation: (_val: string) => {
    void _val;
  },
  isSidebarCollapsed: false,
  setIsSidebarCollapsed: (_val: boolean) => {
    void _val;
  },
  weeklyPeriodCount: 4,
  setWeeklyPeriodCount: (_val: number) => {
    void _val;
  },
  scheduleDateOffset: 0,
  setScheduleDateOffset: (_val: number) => {
    void _val;
  },
  onPublishAll: null as (() => void) | null,
  setOnPublishAll: (_val: (() => void) | null) => {
    void _val;
  },
  scheduleDraftCount: 0,
  setScheduleDraftCount: (_val: number) => {
    void _val;
  },
  scheduleCompactMode: false,
  setScheduleCompactMode: (_val: boolean) => {
    void _val;
  },
  workspaceData: null as { workspace_id: string; company_id: string | null; name: string } | null,
  profileId: null as string | null,
});
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Calendar,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  Search,
  Settings,
  Activity,
  TrendingUp,
  Sun,
  Moon,
  Gamepad2,
  MessageSquare,
  Bot,
  HelpCircle,
  Building2,
  GraduationCap,
  Banknote,
  FileText,
  CalendarDays,
  Shield,
  ShieldCheck,
  Mic,
} from "lucide-react";

import { ContractPendingBanner } from "./ContractPendingBanner";
import { ActionStrip } from "@/components/dashboard/ActionStrip";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { VoiceToolsProvider, useVoiceTools } from "@/components/voice-tools-context";
// Popover imports removed — location selector moved to PlannerCommandBar
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Demo location options for the schedule page location selector */
// LOCATIONS moved to schedule PlannerCommandBar

function VoiceAssistantWithTools({
  isOpen,
  missionId,
  sessionContext,
  onClose,
}: {
  isOpen: boolean;
  missionId: MissionId;
  sessionContext: VoiceSessionContext;
  onClose: () => void;
}) {
  const { clientTools } = useVoiceTools();
  if (!isOpen) return null;
  return (
    <div className="pointer-events-auto absolute top-full right-0 z-50 mt-4 origin-top-right shadow-2xl">
      <VoiceAssistant
        autoStart={false}
        missionId={missionId}
        sessionContext={sessionContext}
        clientTools={clientTools}
        onClose={onClose}
      />
    </div>
  );
}

function ShowcaseStrip({
  isDark,
  onSelectView,
}: {
  isDark: boolean;
  onSelectView: (view: AdminViewType) => void;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
        isDark ? "border-orange-500/25 bg-orange-500/10" : "border-orange-200 bg-orange-50"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md border px-2 py-1 text-[10px] font-bold tracking-widest uppercase ${
              isDark
                ? "border-orange-500/30 bg-orange-500/20 text-orange-300"
                : "border-orange-300 bg-orange-100 text-orange-700"
            }`}
          >
            Showcase
          </span>
          <span className={`text-sm font-semibold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
            Dunner Bros demo path
          </span>
        </div>
        <p className={`truncate text-xs ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
          Event captured - system interprets - Smartout recommends action.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSelectView("strategic")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
            isDark
              ? "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          1. Dashboard Insights
        </button>
        <button
          onClick={() => onSelectView("guardian")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
            isDark
              ? "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          2. Event Handlers
        </button>
        <Link
          href="/dashboard/schedule"
          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
            isDark
              ? "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          3. Templates
        </Link>
        <Link
          href="/dashboard/reports"
          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
            isDark
              ? "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          4. Analytics
        </Link>
        <Link
          href="/onboarding"
          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
            isDark
              ? "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          5. System Intelligence
        </Link>
        <Link
          href="/dashboard/reports"
          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
            isDark
              ? "border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
              : "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200"
          }`}
        >
          Backup Start
        </Link>
      </div>
    </div>
  );
}

export function DashboardShell({
  children,
  profileId = null,
}: {
  children: React.ReactNode;
  profileId?: string | null;
}) {
  const [isDark, setIsDark] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(true);
  const [adminView, setAdminView] = useState<AdminViewType>("strategic");
  const [scheduleLayout, setScheduleLayout] = useState<ScheduleLayoutMode>("daily");
  const [scheduleView, setScheduleView] = useState<ScheduleViewMode>("ansatt");
  const [activeLocation, setActiveLocation] = useState("Alle Lokasjoner");
  // locationMenuOpen removed — location selector moved to PlannerCommandBar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [weeklyPeriodCount, setWeeklyPeriodCount] = useState(4);
  const [scheduleDateOffset, setScheduleDateOffset] = useState(0);
  const onPublishAllRef = useRef<(() => void) | null>(null);
  const scheduleDraftCountRef = useRef(0);
  const [scheduleDraftCountDisplay, setScheduleDraftCountDisplay] = useState(0);
  const [scheduleCompactMode, setScheduleCompactMode] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const pathname = usePathname();
  const workspaceCtx = useWorkspaceOptional();
  const workspaceData = useMemo(
    () =>
      workspaceCtx
        ? {
            workspace_id: workspaceCtx.workspace.workspace_id,
            company_id: workspaceCtx.workspace.company_id,
            name: workspaceCtx.workspace.name,
          }
        : null,
    [workspaceCtx],
  );
  /** Stable setter that schedule page calls to register the publish callback */
  const setOnPublishAll = useCallback((fn: (() => void) | null) => {
    onPublishAllRef.current = fn;
  }, []);
  /** Stable callback that reads ref at call-time (event handler), not render-time */
  const onPublishAllStable = useCallback(() => {
    onPublishAllRef.current?.();
  }, []);
  /** Stable setter — writes to ref + state, avoids infinite loops via guard */
  const setScheduleDraftCount = useCallback((count: number) => {
    if (scheduleDraftCountRef.current !== count) {
      scheduleDraftCountRef.current = count;
      setScheduleDraftCountDisplay(count);
    }
  }, []);
  const dashboardContextValue = useMemo(
    () => ({
      isAdminMode,
      setIsAdminMode,
      isDark,
      setIsDark,
      adminView,
      setAdminView,
      scheduleLayout,
      setScheduleLayout,
      scheduleView,
      setScheduleView,
      activeLocation,
      setActiveLocation,
      isSidebarCollapsed,
      setIsSidebarCollapsed,
      weeklyPeriodCount,
      setWeeklyPeriodCount,
      scheduleDateOffset,
      setScheduleDateOffset,
      onPublishAll: onPublishAllStable,
      setOnPublishAll,
      scheduleDraftCount: scheduleDraftCountDisplay,
      setScheduleDraftCount,
      scheduleCompactMode,
      setScheduleCompactMode,
      workspaceData,
      profileId,
    }),
    [
      isAdminMode,
      isDark,
      adminView,
      scheduleLayout,
      scheduleView,
      activeLocation,
      isSidebarCollapsed,
      weeklyPeriodCount,
      scheduleDateOffset,
      onPublishAllStable,
      setOnPublishAll,
      setScheduleDraftCount,
      scheduleDraftCountDisplay,
      scheduleCompactMode,
      workspaceData,
      profileId,
    ],
  );

  const isDashboardPage = pathname === "/dashboard";

  const isSchedulePage = pathname?.startsWith("/dashboard/schedule");

  // Auto-collapse sidebar when entering schedule, restore when leaving
  const prevIsSchedule = useRef(isSchedulePage);
  const sidebarStateBeforeAutoCollapse = useRef<boolean | null>(null);

  useEffect(() => {
    if (isSchedulePage && !prevIsSchedule.current) {
      sidebarStateBeforeAutoCollapse.current = isSidebarCollapsed;
      if (!isSidebarCollapsed) setIsSidebarCollapsed(true);
    } else if (!isSchedulePage && prevIsSchedule.current) {
      if (sidebarStateBeforeAutoCollapse.current === false) {
        setIsSidebarCollapsed(false);
      }
      sidebarStateBeforeAutoCollapse.current = null;
    }
    prevIsSchedule.current = isSchedulePage;
    // eslint-disable-next-line -- suppress exhaustive-deps: isSidebarCollapsed excluded; this effect sets it, adding it would cause infinite loop
  }, [isSchedulePage]);

  // Helper to determine if a link is active
  const isActive = (path: string) => {
    // Exact match for dashboard root, otherwise starts with
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(path);
  };

  return (
    <VoiceToolsProvider>
      <div
        className={`flex h-screen flex-col overflow-hidden font-sans transition-colors duration-300 selection:bg-orange-500/30 ${
          isDark ? "dark" : ""
        } bg-background text-foreground print:block print:h-auto print:overflow-visible`}
      >
        {/* TOP CONTEXT BAR */}
        {/* UI Events:
            - action: toggleTheme() (sun/moon button)
            - action: openVoiceAssistant() (mic button)
            - color-regime: isDark — dark=near-black, light=warm-cream header with orange accent */}
        <header
          className={`relative z-30 flex h-14 items-center justify-between border-b px-6 transition-colors duration-300 ${
            isDark
              ? "border-border bg-background"
              : "border-[oklch(0.91_0.004_55)] bg-[oklch(0.98_0.003_55)] shadow-sm"
          } print:hidden`}
        >
          <div className="flex items-center gap-6">
            <WorkspaceSwitcher isDark={isDark} />

            <div className="flex items-center gap-2 text-sm">
              <span className={isDark ? "text-muted-foreground" : "text-[oklch(0.52_0.02_50)]"}>
                Sesong:
              </span>
              <span
                className={`font-semibold ${isDark ? "text-foreground" : "text-[oklch(0.25_0.01_50)]"}`}
              >
                Vinter 2026
              </span>
              <div
                className={`ml-2 flex items-center gap-1.5 rounded border px-2 py-0.5 ${
                  isDark
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold tracking-wider uppercase">Aktiv</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDemoMode((prev) => !prev)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors ${
                isDemoMode
                  ? isDark
                    ? "border-orange-500/30 bg-orange-500/15 text-orange-300"
                    : "border-orange-300 bg-orange-100 text-orange-700"
                  : isDark
                    ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800"
              }`}
            >
              Showcase {isDemoMode ? "On" : "Off"}
            </button>

            <button
              onClick={() => setIsDark(!isDark)}
              className={`rounded-md p-1.5 transition-colors ${
                isDark
                  ? "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  : "text-[oklch(0.48_0.02_50)] hover:bg-[oklch(0.93_0.005_55)] hover:text-[oklch(0.25_0.01_50)]"
              }`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Header Voice Assistant (lazy-loaded to avoid shell bundle bloat) */}
            <div className="relative">
              <button
                onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                className={`rounded-md p-1.5 transition-colors ${
                  isAssistantOpen
                    ? "bg-orange-500/20 text-orange-400"
                    : isDark
                      ? "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                      : "text-[oklch(0.48_0.02_50)] hover:bg-[oklch(0.93_0.005_55)] hover:text-[oklch(0.25_0.01_50)]"
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>

              <VoiceAssistantWithTools
                isOpen={isAssistantOpen}
                missionId={resolveMissionForRoute(pathname)}
                sessionContext={buildVoiceSessionContext(pathname, adminView)}
                onClose={() => setIsAssistantOpen(false)}
              />
            </div>

            <UserMenu isDark={isDark} />
          </div>
        </header>

        <ContractPendingBanner />

        <div className="relative flex flex-1 overflow-hidden">
          {/* LEFT SIDEBAR NAVIGATION */}
          {/* UI Events:
              - nav: all NavItem hrefs
              - action: toggleSidebarCollapse() (chevron button)
              - action: toggleAdminMode() (bottom toggle)
              - color-regime: isDark — dark=near-black, light=warm-cream gradient */}
          <aside
            className={`z-20 flex flex-col overflow-hidden border-r transition-[width] duration-200 ${
              isSidebarCollapsed ? "w-16" : "w-64"
            } ${
              isDark
                ? "border-zinc-800 bg-[#0c0c0e]"
                : "border-[oklch(0.91_0.004_55)] bg-[oklch(0.98_0.003_55)] shadow-[1px_0_12px_-4px_oklch(0.6_0.05_50/0.08)]"
            } print:hidden`}
          >
            <TooltipProvider delayDuration={0}>
              {/* Sidebar collapse toggle — top */}
              <div
                className={`flex items-center border-b ${isSidebarCollapsed ? "justify-center px-2" : "justify-end px-4"} py-3 ${
                  isDark ? "border-zinc-800" : "border-[oklch(0.92_0.004_55)]"
                }`}
              >
                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className={`rounded-lg p-1.5 transition-colors ${
                    isDark
                      ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                      : "text-[oklch(0.52_0.02_50)] hover:bg-[oklch(0.94_0.005_55)] hover:text-[oklch(0.3_0.02_50)]"
                  }`}
                >
                  {isSidebarCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </button>
              </div>

              <nav
                className={`scroll-overlay hide-scrollbar relative flex-1 space-y-1 py-4 ${isSidebarCollapsed ? "px-2" : "px-4"}`}
              >
                {isAdminMode ? (
                  isDemoMode ? (
                    <>
                      {!isSidebarCollapsed && (
                        <div
                          className={`mt-2 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                            isDark ? "text-zinc-500" : "text-[oklch(0.60_0.018_45)]"
                          }`}
                        >
                          Showcase
                        </div>
                      )}
                      <NavItem
                        href="/dashboard"
                        icon={LayoutDashboard}
                        label="Oversikt"
                        isDark={isDark}
                        active={isActive("/dashboard")}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <NavItem
                        href="/dashboard"
                        icon={Shield}
                        label="Event Center"
                        isDark={isDark}
                        active={isDashboardPage && adminView === "guardian"}
                        isCollapsed={isSidebarCollapsed}
                        onClick={() => setAdminView("guardian")}
                        useButton
                      />
                      <NavItem
                        href="/dashboard/schedule"
                        icon={CalendarDays}
                        label="Templates"
                        isDark={isDark}
                        active={isActive("/dashboard/schedule")}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <NavItem
                        href="/dashboard/reports"
                        icon={TrendingUp}
                        label="Analytics"
                        isDark={isDark}
                        active={isActive("/dashboard/reports")}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <NavItem
                        href="/onboarding"
                        icon={Bot}
                        label="System Intelligence"
                        isDark={isDark}
                        active={false}
                        isCollapsed={isSidebarCollapsed}
                      />
                    </>
                  ) : (
                    <>
                      {!isSidebarCollapsed && (
                        <div
                          className={`mt-2 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                            isDark ? "text-zinc-500" : "text-[oklch(0.60_0.018_45)]"
                          }`}
                        >
                          Ledelse
                        </div>
                      )}
                      <NavItem
                        href="/dashboard"
                        icon={LayoutDashboard}
                        label="Oversikt"
                        isDark={isDark}
                        active={isActive("/dashboard")}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <NavItem
                        href="/dashboard/people"
                        icon={Users}
                        label="Ansatte"
                        isDark={isDark}
                        badge="2 Forespørsler"
                        active={isActive("/dashboard/people")}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <NavItem
                        href="/dashboard/schedule"
                        icon={CalendarDays}
                        label="Vaktplan"
                        isDark={isDark}
                        active={isActive("/dashboard/schedule")}
                        isCollapsed={isSidebarCollapsed}
                      />

                      {!isSidebarCollapsed && (
                        <div
                          className={`mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                            isDark ? "text-zinc-500" : "text-[oklch(0.60_0.018_45)]"
                          }`}
                        >
                          Operasjoner
                        </div>
                      )}
                      {isSidebarCollapsed && <div className="mt-4" />}
                      <NavItem
                        href="/dashboard/operations"
                        icon={Activity}
                        label="Drift"
                        isDark={isDark}
                        active={isActive("/dashboard/operations")}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <NavItem
                        href="/dashboard/reports"
                        icon={TrendingUp}
                        label="Rapporter"
                        isDark={isDark}
                        active={isActive("/dashboard/reports")}
                        isCollapsed={isSidebarCollapsed}
                      />

                      {!isSidebarCollapsed && (
                        <div
                          className={`mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                            isDark ? "text-zinc-500" : "text-[oklch(0.60_0.018_45)]"
                          }`}
                        >
                          Administrasjon
                        </div>
                      )}
                      {isSidebarCollapsed && <div className="mt-4" />}
                      <NavItem
                        href="/dashboard/governance"
                        icon={ShieldCheck}
                        label="HMS"
                        isDark={isDark}
                        active={isActive("/dashboard/governance")}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <NavItem
                        href="/dashboard/season"
                        icon={Gamepad2}
                        label="Sesong"
                        isDark={isDark}
                        active={isActive("/dashboard/season")}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <NavItem
                        href="/dashboard/organization"
                        icon={Building2}
                        label="Organisasjon"
                        isDark={isDark}
                        active={isActive("/dashboard/organization")}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <NavItem
                        href="/dashboard"
                        icon={Shield}
                        label="Vakt"
                        isDark={isDark}
                        active={isDashboardPage && adminView === "guardian"}
                        isCollapsed={isSidebarCollapsed}
                        onClick={() => setAdminView("guardian")}
                      />
                    </>
                  )
                ) : (
                  <>
                    {!isSidebarCollapsed && (
                      <div
                        className={`mt-2 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                          isDark ? "text-zinc-500" : "text-[oklch(0.60_0.018_45)]"
                        }`}
                      >
                        Mitt arbeidsrom
                      </div>
                    )}
                    <NavItem
                      href="/dashboard"
                      icon={LayoutDashboard}
                      label="Oversikt"
                      isDark={isDark}
                      active={isActive("/dashboard")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/my-schedule"
                      icon={Calendar}
                      label="Min vaktplan"
                      isDark={isDark}
                      active={isActive("/dashboard/my-schedule")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/my-training"
                      icon={GraduationCap}
                      label="Min opplæring"
                      isDark={isDark}
                      badge="1 forfalt"
                      active={isActive("/dashboard/my-training")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/my-cv"
                      icon={FileText}
                      label="Min profil"
                      isDark={isDark}
                      active={isActive("/dashboard/my-cv")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/my-salary"
                      icon={Banknote}
                      label="Min lønn"
                      isDark={isDark}
                      active={isActive("/dashboard/my-salary")}
                      isCollapsed={isSidebarCollapsed}
                    />
                  </>
                )}

                {!isDemoMode && (
                  <>
                    {!isSidebarCollapsed && (
                      <div
                        className={`mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                          isDark ? "text-zinc-500" : "text-zinc-400"
                        }`}
                      >
                        Kommunikasjon
                      </div>
                    )}
                    {isSidebarCollapsed && <div className="mt-4" />}
                    <NavItem
                      href="/dashboard/chat"
                      icon={MessageSquare}
                      label="Chat"
                      isDark={isDark}
                      badge="3"
                      active={isActive("/dashboard/chat")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/ai"
                      icon={Bot}
                      label="Mr. Botsson"
                      isDark={isDark}
                      ai
                      active={isActive("/dashboard/ai")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/onboarding-assistant"
                      icon={Bot}
                      label="Onboarding-assistent"
                      isDark={isDark}
                      ai
                      active={isActive("/dashboard/onboarding-assistant")}
                      isCollapsed={isSidebarCollapsed}
                    />

                    <div className="mt-8 space-y-1 pt-4">
                      <NavItem
                        href="/dashboard/settings"
                        icon={Settings}
                        label="Innstillinger"
                        isDark={isDark}
                        active={isActive("/dashboard/settings")}
                        isCollapsed={isSidebarCollapsed}
                      />
                      <NavItem
                        href="/dashboard/help"
                        icon={HelpCircle}
                        label="Hjelp"
                        isDark={isDark}
                        active={isActive("/dashboard/help")}
                        isCollapsed={isSidebarCollapsed}
                      />
                    </div>
                  </>
                )}
              </nav>

              {/* Sidebar bottom controls */}
              <div
                className={`border-t ${isSidebarCollapsed ? "p-2" : "p-4"} ${
                  isDark
                    ? "border-zinc-800 bg-[#0a0a0c]"
                    : "border-[oklch(0.92_0.004_55)] bg-[oklch(0.96_0.004_55)]"
                } space-y-2`}
              >
                {/* Admin/Employee toggle */}
                <button
                  onClick={() => setIsAdminMode(!isAdminMode)}
                  className={`flex w-full items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"} rounded-lg border ${isSidebarCollapsed ? "px-0 py-2" : "px-3 py-2"} text-sm font-semibold transition-all ${
                    isAdminMode
                      ? isDark
                        ? "border-orange-500/20 bg-orange-500/10 text-orange-500"
                        : "border-orange-200 bg-orange-50 text-orange-600"
                      : isDark
                        ? "border-zinc-700 bg-zinc-800 text-zinc-300"
                        : "border-zinc-200 bg-white text-zinc-700 shadow-sm"
                  }`}
                >
                  {!isSidebarCollapsed && <span>{isAdminMode ? "Adminmodus" : "Ansattmodus"}</span>}
                  <div
                    className={`flex h-4 w-8 items-center rounded-full p-0.5 transition-colors ${
                      isAdminMode ? "bg-orange-500" : "bg-zinc-400"
                    }`}
                  >
                    <div
                      className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                        isAdminMode ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              </div>
            </TooltipProvider>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main
            className={`relative flex h-full flex-1 flex-col overflow-hidden transition-colors duration-300 ${
              isDark ? "bg-zinc-950" : "bg-[oklch(0.965_0.003_55)]"
            } print:block print:h-auto print:overflow-visible print:bg-white`}
          >
            {/* ACTION BAR */}
            <div
              className={`sticky top-0 z-10 flex h-16 flex-shrink-0 items-center justify-between border-b px-6 transition-colors duration-300 md:px-8 ${
                isDark
                  ? "border-zinc-900 bg-zinc-950/90"
                  : "border-[oklch(0.92_0.004_55)] bg-[oklch(0.98_0.003_55/0.92)] shadow-sm backdrop-blur-md"
              } print:hidden`}
            >
              <div
                className={`flex items-center gap-2.5 text-sm ${
                  isDark ? "text-zinc-400" : "text-[oklch(0.52_0.02_50)]"
                }`}
              >
                <span
                  className={`cursor-pointer transition-colors ${
                    isDark ? "hover:text-zinc-200" : "hover:text-[oklch(0.25_0.015_45)]"
                  }`}
                >
                  {isAdminMode ? "Drift" : "Arbeidsrom"}
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span
                  className={`rounded-md border px-2.5 py-1 font-semibold capitalize shadow-sm ${
                    isDark
                      ? "border-zinc-800 bg-zinc-900 text-zinc-100"
                      : "border-[oklch(0.88_0.015_50)] bg-[oklch(0.95_0.004_55)] text-[oklch(0.22_0.02_45)]"
                  }`}
                >
                  {(
                    {
                      schedule: "Vaktplan",
                      people: "Ansatte",
                      reports: "Rapporter",
                      operations: "Drift",
                      governance: "HMS",
                      season: "Sesong",
                      organization: "Organisasjon",
                      settings: "Innstillinger",
                      help: "Hjelp",
                      chat: "Chat",
                      ai: "Mr. Botsson",
                      "onboarding-assistant": "Onboarding-assistent",
                      "my-schedule": "Min vaktplan",
                      "my-training": "Min opplæring",
                      "my-cv": "Min profil",
                      "my-salary": "Min lønn",
                    } as Record<string, string>
                  )[pathname.split("/").pop() ?? ""] ?? "Oversikt"}
                </span>
              </div>

              <div className="flex items-center gap-5">
                {/* Schedule page specific controls */}
                {pathname === "/dashboard/schedule" && isAdminMode && (
                  <>
                    {/* LAYOUT TOGGLE */}
                    <div
                      className={`hidden rounded-xl border p-1 shadow-sm md:flex ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-zinc-100"} mr-2`}
                    >
                      <button
                        onClick={() => setScheduleLayout("daily")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${scheduleLayout === "daily" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
                      >
                        Uke
                      </button>
                      <button
                        onClick={() => setScheduleLayout("weekly")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${scheduleLayout === "weekly" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
                      >
                        Rullerende
                      </button>
                      <button
                        onClick={() => setScheduleLayout("monthly")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${scheduleLayout === "monthly" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
                      >
                        Måned
                      </button>
                      <button
                        onClick={() => setScheduleLayout("list")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${scheduleLayout === "list" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
                      >
                        Vaktliste
                      </button>
                    </div>

                    {/* PERIOD COUNT SELECTOR (weekly only) */}
                    {scheduleLayout === "weekly" && (
                      <div
                        className={`hidden items-center gap-0.5 rounded-xl border p-1 shadow-sm md:flex ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-zinc-100"} mr-2`}
                      >
                        {[
                          { label: "3d", count: 3 },
                          { label: "1u", count: 7 },
                          { label: "2u", count: 10 },
                          { label: "3u", count: 14 },
                        ].map(({ label, count }) => (
                          <button
                            key={label}
                            onClick={() => setWeeklyPeriodCount(count)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums transition-all ${weeklyPeriodCount === count ? (isDark ? "bg-zinc-800 text-white shadow-sm" : "bg-white text-zinc-900 shadow-sm") : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* DATE NAVIGATION */}
                    <div
                      className={`flex items-center gap-2 rounded-xl border p-1 pr-3 ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-zinc-100"} mr-2`}
                    >
                      <button
                        onClick={() => setScheduleDateOffset((prev) => prev - 1)}
                        className={`rounded-md p-1.5 transition-colors ${isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"}`}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span
                        className={`text-[13px] font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
                      >
                        {(() => {
                          const baseWeek = 52;
                          if (scheduleLayout === "daily") {
                            const w = baseWeek + scheduleDateOffset;
                            return `Uke ${w}, 2026`;
                          }
                          if (scheduleLayout === "weekly") {
                            return scheduleDateOffset === 0
                              ? "Aktiv syklus"
                              : `Syklus ${scheduleDateOffset > 0 ? "+" : ""}${scheduleDateOffset}`;
                          }
                          const months = [
                            "Januar",
                            "Februar",
                            "Mars",
                            "April",
                            "Mai",
                            "Juni",
                            "Juli",
                            "August",
                            "September",
                            "Oktober",
                            "November",
                            "Desember",
                          ];
                          const monthIdx = (((11 + scheduleDateOffset) % 12) + 12) % 12;
                          return `${months[monthIdx]} 2026`;
                        })()}
                      </span>
                      {scheduleDateOffset !== 0 && (
                        <button
                          onClick={() => setScheduleDateOffset(0)}
                          className="rounded-md px-2 py-0.5 text-[10px] font-bold text-orange-400 transition-colors hover:bg-orange-500/10"
                        >
                          I dag
                        </button>
                      )}
                      <button
                        onClick={() => setScheduleDateOffset((prev) => prev + 1)}
                        className={`rounded-md p-1.5 transition-colors ${isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"}`}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={onPublishAllStable}
                      disabled={scheduleDraftCountDisplay === 0}
                      className={`mr-2 hidden rounded-lg px-4 py-1.5 text-[13px] font-bold text-white shadow-sm transition-all sm:block ${
                        scheduleDraftCountDisplay > 0
                          ? "bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500"
                          : "cursor-not-allowed bg-zinc-700 opacity-50"
                      }`}
                    >
                      Publiser ({scheduleDraftCountDisplay})
                    </button>
                  </>
                )}

                {/* Tactical/Strategic Switcher (Only on Dashboard) */}
                {isDashboardPage && isAdminMode && (
                  <div
                    className={`hidden rounded-xl border p-1 shadow-sm md:flex ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-zinc-100"} mr-2`}
                  >
                    <button
                      onClick={() => setAdminView("tactical")}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        adminView === "tactical"
                          ? isDark
                            ? "bg-zinc-800 text-white shadow-sm"
                            : "bg-white text-zinc-900 shadow-sm"
                          : isDark
                            ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                            : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700"
                      }`}
                    >
                      Taktisk
                    </button>
                    <button
                      onClick={() => setAdminView("strategic")}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        adminView === "strategic"
                          ? isDark
                            ? "bg-zinc-800 text-white shadow-sm"
                            : "bg-white text-zinc-900 shadow-sm"
                          : isDark
                            ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                            : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700"
                      }`}
                    >
                      Strategisk
                    </button>
                    <button
                      onClick={() => setAdminView("reconciliation")}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        adminView === "reconciliation"
                          ? isDark
                            ? "bg-zinc-800 text-white shadow-sm"
                            : "bg-white text-zinc-900 shadow-sm"
                          : isDark
                            ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                            : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700"
                      }`}
                    >
                      Avstemming
                    </button>
                    <button
                      onClick={() => setAdminView("activity")}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        adminView === "activity"
                          ? isDark
                            ? "bg-zinc-800 text-white shadow-sm"
                            : "bg-white text-zinc-900 shadow-sm"
                          : isDark
                            ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                            : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700"
                      }`}
                    >
                      Aktivitet
                    </button>
                    <button
                      onClick={() => setAdminView("guardian")}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        adminView === "guardian"
                          ? isDark
                            ? "bg-zinc-800 text-white shadow-sm"
                            : "bg-white text-zinc-900 shadow-sm"
                          : isDark
                            ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                            : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700"
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Vakt
                    </button>
                  </div>
                )}

                {/* Standard Search Bar, hidden on schedule page where we want more room */}
                {pathname !== "/dashboard/schedule" && (
                  <div className="group relative">
                    <Search
                      className={`absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transition-colors ${
                        isDark
                          ? "text-zinc-500 group-focus-within:text-orange-500"
                          : "text-zinc-400 group-focus-within:text-orange-600"
                      }`}
                    />
                    <input
                      type="text"
                      placeholder="Søk i drift..."
                      className={`w-64 rounded-lg border py-2 pr-4 pl-9 text-sm shadow-sm transition-all focus:ring-1 focus:outline-none ${
                        isDark
                          ? "border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 hover:bg-zinc-800/80 focus:border-orange-500/50 focus:ring-orange-500/50"
                          : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 hover:bg-zinc-50 focus:border-orange-500/50 focus:ring-orange-500/50"
                      }`}
                    />
                  </div>
                )}
              </div>
            </div>

            <DashboardContext.Provider value={dashboardContextValue}>
              <div className="scroll-overlay flex min-h-0 flex-1 flex-col p-6 md:p-8 print:block print:h-auto print:overflow-visible print:p-0">
                {isAdminMode && isDashboardPage && (
                  <>
                    <div className="mb-4 flex-shrink-0">
                      <ActionStrip isDark={isDark} />
                    </div>
                  </>
                )}
                {children}
              </div>
            </DashboardContext.Provider>
          </main>
        </div>

        {/* Floating Voice Assistant removed and moved to header */}
      </div>
    </VoiceToolsProvider>
  );
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
  badge?: string;
  isDark?: boolean;
  ai?: boolean;
  isCollapsed?: boolean;
  onClick?: () => void;
  useButton?: boolean;
}

function NavItem({
  icon: Icon,
  label,
  href,
  active,
  badge,
  isDark,
  ai,
  isCollapsed,
  onClick,
  useButton,
}: NavItemProps) {
  const baseClassName = `group flex items-center rounded-xl transition-all ${
    isCollapsed ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2.5"
  } ${
    active
      ? isDark
        ? "border border-zinc-700/50 bg-zinc-800/80 font-semibold text-white"
        : "border border-[oklch(0.87_0.015_45/0.5)] bg-[oklch(0.93_0.006_52)] font-bold text-[oklch(0.22_0.02_45)] shadow-sm"
      : isDark
        ? "border border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-200"
        : "border border-transparent text-[oklch(0.50_0.02_50)] hover:bg-[oklch(0.95_0.005_55)] hover:text-[oklch(0.25_0.015_45)]"
  }`;

  const inner = (
    <>
      <div className={`flex items-center ${isCollapsed ? "" : "gap-3"}`}>
        <Icon
          className={`h-[18px] w-[18px] shrink-0 transition-colors ${
            ai
              ? "text-indigo-500 group-hover:text-indigo-400"
              : active
                ? isDark
                  ? "text-zinc-200"
                  : "text-[oklch(0.55_0.18_42)]"
                : isDark
                  ? "text-zinc-500 group-hover:text-zinc-400"
                  : "text-[oklch(0.55_0.03_50)] group-hover:text-[oklch(0.38_0.05_45)]"
          }`}
        />
        {!isCollapsed && (
          <span className={`text-[13px] tracking-wide ${active ? "font-bold" : "font-medium"}`}>
            {label}
          </span>
        )}
      </div>
      {!isCollapsed && active && !badge && (
        <div
          className={`h-1.5 w-1.5 rounded-full ${
            isDark
              ? "bg-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.8)]"
              : "bg-orange-500 shadow-[0_0_6px_rgba(234,88,12,0.4)]"
          }`}
        />
      )}
      {isCollapsed && badge && (
        <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-orange-500" />
      )}
      {!isCollapsed && badge && (
        <span
          className={`rounded border px-2 py-0.5 text-[9px] font-bold ${
            isDark
              ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
              : "border-orange-200 bg-orange-50 text-orange-600"
          }`}
        >
          {badge}
        </span>
      )}
    </>
  );

  const content = useButton ? (
    <button type="button" onClick={onClick} className={baseClassName}>
      {inner}
    </button>
  ) : (
    <Link href={href} prefetch={false} onClick={onClick} className={baseClassName}>
      {inner}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-semibold">
          {label}
          {badge ? ` (${badge})` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export default DashboardShell;
