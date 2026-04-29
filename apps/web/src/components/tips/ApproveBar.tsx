"use client";

/**
 * ApproveBar — sticky bottom bar in SignoffTab for tips approval.
 *
 * Shows total distribution amount, a confirmation checkbox, and "Godkjenn"-knapp
 * (disabled until checkbox is checked). Calls useApproveTipsDistribution().
 *
 * Error mapping:
 *   invalid_state      → "Potten er ikke i riktig tilstand for godkjenning"
 *   already_approved   → "Distribusjonen er allerede godkjent"
 *   workspace_mismatch → "Arbeidsomrade-konflikt — ta kontakt med support"
 *   (default)          → raw message
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useApproveTipsDistribution } from "@/hooks/mutations/use-approve-tips-distribution";

function mapError(rawError: string): string {
  switch (rawError) {
    case "invalid_state":
      return "Potten er ikke i riktig tilstand for godkjenning";
    case "already_approved":
      return "Distribusjonen er allerede godkjent";
    case "workspace_mismatch":
      return "Arbeidsomrade-konflikt — ta kontakt med support";
    default:
      return rawError;
  }
}

function formatNok(amount: number): string {
  return (
    amount.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr"
  );
}

type Props = {
  poolId: string;
  departmentSessionId: string;
  /** Sum of all effective distribution amounts. */
  total: number;
  /** pool.amount_nok - sumDistributed. Non-zero = rounding difference. */
  diffFromPot: number;
};

export function ApproveBar({ poolId, departmentSessionId, total, diffFromPot }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useApproveTipsDistribution();

  function handleApprove() {
    if (!confirmed) return;
    mutation.mutate(
      { pool_id: poolId, department_session_id: departmentSessionId },
      {
        onSuccess: () => {
          toast.success("Tips godkjent og distribusjon last");
          setConfirmed(false);
        },
        onError: (err) => {
          toast.error(mapError(err.message));
        },
      },
    );
  }

  const hasDiff = diffFromPot !== 0;

  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
      {/* Total row */}
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-muted-foreground text-sm font-medium">Total utbetaling</span>
        <span className="text-foreground font-mono text-base font-bold">{formatNok(total)}</span>
      </div>

      {/* Diff warning — only shown when sums do not reconcile exactly */}
      {hasDiff && (
        <div className="border-warning/30 bg-warning/10 text-warning mb-3 rounded-lg border px-3 py-2 text-xs font-medium">
          Differanse vs pot: {diffFromPot > 0 ? "+" : ""}
          {formatNok(diffFromPot)} — juster andeler for a nullstille
        </div>
      )}

      {/* Confirmation checkbox */}
      <div className="mb-4 flex items-start gap-3">
        <Checkbox
          id="tips-approve-confirm"
          checked={confirmed}
          onCheckedChange={(val) => setConfirmed(val === true)}
          disabled={mutation.isPending}
          aria-label="Bekreft tips-godkjenning"
        />
        <Label
          htmlFor="tips-approve-confirm"
          className="text-muted-foreground cursor-pointer text-xs leading-relaxed"
        >
          Jeg bekrefter at tips-potten og distribusjonen er gjennomgatt og klar for utbetaling.
          Dette kan ikke angres uten admin-tilgang.
        </Label>
      </div>

      {/* Approve button */}
      <Button
        type="button"
        onClick={handleApprove}
        disabled={!confirmed || mutation.isPending}
        className="w-full gap-1.5"
        aria-label="Godkjenn tips-distribusjon"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Godkjenner…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Godkjenn
          </>
        )}
      </Button>
    </div>
  );
}
