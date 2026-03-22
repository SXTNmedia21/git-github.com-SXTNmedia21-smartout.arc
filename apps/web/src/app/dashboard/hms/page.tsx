"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { OversiktDashboard } from "./_components/OversiktDashboard";
import { OversiktEmployee } from "./_components/OversiktEmployee";

export default function HmsOversiktPage() {
  const { isAdminMode } = useContext(DashboardContext);

  return isAdminMode ? <OversiktDashboard /> : <OversiktEmployee />;
}
