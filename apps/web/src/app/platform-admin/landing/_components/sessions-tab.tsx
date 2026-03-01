// ============================================
// sessions-tab.tsx
// Client component: the "Sessions" tab content.
// Renders session KPI cards, a data table of landing sessions,
// and a slide-over detail panel for individual sessions.
//
// Connected to: landing-tabs.tsx (parent tab container)
//               session-columns.tsx (column definitions)
//               session-detail.tsx (detail sheet)
//               platform-admin/landing/page.tsx (SessionRow type)
// ============================================

"use client";

import { useState } from "react";
import { Users, UserCheck, Clock, ArrowDownToLine } from "lucide-react";
import { KpiCard } from "@/components/platform-admin/kpi-card";
import { DataTable } from "@/components/platform-admin/data-table";
import { sessionColumns } from "./session-columns";
import { SessionDetail } from "./session-detail";
import type { SessionRow } from "../page";

type SessionsTabProps = {
  sessions: SessionRow[];
  uniqueVisitorsToday: number;
  returningVisitors7d: number;
  /** Average session duration today in seconds */
  avgDurationToday: number;
  /** Average scroll depth today as 0-100 percentage */
  avgScrollToday: number;
};

/**
 * Formats seconds into a readable duration string for the KPI card.
 * Example: 125 -> "2m 5s", 45 -> "45s", 0 -> "0s"
 */
function formatAvgDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function SessionsTab({
  sessions,
  uniqueVisitorsToday,
  returningVisitors7d,
  avgDurationToday,
  avgScrollToday,
}: SessionsTabProps) {
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  return (
    <div className="space-y-6">
      {/* KPI row — four session metrics at a glance */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Unique visitors today"
          value={uniqueVisitorsToday}
          icon={Users}
        />
        <KpiCard
          label="Returning visitors (7d)"
          value={returningVisitors7d}
          icon={UserCheck}
        />
        <KpiCard
          label="Avg. duration today"
          value={formatAvgDuration(avgDurationToday)}
          icon={Clock}
        />
        <KpiCard
          label="Avg. scroll depth"
          value={`${avgScrollToday}%`}
          icon={ArrowDownToLine}
        />
      </div>

      {/* Sessions data table */}
      <DataTable
        columns={sessionColumns}
        data={sessions}
        onRowClick={(row) => setSelectedSession(row)}
      />

      {/* Session detail slide-over panel */}
      <SessionDetail
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}
