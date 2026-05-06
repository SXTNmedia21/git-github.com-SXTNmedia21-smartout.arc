"use client";

// Generic destructive AlertDialog with loading lock, error banner, and prevent-close-while-pending.
//
// NOTE: data-testid values below are tied to "cancel-*" names because the only current
// consumer is the contract-cancel flow in contracts-data-table.tsx. Revisit if reused.

import { AlertTriangle, Loader2 } from "lucide-react";
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
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel: string;
  isPending: boolean;
  error?: { message: string } | null;
  onConfirm: () => void;
};

export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  isPending,
  error,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        data-testid="cancel-dialog"
        onEscapeKeyDown={(e) => {
          if (isPending) e.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div
            data-testid="cancel-error-banner"
            className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            <AlertTriangle className="mr-2 inline size-4" />
            {error.message}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel data-testid="cancel-keep-btn" disabled={isPending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="cancel-confirm-btn"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isPending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
