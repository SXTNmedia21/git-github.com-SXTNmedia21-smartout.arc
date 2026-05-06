"use client";

import { AlertTriangle, Check, X, Play, Clock } from "lucide-react";
import type { ChangeProposal } from "../_hooks/use-change-proposals";

type ProposalPreview = {
  affectedDepartments: Array<{ departmentId: string; name: string }>;
  affectedSessions: Array<{ sessionId: string; sessionDate: string }>;
  autoAdjustShifts: Array<{ shiftId: string }>;
  impactedConfirmedShifts: Array<{ shiftId: string; date: string }>;
};

type ChangeProposalDialogProps = {
  proposal: ChangeProposal | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onApply: (id: string) => void;
  isApplying?: boolean;
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending: { label: "Venter", color: "bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Godkjent", color: "bg-green-500/10 text-green-400" },
  applied: { label: "Gjennomført", color: "bg-blue-500/10 text-blue-400" },
  rejected: { label: "Avvist", color: "bg-red-500/10 text-red-400" },
  failed: { label: "Feilet", color: "bg-red-500/10 text-red-400" },
};

export function ChangeProposalDialog({
  proposal,
  onClose,
  onApprove,
  onReject,
  onApply,
  isApplying,
}: ChangeProposalDialogProps) {
  if (!proposal) return null;

  const preview = (proposal.preview ?? {}) as ProposalPreview;
  const payload = proposal.changes;
  const changeType = payload.change_type as string;
  const badge = STATUS_BADGE[proposal.status] ?? STATUS_BADGE["pending"]!;

  return (
    <div className="animate-in fade-in bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="border-border bg-card w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-foreground font-bold">Endringsforslag</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          <button onClick={onClose} className="hover:bg-accent rounded-full p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-5">
          {/* Change type */}
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Type endring
            </p>
            <p className="text-foreground text-sm">
              {changeType === "workspace_hours"
                ? "Arbeidstidens åpningstider"
                : changeType === "department_hours"
                  ? "Avdelingens åpningstider"
                  : "Avdelingstype"}
            </p>
          </div>

          {/* Preview: affected departments */}
          {preview.affectedDepartments?.length > 0 && (
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Påvirkede avdelinger
              </p>
              <p className="text-foreground text-sm">
                {preview.affectedDepartments.map((d) => d.name).join(", ")}
              </p>
            </div>
          )}

          {/* Preview: sessions */}
          {preview.affectedSessions?.length > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-foreground text-sm">
                {preview.affectedSessions.length} økter vil oppdatere planlagte tider
              </span>
            </div>
          )}

          {/* Preview: auto-adjust shifts */}
          {preview.autoAdjustShifts?.length > 0 && (
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-foreground text-sm">
                {preview.autoAdjustShifts.length} ubekreftede vakter justeres automatisk
              </span>
            </div>
          )}

          {/* Preview: impacted confirmed shifts */}
          {preview.impactedConfirmedShifts?.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">
                  {preview.impactedConfirmedShifts.length} bekreftede vakter krever manuell
                  gjennomgang
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-border flex items-center justify-end gap-3 border-t px-6 py-4">
          {proposal.status === "pending" && (
            <>
              <button
                onClick={() => onReject(proposal.change_proposal_id)}
                className="text-muted-foreground hover:bg-accent rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Avvis
              </button>
              <button
                onClick={() => onApprove(proposal.change_proposal_id)}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
              >
                Godkjenn
              </button>
            </>
          )}
          {proposal.status === "approved" && (
            <button
              onClick={() => onApply(proposal.change_proposal_id)}
              disabled={isApplying}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {isApplying ? "Gjennomfører..." : "Gjennomfør endring"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
