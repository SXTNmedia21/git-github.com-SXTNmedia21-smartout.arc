import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { BillingClient, type CompanyRow, type MrrDataPoint } from "./_components/billing-client";

export default async function BillingPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const thirtyDaysAgo = cutoff.toISOString().split("T")[0];

  // Fetch companies and MRR metrics in parallel
  const [companiesResult, metricsResult] = await Promise.all([
    admin
      .from("company")
      .select(
        "company_id, name, org_number, subscription_plan, subscription_status, trial_ends_at, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("platform_metrics_daily")
      .select("date, mrr_nok")
      .gte("date", thirtyDaysAgo)
      .order("date", { ascending: true }),
  ]);

  const companies: CompanyRow[] = (companiesResult.data ?? []).map((c) => ({
    company_id: c.company_id,
    name: c.name,
    org_number: c.org_number,
    subscription_plan: c.subscription_plan,
    subscription_status: c.subscription_status,
    trial_ends_at: c.trial_ends_at,
    created_at: c.created_at,
  }));

  const mrrData: MrrDataPoint[] = (metricsResult.data ?? []).map((m) => ({
    metric_date: m.date,
    metric_value: Number(m.mrr_nok),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="text-muted-foreground mt-1 text-sm">Subscription and revenue overview</p>

      <div className="mt-6">
        <BillingClient companies={companies} mrrData={mrrData} />
      </div>
    </div>
  );
}
