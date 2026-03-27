"use client";

import { useCallback, useContext, useState } from "react";
import dynamic from "next/dynamic";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { DailyStatusBar } from "./DailyStatusBar";
import { ScheduleUIProvider } from "@/app/dashboard/schedule/_components/schedule-ui-context";
import { DayControlSheet, DayControlPanel } from "@/app/dashboard/schedule/_components/day-control";
import { TodoTaskView } from "@/app/dashboard/_components/todo/TodoTaskView";

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
        <div className="px-4 pt-2">
          <DailyStatusBar />
        </div>
        {adminView === "todo" ? (
          <TodoTaskView />
        ) : adminView === "tactical" ? (
          <TacticalView isDark={isDark} onDateClick={setSelectedDate} />
        ) : adminView === "strategic" ? (
          <StrategicView isDark={isDark} />
        ) : adminView === "reconciliation" ? (
          <ReconciliationView isDark={isDark} />
        ) : adminView === "activity" ? (
          <ActivityView isDark={isDark} />
        ) : null}
      </div>

      <DayControlSheet selectedDate={selectedDate} onClose={handleCloseSheet}>
        <DayControlPanel date={selectedDate} onClose={handleCloseSheet} />
      </DayControlSheet>
    </ScheduleUIProvider>
  );
}

function DashboardSkeleton({ isDark }: { isDark: boolean }) {
  const bar = isDark ? "bg-zinc-800" : "bg-zinc-200";
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className={`h-6 w-48 animate-pulse rounded ${bar}`} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`h-28 animate-pulse rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
          />
        ))}
      </div>
      <div className="flex gap-4">
        <div
          className={`h-56 flex-[2] animate-pulse rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
        />
        <div
          className={`h-56 flex-1 animate-pulse rounded-2xl border ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
        />
      </div>
    </div>
  );
}
