"use client";

import { useState, useRef, useEffect, useCallback, createContext, useMemo } from "react";
import dynamic from "next/dynamic";
import type { MissionId } from "@smartout/ai/missions";
import { useWorkspaceOptional } from "@/lib/workspace-context";

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
  workspaceData: null as { workspace_id: string; company_id: string; name: string } | null,
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
import { VoiceToolsProvider, useVoiceTools } from "@/components/voice-tools-context";
// Popover imports removed — location selector moved to PlannerCommandBar
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const LazyVoiceAssistant = dynamic(() => import("@/components/voice-assistant"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] w-[350px] rounded-2xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-xl" />
  ),
});

/** Demo location options for the schedule page location selector */
// LOCATIONS moved to schedule PlannerCommandBar

function VoiceAssistantWithTools({
  isOpen,
  missionId,
  onClose,
}: {
  isOpen: boolean;
  missionId: MissionId;
  onClose: () => void;
}) {
  const { clientTools } = useVoiceTools();
  if (!isOpen) return null;
  return (
    <div className="pointer-events-auto absolute top-full right-0 z-50 mt-4 origin-top-right shadow-2xl">
      <LazyVoiceAssistant
        autoStart
        missionId={missionId}
        clientTools={clientTools}
        onClose={onClose}
      />
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
  const [isAdminMode, setIsAdminMode] = useState(true);
  const [adminView, setAdminView] = useState<AdminViewType>("tactical");
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
          isDark ? "dark bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
        } print:block print:h-auto print:overflow-visible`}
      >
        {/* TOP CONTEXT BAR */}
        <header
          className={`relative z-30 flex h-14 items-center justify-between px-6 transition-colors duration-300 ${
            isDark ? "border-b border-zinc-800 bg-[#0a0a0c]" : "bg-zinc-900 text-white shadow-md"
          } print:hidden`}
        >
          <div className="flex items-center gap-6">
            <div
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition-colors ${
                isDark ? "bg-zinc-900 hover:bg-zinc-800" : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              <Building2 className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold text-white">
                {workspaceData?.name ?? "Workspace"}
              </span>
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-zinc-400" />
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-400">Season:</span>
              <span className="font-semibold text-white">Vinter 2026</span>
              <div className="ml-2 flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold tracking-wider uppercase">Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDark(!isDark)}
              className={`rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Header Voice Assistant (lazy-loaded to avoid shell bundle bloat) */}
            <div className="relative">
              <button
                onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                className={`rounded-md p-1.5 transition-colors ${isAssistantOpen ? "bg-orange-500/20 text-orange-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
              >
                <Mic className="h-4 w-4" />
              </button>

              <VoiceAssistantWithTools
                isOpen={isAssistantOpen}
                missionId={resolveMissionForRoute(pathname)}
                onClose={() => setIsAssistantOpen(false)}
              />
            </div>

            <UserMenu isDark={isDark} />
          </div>
        </header>

        <ContractPendingBanner />

        <div className="relative flex flex-1 overflow-hidden">
          {/* LEFT SIDEBAR NAVIGATION */}
          <aside
            className={`z-20 flex flex-col overflow-hidden border-r transition-[width] duration-200 ${
              isSidebarCollapsed ? "w-16" : "w-64"
            } ${
              isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white shadow-sm"
            } print:hidden`}
          >
            <TooltipProvider delayDuration={0}>
              {/* Sidebar collapse toggle — top */}
              <div
                className={`flex items-center border-b ${isSidebarCollapsed ? "justify-center px-2" : "justify-end px-4"} py-3 ${
                  isDark ? "border-zinc-800" : "border-zinc-200"
                }`}
              >
                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className={`rounded-lg p-1.5 transition-colors ${
                    isDark
                      ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                      : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
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
                className={`hide-scrollbar relative flex-1 space-y-1 overflow-y-auto py-4 ${isSidebarCollapsed ? "px-2" : "px-4"}`}
              >
                {isAdminMode ? (
                  <>
                    {!isSidebarCollapsed && (
                      <div
                        className={`mt-2 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                          isDark ? "text-zinc-500" : "text-zinc-400"
                        }`}
                      >
                        Management
                      </div>
                    )}
                    <NavItem
                      href="/dashboard"
                      icon={LayoutDashboard}
                      label="Dashboard"
                      isDark={isDark}
                      active={isActive("/dashboard")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/people"
                      icon={Users}
                      label="People"
                      isDark={isDark}
                      badge="2 Req"
                      active={isActive("/dashboard/people")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/schedule"
                      icon={CalendarDays}
                      label="Schedule"
                      isDark={isDark}
                      active={isActive("/dashboard/schedule")}
                      isCollapsed={isSidebarCollapsed}
                    />

                    {!isSidebarCollapsed && (
                      <div
                        className={`mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                          isDark ? "text-zinc-500" : "text-zinc-400"
                        }`}
                      >
                        Operations
                      </div>
                    )}
                    {isSidebarCollapsed && <div className="mt-4" />}
                    <NavItem
                      href="/dashboard/operations"
                      icon={Activity}
                      label="Live Operations"
                      isDark={isDark}
                      active={isActive("/dashboard/operations")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/reports"
                      icon={TrendingUp}
                      label="Reports"
                      isDark={isDark}
                      active={isActive("/dashboard/reports")}
                      isCollapsed={isSidebarCollapsed}
                    />

                    {!isSidebarCollapsed && (
                      <div
                        className={`mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                          isDark ? "text-zinc-500" : "text-zinc-400"
                        }`}
                      >
                        Administration
                      </div>
                    )}
                    {isSidebarCollapsed && <div className="mt-4" />}
                    <NavItem
                      href="/dashboard/governance"
                      icon={ShieldCheck}
                      label="Governance"
                      isDark={isDark}
                      active={isActive("/dashboard/governance")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/season"
                      icon={Gamepad2}
                      label="Season"
                      isDark={isDark}
                      active={isActive("/dashboard/season")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/organization"
                      icon={Building2}
                      label="Organization"
                      isDark={isDark}
                      active={isActive("/dashboard/organization")}
                      isCollapsed={isSidebarCollapsed}
                    />
                  </>
                ) : (
                  <>
                    {!isSidebarCollapsed && (
                      <div
                        className={`mt-2 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                          isDark ? "text-zinc-500" : "text-zinc-400"
                        }`}
                      >
                        My Workspace
                      </div>
                    )}
                    <NavItem
                      href="/dashboard"
                      icon={LayoutDashboard}
                      label="Dashboard"
                      isDark={isDark}
                      active={isActive("/dashboard")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/my-schedule"
                      icon={Calendar}
                      label="My Schedule"
                      isDark={isDark}
                      active={isActive("/dashboard/my-schedule")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/my-training"
                      icon={GraduationCap}
                      label="My Training"
                      isDark={isDark}
                      badge="1 Due"
                      active={isActive("/dashboard/my-training")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/my-cv"
                      icon={FileText}
                      label="My CV & Profile"
                      isDark={isDark}
                      active={isActive("/dashboard/my-cv")}
                      isCollapsed={isSidebarCollapsed}
                    />
                    <NavItem
                      href="/dashboard/my-salary"
                      icon={Banknote}
                      label="My Salary"
                      isDark={isDark}
                      active={isActive("/dashboard/my-salary")}
                      isCollapsed={isSidebarCollapsed}
                    />
                  </>
                )}

                {!isSidebarCollapsed && (
                  <div
                    className={`mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${
                      isDark ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    Communication
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
                  label="Onboarding Copilot"
                  isDark={isDark}
                  ai
                  active={isActive("/dashboard/onboarding-assistant")}
                  isCollapsed={isSidebarCollapsed}
                />

                <div className="mt-8 space-y-1 pt-4">
                  <NavItem
                    href="/dashboard/settings"
                    icon={Settings}
                    label="Settings"
                    isDark={isDark}
                    active={isActive("/dashboard/settings")}
                    isCollapsed={isSidebarCollapsed}
                  />
                  <NavItem
                    href="/dashboard/help"
                    icon={HelpCircle}
                    label="Help"
                    isDark={isDark}
                    active={isActive("/dashboard/help")}
                    isCollapsed={isSidebarCollapsed}
                  />
                </div>
              </nav>

              {/* Sidebar bottom controls */}
              <div
                className={`border-t ${isSidebarCollapsed ? "p-2" : "p-4"} ${
                  isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-zinc-50/50"
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
                  {!isSidebarCollapsed && (
                    <span>{isAdminMode ? "Admin Mode" : "Employee Mode"}</span>
                  )}
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
              isDark ? "bg-zinc-950" : "bg-zinc-50"
            } print:block print:h-auto print:overflow-visible print:bg-white`}
          >
            {/* ACTION BAR */}
            <div
              className={`sticky top-0 z-10 flex h-16 flex-shrink-0 items-center justify-between border-b px-6 transition-colors duration-300 md:px-8 ${
                isDark
                  ? "border-zinc-900 bg-zinc-950/90"
                  : "border-zinc-200 bg-white/90 shadow-sm backdrop-blur-md"
              } print:hidden`}
            >
              <div
                className={`flex items-center gap-2.5 text-sm ${
                  isDark ? "text-zinc-400" : "text-zinc-500"
                }`}
              >
                <span
                  className={`cursor-pointer transition-colors ${
                    isDark ? "hover:text-zinc-200" : "hover:text-zinc-900"
                  }`}
                >
                  {isAdminMode ? "Operations" : "Workspace"}
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span
                  className={`rounded-md border px-2.5 py-1 font-semibold capitalize shadow-sm ${
                    isDark
                      ? "border-zinc-800 bg-zinc-900 text-zinc-100"
                      : "border-zinc-200 bg-white text-zinc-900"
                  }`}
                >
                  {pathname.split("/").pop() || "Dashboard"}
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
                      Tactical
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
                      Strategic
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
                      Guardian
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
                      placeholder="Search operations..."
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
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 md:p-8 print:block print:h-auto print:overflow-visible print:p-0">
                {isAdminMode && isDashboardPage && (
                  <div className="mb-4 flex-shrink-0">
                    <ActionStrip isDark={isDark} />
                  </div>
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
}: NavItemProps) {
  const content = (
    <Link
      href={href}
      className={`group flex items-center rounded-xl transition-all ${
        isCollapsed ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2.5"
      } ${
        active
          ? isDark
            ? "border border-zinc-700/50 bg-zinc-800/80 font-semibold text-white"
            : "border border-zinc-200/50 bg-zinc-100 font-bold text-zinc-900"
          : isDark
            ? "border border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-200"
            : "border border-transparent text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      <div className={`flex items-center ${isCollapsed ? "" : "gap-3"}`}>
        <Icon
          className={`h-[18px] w-[18px] shrink-0 transition-colors ${
            ai
              ? "text-indigo-500 group-hover:text-indigo-400"
              : active
                ? isDark
                  ? "text-zinc-200"
                  : "text-zinc-800"
                : isDark
                  ? "text-zinc-500 group-hover:text-zinc-400"
                  : "text-zinc-400 group-hover:text-zinc-600"
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
              : "bg-orange-500 shadow-sm"
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
