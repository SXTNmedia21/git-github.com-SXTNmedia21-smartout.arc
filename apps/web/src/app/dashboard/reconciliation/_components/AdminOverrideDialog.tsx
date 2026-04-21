"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { overrideReconciliationAction } from "../_actions/override-reconciliation-action";

type Props = {
  reconciliationId: string;
  blockerCount: number;
  disabled?: boolean;
};

const MIN_REASON_LENGTH = 20;

export function AdminOverrideDialog({ reconciliationId, blockerCount, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const qc = useQueryClient();

  const reasonTooShort = reason.trim().length < MIN_REASON_LENGTH;
  const remaining = MIN_REASON_LENGTH - reason.trim().length;

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    if (reasonTooShort) return;

    startTransition(async () => {
      const result = await overrideReconciliationAction({
        reconciliationId,
        reason: reason.trim(),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Oppgjør godkjent med overstyring. Loggført i revisjonslogg.");
      qc.invalidateQueries({ queryKey: ["reconciliation-list"] });
      qc.invalidateQueries({ queryKey: ["reconciliation-detail"] });
      qc.invalidateQueries({ queryKey: ["reconciliation-audit-trail"] });
      setReason("");
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="w-full justify-center gap-1.5"
        >
          <ShieldAlert className="h-4 w-4" aria-hidden />
          Overstyr og godkjenn
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">Overstyr preflight</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Du overstyrer {blockerCount} {blockerCount === 1 ? "blokker" : "blokkere"} på
                preflight-kontrollen. Dette loggføres eksplisitt i revisjonsloggen med begrunnelse
                og aktør.
              </p>
              <p className="text-muted-foreground">
                Override-frekvens spores i campaign-invariant #9 (target under 10 %).
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="override-reason" className="text-sm font-medium">
            Begrunnelse{" "}
            <span className="text-muted-foreground">(minst {MIN_REASON_LENGTH} tegn)</span>
          </label>
          <textarea
            id="override-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="F.eks. Kompressor fikset 13:45, dokumentert i ticket 1234, tekniker bekrefter muntlig."
            className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-describedby="override-reason-hint"
          />
          <p
            id="override-reason-hint"
            className={
              reasonTooShort ? "text-destructive text-xs" : "text-muted-foreground text-xs"
            }
            aria-live="polite"
          >
            {reasonTooShort
              ? `${remaining} tegn igjen før du kan bekrefte.`
              : "Klar til å bekrefte."}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={reasonTooShort || isPending}
            className="gap-1.5"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Bekreft overstyring
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
