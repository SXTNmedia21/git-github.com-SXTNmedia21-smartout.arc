"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { TacticalView } from "./TacticalView";
import { StrategicView } from "./StrategicView";
import { ReconciliationView } from "./ReconciliationView";
import { ActivityView } from "./ActivityView";

interface AdminDashboardProps {
  isDark: boolean;
}

export default function AdminDashboard({ isDark }: AdminDashboardProps) {
  const { adminView } = useContext(DashboardContext);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      {adminView === "tactical" ? (
        <TacticalView isDark={isDark} />
      ) : adminView === "strategic" ? (
        <StrategicView isDark={isDark} />
      ) : adminView === "reconciliation" ? (
        <ReconciliationView isDark={isDark} />
      ) : (
        <ActivityView isDark={isDark} />
      )}
    </div>
  );
}
