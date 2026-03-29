"use client";

/**
 * AgentConfirmationDialog — Promise-based confirmation popup for AI actions.
 * Renders when a voice tool calls requestConfirmation(). The dialog resolves
 * the Promise with true (Godkjenn) or false (Avslå), gating the action.
 *
 * Not schedule-specific by design — can be lifted to Botsson/ later.
 * Lives here because voice tools execute in the schedule bridge context.
 */

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

type AgentConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AgentConfirmationDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: AgentConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="border-border bg-card sm:max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            Avslå
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
          >
            Godkjenn
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
