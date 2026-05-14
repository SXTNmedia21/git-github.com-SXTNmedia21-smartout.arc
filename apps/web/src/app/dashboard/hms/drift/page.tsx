"use client";

import { useContext, useState } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { DriftSessionTable } from "../_components/DriftSessionTable";
import { DriftTaskList } from "../_components/DriftTaskList";
import { DriftInsightStrip } from "../_components/DriftInsightStrip";
import { useDriftInsights } from "../_hooks/use-drift-insights";
import { HmsDriftToolsBridge } from "./_tools/hms-drift-tools-bridge";

export default function DriftPage() {
  const { isAdminMode } = useContext(DashboardContext);
  const [date] = useState(() => new Date().toISOString().split("T")[0]!);

  if (!isAdminMode) {
    return (
      <>
        <HmsDriftToolsBridge isAdminMode={false} date={date} loading={false} insights={null} />
        <DriftTaskList />
      </>
    );
  }

  return <AdminDriftView date={date} />;
}

function AdminDriftView({ date }: { date: string }) {
  const { insights, isLoading } = useDriftInsights(date);

  return (
    <>
      <HmsDriftToolsBridge isAdminMode={true} date={date} loading={isLoading} insights={insights} />
      <div className="space-y-4">
        <DriftInsightStrip date={date} />
        <DriftSessionTable />
      </div>
    </>
  );
}
