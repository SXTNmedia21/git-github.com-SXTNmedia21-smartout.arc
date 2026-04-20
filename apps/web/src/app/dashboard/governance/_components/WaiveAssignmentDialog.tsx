"use client";

/**
 * Confirmation dialog for waiving a protocol assignment.
 * Requires a reason (text input) before submitting.
 * Connected to: useWaiveAssignment mutation, ProtocolEmployeeList row actions
 */

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useWaiveAssignment } from "../_hooks/use-assignment-mutations";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface WaiveAssignmentDialogProps {
  assignmentId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaiveAssignmentDialog({
  assignmentId,
  employeeName,
  open,
  onOpenChange,
}: WaiveAssignmentDialogProps) {
  const waive = useWaiveAssignment();
  const [reason, setReason] = useState("");

  const handleConfirm = useCallback(() => {
    if (!reason.trim()) return;

    waive.mutate(
      { assignmentId, reason: reason.trim() },
      {
        onSuccess: () => {
          setReason("");
          onOpenChange(false);
        },
      },
    );
  }, [assignmentId, reason, waive, onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setReason("");
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Frafalle tildeling?</AlertDialogTitle>
          <AlertDialogDescription>
            Du er i ferd med a frafalle protokolltildelingen for{" "}
            <span className="text-foreground font-medium">{employeeName}</span>. Denne handlingen
            kan ikke angres automatisk.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="waive-reason">Begrunnelse (pakrevd)</Label>
          <Textarea
            id="waive-reason"
            placeholder="Forklar hvorfor tildelingen frafalles..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={waive.isPending}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason.trim() || waive.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {waive.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Frafalle
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
