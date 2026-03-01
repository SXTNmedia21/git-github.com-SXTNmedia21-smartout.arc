// ============================================
// landing-tabs.tsx
// Client component: tabbed container for the landing admin page.
// Wraps "Sessions" and "Events" tabs, delegating rendering
// to SessionsTab and LandingActivityClient respectively.
//
// Connected to: platform-admin/landing/page.tsx (data source)
//               sessions-tab.tsx (sessions view)
//               landing-activity-client.tsx (events view)
// ============================================

"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LandingActivityClient } from "./landing-activity-client";
import { SessionsTab } from "./sessions-tab";
import type { LandingEventRow } from "./landing-columns";
import type { SessionRow } from "../page";

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
}: LandingTabsProps) {
  return (
    <Tabs defaultValue="sessions">
      <TabsList>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
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
  );
}
