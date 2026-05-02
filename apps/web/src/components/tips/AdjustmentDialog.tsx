"use client";

/**
 * AdjustmentDialog — lets the manager adjust a single employee's tips share.
 *
 * Opened from row click in DayDetail Tips-tab. Shows the calculated amount
 * (read-only) and lets the manager enter a new amount + mandatory reason.
 * Calls useAdjustTipsShare() which POSTs to /api/tips/adjust-share.
 *
 * Error mapping:
 *   pool_locked        → "Distribusjonen er last — godkjenning er allerede gitt"
 *   four_eyes_required → "Justering krever fire-oyne-godkjenning — kontakt overordnet"
 *   (default)          → raw message
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { useAdjustTipsShare } from "@/hooks/mutations/use-adjust-tips-share";

function mapError(rawError: string): string {
  switch (rawError) {
    case "pool_locked":
      return "Distribusjonen er last — godkjenning er allerede gitt";
    case "four_eyes_required":
      return "Justering krever fire-oyne-godkjenning — kontakt overordnet";
    default:
      return rawError;
  }
}

function formatNok(amount: number): string {
  return (
    amount.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr"
  );
}

type DistributionProp = {
  id: string;
  profile_id: string;
  profile_name?: string | null;
  calculated_amount: number;
  adjusted_amount: number | null;
};

type Props = {
  distribution: DistributionProp;
  departmentSessionId: string;
  open: boolean;
  onOpenChange: (b: boolean) => void;
};

export function AdjustmentDialog({ distribution, departmentSessionId, open, onOpenChange }: Props) {
  const currentEffective =
    distribution.adjusted_amount !== null && distribution.adjusted_amount !== undefined
      ? distribution.adjusted_amount
      : distribution.calculated_amount;

  const [newAmount, setNewAmount] = useState(String(currentEffective));
  const [reason, setReason] = useState("");
  const mutation = useAdjustTipsShare();

  function reset() {
    setNewAmount(String(currentEffective));
    setReason("");
  }

  function handleOpenChange(val: boolean) {
    if (!val) reset();
    onOpenChange(val);
  }

  function handleSubmit() {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount < 0) return;
    if (reason.trim().length < 5) return;

    mutation.mutate(
      {
        distribution_id: distribution.id,
        new_amount: Math.round(amount * 100) / 100,
        reason: reason.trim(),
        department_session_id: departmentSessionId,
      },
      {
        onSuccess: () => {
          toast.success("Tips-andel justert");
          handleOpenChange(false);
        },
        onError: (err) => {
          toast.error(mapError(err.message));
        },
      },
    );
  }

  const parsedAmount = parseFloat(newAmount);
  const reasonValid = reason.trim().length >= 5;
  const canSubmit = !isNaN(parsedAmount) && parsedAmount >= 0 && reasonValid && !mutation.isPending;

  const profileLabel = distribution.profile_name ?? distribution.profile_id.slice(0, 8) + "…";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" aria-hidden />
            Juster tips-andel
          </DialogTitle>
          <DialogDescription>
            Juster beregnet tips-andel for {profileLabel}. Begrunnelse er pakrevd (min. 5 tegn).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Read-only calculated amount */}
          <div className="border-border bg-muted/40 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium">Beregnet andel</p>
            <p className="text-foreground font-mono text-sm font-semibold">
              {formatNok(distribution.calculated_amount)}
            </p>
            {distribution.adjusted_amount !== null && (
              <>
                <p className="text-muted-foreground mt-1 text-xs font-medium">Siste justering</p>
                <p className="text-foreground font-mono text-sm font-semibold">
                  {formatNok(distribution.adjusted_amount)}
                </p>
              </>
            )}
          </div>

          {/* New amount */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-amount">
              Nytt belop (NOK) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <input
                id="adj-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 pr-12 font-mono text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label="Nytt tips-belop i NOK"
              />
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium">
                NOK
              </span>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">
              Begrunnelse <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="adj-reason"
              placeholder="Oppgi arsak til justering (min. 5 tegn)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              aria-describedby="adj-reason-hint"
            />
            {reason.trim().length > 0 && reason.trim().length < 5 && (
              <p id="adj-reason-hint" className="text-destructive text-xs">
                Begrunnelse ma vare minst 5 tegn
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
          >
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Lagrer…
              </>
            ) : (
              "Lagre justering"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
