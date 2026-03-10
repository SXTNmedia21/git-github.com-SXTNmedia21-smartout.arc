import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
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

type ContractEventRow = {
  contract_id: string;
  event_type: string;
  actor_type: string;
  created_at: string;
};

export default async function ContractsPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: rawContracts }, { data: rawEvents }] = await Promise.all([
    admin
      .from("contract" as never)
      .select(
        `contract_id, title, status, contract_type, recipient_name, recipient_email,
         sent_at, viewed_at, signed_at, expires_at, created_at, signed_pdf_url,
         company:workspace_id (name),
         template:template_id (name, contract_type)`,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("contract_event" as never)
      .select("contract_id, event_type, actor_type, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const contracts = (rawContracts ?? []) as unknown as ContractQueryRow[];
  const events = (rawEvents ?? []) as unknown as ContractEventRow[];

  // Group events by contract_id
  const eventsByContract = new Map<string, ContractEventRow[]>();
  for (const e of events) {
    const list = eventsByContract.get(e.contract_id) ?? [];
    list.push(e);
    eventsByContract.set(e.contract_id, list);
  }

  // Normalize the data shape for the client component
  const normalizedContracts = contracts.map((c) => ({
    ...c,
    contract_type: c.contract_type || c.template?.contract_type || "custom",
    company: c.company,
    template: c.template,
    events: eventsByContract.get(c.contract_id) ?? [],
  }));

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
