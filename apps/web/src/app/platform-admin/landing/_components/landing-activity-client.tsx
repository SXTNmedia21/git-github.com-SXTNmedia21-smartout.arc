// ============================================
// landing-activity-client.tsx
// Client component for the landing page activity feed.
// Renders KPI cards (counts by event type) and a
// sortable data table of all landing_event rows.
//
// Connected to: platform-admin/landing/page.tsx (server data)
//               landing-columns.tsx (table column definitions)
// ============================================

"use client";

import { Globe, Mic, MousePointerClick, Users } from "lucide-react";
import { KpiCard } from "@/components/platform-admin/kpi-card";
import { DataTable } from "@/components/platform-admin/data-table";
import { landingColumns, type LandingEventRow } from "./landing-columns";

type LandingActivityClientProps = {
  events: LandingEventRow[];
  /** Count of page_view events with created_at = today */
  visitsToday: number;
  /** Count of voice_session_started events with created_at = today */
  voiceSessionsToday: number;
  /** Count of cta_click events with created_at = today */
  ctaClicksToday: number;
  /** Count of distinct session_ids in the last 7 days */
  uniqueSessions7d: number;
};

export function LandingActivityClient({
  events,
  visitsToday,
  voiceSessionsToday,
  ctaClicksToday,
  uniqueSessions7d,
}: LandingActivityClientProps) {
  return (
    <div className="space-y-6">
      {/* KPI row — four key metrics at a glance */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Visits today" value={visitsToday} icon={Globe} />
        <KpiCard label="Voice sessions today" value={voiceSessionsToday} icon={Mic} />
        <KpiCard label="CTA clicks today" value={ctaClicksToday} icon={MousePointerClick} />
        <KpiCard label="Unique sessions (7d)" value={uniqueSessions7d} icon={Users} />
      </div>

      {/* Full activity table */}
      <DataTable columns={landingColumns} data={events} />
    </div>
  );
}
