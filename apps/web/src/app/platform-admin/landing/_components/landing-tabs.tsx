// ============================================
// landing-tabs.tsx
// Client component: tabbed container for the landing admin page.
// Renders a top-level KPI bar, then three tabs:
// Sessions, Leads, and Events.
//
// Connected to: platform-admin/landing/page.tsx (data source)
//               sessions-tab.tsx (sessions view)
//               leads-tab.tsx (leads view)
//               landing-activity-client.tsx (events view)
// ============================================

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity, Users, UserCheck, TrendingUp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KpiCard } from "@/components/platform-admin/kpi-card";
import { LandingActivityClient } from "./landing-activity-client";
import { SessionsTab } from "./sessions-tab";
import { LeadsTab } from "./leads-tab";
import type { LandingEventRow } from "./landing-columns";
import type { SessionRow, LeadRow } from "../page";

type LandingTabsProps = {
  // Event data (for Events tab)
  events: LandingEventRow[];
  visitsToday: number;
  voiceSessionsToday: number;
  ctaClicksToday: number;
  uniqueSessions7d: number;
  // Session data (for Sessions tab)
  sessions: SessionRow[];
  uniqueVisitorsToday: number;
  returningVisitors7d: number;
  avgDurationToday: number;
  avgScrollToday: number;
  // Lead data (for Leads tab)
  leads: LeadRow[];
  // Top-level KPIs
  sessionsCountToday: number;
  leadCount: number;
  totalVisitors: number;
  conversionRate: number;
};

export function LandingTabs({
  events,
  visitsToday,
  voiceSessionsToday,
  ctaClicksToday,
  uniqueSessions7d,
  sessions,
  uniqueVisitorsToday,
  returningVisitors7d,
  avgDurationToday,
  avgScrollToday,
  leads,
  sessionsCountToday,
  leadCount,
  totalVisitors,
  conversionRate,
}: LandingTabsProps) {
  const router = useRouter();

  // Auto-refresh every 10 seconds for live feed
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 10_000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Top-level KPI bar — key metrics at a glance */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Sessions today" value={sessionsCountToday} icon={Activity} />
        <KpiCard label="Unique visitors today" value={uniqueVisitorsToday} icon={Users} />
        <KpiCard label="Leads" value={leadCount} icon={UserCheck} />
        <KpiCard label="Conversion rate" value={`${conversionRate}%`} icon={TrendingUp} />
      </div>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="leads">
            Leads
            {leadCount > 0 && (
              <span className="bg-foreground/10 ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums">
                {leadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <SessionsTab
            sessions={sessions}
            uniqueVisitorsToday={uniqueVisitorsToday}
            returningVisitors7d={returningVisitors7d}
            avgDurationToday={avgDurationToday}
            avgScrollToday={avgScrollToday}
          />
        </TabsContent>

        <TabsContent value="leads">
          <LeadsTab leads={leads} totalVisitors={totalVisitors} />
        </TabsContent>

        <TabsContent value="events">
          <LandingActivityClient
            events={events}
            visitsToday={visitsToday}
            voiceSessionsToday={voiceSessionsToday}
            ctaClicksToday={ctaClicksToday}
            uniqueSessions7d={uniqueSessions7d}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
