"use client";

/**
 * PotRegistrationModal — lets the manager register a tips pot for a session.
 *
 * Opened from OkonomiTab tips tile. Calls useSetTipsPot() which POSTs to
 * /api/tips/set-pot and invalidates ["tips-pool", departmentSessionId].
 *
 * Error mapping (ADR-0229 skeletons-only-no-emit — no emit here, BFF side):
 *   no_active_policy → "Ingen tips-policy konfigurert for avdelingen"
 *   no_shifts        → "Ingen ansatte registrert pa vakt"
 *   pool_exists      → "Pot allerede registrert"
 *   unauthorized     → "Du har ikke rettigheter"
 *   (default)        → raw message
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
import { Badge } from "@/components/ui/badge";
import { Loader2, Coins } from "lucide-react";
import { toast } from "sonner";
import { useSetTipsPot } from "@/hooks/mutations/use-set-tips-pot";

function mapError(rawError: string): string {
  switch (rawError) {
    case "no_active_policy":
      return "Ingen tips-policy konfigurert for avdelingen — be admin opprette policy forst";
    case "no_shifts":
      return "Ingen ansatte registrert pa vakt — kan ikke beregne distribusjon";
    case "pool_exists":
      return "Pot allerede registrert — ga til Reconciliation for justering";
    case "unauthorized":
      return "Du har ikke rettigheter til a registrere tips";
    default:
      return rawError;
  }
}

type Props = {
  departmentSessionId: string;
  open: boolean;
  onOpenChange: (b: boolean) => void;
  /** Optional: algorithm name shown as a read-only badge (e.g. "by_hours") */
  algorithm?: string | null;
};

export function PotRegistrationModal({
  departmentSessionId,
  open,
  onOpenChange,
  algorithm,
}: Props) {
  const [amountNok, setAmountNok] = useState("");
  const [notes, setNotes] = useState("");
  const mutation = useSetTipsPot();

  function reset() {
    setAmountNok("");
    setNotes("");
  }

  function handleOpenChange(val: boolean) {
    if (!val) reset();
    onOpenChange(val);
  }

  function handleSubmit() {
    const amount = parseFloat(amountNok);
    if (isNaN(amount) || amount < 0) return;

    mutation.mutate(
      {
        department_session_id: departmentSessionId,
        amount_nok: Math.round(amount * 100) / 100,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Tips-pot registrert");
          handleOpenChange(false);
        },
        onError: (err) => {
          toast.error(mapError(err.message));
        },
      },
    );
  }

  const parsedAmount = parseFloat(amountNok);
  const canSubmit =
    !isNaN(parsedAmount) && parsedAmount >= 0 && amountNok.trim() !== "" && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" aria-hidden />
            Registrer tips-pot
          </DialogTitle>
          <DialogDescription>
            Angi dagens tips-pot. Belop fordeles automatisk etter aktiv algoritme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Algorithm badge — read-only */}
          {algorithm && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">Algoritme:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {algorithm}
              </Badge>
            </div>
          )}

          {/* Amount field */}
          <div className="space-y-1.5">
            <Label htmlFor="tips-amount">
              Belop (NOK) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <input
                id="tips-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amountNok}
                onChange={(e) => setAmountNok(e.target.value)}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 pr-12 font-mono text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label="Tips-belop i NOK"
              />
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium">
                NOK
              </span>
            </div>
          </div>

          {/* Notes field */}
          <div className="space-y-1.5">
            <Label htmlFor="tips-notes">
              Notater <span className="text-muted-foreground text-xs font-normal">(valgfritt)</span>
            </Label>
            <Textarea
              id="tips-notes"
              placeholder="F.eks. stort selskap, ekstra driks fra bar…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
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
                Registrerer…
              </>
            ) : (
              "Registrer pot"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
