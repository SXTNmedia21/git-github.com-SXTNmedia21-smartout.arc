import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Building2, Users, CreditCard, AlertTriangle, PlayCircle } from "lucide-react";

export default async function DashboardPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  const [
    { count: totalWorkspaces },
    { count: totalUsers },
    { count: trialCount },
    { count: activeCount },
    { count: pastDueCount },
    { data: recentWorkspaces },
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
      .from("workspace")
      .select("workspace_id, name, created_at, company:company_id (name, subscription_status)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const kpis = [
    { label: "Workspaces", value: totalWorkspaces || 0, icon: Building2 },
    { label: "Users", value: totalUsers || 0, icon: Users },
    { label: "Active Subs", value: activeCount || 0, icon: CreditCard },
    { label: "Trials", value: trialCount || 0, icon: PlayCircle },
    {
      label: "At Risk",
      value: pastDueCount || 0,
      icon: AlertTriangle,
      danger: (pastDueCount || 0) > 0,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground mt-1 text-sm">Platform overview</p>

      <div className="mt-6 grid grid-cols-5 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.label}
              className={`p-4 ${"danger" in kpi && kpi.danger ? "border-destructive/30" : ""}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="text-muted-foreground h-4 w-4" />
                <p className="text-muted-foreground text-xs tracking-wider uppercase">
                  {kpi.label}
                </p>
              </div>
              <p
                className={`mt-2 text-3xl font-semibold ${"danger" in kpi && kpi.danger ? "text-destructive" : ""}`}
              >
                {kpi.value}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-medium">Recent Workspaces</h2>
        <div className="border-border rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                <th className="px-4 py-3">Workspace</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {recentWorkspaces?.map((ws) => (
                <tr key={ws.workspace_id} className="border-border border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{ws.name}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {(ws.company as { name: string } | null)?.name || "\u2014"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 capitalize">
                    {(ws.company as { subscription_status: string } | null)?.subscription_status ||
                      "\u2014"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {new Date(ws.created_at).toLocaleDateString("no-NO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
