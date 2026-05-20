"use client";

/**
 * page.tsx — /dashboard/my-schedule
 *
 * Employee schedule view. Lifts weekOffset state so the harness bridge can
 * read the currently-visible week without a duplicate fetch.
 *
 * UI Events:
 * - nav: /dashboard/my-schedule (sidebar link)
 * - action: week navigation (prev/next) — delegated to MyWeekView
 */

import { useContext, useMemo, useState } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { MyWeekView } from "./_components/MyWeekView";
import { MyScheduleToolsBridge } from "./_tools/my-schedule-tools-bridge";
import { useMyScheduleShifts } from "./_hooks/use-my-shifts";

function getWeekRange(offset: number): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}

export default function MySchedulePage() {
  const { profileId } = useContext(DashboardContext);
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekStart, weekEnd } = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  // Shared data fetch — MyWeekView will re-use from TanStack cache (same queryKey).
  const { data: shifts = null, isLoading } = useMyScheduleShifts(profileId, weekStart, weekEnd);

  return (
    <>
      {/* Harness bridge — registers Botsson tools for this surface */}
      <MyScheduleToolsBridge
        weekStart={weekStart}
        weekEnd={weekEnd}
        shifts={shifts}
        isLoading={isLoading}
        weekOffset={weekOffset}
        setWeekOffset={setWeekOffset}
      />
      <MyWeekView weekOffset={weekOffset} onWeekOffsetChange={setWeekOffset} />
    </>
  );
}
