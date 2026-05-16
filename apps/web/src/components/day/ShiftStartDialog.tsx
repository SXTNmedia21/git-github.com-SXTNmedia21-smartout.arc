"use client";

// =============================================================================
// ShiftStartDialog.tsx
//
// Minimal "Vaktstart" confirmation dialog for the SlotQuickAddPopover action.
//
// Phase 1 stub: resolves the clicked time and shows a confirm dialog.
// The actual shift-start action (writing to schedule_shift_assignment or
// department_session) is not wired in this sortie — that write path belongs
// to the shift-start engine_process flow which is outside Track C scope.
//
// TODO(follow-up sortie): wire shift_start action — find the active shift for
// the current session + actor, call start-shift-action (or equivalent), emit
// shift.started, and invalidate ["day-control", "timeline-events"].
// =============================================================================

import { useState } from "react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
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

type ShiftStartDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** HH:MM of the slot the manager clicked */
  time: string;
};

export function ShiftStartDialog({ open, onOpenChange, time }: ShiftStartDialogProps) {
  const [isPending, setIsPending] = useState(false);

  function handleConfirm() {
    setIsPending(true);

    // TODO(follow-up sortie): wire to actual shift-start action.
    // When available:
    //   1. Resolve active shift_id for (workspace, department, sessionId, actor_id)
    //   2. Call start-shift-action({ shiftId, startedAt: time })
    //   3. emit("shift.started", { workspace_id, actor_id, ... })
    //   4. invalidateQueries(["day-control", "timeline-events"])
    //
    // For now: placeholder toast so manager sees intent confirmed.
    setTimeout(() => {
      toast.info(`Vaktstart ${time} — kobling til vakthandling settes opp i oppfølgingssortie.`);
      setIsPending(false);
      onOpenChange(false);
    }, 300);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="shift-start-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading flex items-center gap-2">
            <LogIn className="h-4 w-4" aria-hidden />
            Start vakt kl {time}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Bekreft at vakten startes kl {time}. Systemet registrerer vaktstart og oppdaterer
            dagslinjen.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Registrerer…" : "Start vakt"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
