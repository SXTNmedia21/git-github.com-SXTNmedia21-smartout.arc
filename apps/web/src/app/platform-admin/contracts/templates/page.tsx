import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  client: "Klient",
  employee: "Ansatt",
  haccp: "HACCP",
  training: "Opplaring",
  season: "Sesong",
  custom: "Egendefinert",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  active: "default",
  archived: "outline",
  deprecated: "destructive",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ContractTemplatesPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: templates } = await admin
    .from("contract_template")
    .select("template_id, name, contract_type, status, is_active, updated_at, template_type")
    .order("updated_at", { ascending: false });

  const rows = templates ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kontraktsmaler</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Opprett og rediger maler for kontrakter
          </p>
        </div>
        <Link href="/platform-admin/contracts/templates/new/edit">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Ny mal
          </Button>
        </Link>
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border py-12 text-center">
            <p className="text-sm">Ingen maler opprettet enda.</p>
            <Link href="/platform-admin/contracts/templates/new/edit">
              <Button variant="outline" className="mt-4" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Opprett din forste mal
              </Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktiv</TableHead>
                  <TableHead>Oppdatert</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.template_id}>
                    <TableCell>
                      <Link
                        href={`/platform-admin/contracts/templates/${t.template_id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">
                        {CONTRACT_TYPE_LABELS[t.contract_type] ?? t.contract_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[t.status] ?? "secondary"}>{t.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${t.is_active ? "bg-green-500" : "bg-muted-foreground/30"}`}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(t.updated_at)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/platform-admin/contracts/templates/${t.template_id}/edit`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
