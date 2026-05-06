"use client";

import { Lock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
  periodLabel: string;
};

/**
 * Confirmation dialog before locking a payroll period.
 *
 * Warns the manager that locking is irreversible (no unlock — only corrective
 * period per Bokf. §13). Shows only when the period has no unacknowledged
 * error-severity deviations (the caller already checked).
 */
export function LockModal({ open, onOpenChange, onConfirm, isLoading, periodLabel }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Lås lønnsperiode?
          </AlertDialogTitle>
          <AlertDialogDescription className="mt-2 space-y-2 text-left">
            <span className="block">
              Du er i ferd med å låse perioden <strong>{periodLabel}</strong>.
            </span>
            <span className="block text-amber-700">
              Låsing er irreversibel. En låst periode kan ikke åpnes igjen — kun en korrigerende
              periode i neste syklus kan rette eventuelle feil (Bokf. §13).
            </span>
            <span className="block">Alle avvik er bekreftet. Fortsett?</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Låser…" : "Lås periode"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
