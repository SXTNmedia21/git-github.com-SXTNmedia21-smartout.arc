// ============================================
// platform-admin/landing/page.tsx
// Server component: fetches landing_event data and renders
// the landing page activity feed for platform admins.
//
// Shows all visits, voice sessions, and CTA clicks from the
// public landing page. Useful for tracking funnel performance
// and understanding visitor behavior.
//
// Connected to: _components/landing-activity-client.tsx (renders data)
//               apps/landing/src/app/api/track/route.ts (writes events)
//               apps/landing/src/app/api/wizard/start/route.ts (writes voice events)
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { LandingActivityClient } from "./_components/landing-activity-client";
import type { LandingEventRow } from "./_components/landing-columns";

/**
 * Returns today's date as a UTC ISO string at midnight.
 * Used to filter events created today.
 */
function todayUtcStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Returns the ISO string for 7 days ago at midnight UTC.
 * Used to count unique sessions over the past week.
 */
function sevenDaysAgoUtcStart(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function LandingActivityPage() {
  // Guard: only platform admins can access this page
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const today = todayUtcStart();
  const sevenDaysAgo = sevenDaysAgoUtcStart();

  // Fetch all counts and the event list in parallel for minimal latency
  const [
    { data: events },
    { count: visitsToday },
    { count: voiceSessionsToday },
    { count: ctaClicksToday },
    { data: recentSessions },
  ] = await Promise.all([
    // Last 200 events for the activity table
    admin
      .from("landing_event")
      .select(
        "id, event_type, variant, session_id, referrer, ip_address, user_agent, details, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),

    // Today's page views
    admin
      .from("landing_event")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "page_view")
      .gte("created_at", today),

    // Today's voice sessions
    admin
      .from("landing_event")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "voice_session_started")
      .gte("created_at", today),

    // Today's CTA clicks
    admin
      .from("landing_event")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "cta_click")
      .gte("created_at", today),

    // Unique session IDs in the last 7 days (used to compute unique visitor count)
    // Supabase doesn't support COUNT(DISTINCT) via the JS client, so we fetch
    // all session_ids for the period and deduplicate in JS.
    admin
      .from("landing_event")
      .select("session_id")
      .not("session_id", "is", null)
      .gte("created_at", sevenDaysAgo),
  ]);

  // Deduplicate session IDs in JS to get unique visitor count
  const uniqueSessions7d = new Set((recentSessions ?? []).map((r) => r.session_id).filter(Boolean))
    .size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Landing Activity</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          All visits, voice sessions, and CTA clicks from the public landing page
        </p>
      </div>

      <LandingActivityClient
        events={(events as unknown as LandingEventRow[]) ?? []}
        visitsToday={visitsToday ?? 0}
        voiceSessionsToday={voiceSessionsToday ?? 0}
        ctaClicksToday={ctaClicksToday ?? 0}
        uniqueSessions7d={uniqueSessions7d}
      />
    </div>
  );
}
