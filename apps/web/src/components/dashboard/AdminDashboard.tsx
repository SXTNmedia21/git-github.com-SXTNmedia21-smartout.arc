"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useAdminContext } from "@/components/dashboard/contexts";
import { ScheduleUIProvider } from "@/app/dashboard/schedule/_components/schedule-ui-context";
import { DayControlSheet, DayControlPanel } from "@/app/dashboard/schedule/_components/day-control";
import { TodoTaskView } from "@/app/dashboard/_components/todo/TodoTaskView";

const HospitalityOperationsCockpit = dynamic(() =>
  import("./cockpit/HospitalityOperationsCockpit").then((m) => ({
    default: m.HospitalityOperationsCockpit,
  })),
);
const StrategicView = dynamic(() =>
  import("./StrategicView").then((m) => ({ default: m.StrategicView })),
);
const ReconciliationView = dynamic(() =>
  import("./ReconciliationView").then((m) => ({ default: m.ReconciliationView })),
);
const ActivityView = dynamic(() =>
  import("./ActivityView").then((m) => ({ default: m.ActivityView })),
);
const InteractiveDashboard = dynamic(() =>
  import("./interactive").then((m) => ({ default: m.InteractiveDashboard })),
);

const useInteractiveDashboard = process.env.NEXT_PUBLIC_INTERACTIVE_DASHBOARD === "true";

interface AdminDashboardProps {
  isDark: boolean;
}

export default function AdminDashboard({ isDark }: AdminDashboardProps) {
  const { adminView } = useAdminContext();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleCloseSheet = useCallback(() => {
    setSelectedDate(null);
  }, []);

  // The oversikt* variants are rendered directly from /dashboard/page.tsx.
  // AdminDashboard is kept as a thin fallback for the legacy admin views so
  // other entry points that still delegate here keep working.
  const legacyView = (() => {
    if (adminView === "todo") return <TodoTaskView />;
    if (adminView === "strategic") {
      return useInteractiveDashboard ? <InteractiveDashboard /> : <StrategicView />;
    }
    if (adminView === "reconciliation") return <ReconciliationView isDark={isDark} />;
    if (adminView === "activity") return <ActivityView />;
    // Oversikt variants are handled upstream — render the legacy cockpit as a
    // safety net when someone mounts AdminDashboard outside the dashboard page.
    return useInteractiveDashboard ? <InteractiveDashboard /> : <HospitalityOperationsCockpit />;
  })();

  return (
    <ScheduleUIProvider>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">{legacyView}</div>

      <DayControlSheet selectedDate={selectedDate} onClose={handleCloseSheet}>
        <DayControlPanel date={selectedDate} onClose={handleCloseSheet} />
      </DayControlSheet>
    </ScheduleUIProvider>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="bg-muted h-6 w-48 animate-pulse rounded" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border-border bg-muted/50 h-28 animate-pulse rounded-2xl border"
          />
        ))}
      </div>
      <div className="flex gap-4">
        <div className="border-border bg-muted/50 h-56 flex-[2] animate-pulse rounded-2xl border" />
        <div className="border-border bg-muted/50 h-56 flex-1 animate-pulse rounded-2xl border" />
      </div>
    </div>
  );
}
