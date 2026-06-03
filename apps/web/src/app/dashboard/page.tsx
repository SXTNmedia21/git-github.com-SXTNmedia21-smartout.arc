"use client";

// Dashboard entry point — delegates to the admin view selected in the
// DashboardShell variant bar (Oversikt / Mockup v1 / Interactive / Pipeline /
// Strategic / Avstemming / Aktivitet / Å gjøre) or to the employee dashboard
// when admin mode is off.

import { useContext } from "react";
import dynamic from "next/dynamic";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useAdminContext } from "@/components/dashboard/contexts";

// WebDayControl replaced OversiktView per ADR-0156 (PR 4). The
// NEXT_PUBLIC_DAY_CONTROL_V2 feature flag was removed at retirement.
const WebDayControl = dynamic(
  () => import("@/components/day/WebDayControl").then((m) => ({ default: m.WebDayControl })),
  { ssr: false },
);
// OversiktCockpitClient — Nordic Split design port (campaign/master-refactor)
const OversiktCockpitClient = dynamic(
  () =>
    import("@/app/dashboard/_components/oversikt/OversiktCockpitClient").then((m) => ({
      default: m.OversiktCockpitClient,
    })),
  { ssr: false },
);
const InteractiveDashboard = dynamic(
  () =>
    import("@/components/dashboard/interactive").then((m) => ({
      default: m.InteractiveDashboard,
    })),
  { ssr: false },
);
const StrategicView = dynamic(
  () => import("@/components/dashboard/StrategicView").then((m) => ({ default: m.StrategicView })),
  { ssr: false },
);
const ReconciliationView = dynamic(
  () =>
    import("@/components/dashboard/ReconciliationView").then((m) => ({
      default: m.ReconciliationView,
    })),
  { ssr: false },
);
const ActivityView = dynamic(
  () => import("@/components/dashboard/ActivityView").then((m) => ({ default: m.ActivityView })),
  { ssr: false },
);
const TodoTaskView = dynamic(
  () =>
    import("@/app/dashboard/_components/todo/TodoTaskView").then((m) => ({
      default: m.TodoTaskView,
    })),
  { ssr: false },
);
const EmployeeDashboard = dynamic(() => import("@/components/dashboard/EmployeeDashboard"), {
  ssr: false,
});

const MOCKUP_SRC: Record<"oversikt-pipeline", string> = {
  "oversikt-pipeline": "/design-mockups/dashboard-pipeline-variants.html",
};

export default function DashboardPage() {
  const { isAdminMode, isDark } = useContext(DashboardContext);
  const { adminView } = useAdminContext();

  if (!isAdminMode) {
    return (
      <div className="relative flex h-full flex-col">
        <EmployeeDashboard isDark={isDark} />
      </div>
    );
  }

  return <div className="relative flex h-full min-h-0 flex-1 flex-col">{renderView()}</div>;

  function renderView() {
    if (adminView === "oversikt") return <OversiktCockpitClient />;
    // "Interactive" renders the feature-flagged InteractiveDashboard (normally
    // gated on NEXT_PUBLIC_INTERACTIVE_DASHBOARD=true) so Pontus can preview it
    // directly from the variant tab bar.
    if (adminView === "oversikt-interactive") return <InteractiveDashboard />;
    if (adminView === "strategic") return <StrategicView />;
    if (adminView === "reconciliation") return <ReconciliationView isDark={isDark} />;
    if (adminView === "activity") return <ActivityView />;
    if (adminView === "todo") return <TodoTaskView />;
    // Remaining value is the iframe-backed pipeline mockup.
    const src = MOCKUP_SRC[adminView];
    return (
      <iframe
        key={adminView}
        src={src}
        title={adminView}
        className="h-full w-full flex-1 border-0"
      />
    );
  }
}
