"use client";

/**
 * ContractsDataTable — paginated overview of all employee contracts in a workspace.
 *
 * Fetches from GET /api/contracts with server-side pagination (page size 20).
 * Supports filtering by contract status. Row actions: view details, resend, cancel.
 */

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { FileSignature, MoreHorizontal, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ──────────────────────────────────────────────────────────────────

type ContractStatus = "draft" | "sent" | "viewed" | "signed" | "expired" | "cancelled";

type Contract = {
  contract_id: string;
  recipient_name: string;
  recipient_email: string;
  status: ContractStatus;
  created_at: string;
  signed_at: string | null;
  sent_at: string | null;
};

type ApiResponse = {
  data: Contract[];
  total: number;
  page: number;
  pageSize: number;
};

type StatusFilter = ContractStatus | "all";

// ── Status badge config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ContractStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  draft: { label: "Utkast", variant: "secondary" },
  sent: { label: "Sendt", variant: "outline", className: "border-primary/40 text-primary" },
  viewed: { label: "Åpnet", variant: "outline", className: "border-primary/60 text-primary" },
  signed: { label: "Signert", variant: "default" },
  expired: { label: "Utløpt", variant: "destructive" },
  cancelled: { label: "Avbrutt", variant: "secondary", className: "line-through opacity-60" },
};

function StatusBadge({ status }: { status: ContractStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "secondary" as const };
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

// ── Date formatting helpers ────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Loading skeleton rows ──────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={5} className="py-16 text-center">
        <div className="text-muted-foreground flex flex-col items-center gap-2">
          <FileSignature className="h-8 w-8 opacity-40" />
          <p className="font-medium">
            {hasFilter ? "Ingen kontrakter med valgt status" : "Ingen kontrakter ennå"}
          </p>
          <p className="text-sm">
            {hasFilter
              ? "Prøv et annet filter for å se kontrakter."
              : "Send din første kontrakt fra ansattprofilen."}
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ContractsDataTable({ workspaceId }: { workspaceId: string }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  /** The contract currently shown in the detail sheet */
  const detailContract = detailId ? contracts.find((c) => c.contract_id === detailId) : null;

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        page: String(page),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/contracts?${params.toString()}`);
      if (!res.ok) throw new Error("Kunne ikke hente kontrakter");

      const json: ApiResponse = await res.json();
      setContracts(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, page, statusFilter]);

  // Refetch when page or filter changes
  useEffect(() => {
    void fetchContracts();
  }, [fetchContracts]);

  // Reset to page 1 when filter changes
  function handleStatusChange(value: string) {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  }

  function handleViewDetails(contractId: string) {
    setDetailId(contractId);
  }

  async function handleResend(contractId: string) {
    try {
      const res = await fetch(`/api/contracts/${contractId}/send`, { method: "POST" });
      if (!res.ok) throw new Error("Kunne ikke sende kontrakt på nytt");
      toast.success("Kontrakt sendt på nytt");
      void fetchContracts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    }
  }

  async function handleCancel(contractId: string) {
    try {
      const res = await fetch(`/api/contracts/${contractId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("Kunne ikke avbryte kontrakt");
      toast.success("Kontrakt avbrutt");
      void fetchContracts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="text-muted-foreground h-5 w-5" />
          <h1 className="text-lg font-semibold">Kontrakter</h1>
          {!loading && <span className="text-muted-foreground text-sm">({total})</span>}
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Alle statuser" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statuser</SelectItem>
              <SelectItem value="draft">Utkast</SelectItem>
              <SelectItem value="sent">Sendt</SelectItem>
              <SelectItem value="viewed">Åpnet</SelectItem>
              <SelectItem value="signed">Signert</SelectItem>
              <SelectItem value="expired">Utløpt</SelectItem>
              <SelectItem value="cancelled">Avbrutt</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => void fetchContracts()}
            title="Oppdater"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ansatt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sendt</TableHead>
              <TableHead>Signert</TableHead>
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : contracts.length === 0 ? (
              <EmptyState hasFilter={statusFilter !== "all"} />
            ) : (
              contracts.map((contract) => (
                <TableRow
                  key={contract.contract_id}
                  className="cursor-pointer"
                  onClick={() => handleViewDetails(contract.contract_id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{contract.recipient_name || "—"}</span>
                      <span className="text-muted-foreground text-xs">
                        {contract.recipient_email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={contract.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {formatDate(contract.sent_at ?? contract.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {formatDate(contract.signed_at)}
                  </TableCell>
                  <TableCell
                    // Stop row click from firing when opening the actions menu
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Handlinger</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(contract.contract_id)}>
                          Vis detaljer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleResend(contract.contract_id)}
                          disabled={contract.status === "signed" || contract.status === "cancelled"}
                        >
                          Send på nytt
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleCancel(contract.contract_id)}
                          disabled={contract.status === "signed" || contract.status === "cancelled"}
                          className="text-destructive focus:text-destructive"
                        >
                          Avbryt
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            Side {page} av {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              Forrige
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Neste
            </Button>
          </div>
        </div>
      )}

      {/* Contract detail sheet */}
      <Sheet open={!!detailContract} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Kontraktdetaljer</SheetTitle>
          </SheetHeader>

          {detailContract && (
            <div className="mt-6 space-y-6">
              {/* Recipient info */}
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Mottaker
                </p>
                <p className="text-sm font-medium">{detailContract.recipient_name || "—"}</p>
                <p className="text-muted-foreground text-sm">{detailContract.recipient_email}</p>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Status
                </p>
                <StatusBadge status={detailContract.status} />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Opprettet
                  </p>
                  <p className="font-mono text-sm">{formatDate(detailContract.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Sendt
                  </p>
                  <p className="font-mono text-sm">{formatDate(detailContract.sent_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    Signert
                  </p>
                  <p className="font-mono text-sm">{formatDate(detailContract.signed_at)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    detailContract.status === "signed" || detailContract.status === "cancelled"
                  }
                  onClick={() => void handleResend(detailContract.contract_id)}
                >
                  Send på nytt
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={
                    detailContract.status === "signed" || detailContract.status === "cancelled"
                  }
                  onClick={() => {
                    void handleCancel(detailContract.contract_id);
                    setDetailId(null);
                  }}
                >
                  Avbryt kontrakt
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
