"use client";

/**
 * ProposalDetailClient — detail view for a wage_line_override proposal (T5.2).
 *
 * Displays:
 *   - Original amount → proposed amount + delta + percentage
 *   - Reason (full) + category
 *   - Proposer (name + time)
 *   - Audit trail panel (activity_trail rows for this proposal)
 *   - "Godkjenn" / "Avvis" buttons (visible when status='pending')
 *     - Godkjenn: confirm modal → approve-proposal BFF → redirect to period
 *     - Avvis: reason modal (required) → reject-proposal BFF → redirect to proposals list
 *
 * Access: admin only (BFF enforces role; UI renders buttons for all but non-admins
 * will receive 403 from BFF). Role-gated UI can be added in T9.2 cleanup.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { nb } from "date-fns/locale";
import { ArrowRight, CheckCircle2, Clock, FileText, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import {
  usePayrollProposal,
  useApproveProposal,
  useRejectProposal,
} from "../_hooks/use-payroll-proposals";
import type { AuditTrailRow, ProposalDetail } from "../_hooks/use-payroll-proposals";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNok(cents: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function categoryLabel(cat: string | undefined): string {
  const labels: Record<string, string> = {
    manual_adjustment: "Manuell justering",
    tariff_interpretation: "Tariff-tolkning",
    shift_data_error: "Vakdata-feil",
    other: "Annet",
  };
  return cat ? (labels[cat] ?? cat) : "—";
}

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">Venter godkjenning</Badge>;
    case "applied":
      return (
        <Badge variant="default" className="bg-green-700 text-white">
          Godkjent
        </Badge>
      );
    case "rejected":
      return <Badge variant="destructive">Avvist</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Audit trail panel ───────────────────────────────────────────────────────

function AuditPanel({ rows }: { rows: AuditTrailRow[] }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Ingen audit-hendelser registrert enda.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-start gap-3">
          <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-foreground text-sm">{row.event_type}</p>
            <p className="text-muted-foreground text-xs">
              {format(new Date(row.created_at), "d. MMM yyyy HH:mm", { locale: nb })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Approve confirm modal ────────────────────────────────────────────────────

function ApproveModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  proposal,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  proposal: ProposalDetail;
}) {
  const { changes } = proposal;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Godkjenn override?</DialogTitle>
          <DialogDescription>
            Handlingen er irreversibel — original linje beholdes som audit-spor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
          {changes.original_amount_cents !== undefined && (
            <span className="text-muted-foreground text-sm">
              {formatNok(changes.original_amount_cents)}
            </span>
          )}
          <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
          {changes.proposed_amount_cents !== undefined && (
            <span className="text-foreground text-sm font-medium">
              {formatNok(changes.proposed_amount_cents)}
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Avbryt
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Godkjenn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reject reason modal ─────────────────────────────────────────────────────

function RejectModal({
  open,
  onClose,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Avvis override</DialogTitle>
          <DialogDescription>
            Oppgi grunn til avvisning. Lederen vil se dette i sin innboks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="rejection-reason">Grunn (påkrevd)</Label>
          <Textarea
            id="rejection-reason"
            placeholder="Forklar hvorfor overriden avvises..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={1000}
            disabled={isLoading}
          />
          <p className="text-muted-foreground text-right text-xs">{trimmed.length}/1000</p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setReason("");
              onClose();
            }}
            disabled={isLoading}
          >
            Avbryt
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(trimmed)}
            disabled={isLoading || trimmed.length === 0}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Avvis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main detail view ─────────────────────────────────────────────────────────

type Props = {
  proposalId: string;
};

/**
 * ProposalDetailClient — consumed by /dashboard/proposals/[proposalId]/page.tsx.
 */
export function ProposalDetailClient({ proposalId }: Props) {
  const router = useRouter();
  const { data, isLoading, isError, error } = usePayrollProposal(proposalId);

  const approve = useApproveProposal();
  const reject = useRejectProposal();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-destructive py-8 text-sm">
        {isError ? `Feil ved lasting: ${(error as Error).message}` : "Forslag ikke funnet."}
      </div>
    );
  }

  const { proposal, audit } = data;
  const { changes } = proposal;

  const delta =
    changes.original_amount_cents !== undefined && changes.proposed_amount_cents !== undefined
      ? changes.proposed_amount_cents - changes.original_amount_cents
      : null;

  const deltaPct =
    delta !== null && changes.original_amount_cents && changes.original_amount_cents !== 0
      ? Math.round((delta / changes.original_amount_cents) * 100)
      : null;

  const isPending = proposal.status === "pending";

  function handleApprove() {
    approve.mutate(
      { workspace_id: proposal.workspace_id, change_proposal_id: proposalId },
      {
        onSuccess: (result) => {
          toast.success("Override godkjent. Recalc kjører.");
          if (result.period_id) {
            router.push(`/dashboard/payroll/${result.period_id}`);
          } else {
            router.push("/dashboard/proposals");
          }
        },
      },
    );
  }

  function handleReject(reason: string) {
    reject.mutate(
      {
        workspace_id: proposal.workspace_id,
        change_proposal_id: proposalId,
        rejection_reason: reason,
      },
      {
        onSuccess: () => {
          setRejectOpen(false);
          toast.success("Override avvist.");
          router.push("/dashboard/proposals");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl">Lønns-override forslag</h1>
          <p className="text-muted-foreground text-sm">
            Foreslått av{" "}
            <span className="text-foreground font-medium">
              {proposal.profile?.display_name ?? "ukjent"}
            </span>{" "}
            <span className="flex inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(proposal.created_at), {
                addSuffix: true,
                locale: nb,
              })}
            </span>
          </p>
        </div>
        {statusBadge(proposal.status)}
      </div>

      {/* Main detail card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base">Oversikt</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Amount row */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Original</span>
              <span className="text-foreground text-lg font-medium">
                {changes.original_amount_cents !== undefined
                  ? formatNok(changes.original_amount_cents)
                  : "—"}
              </span>
            </div>
            <ArrowRight className="text-muted-foreground h-5 w-5 shrink-0 self-end pb-1" />
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Foreslått</span>
              <span className="text-foreground text-lg font-medium">
                {changes.proposed_amount_cents !== undefined
                  ? formatNok(changes.proposed_amount_cents)
                  : "—"}
              </span>
            </div>
            {delta !== null && (
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Differanse</span>
                <span
                  className={
                    delta >= 0
                      ? "text-lg font-medium text-green-700"
                      : "text-lg font-medium text-red-600"
                  }
                >
                  {delta >= 0 ? "+" : ""}
                  {formatNok(delta)}
                  {deltaPct !== null && ` (${delta >= 0 ? "+" : ""}${deltaPct} %)`}
                </span>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <span className="text-muted-foreground text-xs">Kategori</span>
            <p className="text-foreground text-sm">{categoryLabel(changes.category)}</p>
          </div>

          {/* Reason */}
          <div>
            <span className="text-muted-foreground text-xs">Begrunnelse</span>
            <p className="text-foreground text-sm">{changes.reason ?? "—"}</p>
          </div>

          {/* Audit IDs */}
          <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-xs">
            <span>Proposal ID</span>
            <span className="truncate font-mono">{proposal.change_proposal_id}</span>
            {changes.calculation_id && (
              <>
                <span>Beregning ID</span>
                <span className="truncate font-mono">{changes.calculation_id}</span>
              </>
            )}
            {changes.period_id && (
              <>
                <span>Periode ID</span>
                <span className="truncate font-mono">{changes.period_id}</span>
              </>
            )}
          </div>

          {/* Action buttons (visible when pending) */}
          {isPending && (
            <div className="flex gap-3 border-t pt-3">
              <Button
                onClick={() => setApproveOpen(true)}
                className="gap-2"
                disabled={approve.isPending || reject.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                Godkjenn
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejectOpen(true)}
                className="gap-2 text-red-600 hover:text-red-700"
                disabled={approve.isPending || reject.isPending}
              >
                <XCircle className="h-4 w-4" />
                Avvis
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit trail */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base">Audit-spor</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditPanel rows={audit} />
        </CardContent>
      </Card>

      {/* Modals */}
      <ApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleApprove}
        isLoading={approve.isPending}
        proposal={proposal}
      />

      <RejectModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        isLoading={reject.isPending}
      />
    </div>
  );
}
