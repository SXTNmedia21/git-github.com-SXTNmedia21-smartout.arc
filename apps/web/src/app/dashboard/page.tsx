"use client";

import { useContext } from "react";
import dynamic from "next/dynamic";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

const AdminDashboard = dynamic(() => import("@/components/dashboard/AdminDashboard"), {
  ssr: false,
});
const EmployeeDashboard = dynamic(() => import("@/components/dashboard/EmployeeDashboard"), {
  ssr: false,
});

export default function DashboardPage() {
  const { isAdminMode, isDark } = useContext(DashboardContext);

  return (
    <div className="relative flex h-full flex-col">
      {isAdminMode ? <AdminDashboard isDark={isDark} /> : <EmployeeDashboard isDark={isDark} />}
    </div>
  );
}
