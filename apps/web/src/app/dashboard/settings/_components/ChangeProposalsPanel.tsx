"use client";

// Panel for viewing and managing cascade change proposals.
//
// Uses the existing useChangeProposals() hook and ChangeProposalDialog.
// Proposals are split into two sections:
//   - Active (pending/approved/failed) — actionable
//   - Historikk (applied/rejected) — read-only archive
//
// UI Events:
// - action: click proposal row → open ChangeProposalDialog
// - action: approve/reject/apply via dialog callbacks

import { useState } from "react";
import { Clock, Check, X, AlertTriangle, GitBranch } from "lucide-react";
import { Card, Skeleton } from "@smartout/ui";
import { useChangeProposals, type ChangeProposal } from "../_hooks/use-change-proposals";
import { ChangeProposalDialog } from "./ChangeProposalDialog";

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Venter", color: "bg-yellow-500/10 text-yellow-400", icon: Clock },
  approved: { label: "Godkjent", color: "bg-green-500/10 text-green-400", icon: Check },
  applied: { label: "Gjennomført", color: "bg-blue-500/10 text-blue-400", icon: Check },
  rejected: { label: "Avvist", color: "bg-red-500/10 text-red-400", icon: X },
  failed: { label: "Feilet", color: "bg-red-500/10 text-red-400", icon: AlertTriangle },
};

// ─── Change type labels ───────────────────────────────────────────────────────

function getChangeTypeLabel(changes: Record<string, unknown>): string {
  const changeType = changes.change_type as string | undefined;
  switch (changeType) {
    case "workspace_hours":
      return "Åpningstider (workspace)";
    case "department_hours":
      return "Åpningstider (avdeling)";
    case "framework_rule_change":
      return "Regelendring";
    case "tariff_adjustment":
      return "Tariffjustering";
    default:
      return changeType ?? "Ukjent endring";
  }
}

// ─── Proposal card ────────────────────────────────────────────────────────────

function ProposalCard({ proposal, onClick }: { proposal: ChangeProposal; onClick: () => void }) {
  const config = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG["pending"]!;
  const Icon = config.icon;
  const createdDate = new Date(proposal.created_at).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="hover:bg-accent cursor-pointer p-4 transition-colors" onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className={`rounded-full p-1.5 ${config.color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-medium">
            {getChangeTypeLabel(proposal.changes)}
          </p>
          <p className="text-muted-foreground text-xs">{createdDate}</p>
        </div>

        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>
    </Card>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ProposalsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="h-7 w-7 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </Card>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChangeProposalsPanel() {
  const { proposals, isLoading, approveProposal, rejectProposal, applyProposal } =
    useChangeProposals();
  const [selectedProposal, setSelectedProposal] = useState<ChangeProposal | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-96" />
        </div>
        <ProposalsSkeleton />
      </div>
    );
  }

  // Split into active vs history
  const activeProposals = proposals.filter(
    (p) => p.status === "pending" || p.status === "approved" || p.status === "failed",
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-foreground text-lg font-semibold">Endringsforslag</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Forslag til endringer i arbeidstider, regler eller tariffavtaler. Godkjenn og gjennomfør
          endringer her.
        </p>
      </div>

      {/* Empty state */}
      {activeProposals.length === 0 && (
        <div className="border-border bg-muted/40 rounded-lg border border-dashed px-4 py-8">
          <div className="flex flex-col items-center text-center">
            <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-full">
              <GitBranch className="text-muted-foreground h-5 w-5" />
            </div>
            <p className="text-muted-foreground text-sm">
              Ingen aktive endringsforslag. Forslag opprettes automatisk når endringer i
              åpningstider eller regler påvirker eksisterende vakter.
            </p>
          </div>
        </div>
      )}

      {/* Active proposals */}
      {activeProposals.length > 0 && (
        <div className="space-y-2">
          {activeProposals.map((proposal) => (
            <ProposalCard
              key={proposal.change_proposal_id}
              proposal={proposal}
              onClick={() => setSelectedProposal(proposal)}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      <ChangeProposalDialog
        proposal={selectedProposal}
        onClose={() => setSelectedProposal(null)}
        onApprove={(id) => {
          approveProposal.mutate(id);
          setSelectedProposal(null);
        }}
        onReject={(id) => {
          rejectProposal.mutate(id);
          setSelectedProposal(null);
        }}
        onApply={(id) => {
          applyProposal.mutate(id);
          setSelectedProposal(null);
        }}
        isApplying={applyProposal.isPending}
      />
    </div>
  );
}
