"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { DriftSessionTable } from "../_components/DriftSessionTable";
import { DriftTaskList } from "../_components/DriftTaskList";

export default function DriftPage() {
  const { isAdminMode } = useContext(DashboardContext);

  return isAdminMode ? <DriftSessionTable /> : <DriftTaskList />;
}
