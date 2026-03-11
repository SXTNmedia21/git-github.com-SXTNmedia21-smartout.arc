import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { ContractListClient } from "@/components/platform-admin/contract-list-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";

// Contract row shape
type ContractQueryRow = {
  contract_id: string;
  title: string;
  status: string;
  contract_type: string | null;
  recipient_name: string;
  recipient_email: string;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
  signed_pdf_url: string | null;
  company: { name: string } | null;
  template: { name: string; contract_type: string } | null;
};

const getContractsData = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const { data: rawContracts } = await admin
      .from("contract")
      .select(
        `contract_id, title, status, contract_type, recipient_name, recipient_email,
         sent_at, signed_at, expires_at, created_at, signed_pdf_url,
         company:workspace_id (name),
         template:template_id (name, contract_type)`,
      )
      .order("created_at", { ascending: false })
      .limit(100);

    const contracts = (rawContracts ?? []) as unknown as ContractQueryRow[];

    return contracts.map((c) => ({
      ...c,
      contract_type: c.contract_type || c.template?.contract_type || "custom",
      company: c.company,
      template: c.template,
    }));
  },
  ["platform-admin-contracts-v1"],
  { revalidate: 60 },
);

export default async function ContractsPage() {
  const [adminId, normalizedContracts] = await Promise.all([getSuperAdminId(), getContractsData()]);
  if (!adminId) redirect("/dashboard");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contracts</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Platform contract management — create, track, and manage all contracts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/platform-admin/contracts/templates">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Maler
            </Button>
          </Link>
          <Link href="/platform-admin/contracts/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ny kontrakt
            </Button>
          </Link>
        </div>
      </div>
      <div className="mt-6">
        <ContractListClient data={normalizedContracts} />
      </div>
    </div>
  );
}
