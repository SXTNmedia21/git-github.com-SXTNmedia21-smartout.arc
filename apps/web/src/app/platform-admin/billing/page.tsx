import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { BillingClient, type CompanyRow, type MrrDataPoint } from "./_components/billing-client";

const getBillingData = unstable_cache(
  async () => {
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
        )
        .order("created_at", { ascending: false })
        .limit(200),
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

    return { companies, mrrData };
  },
  ["platform-admin-billing-v1"],
  { revalidate: 60 },
);

export default async function BillingPage() {
  const [adminId, { companies, mrrData }] = await Promise.all([
    getSuperAdminId(),
    getBillingData(),
  ]);
  if (!adminId) redirect("/dashboard");

  return (
    <div>
      <h1 className="font-heading text-foreground text-2xl font-semibold">Billing</h1>
      <p className="text-muted-foreground mt-1 text-sm">Subscription and revenue overview</p>

      <div className="mt-6">
        <BillingClient companies={companies} mrrData={mrrData} />
      </div>
    </div>
  );
}
