"use client";

import { useCallback, useContext, useState } from "react";
import dynamic from "next/dynamic";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ScheduleUIProvider } from "@/app/dashboard/schedule/_components/schedule-ui-context";
import { DayControlSheet, DayControlPanel } from "@/app/dashboard/schedule/_components/day-control";

const TacticalView = dynamic(() =>
  import("./TacticalView").then((m) => ({ default: m.TacticalView })),
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
const GuardianView = dynamic(() =>
  import("./GuardianView").then((m) => ({ default: m.GuardianView })),
);

interface AdminDashboardProps {
  isDark: boolean;
}

export default function AdminDashboard({ isDark }: AdminDashboardProps) {
  const { adminView } = useContext(DashboardContext);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleCloseSheet = useCallback(() => {
    setSelectedDate(null);
  }, []);

  return (
    <ScheduleUIProvider>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        {adminView === "tactical" ? (
          <TacticalView isDark={isDark} onDateClick={setSelectedDate} />
        ) : adminView === "strategic" ? (
          <StrategicView isDark={isDark} />
        ) : adminView === "reconciliation" ? (
          <ReconciliationView isDark={isDark} />
        ) : adminView === "activity" ? (
          <ActivityView isDark={isDark} />
        ) : adminView === "guardian" ? (
          <GuardianView isDark={isDark} />
        ) : null}
      </div>

      <DayControlSheet selectedDate={selectedDate} onClose={handleCloseSheet}>
        <DayControlPanel date={selectedDate} onClose={handleCloseSheet} />
      </DayControlSheet>
    </ScheduleUIProvider>
  );
}
