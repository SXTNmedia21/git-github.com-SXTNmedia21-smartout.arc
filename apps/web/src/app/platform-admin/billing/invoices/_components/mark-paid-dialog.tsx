"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { markInvoicePaid } from "../../_actions/markInvoicePaid";
import type { InvoiceStatus } from "@smartout/ui";

// Phase 7.9 — MarkPaidDialog
//
// Form for the markInvoicePaid Server Action. Fields: payment_date,
// amount (defaults to invoice total), channel, reference, optional
// notes. idempotency_key is generated client-side via crypto.randomUUID()
// (secure enough for de-dup under sub-second retries).

type InvoiceSummary = {
  invoice_id: string;
  invoice_number: number | null;
  amount_incl_vat: number;
  status: InvoiceStatus;
};

export function MarkPaidDialog({
  invoice,
  open,
  onClose,
}: {
  invoice: InvoiceSummary;
  open: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    start(async () => {
      const result = await markInvoicePaid({
        invoice_id: invoice.invoice_id,
        payment_date: String(form.get("payment_date") ?? ""),
        payment_reference: String(form.get("payment_reference") ?? ""),
        payment_channel: String(form.get("payment_channel") ?? ""),
        amount: Number(form.get("amount") ?? 0),
        notes: String(form.get("notes") ?? "") || undefined,
        idempotency_key: crypto.randomUUID(),
      });

      if (result.ok) {
        toast.success(`Faktura #${invoice.invoice_number ?? ""} er merket som betalt.`);
        onClose();
      } else {
        toast.error(`Kunne ikke registrere betaling: ${result.error}`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrer betaling — faktura #{invoice.invoice_number ?? "—"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment_date">Betalingsdato</Label>
            <Input
              id="payment_date"
              name="payment_date"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Beløp (kr inkl. mva)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={invoice.amount_incl_vat}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_channel">Kanal</Label>
            <Select name="payment_channel" defaultValue="bank_transfer">
              <SelectTrigger id="payment_channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bankoverføring</SelectItem>
                <SelectItem value="cash">Kontant</SelectItem>
                <SelectItem value="stripe_manual_capture">Stripe (manuell)</SelectItem>
                <SelectItem value="out_of_band">Utenom system</SelectItem>
                <SelectItem value="partial_write_off">Delvis ettergivelse</SelectItem>
                <SelectItem value="other">Annet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_reference">Referanse</Label>
            <Input
              id="payment_reference"
              name="payment_reference"
              placeholder="KID / transaksjonsnummer / bilagsnummer"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notat (valgfritt)</Label>
            <Input id="notes" name="notes" maxLength={1000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Registrerer…" : "Registrer betaling"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
