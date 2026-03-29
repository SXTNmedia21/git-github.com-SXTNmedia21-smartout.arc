"use client";

/**
 * page.tsx — Route entry point for /dashboard/shift-clock.
 *
 * Detects user role via DashboardContext:
 * - Employee (not admin) renders ShiftClockView (fullscreen punch clock)
 * - Admin/manager renders LeaderOverview (Task 11 placeholder)
 */

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ShiftClockView } from "./ShiftClockView";

/**
 * LeaderOverview placeholder — will be implemented in Task 11.
 * Shows a live dashboard of all active shifts for managers.
 */
function LeaderOverviewPlaceholder() {
  return (
    <div className="bg-background flex h-full w-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="font-heading text-foreground text-2xl">Leder-oversikt</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        Live oversikt over alle aktive vakter, manuelle stempling, og sanntidsdata. Implementeres i
        Task 11.
      </p>
    </div>
  );
}

export default function ShiftClockPage() {
  const { isAdminMode } = useContext(DashboardContext);

  if (isAdminMode) {
    return <LeaderOverviewPlaceholder />;
  }

  return <ShiftClockView />;
}
