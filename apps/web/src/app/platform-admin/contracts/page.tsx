import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default async function ContractsPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: contracts } = await admin
    .from("platform_contract_instance")
    .select(
      `contract_id, title, status, sent_at, signed_at, expires_at, created_at,
       company:company_id (name),
       template:template_id (name, template_type)`,
    )
    .order("created_at", { ascending: false });

  const statusColor: Record<string, string> = {
    draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    viewed: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    signed: "bg-green-500/10 text-green-400 border-green-500/20",
    expired: "bg-red-500/10 text-red-400 border-red-500/20",
    cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Contracts</h1>
      <p className="text-muted-foreground mt-1 text-sm">Platform contract management</p>

      <div className="border-border mt-6 rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Signed</th>
              <th className="px-4 py-3">Expires</th>
            </tr>
          </thead>
          <tbody>
            {contracts?.map((contract) => (
              <tr key={contract.contract_id} className="border-border border-b last:border-0">
                <td className="px-4 py-3 font-medium">{contract.title}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {(contract.company as { name: string } | null)?.name || "\u2014"}
                </td>
                <td className="text-muted-foreground px-4 py-3 capitalize">
                  {(
                    (contract.template as { template_type: string } | null)?.template_type ||
                    "\u2014"
                  ).replace("_", " ")}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${statusColor[contract.status] || ""}`}
                  >
                    {contract.status}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {contract.signed_at
                    ? new Date(contract.signed_at).toLocaleDateString("no-NO")
                    : "\u2014"}
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {contract.expires_at
                    ? new Date(contract.expires_at).toLocaleDateString("no-NO")
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
