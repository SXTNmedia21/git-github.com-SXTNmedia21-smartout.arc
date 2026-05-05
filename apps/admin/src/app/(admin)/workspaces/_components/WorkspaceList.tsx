"use client";

// WorkspaceList.tsx — client component: search input + workspace table
//
// Receives the full workspace list from the server page component.
// Filters client-side by workspace name OR company name on every
// keystroke — no round-trip needed for a list this size (≤200 rows).
//
// Click on a row → navigate to /workspaces/<id>.

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceListItem } from "@smartout/billing";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkspaceCard } from "./WorkspaceCard";

type Props = {
  workspaces: WorkspaceListItem[];
};

/** Format a numeric NOK amount as a Norwegian locale string. */
function formatNok(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format an ISO date string to a short Norwegian locale date. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("nb-NO", { dateStyle: "short" }).format(new Date(iso));
}

export function WorkspaceList({ workspaces }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter(
      (w) => w.workspace_name.toLowerCase().includes(q) || w.company_name.toLowerCase().includes(q),
    );
  }, [workspaces, query]);

  if (workspaces.length === 0) {
    return (
      <div className="text-muted-foreground border-border rounded-lg border border-dashed p-8 text-center text-sm">
        Ingen workspaces tildelt — kontakt admin for tilgang
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Søk etter workspace eller selskap…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
        aria-label="Filtrer workspaces"
      />

      {filtered.length === 0 ? (
        <div className="text-muted-foreground border-border rounded-lg border border-dashed p-8 text-center text-sm">
          Ingen workspaces matcher søket
        </div>
      ) : (
        <div className="border-border rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Workspace</TableHead>
                <TableHead>Selskap</TableHead>
                <TableHead>Org.nr</TableHead>
                <TableHead className="text-right">Utstående beløp</TableHead>
                <TableHead>Sist faktura</TableHead>
                <TableHead>Sist betalt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((workspace) => (
                <WorkspaceCard
                  key={workspace.workspace_id}
                  workspace={workspace}
                  onNavigate={() => router.push(`/workspaces/${workspace.workspace_id}`)}
                  formatNok={formatNok}
                  formatDate={formatDate}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
