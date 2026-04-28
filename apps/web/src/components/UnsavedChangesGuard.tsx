"use client";

// AlertDialog that interrupts drawer/dialog close when there are unsaved changes.

import { useTranslation } from "@smartout/i18n";
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
  // isDirty is unused inside the component; callers gate rendering/open based on this value.
  isDirty: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDiscard: () => void;
};

export function UnsavedChangesGuard({
  isDirty: _isDirty,
  open,
  onOpenChange,
  onConfirmDiscard,
}: Props) {
  const { t } = useTranslation("common");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.unsaved.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("common.unsaved.body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.unsaved.keep")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              // Call onConfirmDiscard only. Radix AlertDialog auto-closes after
              // AlertDialogAction click; the parent's onConfirmDiscard handler
              // is responsible for setting guardOpen=false. A second explicit
              // onOpenChange(false) here caused a double close-event that the
              // parent re-interpreted as "kept" telemetry.
              onConfirmDiscard();
            }}
          >
            {t("common.unsaved.discard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
