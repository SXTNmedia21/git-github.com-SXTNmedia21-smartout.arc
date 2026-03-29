"use client";

import { useContext, useState } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { DriftSessionTable } from "../_components/DriftSessionTable";
import { DriftTaskList } from "../_components/DriftTaskList";
import { DriftInsightStrip } from "../_components/DriftInsightStrip";

export default function DriftPage() {
  const { isAdminMode } = useContext(DashboardContext);

  if (!isAdminMode) {
    return <DriftTaskList />;
  }

  return <AdminDriftView />;
}

function AdminDriftView() {
  const [date] = useState(() => new Date().toISOString().split("T")[0]!);

  return (
    <div className="space-y-4">
      <DriftInsightStrip date={date} />
      <DriftSessionTable />
    </div>
  );
}
