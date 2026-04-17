"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addDunningNote } from "../../_actions/addDunningNote";
import type { InvoiceStatus } from "@smartout/ui";

// Phase 7.9 — DunningNoteDialog
//
// Simple textarea. The Server Action writes to billing_activity_log
// via emit() and bumps dunning_status none → in_negotiation if the
// invoice is in an active status. No fancy UI state needed.

type InvoiceSummary = {
  invoice_id: string;
  invoice_number: number | null;
  amount_incl_vat: number;
  status: InvoiceStatus;
};

export function DunningNoteDialog({
  invoice,
  open,
  onClose,
}: {
  invoice: InvoiceSummary;
  open: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");

  const canSubmit = note.trim().length >= 1 && note.length <= 2000;

  const submit = () => {
    start(async () => {
      const result = await addDunningNote({
        invoice_id: invoice.invoice_id,
        note: note.trim(),
      });

      if (result.ok) {
        toast.success("Notat lagret.");
        setNote("");
        onClose();
      } else {
        toast.error(`Kunne ikke lagre notat: ${result.error}`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Legg til notat — faktura #{invoice.invoice_number ?? "—"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="dunning-note">Notat</Label>
          <textarea
            id="dunning-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={5}
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            placeholder="Samtale med kunde, avtalt betalingsplan, betalingslovnad…"
          />
          <p className="text-muted-foreground text-xs">
            Notatet lagres i billing_activity_log (ADR-0125) og blir synlig i fakturaens
            historikk-fane.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button disabled={!canSubmit || pending} onClick={submit}>
            {pending ? "Lagrer…" : "Lagre notat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
