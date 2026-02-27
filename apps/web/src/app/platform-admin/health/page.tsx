import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";

export default async function HealthPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: metrics } = await admin
    .from("platform_metrics_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Platform Health</h1>
      <p className="text-muted-foreground mt-1 text-sm">Metrics and system health overview</p>

      {metrics ? (
        <>
          <div className="mt-6 grid grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Total Users</p>
              <p className="text-2xl font-semibold">{metrics.total_users}</p>
              <p className="text-muted-foreground text-xs">+{metrics.new_users_today} today</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Workspaces</p>
              <p className="text-2xl font-semibold">{metrics.total_workspaces}</p>
              <p className="text-muted-foreground text-xs">+{metrics.new_workspaces_today} today</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Active 24h</p>
              <p className="text-2xl font-semibold">{metrics.active_workspaces_24h}</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">MRR (NOK)</p>
              <p className="text-2xl font-semibold">
                {Number(metrics.mrr_nok).toLocaleString("no-NO")}
              </p>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-5 gap-4">
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Trial</p>
              <p className="text-xl font-semibold text-blue-400">{metrics.subscriptions_trial}</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Active</p>
              <p className="text-xl font-semibold text-green-400">{metrics.subscriptions_active}</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Paused</p>
              <p className="text-xl font-semibold">{metrics.subscriptions_paused}</p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Past Due</p>
              <p className="text-xl font-semibold text-orange-400">
                {metrics.subscriptions_past_due}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Cancelled</p>
              <p className="text-destructive text-xl font-semibold">
                {metrics.subscriptions_cancelled}
              </p>
            </Card>
          </div>

          <p className="text-muted-foreground mt-4 text-xs">
            Last computed: {new Date(metrics.computed_at).toLocaleString("no-NO")}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground mt-6">
          No metrics data. Run <code className="text-xs">SELECT compute_platform_metrics()</code> in
          Supabase SQL editor to populate.
        </p>
      )}
    </div>
  );
}
