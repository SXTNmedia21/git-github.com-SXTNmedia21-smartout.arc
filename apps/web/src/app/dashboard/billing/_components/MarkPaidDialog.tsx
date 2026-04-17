"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { markInvoicePaidAction } from "../_actions/markInvoicePaidAction";
import type { MarkPaidButtonInvoice } from "./MarkPaidButton";

// Fase 2 Spor C — workspace-admin mark-paid dialog.
//
// Copy is load-bearing (spec §5.2): the description text warns that
// the action is not reversible by the workspace-admin. Reversal goes
// through platform-admin + credit note per ADR-0120.
//
// All strings come from the billing namespace (@smartout/i18n) so the
// workspace surface stays Norwegian-first per tenant locale.

export function MarkPaidDialog({
  invoice,
  open,
  onClose,
}: {
  invoice: MarkPaidButtonInvoice;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("billing");
  const [pending, start] = useTransition();

  const invoiceLabel = invoice.invoice_number != null ? String(invoice.invoice_number) : "—";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    start(async () => {
      const result = await markInvoicePaidAction({
        invoice_id: invoice.invoice_id,
        payment_date: String(form.get("payment_date") ?? ""),
        payment_reference: String(form.get("payment_reference") ?? ""),
        note: String(form.get("note") ?? "") || undefined,
      });

      if (result.ok) {
        toast.success(t("mark_paid.success_toast"));
        onClose();
      } else {
        toast.error(t("mark_paid.error_toast", { error: result.error }));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("mark_paid.dialog_title", { invoice_number: invoiceLabel })}</DialogTitle>
          <DialogDescription>
            {t("mark_paid.confirmation", { invoice_number: invoiceLabel })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment_date">{t("mark_paid.payment_date_label")}</Label>
            <Input
              id="payment_date"
              name="payment_date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_reference">{t("mark_paid.payment_reference_label")}</Label>
            <Input id="payment_reference" name="payment_reference" maxLength={500} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">{t("mark_paid.note_label")}</Label>
            <Textarea id="note" name="note" maxLength={1000} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t("mark_paid.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("mark_paid.submitting") : t("mark_paid.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
