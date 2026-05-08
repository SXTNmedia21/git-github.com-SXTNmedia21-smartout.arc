/**
 * UnmaskedConfirmDialog — modal for confirming "Include unmasked PII" toggle.
 *
 * Shown when the admin turns on the "Inkluder upålitt PII" switch in ExportTab.
 * The toggle only stays ON if the admin confirms in this dialog.
 * Cancelling reverts the toggle to OFF.
 *
 * This is a pure UI gate — the actual PII handling is enforced server-side
 * by the capability tool and emits payroll.csv_export_unmasked to activity_trail.
 *
 * ADR-0078: Høy-PII — shown only on web (ExportTab is web-only per ADR-0133).
 * Nordic Split: all colours via CSS variables — no hardcoded hex/oklch.
 *
 * L-0176 compliance: docstring written after body verified.
 */
"use client";

import type { JSX } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type UnmaskedConfirmDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function UnmaskedConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: UnmaskedConfirmDialogProps): JSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-3 flex items-center gap-2">
            <div className="bg-destructive/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
          </div>
          <DialogTitle className="font-heading text-foreground text-xl">
            Bekreft upålitt PII-eksport
          </DialogTitle>
          <DialogDescription className="text-muted-foreground mt-1 text-sm leading-relaxed">
            CSV vil inneholde personnummer og bankkonto i klartekst. Eksporten logges til
            revisjons-sporet.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-2 gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onCancel}>
            Avbryt
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Bekreft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
