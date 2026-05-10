/**
 * LineOverrideModal — manager proposes a wage-line override (T4.1).
 *
 * Opens from LineDrawer "Overstyr linje" action on derived calculation_line rows.
 * Sends a change_proposal (kind='wage_line_override', status='pending') via
 * POST /api/payroll/propose-line-override (BFF). Admin must approve before
 * the line is updated.
 *
 * ADR-0133: web-only authoring surface.
 * ADR-0292: this modal writes change_proposal only — payroll_calculation untouched.
 * ADR-0078: Høy-PII — rendered in web chat-equivalent surface only.
 * Nordic Split: all colours from CSS variables, no hardcoded values.
 *
 * L-0176 compliance: docstring written after body verified.
 */
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, ExternalLink } from "lucide-react";
import { useProposeLineOverride } from "../_hooks/use-line-overrides";

// ─── Types ─────────────────────────────────────────────────────────────────

export type OverrideLine = {
  id: string;
  profileName: string;
  shiftDate: string;
  category: string;
  totalPay: number;
  source: string;
  existingProposalId?: string;
};

export type LineOverrideModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  /** Used to block submit UI when period is locked. Defaults to 'open'. */
  periodStatus?: string;
  line: OverrideLine | null;
  onSuccess?: () => void;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatNok(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type Category = "manual_adjustment" | "tariff_interpretation" | "shift_data_error" | "other";

const CATEGORY_LABELS: Record<Category, string> = {
  manual_adjustment: "Manuell justering",
  tariff_interpretation: "Tariff-tolkning",
  shift_data_error: "Vakt-data feil",
  other: "Annet",
};

const MIN_REASON_LENGTH = 8;

// ─── Component ─────────────────────────────────────────────────────────────

export function LineOverrideModal({
  open,
  onOpenChange,
  periodId,
  periodStatus = "open",
  line,
  onSuccess,
}: LineOverrideModalProps) {
  const [proposedAmount, setProposedAmount] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<Category>("manual_adjustment");

  const isLocked = periodStatus === "locked" || periodStatus === "approved";
  const hasPendingOverride = Boolean(line?.existingProposalId);
  const isDisabled = isLocked || hasPendingOverride;

  const { mutate, isPending } = useProposeLineOverride(periodId, () => {
    // Reset form and close
    setProposedAmount("");
    setReason("");
    setCategory("manual_adjustment");
    onOpenChange(false);
    onSuccess?.();
  });

  function handleClose() {
    if (isPending) return;
    setProposedAmount("");
    setReason("");
    setCategory("manual_adjustment");
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!line || isDisabled) return;

    const parsedAmount = parseFloat(proposedAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (reason.trim().length < MIN_REASON_LENGTH) return;

    mutate({
      period_id: periodId,
      calculation_line_id: line.id,
      proposed_amount: parsedAmount,
      reason: reason.trim(),
      category,
    });
  }

  const parsedAmount = parseFloat(proposedAmount);
  const amountValid = !isNaN(parsedAmount) && parsedAmount > 0;
  const reasonValid = reason.trim().length >= MIN_REASON_LENGTH;
  const canSubmit = amountValid && reasonValid && !isDisabled && !isPending && !!line;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      {/* Fix 3: [&>button:first-of-type]:hidden hides the auto-rendered DialogPrimitive.Close X button.
          Close paths: Avbryt button + backdrop click + Escape key (all work by default). */}
      <DialogContent className="sm:max-w-md [&>button:first-of-type]:hidden">
        <DialogHeader>
          <DialogTitle className="font-heading text-base">Overstyr linje</DialogTitle>
        </DialogHeader>

        {line && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Context display — read-only row info */}
            <div className="bg-muted/50 space-y-1 rounded-md p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ansatt</span>
                <span className="text-foreground font-medium">{line.profileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dato</span>
                <span className="text-foreground">{line.shiftDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kategori</span>
                <span className="text-foreground">{line.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nåværende beløp</span>
                <span className="text-foreground font-semibold tabular-nums">
                  {formatNok(line.totalPay)}
                </span>
              </div>
            </div>

            {/* Disabled state messages */}
            {isLocked && (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>Periode er låst — overstyring ikke mulig.</span>
              </div>
            )}

            {!isLocked && hasPendingOverride && (
              <div className="border-border bg-muted text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>Det finnes allerede et ubehandlet forslag for denne linjen.</span>
                {line.existingProposalId && (
                  <a
                    href={`/dashboard/proposals/${line.existingProposalId}`}
                    className="ml-auto flex items-center gap-1 text-xs hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Se forslag
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {/* Proposed amount */}
            <div className="space-y-1.5">
              <Label htmlFor="proposed-amount">
                Foreslått ny verdi (NOK){" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="proposed-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={proposedAmount}
                onChange={(e) => setProposedAmount(e.target.value)}
                disabled={isDisabled || isPending}
                className="tabular-nums"
                aria-required="true"
              />
              {proposedAmount && !amountValid && (
                <p className="text-destructive text-xs">Beløp må være positivt</p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="override-category">Kategori</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as Category)}
                disabled={isDisabled || isPending}
              >
                <SelectTrigger id="override-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="override-reason">
                Grunn{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Textarea
                id="override-reason"
                placeholder="Beskriv årsaken til overstyringen (min. 8 tegn)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isDisabled || isPending}
                rows={3}
                aria-required="true"
                minLength={MIN_REASON_LENGTH}
              />
              <p className="text-muted-foreground text-xs">
                {reason.trim().length}/{MIN_REASON_LENGTH} tegn minimum
              </p>
              {reason.trim().length > 0 && !reasonValid && (
                <p className="text-destructive text-xs">
                  Grunn må være minst {MIN_REASON_LENGTH} tegn
                </p>
              )}
            </div>

            <p className="text-muted-foreground text-xs">
              Forslaget sendes til admin for godkjenning.
            </p>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Avbryt
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isPending ? "Sender…" : "Send forslag"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
