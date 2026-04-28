"use client";

/**
 * ContractsDataTable — paginated overview of all employee contracts in a workspace.
 *
 * Fetches from GET /api/contracts with server-side pagination (page size 20).
 * Supports filtering by contract status. Row actions: view details, resend, cancel.
 *
 * Fix 4: Cancel action now goes through DestructiveConfirmDialog (no direct-fire).
 * Fix 7: Resend uses MutationDropdownMenuItem for loading state.
 * Telemetry: emits resend.submitted, cancel.dialog_opened/confirmed/aborted/failed,
 *            and detail.viewed events.
 */

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FileSignature, MoreHorizontal, RefreshCw, Send, UserPlus, XCircle } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";

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
import { DestructiveConfirmDialog } from "@/components/DestructiveConfirmDialog";
import { MutationDropdownMenuItem } from "@/components/MutationDropdownMenuItem";

// ── Types ──────────────────────────────────────────────────────────────────

type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "expired"
  | "pending_data"
  | "declined"
  | "cancelled";

type Contract = {
  contract_id: string;
  profile_id: string | null;
  status: ContractStatus;
  position_title: string | null;
  employment_category: string | null;
  employment_percentage: number | null;
  created_at: string;
  signed_at: string | null;
  profile: { display_name: string } | null;
};

type ApiResponse = {
  data: Contract[];
  total: number;
  page: number;
  pageSize: number;
};

type StatusFilter = ContractStatus | "all";

/** Which surface opened the cancel dialog — drives telemetry `source` field. */
type CancelSource = "table_dropdown" | "detail_sheet";

// ── Status badge config ────────────────────────────────────────────────────

const STATUS_VARIANT: Record<
  ContractStatus,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  }
> = {
  draft: { variant: "secondary" },
  sent: { variant: "outline", className: "border-primary/40 text-primary" },
  viewed: { variant: "outline", className: "border-primary/60 text-primary" },
  signed: { variant: "default" },
  expired: { variant: "destructive" },
  pending_data: {
    variant: "outline",
    className: "border-warning text-warning-foreground",
  },
  declined: { variant: "destructive" },
  cancelled: { variant: "secondary", className: "line-through opacity-60" },
};

function StatusBadge({ status }: { status: ContractStatus }) {
  const { t } = useTranslation("contracts");
  const config = STATUS_VARIANT[status] ?? { variant: "secondary" as const };
  return (
    <Badge variant={config.variant} className={config.className}>
      {t(`status.${status}`)}
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
  const { t } = useTranslation("contracts");
  return (
    <TableRow>
      <TableCell colSpan={5} className="py-16 text-center">
        <div className="text-muted-foreground flex flex-col items-center gap-2">
          <FileSignature className="h-8 w-8 opacity-40" />
          <p className="font-medium">
            {hasFilter ? t("table.empty_filtered_title") : t("table.empty_title")}
          </p>
          <p className="text-sm">
            {hasFilter ? t("table.empty_filtered_description") : t("table.empty_description")}
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type Props = {
  workspaceId: string;
  /** Actor's profile_id for telemetry attribution. Optional — callers that
   *  haven't been updated yet pass undefined; nonEmpty handles the sentinel. */
  actorProfileId?: string | null;
};

export function ContractsDataTable({ workspaceId, actorProfileId = null }: Props) {
  const { t } = useTranslation("contracts");
  const router = useRouter();

  // ── Core state ──────────────────────────────────────────────────────────
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  // ── Cancel dialog state ─────────────────────────────────────────────────
  /** The contract targeted by the open (or about-to-open) cancel dialog. */
  const [cancelTarget, setCancelTarget] = useState<{
    contract: Contract;
    source: CancelSource;
  } | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelError, setCancelError] = useState<{ message: string } | null>(null);

  const cancelOpen = cancelTarget !== null;

  /** The contract currently shown in the detail sheet */
  const detailContract = detailId ? contracts.find((c) => c.contract_id === detailId) : null;

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
      });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/employment-contracts/list?${params.toString()}`);
      if (!res.ok) throw new Error(t("errors.fetch_contracts"));

      const json: ApiResponse = await res.json();
      setContracts(json.data ?? []);
      setTotal(json.data?.length ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.something_went_wrong"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, statusFilter, t]);

  // Refetch when page or filter changes
  useEffect(() => {
    void fetchContracts();
  }, [fetchContracts]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleStatusChange(value: string) {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  }

  /** Open the detail sheet and emit the detail.viewed telemetry event. */
  function handleViewDetails(contractId: string) {
    setDetailId(contractId);
    const contract = contracts.find((c) => c.contract_id === contractId);
    void emit({
      event: "contracts.detail.viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "contract",
          entity_id: contractId,
        },
        data: {
          contract_id: contractId,
          status: contract?.status ?? "unknown",
        },
      },
    });
  }

  /** Resend a contract — used by MutationDropdownMenuItem.onMutate. */
  async function handleResend(contractId: string): Promise<void> {
    const res = await fetch(`/api/contracts/${contractId}/send`, { method: "POST" });
    if (!res.ok) throw new Error(t("errors.resend_failed"));
    toast.success(t("toast.contract_resent"));
    const contract = contracts.find((c) => c.contract_id === contractId);
    void emit({
      event: "contracts.resend.submitted",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "contract",
          entity_id: contractId,
        },
        data: {
          contract_id: contractId,
          employee_id: contract?.profile_id ?? "",
        },
      },
    });
    void fetchContracts();
  }

  /**
   * Open the cancel confirm dialog.
   * Emits contracts.cancel.dialog_opened immediately.
   * Mutation is deferred to handleConfirmCancel (fires inside the dialog).
   */
  function openCancelDialog(contract: Contract, source: CancelSource) {
    setCancelTarget({ contract, source });
    setCancelError(null);
    void emit({
      event: "contracts.cancel.dialog_opened",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "contract",
          entity_id: contract.contract_id,
        },
        data: {
          contract_id: contract.contract_id,
          source,
          contract_status: contract.status,
        },
      },
    });
  }

  /**
   * Handle DestructiveConfirmDialog onOpenChange.
   * Only called when isPending is false (the dialog prevents close while pending).
   * If closing without confirming, emit aborted.
   */
  function handleCancelDialogOpenChange(open: boolean) {
    if (!open && cancelTarget && !cancelPending) {
      // User dismissed without confirming
      void emit({
        event: "contracts.cancel.aborted",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorProfileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "contract",
            entity_id: cancelTarget.contract.contract_id,
          },
          data: {
            contract_id: cancelTarget.contract.contract_id,
            reason: "user_cancelled",
          },
        },
      });
      setCancelTarget(null);
    }
  }

  /** Fires when user clicks "Avbryt kontrakt" inside the confirmation dialog. */
  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    const { contract } = cancelTarget;
    setCancelPending(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/contracts/${contract.contract_id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(t("errors.cancel_failed"));

      toast.success(t("cancel.success"));
      // Close detail sheet if it was showing this contract
      if (detailId === contract.contract_id) setDetailId(null);
      setCancelTarget(null);
      void emit({
        event: "contracts.cancel.confirmed",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorProfileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "contract",
            entity_id: contract.contract_id,
          },
          data: {
            contract_id: contract.contract_id,
            employee_id: contract.profile_id ?? "",
            was_sent: contract.status === "sent" || contract.status === "viewed",
          },
        },
      });
      void fetchContracts();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("toast.something_went_wrong");
      setCancelError({ message });
      void emit({
        event: "contracts.cancel.failed",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorProfileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "contract",
            entity_id: contract.contract_id,
          },
          data: {
            contract_id: contract.contract_id,
            error_code: message,
          },
        },
      });
    } finally {
      setCancelPending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="text-muted-foreground h-5 w-5" />
          <h1 className="text-lg font-semibold">{t("table.title")}</h1>
          {!loading && <span className="text-muted-foreground text-sm">({total})</span>}
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t("table.all_statuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("table.all_statuses")}</SelectItem>
              <SelectItem value="draft">{t("status.draft")}</SelectItem>
              <SelectItem value="sent">{t("status.sent")}</SelectItem>
              <SelectItem value="viewed">{t("status.viewed")}</SelectItem>
              <SelectItem value="signed">{t("status.signed")}</SelectItem>
              <SelectItem value="expired">{t("status.expired")}</SelectItem>
              <SelectItem value="pending_data">{t("status.pending_data")}</SelectItem>
              <SelectItem value="declined">{t("status.declined")}</SelectItem>
              <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => void fetchContracts()}
            title={t("table.refresh")}
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
              <TableHead>{t("table.employee")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.sent")}</TableHead>
              <TableHead>{t("table.signed")}</TableHead>
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
                  data-testid={`contract-row-${contract.contract_id}`}
                  className="cursor-pointer"
                  onClick={() => handleViewDetails(contract.contract_id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{contract.profile?.display_name || "—"}</span>
                      <span className="text-muted-foreground text-xs">
                        {contract.position_title || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={contract.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {formatDate(contract.created_at)}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          data-testid={`contract-row-dropdown-${contract.contract_id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{t("table.actions_label")}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(contract.contract_id)}>
                          {t("table.view_details")}
                        </DropdownMenuItem>
                        {contract.status === "pending_data" && contract.profile_id && (
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/dashboard/people/${contract.profile_id}/complete-data`)
                            }
                          >
                            <UserPlus className="mr-2 h-3.5 w-3.5" />
                            {t("table.complete_data")}
                          </DropdownMenuItem>
                        )}
                        {/* Fix 7 — Resend: MutationDropdownMenuItem shows spinner during fetch */}
                        <MutationDropdownMenuItem
                          data-testid="contract-action-resend"
                          icon={Send}
                          label={t("actions.resend")}
                          pendingLabel={t("actions.resending")}
                          onMutate={async () => {
                            if (contract.status === "signed" || contract.status === "cancelled") {
                              return;
                            }
                            await handleResend(contract.contract_id);
                          }}
                        />
                        {/* Fix 7 — Cancel: opens DestructiveConfirmDialog (sync, no async here) */}
                        {contract.status !== "signed" && contract.status !== "cancelled" && (
                          <DropdownMenuItem
                            data-testid="contract-action-cancel"
                            className="text-destructive focus:text-destructive"
                            onSelect={(e) => {
                              e.preventDefault();
                              openCancelDialog(contract, "table_dropdown");
                            }}
                          >
                            <XCircle className="mr-2 size-4" />
                            {t("actions.cancel")}
                          </DropdownMenuItem>
                        )}
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
          <span>{t("table.page_of", { page: String(page), total: String(totalPages) })}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              {t("table.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              {t("table.next")}
            </Button>
          </div>
        </div>
      )}

      {/* Contract detail sheet */}
      <Sheet open={!!detailContract} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("detail.title")}</SheetTitle>
          </SheetHeader>

          {detailContract && (
            <div className="mt-6 space-y-6">
              {/* Employee info */}
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t("detail.employee")}
                </p>
                <p className="text-sm font-medium">{detailContract.profile?.display_name || "—"}</p>
                <p className="text-muted-foreground text-sm">
                  {detailContract.position_title || "—"}
                </p>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  {t("detail.status")}
                </p>
                <StatusBadge status={detailContract.status} />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    {t("detail.created")}
                  </p>
                  <p className="font-mono text-sm">{formatDate(detailContract.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    {t("detail.signed")}
                  </p>
                  <p className="font-mono text-sm">{formatDate(detailContract.signed_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    {t("detail.employment_percentage")}
                  </p>
                  <p className="font-mono text-sm">
                    {detailContract.employment_percentage
                      ? `${detailContract.employment_percentage}%`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 border-t pt-4">
                {detailContract.status === "pending_data" && detailContract.profile_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      router.push(`/dashboard/people/${detailContract.profile_id}/complete-data`)
                    }
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t("table.complete_data")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    detailContract.status === "signed" || detailContract.status === "cancelled"
                  }
                  onClick={() => void handleResend(detailContract.contract_id)}
                >
                  {t("detail.resend")}
                </Button>
                {/* Fix 4 — Cancel in detail sheet: opens DestructiveConfirmDialog */}
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={
                    detailContract.status === "signed" || detailContract.status === "cancelled"
                  }
                  onClick={() => openCancelDialog(detailContract, "detail_sheet")}
                >
                  {t("detail.cancel_contract")}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Fix 4 — Cancel confirmation dialog */}
      <DestructiveConfirmDialog
        open={cancelOpen}
        onOpenChange={handleCancelDialogOpenChange}
        title={t("cancel.title", {
          employee: cancelTarget?.contract.profile?.display_name ?? "",
        })}
        description={t("cancel.body")}
        confirmLabel={t("cancel.confirm")}
        pendingLabel={t("cancel.pending")}
        cancelLabel={t("cancel.keep")}
        isPending={cancelPending}
        error={cancelError}
        onConfirm={() => void handleConfirmCancel()}
      />
    </div>
  );
}
