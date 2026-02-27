import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function BillingPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: companies } = await admin
    .from("company")
    .select(
      "company_id, name, org_number, subscription_plan, subscription_status, trial_ends_at, created_at",
    )
    .order("created_at", { ascending: false });

  const statusColor: Record<string, string> = {
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    trial: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    past_due: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
    paused: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  const active = companies?.filter((c) => c.subscription_status === "active").length || 0;
  const trial = companies?.filter((c) => c.subscription_status === "trial").length || 0;
  const pastDue = companies?.filter((c) => c.subscription_status === "past_due").length || 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="text-muted-foreground mt-1 text-sm">Subscription and revenue overview</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Active</p>
          <p className="text-3xl font-semibold text-green-400">{active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Trial</p>
          <p className="text-3xl font-semibold text-blue-400">{trial}</p>
        </Card>
        <Card className="p-4">
          <p className="text-muted-foreground text-xs uppercase">Past Due</p>
          <p className={`text-3xl font-semibold ${pastDue > 0 ? "text-destructive" : ""}`}>
            {pastDue}
          </p>
        </Card>
      </div>

      <div className="border-border mt-8 rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Org.nr</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial Ends</th>
            </tr>
          </thead>
          <tbody>
            {companies?.map((c) => (
              <tr key={c.company_id} className="border-border border-b last:border-0">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                  {c.org_number}
                </td>
                <td className="px-4 py-3 capitalize">{c.subscription_plan || "\u2014"}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${statusColor[c.subscription_status || ""] || ""}`}
                  >
                    {c.subscription_status || "unknown"}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {c.trial_ends_at
                    ? new Date(c.trial_ends_at).toLocaleDateString("no-NO")
                    : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
