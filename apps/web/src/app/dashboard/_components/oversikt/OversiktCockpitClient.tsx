"use client";

/**
 * OversiktCockpitClient — client bridge for the Nordic Split OversiktCockpit design.
 *
 * Resolves workspaceId from useWorkspaceOptional() and profileId/actorId from
 * DashboardContext (same pattern as WebDayControl). Fetches a greeting name via
 * a targeted profile query. Calls the 4 client hooks, runs the adapter, and renders
 * <OversiktCockpit data actorId workspaceId />.
 *
 * No DB writes. No ghost data — all gaps render honest empty/loading states per the
 * design (OversiktCockpit already handles these via its empty-state nodes).
 */

import { useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useCockpitFirstScreen } from "@/app/dashboard/_hooks/use-cockpit-first-screen";
import { useShiftDayStats } from "@/app/dashboard/_hooks/use-shift-day-stats";
import { useDayTimelineEvents } from "@/app/dashboard/_hooks/use-day-timeline-events";
import { useDayBudget } from "@/app/dashboard/_hooks/use-day-budget";
import { usePendingApprovals } from "@/app/dashboard/_hooks/use-pending-approvals";
import { useUnreadCounts } from "@/app/dashboard/komm/_hooks/use-unread-counts";
import OversiktCockpit from "./OversiktCockpit";
import { OversiktToolsBridge } from "./_tools/oversikt-tools-bridge";
import { toDesignOversikt } from "./to-design-shape";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// OversiktCockpitClient
// ---------------------------------------------------------------------------

export function OversiktCockpitClient() {
  const ctx = useContext(DashboardContext);
  const wsCtx = useWorkspaceOptional();

  const profileId = ctx.profileId;
  const workspaceId = wsCtx?.workspace.workspace_id ?? null;
  const dateISO = todayISO();

  // Greeting name — targeted profile fetch (profileId from DashboardContext)
  const { data: profileData } = useQuery({
    queryKey: ["oversikt-cockpit", "profile-name", profileId],
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profile")
        .select("display_name")
        .eq("profile_id", profileId!)
        .maybeSingle();
      return data?.display_name ?? null;
    },
  });

  const greetingName = profileData ?? wsCtx?.workspace.name ?? "deg";

  // ── 4 client hooks ──────────────────────────────────────────────────────────

  const cockpitModel = useCockpitFirstScreen({
    feedLimit: 24,
    feedFilters: { category: "all", timeRange: "today" },
  });

  const shiftStatsQuery = useShiftDayStats(dateISO);

  const timelineQuery = useDayTimelineEvents({
    workspaceId,
    departmentId: null, // workspace-wide; no dept filter on this surface
    sessionId: null,
    dateISO,
  });

  // useDayBudget — departmentId=null uses workspace-level fallback (enabled-gate fixed to use dateISO)
  const budgetQuery = useDayBudget(null, dateISO);

  // Wired pulse tiles ─────────────────────────────────────────────────────────
  // pendingApprovals: department_session rows with status=pending_signoff
  const pendingApprovalsQuery = usePendingApprovals();
  const pendingApprovalsCount = pendingApprovalsQuery.data?.length ?? 0;

  // unread: total unread channel + direct-message count from komm
  const unreadCountsQuery = useUnreadCounts();
  const unreadTotal = (unreadCountsQuery.data ?? []).reduce((sum, u) => sum + u.unread_count, 0);

  // ── Adapter ─────────────────────────────────────────────────────────────────

  const now = useMemo(() => new Date(), []);

  const designData = useMemo(() => {
    if (cockpitModel.isLoading) return null;

    return toDesignOversikt(
      cockpitModel,
      shiftStatsQuery.data ?? null,
      timelineQuery.data ?? [],
      budgetQuery.data ?? null,
      greetingName,
      now,
      pendingApprovalsCount,
      unreadTotal,
    );
  }, [
    cockpitModel,
    shiftStatsQuery.data,
    timelineQuery.data,
    budgetQuery.data,
    greetingName,
    now,
    pendingApprovalsCount,
    unreadTotal,
  ]);

  // ── Loading state ────────────────────────────────────────────────────────────
  // Render the skeleton layout while the cockpit model loads. The design itself
  // handles empty states — we only block on the minimum required data.

  if (!workspaceId || !profileId || !designData) {
    return (
      <main className="sk-main">
        <div className="sk-wrap" style={{ opacity: 0.4 }}>
          <div className="dash-head">
            <div>
              <div className="sk-eyebrow">Laster…</div>
              <h1 className="dash-greet">God morgen</h1>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <OversiktToolsBridge workspaceId={workspaceId} actorId={profileId} designData={designData} />
      <OversiktCockpit data={designData} workspaceId={workspaceId} actorId={profileId} />
    </>
  );
}
