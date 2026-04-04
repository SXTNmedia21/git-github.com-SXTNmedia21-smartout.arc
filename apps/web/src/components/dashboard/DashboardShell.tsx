"use client";

import { useState, useRef, useEffect, useCallback, createContext, useMemo } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import type { MissionId } from "@smartout/ai/missions";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { createClient } from "@smartout/supabase/client";
import { useCascadeTaskCount } from "@/app/dashboard/_hooks/use-cascade-task-count";
import { EntityDrawerProvider } from "./entity-drawer/EntityDrawerContext";
import { EntityDrawer } from "./entity-drawer/EntityDrawer";
import { ChatPanelProvider } from "./ChatPanel";

const GlobalCallAlert = dynamic(
  () => import("./GlobalCallAlert").then((m) => ({ default: m.GlobalCallAlert })),
  { ssr: false },
);

const VoiceAssistant = dynamic(() => import("@/components/voice-assistant"), {
  ssr: false,
});

const GlobalSearchPalette = dynamic(
  () =>
    import("@/components/dashboard/GlobalSearchPalette").then((m) => ({
      default: m.GlobalSearchPalette,
    })),
  { ssr: false },
);

const EmmaOverlay = dynamic(
  () =>
    import("@/app/Botsson/_components/EmmaOverlay").then((m) => ({
      default: m.EmmaOverlay,
    })),
  { ssr: false },
);

const NotificationBell = dynamic(
  () => import("./NotificationBell").then((m) => ({ default: m.NotificationBell })),
  { ssr: false },
);

const ROUTE_MISSION_MAP: Record<string, MissionId> = {
  "/dashboard": "mr-botsson",
  "/dashboard/schedule": "shift-assistant",
  "/dashboard/hms": "haccp-inspector",
  "/dashboard/operations": "mr-botsson",
  "/dashboard/komm": "mr-botsson",
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
  "/dashboard/reconciliation": "mr-botsson",
};

function resolveMissionForRoute(pathname: string): MissionId {
  const direct = ROUTE_MISSION_MAP[pathname];
  if (direct) return direct;
  const match = Object.keys(ROUTE_MISSION_MAP)
    .filter((prefix) => pathname.startsWith(prefix) && prefix !== "/dashboard")
    .sort((a, b) => b.length - a.length)[0];
  return (match !== undefined ? ROUTE_MISSION_MAP[match] : undefined) ?? "mr-botsson";
}

export type AdminViewType = "tactical" | "strategic" | "reconciliation" | "activity" | "todo";
export type ScheduleLayoutMode = "daily" | "weekly" | "monthly" | "list" | "grid";
export type ScheduleViewMode = "ansatt" | "jobb" | "team" | "lokasjon";
type VoiceSessionContext = {
  page: string;
  story: string;
  workingElements: string[];
  availableInputs: string[];
};

type WalkthroughNoticeTone = "info" | "success" | "warning";

type WalkthroughNotice = {
  id: number;
  title: string;
  message: string;
  tone: WalkthroughNoticeTone;
};

function buildVoiceSessionContext(pathname: string, adminView: AdminViewType): VoiceSessionContext {
  if (pathname === "/dashboard") {
    if (adminView === "todo") {
      return {
        page: "dashboard.todo",
        story:
          "Du er i oppgaveoversikten. Forklar hva som mangler i virksomheten, prioriter etter viktighet, og veiled lederen til neste steg.",
        workingElements: [
          "Cascade task groups",
          "Progress bars per domain",
          "Urgency-sorted task cards",
          "Completion tracking",
        ],
        availableInputs: [
          "Cascade task surface data",
          "Workspace context",
          "Current admin view (todo)",
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
  activeDepartment: "Alle avdelinger",
  setActiveDepartment: (_val: string) => {
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
  isSetupMode: false,
  isSetupLoading: false,
  dismissSetup: () => {},
});
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  Radio,
  Bot,
  HelpCircle,
  Building2,
  GraduationCap,
  Banknote,
  FileText,
  CalendarDays,
  ListChecks,
  ShieldCheck,
  Mic,
  Bell,
  CheckCircle2,
  LoaderCircle,
  Sparkles,
  BookOpen,
  Globe,
  Receipt,
} from "lucide-react";

import { ContractPendingBanner } from "./ContractPendingBanner";
import { ActionStrip } from "@/components/dashboard/ActionStrip";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { VoiceToolsProvider, useVoiceTools } from "@/components/voice-tools-context";
// Popover imports removed — location selector moved to PlannerCommandBar
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { format, getISOWeek, getISOWeekYear } from "date-fns";
import { nb } from "date-fns/locale";
import { DocumentModeShell } from "@/app/dashboard/_components/document-mode/document-mode-shell";
import { DocumentModeSidebar } from "@/app/dashboard/_components/document-mode/document-mode-sidebar";
import { DocumentModeProvider } from "@/app/dashboard/_components/document-mode/document-mode-context";

// Department filter state is managed via activeDepartment in context

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

export function DashboardShell({
  children,
  profileId = null,
}: {
  children: React.ReactNode;
  profileId?: string | null;
}) {
  const [isDark, setIsDarkRaw] = useState(false); // SSR-safe default
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("smartout-theme");
    if (stored === "dark") setIsDarkRaw(true);
    setThemeReady(true);
  }, []);
  const setIsDark = useCallback((val: boolean) => {
    setIsDarkRaw(val);
    localStorage.setItem("smartout-theme", val ? "dark" : "light");
  }, []);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(true);
  const [adminView, setAdminView] = useState<AdminViewType>("tactical");
  const [scheduleLayout, setScheduleLayout] = useState<ScheduleLayoutMode>("daily");
  const [scheduleView, setScheduleView] = useState<ScheduleViewMode>("ansatt");
  const [activeDepartment, setActiveDepartment] = useState("Alle avdelinger");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [weeklyPeriodCount, setWeeklyPeriodCount] = useState(4);
  const [scheduleDateOffset, setScheduleDateOffset] = useState(0);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const onPublishAllRef = useRef<(() => void) | null>(null);
  const scheduleDraftCountRef = useRef(0);
  const [scheduleDraftCountDisplay, setScheduleDraftCountDisplay] = useState(0);
  const [scheduleCompactMode, setScheduleCompactMode] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [voiceSessionOverride, setVoiceSessionOverride] = useState<VoiceSessionContext | null>(
    null,
  );
  const [autoplayUiState, setAutoplayUiState] = useState<{
    isRunning: boolean;
    currentStepLabel: string;
    completedCount: number;
    totalCount: number;
    isSettling: boolean;
    notices: WalkthroughNotice[];
  }>({
    isRunning: false,
    currentStepLabel: "",
    completedCount: 0,
    totalCount: 0,
    isSettling: false,
    notices: [],
  });
  const [setupDismissed, setSetupDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("setup_dismissed") === "1";
  });
  const dismissSetup = useCallback(() => {
    setSetupDismissed(true);
    sessionStorage.setItem("setup_dismissed", "1");
  }, []);
  const [isDocumentMode, setIsDocumentMode] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAutoplayMode =
    searchParams?.get("autoplay") === "1" || searchParams?.get("showcase") === "1";
  const hasShowcaseQuery = searchParams?.get("showcase") === "1";
  const autoplayStartedRef = useRef(false);
  const noticeIdRef = useRef(0);
  const workspaceCtx = useWorkspaceOptional();
  // Derive setup mode from the DB flag rather than cascade task count.
  // Defaults to true (no redirect) when workspace context is not yet available.
  const setupGuideCompleted = workspaceCtx?.workspace.setup_guide_completed ?? true;
  const isSetupMode = !setupGuideCompleted && !setupDismissed;
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

  // Live inbound join request count for the Ansatte nav badge
  const [inboundRequestCount, setInboundRequestCount] = useState(0);
  useEffect(() => {
    if (!workspaceData?.workspace_id) return;
    const supabase = createClient();

    async function fetchCount() {
      const { count } = await supabase
        .from("invitation")
        .select("invitation_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceData!.workspace_id)
        .eq("direction", "inbound")
        .eq("status", "pending");
      setInboundRequestCount(count ?? 0);
    }

    void fetchCount();

    // Subscribe to realtime changes on invitation table for this workspace
    const channel = supabase
      .channel("inbound-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invitation",
          filter: `workspace_id=eq.${workspaceData.workspace_id}`,
        },
        () => void fetchCount(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceData?.workspace_id]);

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
      activeDepartment,
      setActiveDepartment,
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
      isSetupMode,
      // isSetupLoading is no longer used — setup is now flag-driven, not
      // cascade-task-driven. Kept as false for context shape compatibility.
      isSetupLoading: false,
      dismissSetup,
    }),
    [
      isAdminMode,
      isDark,
      adminView,
      scheduleLayout,
      scheduleView,
      activeDepartment,
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
      isSetupMode,
      dismissSetup,
    ],
  );

  const isDashboardPage = pathname === "/dashboard";

  const isSchedulePage = pathname?.startsWith("/dashboard/schedule");

  /**
   * Pushes a short-lived walkthrough notification card.
   * Why: gives visual checkpoints while autoplay is running.
   */
  const pushWalkthroughNotice = useCallback(
    (title: string, message: string, tone: WalkthroughNoticeTone = "info") => {
      const nextId = noticeIdRef.current + 1;
      noticeIdRef.current = nextId;

      setAutoplayUiState((previous) => ({
        ...previous,
        notices: [...previous.notices, { id: nextId, title, message, tone }].slice(-3),
      }));

      window.setTimeout(() => {
        setAutoplayUiState((previous) => ({
          ...previous,
          notices: previous.notices.filter((notice) => notice.id !== nextId),
        }));
      }, 3200);
    },
    [],
  );

  /**
   * Runs a deterministic 20-step walkthrough for demos and manual speed smoke-tests.
   * Why: enables one-click showcase automation from admin health.
   */
  const runAutoplayWalkthrough = useCallback(async () => {
    if (autoplayStartedRef.current) return;
    autoplayStartedRef.current = true;

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const emitWalkthroughEvent = (eventName: string, payload: Record<string, unknown>) => {
      window.dispatchEvent(
        new CustomEvent(`smartout:walkthrough:${eventName}`, { detail: payload }),
      );
      console.info(`[dashboard-autoplay] ${eventName}`, payload);
    };

    /**
     * Waits until UI has had a quiet period (no DOM mutations and no running animations).
     * Why: makes autoplay deterministic and avoids clicking while transitions are still active.
     */
    const waitForUiSettled = async (timeoutMs = 5000, quietWindowMs = 320) => {
      const started = Date.now();
      let lastMutationAt = Date.now();
      let rafTime = Date.now();
      const observer = new MutationObserver(() => {
        lastMutationAt = Date.now();
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });

      try {
        while (Date.now() - started < timeoutMs) {
          await sleep(80);
          // Two RAFs to allow layout/paint work to flush.
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          rafTime = Date.now();

          const isQuietEnough = rafTime - lastMutationAt >= quietWindowMs;
          const hasRunningAnimation = document
            .getAnimations()
            .some((animation) => animation.playState === "running");

          if (isQuietEnough && !hasRunningAnimation) {
            return;
          }
        }
      } finally {
        observer.disconnect();
      }
    };

    const waitForPathname = async (expectedPathname: string, timeoutMs = 5000) => {
      const started = Date.now();
      while (window.location.pathname !== expectedPathname && Date.now() - started < timeoutMs) {
        await sleep(120);
      }
    };

    const runStep = async (step: {
      id: string;
      label: string;
      selector: string;
      waitMs?: number;
      expectedPathname?: string;
    }) => {
      const stepStarted = performance.now();
      const element = document.querySelector(step.selector) as HTMLElement | null;
      if (!element) {
        emitWalkthroughEvent("step-skipped", {
          id: step.id,
          selector: step.selector,
          reason: "selector_not_found",
        });
        return;
      }

      emitWalkthroughEvent("step-start", {
        id: step.id,
        selector: step.selector,
      });
      setAutoplayUiState((previous) => ({
        ...previous,
        currentStepLabel: step.label,
        isSettling: true,
      }));
      element.click();

      if (step.expectedPathname) {
        await waitForPathname(step.expectedPathname);
      }
      await waitForUiSettled();
      if (step.waitMs !== undefined && step.waitMs > 0) {
        await sleep(step.waitMs);
      }
      setAutoplayUiState((previous) => ({
        ...previous,
        completedCount: Math.min(previous.completedCount + 1, previous.totalCount),
        isSettling: false,
      }));

      emitWalkthroughEvent("step-complete", {
        id: step.id,
        selector: step.selector,
        elapsed_ms: Math.round(performance.now() - stepStarted),
        pathname: window.location.pathname,
      });
    };

    // Slower walkthrough that visits all major sidebar menu sections.
    const steps: Array<{
      id: string;
      label: string;
      selector: string;
      waitMs?: number;
      expectedPathname?: string;
    }> = [
      {
        id: "showcase-toggle",
        label: "Activate showcase mode",
        selector: '[data-autoplay="top-demo-toggle"]',
        waitMs: 700,
      },
      {
        id: "dashboard-overview",
        label: "Open dashboard overview",
        selector: '[data-autoplay="nav-/dashboard"]',
        expectedPathname: "/dashboard",
      },
      {
        id: "people",
        label: "Open people",
        selector: '[data-autoplay="nav-/dashboard/people"]',
        expectedPathname: "/dashboard/people",
      },
      {
        id: "schedule",
        label: "Open schedule",
        selector: '[data-autoplay="nav-/dashboard/schedule"]',
        expectedPathname: "/dashboard/schedule",
        waitMs: 900,
      },
      {
        id: "layout-daily",
        label: "Switch to weekly layout",
        selector: '[data-autoplay="schedule-layout-daily"]',
        waitMs: 500,
      },
      {
        id: "layout-weekly",
        label: "Switch to rolling layout",
        selector: '[data-autoplay="schedule-layout-weekly"]',
        waitMs: 500,
      },
      {
        id: "layout-monthly",
        label: "Switch to monthly layout",
        selector: '[data-autoplay="schedule-layout-monthly"]',
        waitMs: 500,
      },
      {
        id: "layout-list",
        label: "Switch to shift list layout",
        selector: '[data-autoplay="schedule-layout-list"]',
        waitMs: 500,
      },
      {
        id: "date-prev",
        label: "Move period backward",
        selector: '[data-autoplay="schedule-date-prev"]',
        waitMs: 500,
      },
      {
        id: "date-next",
        label: "Move period forward",
        selector: '[data-autoplay="schedule-date-next"]',
        waitMs: 500,
      },
      {
        id: "date-today",
        label: "Return to active period",
        selector: '[data-autoplay="schedule-date-today"]',
        waitMs: 500,
      },
      {
        id: "operations",
        label: "Open operations",
        selector: '[data-autoplay="nav-/dashboard/operations"]',
        expectedPathname: "/dashboard/operations",
      },
      {
        id: "reports",
        label: "Open reports",
        selector: '[data-autoplay="nav-/dashboard/reports"]',
        expectedPathname: "/dashboard/reports",
      },
      {
        id: "hms",
        label: "Open HMS",
        selector: '[data-autoplay="nav-/dashboard/hms"]',
        expectedPathname: "/dashboard/hms",
      },
      {
        id: "season",
        label: "Open season planning",
        selector: '[data-autoplay="nav-/dashboard/season"]',
        expectedPathname: "/dashboard/season",
      },
      {
        id: "organization",
        label: "Open organization",
        selector: '[data-autoplay="nav-/dashboard/organization"]',
        expectedPathname: "/dashboard/organization",
      },
      {
        id: "komm",
        label: "Open team communication",
        selector: '[data-autoplay="nav-/dashboard/komm"]',
        expectedPathname: "/dashboard/komm",
      },
      {
        id: "ai",
        label: "Open Mr. Botsson",
        selector: '[data-autoplay="nav-/dashboard/ai"]',
        expectedPathname: "/dashboard/ai",
      },
      {
        id: "onboarding-assistant",
        label: "Open onboarding assistant",
        selector: '[data-autoplay="nav-/dashboard/onboarding-assistant"]',
        expectedPathname: "/dashboard/onboarding-assistant",
      },
      {
        id: "settings",
        label: "Open settings",
        selector: '[data-autoplay="nav-/dashboard/settings"]',
        expectedPathname: "/dashboard/settings",
      },
      {
        id: "help",
        label: "Open help center",
        selector: '[data-autoplay="nav-/dashboard/help"]',
        expectedPathname: "/dashboard/help",
      },
      {
        id: "switch-employee",
        label: "Switch to employee mode",
        selector: '[data-autoplay="admin-mode-toggle"]',
        waitMs: 700,
      },
      {
        id: "my-schedule",
        label: "Open my schedule",
        selector: '[data-autoplay="nav-/dashboard/my-schedule"]',
        expectedPathname: "/dashboard/my-schedule",
      },
      {
        id: "my-training",
        label: "Open my training",
        selector: '[data-autoplay="nav-/dashboard/my-training"]',
        expectedPathname: "/dashboard/my-training",
      },
      {
        id: "my-cv",
        label: "Open my profile",
        selector: '[data-autoplay="nav-/dashboard/my-cv"]',
        expectedPathname: "/dashboard/my-cv",
      },
      {
        id: "my-salary",
        label: "Open my salary",
        selector: '[data-autoplay="nav-/dashboard/my-salary"]',
        expectedPathname: "/dashboard/my-salary",
      },
      {
        id: "switch-admin",
        label: "Switch back to admin mode",
        selector: '[data-autoplay="admin-mode-toggle"]',
        waitMs: 700,
      },
      {
        id: "finish-dashboard",
        label: "Return to dashboard",
        selector: '[data-autoplay="nav-/dashboard"]',
        expectedPathname: "/dashboard",
      },
    ];

    const walkthroughStarted = performance.now();
    setAutoplayUiState((previous) => ({
      ...previous,
      isRunning: true,
      currentStepLabel: "Preparing walkthrough",
      completedCount: 0,
      totalCount: steps.length,
      isSettling: false,
    }));
    pushWalkthroughNotice(
      "Walkthrough started",
      "Running controlled step flow with settle checks.",
    );
    emitWalkthroughEvent("run-start", {
      step_count: steps.length,
      pathname: window.location.pathname,
    });

    for (const step of steps) {
      if (step.id === "schedule") {
        pushWalkthroughNotice(
          "Schedule loaded",
          "Checking layout transitions and date controls before continuing.",
        );
      }
      if (step.id === "switch-employee") {
        pushWalkthroughNotice("Mode switch", "Entering employee mode cards and routes.");
      }
      await runStep(step);
    }

    setAutoplayUiState((previous) => ({
      ...previous,
      isRunning: false,
      isSettling: false,
      currentStepLabel: "Walkthrough complete",
      completedCount: steps.length,
      totalCount: steps.length,
    }));
    pushWalkthroughNotice(
      "Walkthrough complete",
      "All menu and mode transitions finished.",
      "success",
    );
    emitWalkthroughEvent("run-complete", {
      step_count: steps.length,
      elapsed_ms: Math.round(performance.now() - walkthroughStarted),
      pathname: window.location.pathname,
    });
  }, [pushWalkthroughNotice]);

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

  useEffect(() => {
    if (!isAutoplayMode) return;
    void runAutoplayWalkthrough();
  }, [isAutoplayMode, runAutoplayWalkthrough]);

  useEffect(() => {
    const handleScheduleCall = (event: Event) => {
      const customEvent = event as CustomEvent<{ employeeName?: string; note?: string }>;
      const employeeName = customEvent.detail?.employeeName ?? "ansatt";
      const note = customEvent.detail?.note ?? "Kontakt ansatt om vaktendring.";
      setVoiceSessionOverride({
        page: "dashboard.schedule.call",
        story: `Du skal gjennomfore en operativ samtale med ${employeeName}. ${note}`,
        workingElements: ["Skiftkort", "Dagskontrollpanel", "Kontaktflyt"],
        availableInputs: ["Ansattnavn", "Skiftkontekst", "Dato", "Ansvarlig leder"],
      });
      setIsAssistantOpen(true);
    };

    window.addEventListener("smartout:schedule-call", handleScheduleCall);
    return () => {
      window.removeEventListener("smartout:schedule-call", handleScheduleCall);
    };
  }, []);

  useEffect(() => {
    if (!hasShowcaseQuery) return;
    setIsDemoMode(true);
  }, [hasShowcaseQuery]);

  /**
   * Locks document-level scrolling during autoplay showcase mode.
   * Why: keeps container pages viewport-fitted without browser scrollbars.
   */
  useEffect(() => {
    if (!isAutoplayMode) return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [isAutoplayMode]);

  const isSetupPage = pathname === "/dashboard/setup";

  // Redirect to setup guide on page load when setup is incomplete.
  // Only fires once per mount (not on in-app navigation) via ref guard.
  // Uses window.location.href for hard navigation to force server layout re-fetch.
  const setupRedirectFired = useRef(false);
  useEffect(() => {
    if (setupRedirectFired.current) return;
    if (isSetupPage || setupGuideCompleted || setupDismissed) return;
    setupRedirectFired.current = true;
    window.location.href = "/dashboard/setup";
  }, [isSetupPage, setupGuideCompleted, setupDismissed]);

  // Helper to determine if a link is active
  const isActive = (path: string) => {
    // Exact match for dashboard root, otherwise starts with
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(path);
  };

  // /dashboard/setup renders full-screen (no header/menu) — kept as-is.
  // Routing is decoupled from cascade tasks: setup redirect is now driven by
  // the workspace.setup_guide_completed flag (see useEffect above).
  if (isSetupPage) {
    return (
      <DashboardContext.Provider value={dashboardContextValue}>
        <div
          className={`flex h-screen flex-col overflow-hidden font-sans transition-colors duration-300 selection:bg-orange-500/30 ${
            isDark ? "dark" : ""
          } bg-background text-foreground`}
        >
          {children}
        </div>
      </DashboardContext.Provider>
    );
  }

  return (
    <DocumentModeProvider>
      <VoiceToolsProvider>
        <EntityDrawerProvider>
          <ChatPanelProvider>
            <div
              style={themeReady ? undefined : { opacity: 0 }}
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
                    <span
                      className={isDark ? "text-muted-foreground" : "text-[oklch(0.52_0.02_50)]"}
                    >
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
                    data-autoplay="top-demo-toggle"
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
                    onClick={() => setIsDocumentMode(!isDocumentMode)}
                    className={`rounded-md p-1.5 transition-colors ${
                      isDocumentMode
                        ? "bg-orange-500/20 text-orange-400"
                        : isDark
                          ? "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                          : "text-[oklch(0.48_0.02_50)] hover:bg-[oklch(0.93_0.005_55)] hover:text-[oklch(0.25_0.01_50)]"
                    }`}
                    title={isDocumentMode ? "Tilbake til drift" : "Dokumentmodus"}
                  >
                    <BookOpen className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => setIsDark(!isDark)}
                    data-autoplay="top-theme-toggle"
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
                      onClick={() => {
                        setVoiceSessionOverride(null);
                        setIsAssistantOpen(!isAssistantOpen);
                      }}
                      data-autoplay="top-mic-toggle"
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
                      sessionContext={
                        voiceSessionOverride ?? buildVoiceSessionContext(pathname, adminView)
                      }
                      onClose={() => {
                        setIsAssistantOpen(false);
                        setVoiceSessionOverride(null);
                      }}
                    />
                  </div>

                  <NotificationBell profileId={profileId ?? undefined} />
                  <UserMenu isDark={isDark} />
                </div>
              </header>

              <ContractPendingBanner />

              {(autoplayUiState.isRunning || autoplayUiState.notices.length > 0) && (
                <div className="pointer-events-none fixed top-18 right-6 z-[90] flex max-h-[calc(100vh-5rem)] w-[360px] flex-col gap-3 overflow-hidden">
                  <div
                    className={`animate-in slide-in-from-right-2 fade-in rounded-xl border p-3 shadow-xl backdrop-blur-sm ${
                      isDark
                        ? "border-zinc-700 bg-zinc-900/92 text-zinc-100"
                        : "border-zinc-200 bg-white/95 text-zinc-900"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-orange-500" />
                        <span className="text-xs font-semibold tracking-wide uppercase">
                          Showcase Flow
                        </span>
                      </div>
                      {autoplayUiState.isRunning ? (
                        <span className="flex items-center gap-1 text-[11px] text-orange-500">
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          Running
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Done
                        </span>
                      )}
                    </div>

                    <p
                      className={`mb-2 text-[13px] font-medium ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
                    >
                      {autoplayUiState.currentStepLabel || "Waiting for autoplay"}
                    </p>

                    <div
                      className={`mb-2 h-1.5 overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-500"
                        style={{
                          width:
                            autoplayUiState.totalCount > 0
                              ? `${Math.round((autoplayUiState.completedCount / autoplayUiState.totalCount) * 100)}%`
                              : "0%",
                        }}
                      />
                    </div>

                    <div
                      className={`flex items-center justify-between text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                    >
                      <span>
                        {autoplayUiState.completedCount}/{autoplayUiState.totalCount} steps
                      </span>
                      <span>
                        {autoplayUiState.isSettling ? "Waiting for UI settle..." : "UI settled"}
                      </span>
                    </div>
                  </div>

                  {autoplayUiState.notices.map((notice) => (
                    <div
                      key={notice.id}
                      className={`animate-in slide-in-from-right-3 fade-in rounded-xl border p-3 shadow-lg ${
                        notice.tone === "success"
                          ? isDark
                            ? "border-emerald-700/70 bg-emerald-950/70 text-emerald-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : notice.tone === "warning"
                            ? isDark
                              ? "border-amber-700/70 bg-amber-950/70 text-amber-100"
                              : "border-amber-200 bg-amber-50 text-amber-900"
                            : isDark
                              ? "border-zinc-700 bg-zinc-900/95 text-zinc-100"
                              : "border-zinc-200 bg-white text-zinc-900"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase">
                        <Bell className="h-3.5 w-3.5" />
                        {notice.title}
                      </div>
                      <p
                        className={`text-[12px] leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                      >
                        {notice.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}

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
                      className={`flex items-center border-b ${isSidebarCollapsed ? "justify-center px-2" : "justify-end px-3"} py-2 ${
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
                      className={`relative flex-1 space-y-0 overflow-hidden py-1 ${isSidebarCollapsed ? "px-2" : "px-2.5"}`}
                    >
                      {isDocumentMode ? (
                        <DocumentModeSidebar isDark={isDark} />
                      ) : isAdminMode ? (
                        isDemoMode ? (
                          <>
                            {!isSidebarCollapsed && (
                              <div
                                className={`mt-1 mb-1 px-2 text-[9px] font-bold tracking-widest uppercase ${
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
                              icon={ListChecks}
                              label="Å gjøre"
                              isDark={isDark}
                              active={isDashboardPage && adminView === "todo"}
                              isCollapsed={isSidebarCollapsed}
                              onClick={() => setAdminView("todo")}
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
                                className={`mt-1 mb-1 px-2 text-[9px] font-bold tracking-widest uppercase ${
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
                              badge={
                                inboundRequestCount > 0
                                  ? `${inboundRequestCount} Forespørsler`
                                  : undefined
                              }
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
                                className={`mt-3 mb-1 px-2 text-[9px] font-bold tracking-widest uppercase ${
                                  isDark ? "text-zinc-500" : "text-[oklch(0.60_0.018_45)]"
                                }`}
                              >
                                Operasjoner
                              </div>
                            )}
                            {isSidebarCollapsed && <div className="mt-2" />}
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
                            <NavItem
                              href="/dashboard/reconciliation"
                              icon={Receipt}
                              label="Avstemming"
                              isDark={isDark}
                              active={isActive("/dashboard/reconciliation")}
                              isCollapsed={isSidebarCollapsed}
                            />

                            {!isSidebarCollapsed && (
                              <div
                                className={`mt-3 mb-1 px-2 text-[9px] font-bold tracking-widest uppercase ${
                                  isDark ? "text-zinc-500" : "text-[oklch(0.60_0.018_45)]"
                                }`}
                              >
                                Administrasjon
                              </div>
                            )}
                            {isSidebarCollapsed && <div className="mt-2" />}
                            <NavItem
                              href="/dashboard/hms"
                              icon={ShieldCheck}
                              label="HMS"
                              isDark={isDark}
                              active={isActive("/dashboard/hms")}
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
                              href="/dashboard/website"
                              icon={Globe}
                              label="Nettside"
                              isDark={isDark}
                              active={isActive("/dashboard/website")}
                              isCollapsed={isSidebarCollapsed}
                            />
                            <NavItem
                              href="/dashboard"
                              icon={ListChecks}
                              label="Å gjøre"
                              isDark={isDark}
                              active={isDashboardPage && adminView === "todo"}
                              isCollapsed={isSidebarCollapsed}
                              onClick={() => setAdminView("todo")}
                            />
                          </>
                        )
                      ) : (
                        <>
                          {!isSidebarCollapsed && (
                            <div
                              className={`mt-1 mb-1 px-2 text-[9px] font-bold tracking-widest uppercase ${
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
                          {FEATURE_FLAGS.MY_CV && (
                            <NavItem
                              href="/dashboard/my-cv"
                              icon={FileText}
                              label="Min profil"
                              isDark={isDark}
                              active={isActive("/dashboard/my-cv")}
                              isCollapsed={isSidebarCollapsed}
                            />
                          )}
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
                              className={`mt-3 mb-1 px-2 text-[9px] font-bold tracking-widest uppercase ${
                                isDark ? "text-zinc-500" : "text-zinc-400"
                              }`}
                            >
                              Kommunikasjon
                            </div>
                          )}
                          {isSidebarCollapsed && <div className="mt-2" />}
                          <NavItem
                            href="/dashboard/komm"
                            icon={Radio}
                            label="Komm"
                            isDark={isDark}
                            active={isActive("/dashboard/komm")}
                            isCollapsed={isSidebarCollapsed}
                          />
                          {FEATURE_FLAGS.AI_CHAT && (
                            <NavItem
                              href="/dashboard/ai"
                              icon={Bot}
                              label="Mr. Botsson"
                              isDark={isDark}
                              ai
                              active={isActive("/dashboard/ai")}
                              isCollapsed={isSidebarCollapsed}
                            />
                          )}
                          <NavItem
                            href="/dashboard/onboarding-assistant"
                            icon={Bot}
                            label="Onboarding-assistent"
                            isDark={isDark}
                            ai
                            active={isActive("/dashboard/onboarding-assistant")}
                            isCollapsed={isSidebarCollapsed}
                          />

                          <div className="mt-3 space-y-0.5 pt-1">
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
                      } ${isSidebarCollapsed ? "p-1.5" : "p-2"} space-y-1`}
                    >
                      {/* Admin/Employee toggle */}
                      <button
                        onClick={() => setIsAdminMode(!isAdminMode)}
                        data-autoplay="admin-mode-toggle"
                        className={`flex w-full items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"} rounded-lg border ${isSidebarCollapsed ? "px-0 py-1.5" : "px-2.5 py-1.5"} text-xs font-semibold transition-all ${
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
                          <span>{isAdminMode ? "Adminmodus" : "Ansattmodus"}</span>
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
                        {isDocumentMode ? "Handbok" : isAdminMode ? "Drift" : "Arbeidsrom"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5" />
                      <span
                        className={`rounded-md border px-2.5 py-1 font-semibold capitalize shadow-sm ${
                          isDark
                            ? "border-zinc-800 bg-zinc-900 text-zinc-100"
                            : "border-[oklch(0.88_0.015_50)] bg-[oklch(0.95_0.004_55)] text-[oklch(0.22_0.02_45)]"
                        }`}
                      >
                        {isDocumentMode
                          ? "Dokumentmodus"
                          : ((
                              {
                                schedule: "Vaktplan",
                                people: "Ansatte",
                                reports: "Rapporter",
                                operations: "Drift",
                                hms: "HMS",
                                governance: "HMS",
                                season: "Sesong",
                                organization: "Organisasjon",
                                settings: "Innstillinger",
                                help: "Hjelp",
                                komm: "Komm",
                                ai: "Mr. Botsson",
                                "onboarding-assistant": "Onboarding-assistent",
                                "my-schedule": "Min vaktplan",
                                "my-training": "Min opplæring",
                                "my-cv": "Min profil",
                                "my-salary": "Min lønn",
                              } as Record<string, string>
                            )[pathname.split("/").pop() ?? ""] ?? "Oversikt")}
                      </span>
                    </div>

                    <div className="flex items-center gap-5">
                      {/* Schedule page specific controls */}
                      {!isDocumentMode && pathname === "/dashboard/schedule" && isAdminMode && (
                        <>
                          {/* LAYOUT TOGGLE */}
                          <div
                            className={`hidden rounded-xl border p-1 shadow-sm md:flex ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-zinc-100"} mr-2`}
                          >
                            <button
                              onClick={() => setScheduleLayout("daily")}
                              data-autoplay="schedule-layout-daily"
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${scheduleLayout === "daily" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
                            >
                              Uke
                            </button>
                            {/* Rullerende — hidden until implemented */}
                            <button
                              onClick={() => setScheduleLayout("monthly")}
                              data-autoplay="schedule-layout-monthly"
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${scheduleLayout === "monthly" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
                            >
                              Måned
                            </button>
                            <button
                              onClick={() => setScheduleLayout("list")}
                              data-autoplay="schedule-layout-list"
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${scheduleLayout === "list" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
                            >
                              Vaktliste
                            </button>
                            <button
                              onClick={() => setScheduleLayout("grid")}
                              data-autoplay="schedule-layout-grid"
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${scheduleLayout === "grid" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
                            >
                              Vaktgrid
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
                              data-autoplay="schedule-date-prev"
                              className={`rounded-md p-1.5 transition-colors ${isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"}`}
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className={`cursor-pointer rounded-md px-1.5 py-1 transition-colors ${
                                    isDark
                                      ? "text-white hover:bg-zinc-800"
                                      : "text-zinc-900 hover:bg-zinc-200"
                                  } text-[13px] font-bold`}
                                >
                                  {(() => {
                                    if (scheduleLayout === "daily") {
                                      const now = new Date();
                                      now.setDate(
                                        now.getDate() -
                                          ((now.getDay() + 6) % 7) +
                                          scheduleDateOffset * 7,
                                      );
                                      const w = getISOWeek(now);
                                      const y = getISOWeekYear(now);
                                      return `Uke ${w}, ${y}`;
                                    }
                                    if (scheduleLayout === "weekly") {
                                      return scheduleDateOffset === 0
                                        ? "Aktiv syklus"
                                        : `Syklus ${scheduleDateOffset > 0 ? "+" : ""}${scheduleDateOffset}`;
                                    }
                                    const now = new Date();
                                    now.setMonth(now.getMonth() + scheduleDateOffset);
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
                                    return `${months[now.getMonth()]} ${now.getFullYear()}`;
                                  })()}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="center">
                                <CalendarUI
                                  mode="single"
                                  locale={nb}
                                  selected={(() => {
                                    const now = new Date();
                                    if (scheduleLayout === "monthly") {
                                      now.setMonth(now.getMonth() + scheduleDateOffset);
                                    } else {
                                      now.setDate(
                                        now.getDate() -
                                          ((now.getDay() + 6) % 7) +
                                          scheduleDateOffset * 7,
                                      );
                                    }
                                    return now;
                                  })()}
                                  onSelect={(date) => {
                                    if (!date) return;
                                    const now = new Date();
                                    if (scheduleLayout === "monthly") {
                                      const diff =
                                        (date.getFullYear() - now.getFullYear()) * 12 +
                                        date.getMonth() -
                                        now.getMonth();
                                      setScheduleDateOffset(diff);
                                    } else {
                                      const startOfCurrentWeek = new Date(now);
                                      startOfCurrentWeek.setDate(
                                        now.getDate() - ((now.getDay() + 6) % 7),
                                      );
                                      startOfCurrentWeek.setHours(0, 0, 0, 0);

                                      const startOfSelectedWeek = new Date(date);
                                      startOfSelectedWeek.setDate(
                                        date.getDate() - ((date.getDay() + 6) % 7),
                                      );
                                      startOfSelectedWeek.setHours(0, 0, 0, 0);

                                      const diffInDays = Math.round(
                                        (startOfSelectedWeek.getTime() -
                                          startOfCurrentWeek.getTime()) /
                                          (1000 * 60 * 60 * 24),
                                      );
                                      const offset = Math.round(diffInDays / 7);
                                      setScheduleDateOffset(offset);
                                    }
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            {scheduleDateOffset !== 0 && (
                              <button
                                onClick={() => setScheduleDateOffset(0)}
                                data-autoplay="schedule-date-today"
                                className="rounded-md px-2 py-0.5 text-[10px] font-bold text-orange-400 transition-colors hover:bg-orange-500/10"
                              >
                                I dag
                              </button>
                            )}
                            <button
                              onClick={() => setScheduleDateOffset((prev) => prev + 1)}
                              data-autoplay="schedule-date-next"
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
                      {!isDocumentMode && isDashboardPage && isAdminMode && (
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
                          <TodoTabButton
                            adminView={adminView}
                            isDark={isDark}
                            onClick={() => setAdminView("todo")}
                          />
                        </div>
                      )}

                      {/* Standard Search Bar, hidden on schedule page and document mode */}
                      {!isDocumentMode && pathname !== "/dashboard/schedule" && (
                        <div className="group relative">
                          <Search
                            className={`absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transition-colors ${
                              isDark
                                ? "text-zinc-500 group-focus-within:text-orange-500"
                                : "text-zinc-400 group-focus-within:text-orange-600"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              window.dispatchEvent(new Event("smartout:open-global-search"))
                            }
                            className={`flex w-64 items-center justify-between rounded-lg border py-2 pr-3 pl-9 text-sm shadow-sm transition-all focus:ring-1 focus:outline-none ${
                              isDark
                                ? "border-zinc-800 bg-zinc-900 text-zinc-100 hover:bg-zinc-800/80 focus:border-orange-500/50 focus:ring-orange-500/50"
                                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 focus:border-orange-500/50 focus:ring-orange-500/50"
                            }`}
                            aria-label="Open global search palette"
                          >
                            <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                              Søk i drift...
                            </span>
                            <kbd
                              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                                isDark
                                  ? "border-zinc-700 bg-zinc-800 text-zinc-400"
                                  : "border-zinc-200 bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {typeof navigator !== "undefined" &&
                              navigator.platform.includes("Mac")
                                ? "⌘K"
                                : "Ctrl+K"}
                            </kbd>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <DashboardContext.Provider value={dashboardContextValue}>
                    <GlobalSearchPalette />
                    {isDocumentMode ? (
                      <DocumentModeShell isDark={isDark} />
                    ) : (
                      <div className="flex min-h-0 flex-1 overflow-hidden">
                        <div className="scroll-overlay flex min-h-0 flex-1 flex-col overflow-hidden p-6 md:p-8 print:block print:h-auto print:overflow-visible print:p-0">
                          {isAdminMode && isDashboardPage && (
                            <>
                              <div className="mb-4 flex-shrink-0">
                                <ActionStrip isDark={isDark} />
                              </div>
                            </>
                          )}
                          {children}
                        </div>
                        <AnimatePresence>
                          <EntityDrawer />
                        </AnimatePresence>
                      </div>
                    )}
                  </DashboardContext.Provider>
                </main>
              </div>

              {/* Global incoming call overlay — works from any dashboard page */}
              <GlobalCallAlert />

              {/* Emma — floating voice overlay (inside EntityDrawerProvider for agent bridge) */}
              <EmmaOverlay />
            </div>
          </ChatPanelProvider>
        </EntityDrawerProvider>
      </VoiceToolsProvider>
    </DocumentModeProvider>
  );
}

/**
 * Tab button for the "Å gjøre" (Todo) view in the dashboard tab switcher.
 * Shows a badge with pending task count from cascade task resolution.
 */
function TodoTabButton({
  adminView,
  isDark,
  onClick,
}: {
  adminView: AdminViewType;
  isDark: boolean;
  onClick: () => void;
}) {
  const { data: taskCount } = useCascadeTaskCount();
  const pendingCount = (taskCount?.critical ?? 0) + (taskCount?.should ?? 0);

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
        adminView === "todo"
          ? isDark
            ? "bg-zinc-800 text-white shadow-sm"
            : "bg-white text-zinc-900 shadow-sm"
          : isDark
            ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700"
      }`}
    >
      <ListChecks className="h-3.5 w-3.5" />Å gjøre
      {pendingCount > 0 && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${
            isDark ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-600"
          }`}
        >
          {pendingCount}
        </span>
      )}
    </button>
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
  const normalizedLabel = label.toLowerCase().replace(/\s+/g, "-");
  const navAutoplayId = `nav-${href}`;
  const navButtonAutoplayId = `navbtn-${normalizedLabel}`;
  const baseClassName = `group flex items-center rounded-xl transition-all ${
    isCollapsed ? "justify-center px-0 py-1.5" : "justify-between px-2.5 py-1.5"
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
      <div className={`flex items-center ${isCollapsed ? "" : "gap-2.5"}`}>
        <Icon
          className={`h-4 w-4 shrink-0 transition-colors ${
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
          <span className={`text-[12px] tracking-wide ${active ? "font-bold" : "font-medium"}`}>
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
          className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${
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
    <button
      type="button"
      onClick={onClick}
      data-autoplay={navButtonAutoplayId}
      className={baseClassName}
    >
      {inner}
    </button>
  ) : (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      data-autoplay={navAutoplayId}
      className={baseClassName}
    >
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
