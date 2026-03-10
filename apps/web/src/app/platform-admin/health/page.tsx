import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { HealthPageClient } from "./_components/health-page-client";

const getHealthMetrics = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_metrics_daily")
      .select("total_users, total_workspaces, active_workspaces_24h, mrr_nok, computed_at")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
  ["platform-admin-health-v1"],
  { revalidate: 60 },
);

export default async function HealthPage() {
  const [adminId, metrics] = await Promise.all([getSuperAdminId(), getHealthMetrics()]);
  if (!adminId) redirect("/dashboard");

  const initialMetrics = metrics
    ? {
        total_users: metrics.total_users as number,
        total_workspaces: metrics.total_workspaces as number,
        active_workspaces_24h: metrics.active_workspaces_24h as number,
        mrr_nok: Number(metrics.mrr_nok),
        computed_at: metrics.computed_at as string,
      }
    : null;

  return <HealthPageClient initialMetrics={initialMetrics} />;
}
