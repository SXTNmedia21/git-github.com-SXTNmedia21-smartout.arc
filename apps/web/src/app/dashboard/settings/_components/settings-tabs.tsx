"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import {
  Clock,
  Target,
  Building2,
  Bell,
  Users,
  Shield,
  Banknote,
  Receipt,
  CalendarClock,
  Utensils,
  Timer,
  ShieldCheck,
  CalendarDays,
  Scale,
  Calculator,
  GitBranch,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@smartout/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@smartout/supabase/client";
import { OpeningHoursSettings } from "./opening-hours-settings";
import { NotificationPreferences } from "./NotificationPreferences";

const PayrollGeneralSettings = lazy(() =>
  import("./payroll-general-settings").then((m) => ({ default: m.PayrollGeneralSettings })),
);
const SalaryCodesSettings = lazy(() =>
  import("./salary-codes-settings").then((m) => ({ default: m.SalaryCodesSettings })),
);
const EmployeeGroupsSettings = lazy(() =>
  import("./employee-groups-settings").then((m) => ({ default: m.EmployeeGroupsSettings })),
);
const SupplementRulesSettings = lazy(() =>
  import("./supplement-rules-settings").then((m) => ({ default: m.SupplementRulesSettings })),
);
const MealRulesSettings = lazy(() =>
  import("./meal-rules-settings").then((m) => ({ default: m.MealRulesSettings })),
);
const ShiftTypesSettings = lazy(() =>
  import("./shift-types-settings").then((m) => ({ default: m.ShiftTypesSettings })),
);
const BreakRulesSettings = lazy(() =>
  import("./break-rules-settings").then((m) => ({ default: m.BreakRulesSettings })),
);
const WorkingTimeRulesSettings = lazy(() =>
  import("./working-time-rules-settings").then((m) => ({ default: m.WorkingTimeRulesSettings })),
);
const HolidayCalendarSettings = lazy(() =>
  import("./holiday-calendar-settings").then((m) => ({ default: m.HolidayCalendarSettings })),
);
const FrameworkRulesPanel = lazy(() =>
  import("./FrameworkRulesPanel").then((m) => ({ default: m.FrameworkRulesPanel })),
);
const TariffRatesPanel = lazy(() =>
  import("./TariffRatesPanel").then((m) => ({ default: m.TariffRatesPanel })),
);
const ChangeProposalsPanel = lazy(() =>
  import("./ChangeProposalsPanel").then((m) => ({ default: m.ChangeProposalsPanel })),
);
const FinancialCloseSettings = lazy(() =>
  import("./financial-close-settings").then((m) => ({ default: m.FinancialCloseSettings })),
);

type Tab = { id: string; label: string; icon: LucideIcon };
type Section = { title: string; tabs: Tab[] };

const SECTIONS: Section[] = [
  {
    title: "General",
    tabs: [
      { id: "general", label: "General", icon: Building2 },
      { id: "hours", label: "Opening Hours", icon: Clock },
      { id: "kpis", label: "KPI Targets", icon: Target },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "teams", label: "Teams & Departments", icon: Users },
      { id: "security", label: "Security", icon: Shield },
      { id: "financial-close", label: "Dagsoppgjor", icon: Receipt },
    ],
  },
  {
    title: "Payroll",
    tabs: [
      { id: "payroll-general", label: "Payroll", icon: Banknote },
      { id: "salary-codes", label: "Salary Codes", icon: Receipt },
      { id: "employee-groups", label: "Employee Groups", icon: Users },
      { id: "supplements", label: "Supplements", icon: CalendarClock },
      { id: "meal-rules", label: "Meal Rules", icon: Utensils },
    ],
  },
  {
    title: "Schedule",
    tabs: [
      { id: "shift-types", label: "Shift Types", icon: Timer },
      { id: "break-rules", label: "Break Rules", icon: Timer },
      { id: "working-time", label: "Working Time", icon: ShieldCheck },
    ],
  },
  {
    title: "Regelverk",
    tabs: [
      { id: "framework-rules", label: "Arbeidsregler", icon: Scale },
      { id: "tariff-rates", label: "Tariffsatser", icon: Calculator },
      { id: "change-proposals", label: "Endringsforslag", icon: GitBranch },
    ],
  },
  {
    title: "Organisation",
    tabs: [{ id: "holidays", label: "Holidays", icon: CalendarDays }],
  },
];

const ALL_TABS = SECTIONS.flatMap((s) => s.tabs);
type TabId = (typeof ALL_TABS)[number]["id"];

function TabPlaceholder({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24">
      <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground h-7 w-7" />
      </div>
      <h3 className="text-foreground mb-1 text-lg font-semibold">{label}</h3>
      <p className="text-muted-foreground text-sm">Coming soon</p>
    </div>
  );
}

function SettingsLoadingSkeleton() {
  return (
    <div className="space-y-6 p-1">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="space-y-4 pt-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

function TabContent({ tabId, userId }: { tabId: TabId; userId: string | undefined }) {
  switch (tabId) {
    case "hours":
      return <OpeningHoursSettings />;
    case "payroll-general":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <PayrollGeneralSettings />
        </Suspense>
      );
    case "salary-codes":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <SalaryCodesSettings />
        </Suspense>
      );
    case "employee-groups":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <EmployeeGroupsSettings />
        </Suspense>
      );
    case "supplements":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <SupplementRulesSettings />
        </Suspense>
      );
    case "meal-rules":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <MealRulesSettings />
        </Suspense>
      );
    case "shift-types":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <ShiftTypesSettings />
        </Suspense>
      );
    case "break-rules":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <BreakRulesSettings />
        </Suspense>
      );
    case "working-time":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <WorkingTimeRulesSettings />
        </Suspense>
      );
    case "holidays":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <HolidayCalendarSettings />
        </Suspense>
      );
    case "framework-rules":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <FrameworkRulesPanel />
        </Suspense>
      );
    case "tariff-rates":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <TariffRatesPanel />
        </Suspense>
      );
    case "change-proposals":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <ChangeProposalsPanel />
        </Suspense>
      );
    case "financial-close":
      return (
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <FinancialCloseSettings />
        </Suspense>
      );
    case "notifications":
      return <NotificationPreferences userId={userId} />;
    default: {
      const tab = ALL_TABS.find((t) => t.id === tabId)!;
      return <TabPlaceholder icon={tab.icon} label={tab.label} />;
    }
  }
}

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("hours");
  // Fetch auth user id for notification preferences (keyed by user_id, not profile_id)
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    // Check hash on mount
    const hash = window.location.hash.replace("#", "") as TabId;
    if (hash && ALL_TABS.some((t) => t.id === hash)) {
      setActiveTab(hash);
    }

    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) setUserId(data.user.id);
      });
  }, []);

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    window.location.hash = id;
  };

  return (
    <div className="flex gap-6">
      {/* Left sidebar nav */}
      <nav className="w-56 shrink-0 space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="text-muted-foreground mb-1 px-3 text-xs font-medium tracking-wider uppercase">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <TabContent tabId={activeTab} userId={userId} />
      </div>
    </div>
  );
}
