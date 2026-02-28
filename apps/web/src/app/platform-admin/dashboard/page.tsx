import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Building2, Users, CreditCard, AlertTriangle, PlayCircle } from "lucide-react";
import { KpiCard } from "@/components/platform-admin/kpi-card";
import { DashboardClient } from "./_components/dashboard-client";

export default async function DashboardPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const fourteenDaysAgo = cutoff.toISOString().split("T")[0];

  // Fetch all KPI data + activity in parallel
  const [
    { count: totalWorkspaces },
    { count: totalUsers },
    { count: trialCount },
    { count: activeCount },
    { count: pastDueCount },
    { count: cancelledCount },
    { count: pausedCount },
    { data: metrics },
    { data: recentActivity },
  ] = await Promise.all([
    admin.from("workspace").select("*", { count: "exact", head: true }),
    admin.from("user_identity").select("*", { count: "exact", head: true }),
    admin
      .from("company")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "trial"),
    admin
      .from("company")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "active"),
    admin
      .from("company")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "past_due"),
    admin
      .from("company")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "cancelled"),
    admin
      .from("company")
      .select("*", { count: "exact", head: true })
      .eq("subscription_status", "paused"),
    // Try to get metrics for sparklines — table may be empty
    admin
      .from("platform_metrics_daily")
      .select(
        "date, total_workspaces, total_users, subscriptions_active, subscriptions_trial, subscriptions_past_due",
      )
      .gte("date", fourteenDaysAgo)
      .order("date", { ascending: true }),
    // Activity feed from audit log
    admin
      .from("platform_audit_log")
      .select("id, action, entity_type, details, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  // Build sparkline arrays from metrics (may be empty)
  const workspaceSparkline = metrics?.map((m) => m.total_workspaces) ?? undefined;
  const userSparkline = metrics?.map((m) => m.total_users) ?? undefined;
  const activeSparkline = metrics?.map((m) => m.subscriptions_active) ?? undefined;
  const trialSparkline = metrics?.map((m) => m.subscriptions_trial) ?? undefined;
  const pastDueSparkline = metrics?.map((m) => m.subscriptions_past_due) ?? undefined;

  // Subscription distribution for pie chart
  const subscriptionData = [
    { name: "Active", value: activeCount ?? 0, color: "#10b981" },
    { name: "Trial", value: trialCount ?? 0, color: "#3b82f6" },
    { name: "Past Due", value: pastDueCount ?? 0, color: "#f97316" },
    { name: "Cancelled", value: cancelledCount ?? 0, color: "#ef4444" },
    { name: "Paused", value: pausedCount ?? 0, color: "#71717a" },
  ];

  // Format activity entries for the client
  const activityEntries = (recentActivity ?? []).map((entry) => ({
    id: entry.id,
    action: entry.action,
    entity_type: entry.entity_type,
    details: entry.details as Record<string, unknown> | null,
    created_at: entry.created_at,
  }));

  // Compute sparkline-based trends (compare last 7 days vs previous 7 days)
  function computeTrend(
    sparkline: number[] | undefined,
  ): { value: number; isPositive: boolean } | undefined {
    if (!sparkline || sparkline.length < 2) return undefined;
    const mid = Math.floor(sparkline.length / 2);
    const recent = sparkline.slice(mid);
    const previous = sparkline.slice(0, mid);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
    if (previousAvg === 0) return undefined;
    const change = ((recentAvg - previousAvg) / previousAvg) * 100;
    return { value: Math.round(Math.abs(change)), isPositive: change >= 0 };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Platform overview and quick actions</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard
          label="Workspaces"
          value={totalWorkspaces ?? 0}
          icon={Building2}
          trend={computeTrend(workspaceSparkline)}
          sparklineData={
            workspaceSparkline && workspaceSparkline.length > 1 ? workspaceSparkline : undefined
          }
        />
        <KpiCard
          label="Users"
          value={totalUsers ?? 0}
          icon={Users}
          trend={computeTrend(userSparkline)}
          sparklineData={userSparkline && userSparkline.length > 1 ? userSparkline : undefined}
        />
        <KpiCard
          label="Active Subs"
          value={activeCount ?? 0}
          icon={CreditCard}
          trend={computeTrend(activeSparkline)}
          sparklineData={
            activeSparkline && activeSparkline.length > 1 ? activeSparkline : undefined
          }
        />
        <KpiCard
          label="Trials"
          value={trialCount ?? 0}
          icon={PlayCircle}
          trend={computeTrend(trialSparkline)}
          sparklineData={trialSparkline && trialSparkline.length > 1 ? trialSparkline : undefined}
        />
        <KpiCard
          label="At Risk"
          value={pastDueCount ?? 0}
          icon={AlertTriangle}
          danger={(pastDueCount ?? 0) > 0}
          trend={computeTrend(pastDueSparkline)}
          sparklineData={
            pastDueSparkline && pastDueSparkline.length > 1 ? pastDueSparkline : undefined
          }
        />
      </div>

      {/* Client-rendered sections: Quick Actions, Charts, Activity Feed */}
      <DashboardClient subscriptionData={subscriptionData} recentActivity={activityEntries} />
    </div>
  );
}
