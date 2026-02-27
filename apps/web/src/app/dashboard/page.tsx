"use client";

import { useContext } from "react";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";
import { DashboardContext } from "./layout";

export default function DashboardPage() {
    const { isAdminMode, isDark } = useContext(DashboardContext);

    return (
        <div className="flex flex-col h-full relative">
            {isAdminMode ? (
                <AdminDashboard isDark={isDark} />
            ) : (
                <EmployeeDashboard isDark={isDark} />
            )}
        </div>
    );
}
