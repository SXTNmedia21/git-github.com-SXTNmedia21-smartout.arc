// ============================================
// platform-admin/landing/page.tsx
// Server component: fetches landing_event + landing_session data
// and renders the tabbed admin view (Sessions + Events).
//
// Connected to: _components/landing-tabs.tsx (tab container)
//               _components/landing-activity-client.tsx (events tab)
//               _components/sessions-tab.tsx (sessions tab)
//               apps/landing/src/app/api/track/route.ts (writes events)
//               apps/landing/src/app/api/wizard/start/route.ts (writes voice events)
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { LandingTabs } from "./_components/landing-tabs";
import type { LandingEventRow } from "./_components/landing-columns";

// ── Exported types ────────────────────────────────────────────

/** Shape of a landing session row with joined visitor + user_identity data. */
export type SessionRow = {
  id: string;
  visitor_id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  max_scroll_depth: number;
  page_count: number;
  click_count: number;
  cta_click_count: number;
  variant: string | null;
  referrer: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  visitor: {
    id: string;
    visit_count: number;
    first_seen: string;
    user_identity_id: string | null;
    manual_label: string | null;
    user_identity: {
      full_name: string | null;
      email: string | null;
    } | null;
  } | null;
};

// ── Date helpers ──────────────────────────────────────────────

/**
 * Returns today's date as a UTC ISO string at midnight.
 * Used to filter events/sessions created today.
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

// ── Page component ────────────────────────────────────────────

export default async function LandingActivityPage() {
  // Guard: only platform admins can access this page
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const today = todayUtcStart();
  const sevenDaysAgo = sevenDaysAgoUtcStart();

  // Fetch all event + session data in parallel for minimal latency
  const [
    { data: events },
    { count: visitsToday },
    { count: voiceSessionsToday },
    { count: ctaClicksToday },
    { data: recentEventSessions },
    { data: sessions },
    { data: sessionsToday },
    { data: sessions7d },
  ] = await Promise.all([
    // ── Event queries (unchanged) ──

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

    // Unique session IDs in the last 7 days (for event-based unique count)
    admin
      .from("landing_event")
      .select("session_id")
      .not("session_id", "is", null)
      .gte("created_at", sevenDaysAgo),

    // ── Session queries (new) ──

    // Last 200 sessions with joined visitor data
    admin
      .from("landing_session")
      .select(
        `id, visitor_id, session_id, started_at, ended_at, duration_seconds,
         max_scroll_depth, page_count, click_count, cta_click_count,
         variant, referrer, ip_address, user_agent, device_type,
         visitor:landing_visitor(
           id, visit_count, first_seen, user_identity_id, manual_label,
           user_identity:user_identity(full_name, email)
         )`,
      )
      .order("started_at", { ascending: false })
      .limit(200),

    // Today's sessions for avg duration + avg scroll
    admin
      .from("landing_session")
      .select("duration_seconds, max_scroll_depth, visitor_id")
      .gte("started_at", today),

    // Last 7 days sessions for returning visitor count
    admin
      .from("landing_session")
      .select(
        `visitor_id, visitor:landing_visitor(visit_count)`,
      )
      .gte("started_at", sevenDaysAgo),
  ]);

  // ── Compute event-based KPIs ──

  const uniqueSessions7d = new Set(
    (recentEventSessions ?? []).map((r) => r.session_id).filter(Boolean),
  ).size;

  // ── Compute session-based KPIs ──

  const todaySessions = sessionsToday ?? [];
  const weekSessions = sessions7d ?? [];

  // Unique visitors today: count distinct visitor_ids from today's sessions
  const uniqueVisitorsToday = new Set(
    todaySessions.map((s) => s.visitor_id).filter(Boolean),
  ).size;

  // Returning visitors (7d): unique visitor_ids where visit_count > 1
  const returningVisitors7d = new Set(
    weekSessions
      .filter((s) => {
        const visitor = s.visitor as { visit_count: number } | null;
        return visitor && visitor.visit_count > 1;
      })
      .map((s) => s.visitor_id)
      .filter(Boolean),
  ).size;

  // Average duration today (seconds)
  const durationsToday = todaySessions
    .map((s) => s.duration_seconds as number | null)
    .filter((d): d is number => d !== null && d > 0);
  const avgDurationToday =
    durationsToday.length > 0
      ? Math.round(durationsToday.reduce((a, b) => a + b, 0) / durationsToday.length)
      : 0;

  // Average scroll depth today (0-100)
  const scrollsToday = todaySessions
    .map((s) => s.max_scroll_depth as number)
    .filter((d) => d > 0);
  const avgScrollToday =
    scrollsToday.length > 0
      ? Math.round(scrollsToday.reduce((a, b) => a + b, 0) / scrollsToday.length)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Landing Activity</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          All visits, voice sessions, and CTA clicks from the public landing page
        </p>
      </div>

      <LandingTabs
        events={(events as unknown as LandingEventRow[]) ?? []}
        visitsToday={visitsToday ?? 0}
        voiceSessionsToday={voiceSessionsToday ?? 0}
        ctaClicksToday={ctaClicksToday ?? 0}
        uniqueSessions7d={uniqueSessions7d}
        sessions={(sessions as unknown as SessionRow[]) ?? []}
        uniqueVisitorsToday={uniqueVisitorsToday}
        returningVisitors7d={returningVisitors7d}
        avgDurationToday={avgDurationToday}
        avgScrollToday={avgScrollToday}
      />
    </div>
  );
}
