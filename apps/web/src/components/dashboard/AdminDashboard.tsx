"use client";

import { useCallback, useContext, useState } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ScheduleUIProvider } from "@/app/dashboard/schedule/_components/schedule-ui-context";
import {
  DayControlSheet,
  DayControlPanel,
} from "@/app/dashboard/schedule/_components/day-control";
import { TacticalView } from "./TacticalView";
import { StrategicView } from "./StrategicView";
import { ReconciliationView } from "./ReconciliationView";
import { ActivityView } from "./ActivityView";

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
        ) : (
          <ActivityView isDark={isDark} />
        )}
      </div>

      <DayControlSheet selectedDate={selectedDate} onClose={handleCloseSheet}>
        <DayControlPanel date={selectedDate} onClose={handleCloseSheet} />
      </DayControlSheet>
    </ScheduleUIProvider>
  );
}
