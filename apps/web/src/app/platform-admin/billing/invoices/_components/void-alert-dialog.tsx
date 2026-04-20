"use client";

import { useMemo, useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { voidInvoice } from "../../_actions/voidInvoice";
import type { InvoiceStatus } from "@smartout/ui";

// Phase 7.9 — VoidAlertDialog
//
// AlertDialog (destructive modal). Submit is disabled until the admin
// types the exact invoice_number — the server re-verifies the same
// match, but the UI guard prevents accidental submits. Reason code +
// free-text detail required (min 10 chars) per Zod schema.

type InvoiceSummary = {
  invoice_id: string;
  invoice_number: number | null;
  amount_incl_vat: number;
  status: InvoiceStatus;
};

const REASONS: Array<{ value: string; label: string }> = [
  { value: "duplicate", label: "Duplikat" },
  { value: "fraudulent", label: "Svindel" },
  { value: "order_change", label: "Endring i bestilling" },
  { value: "product_unsatisfactory", label: "Produkt/service utilstrekkelig" },
  { value: "issued_in_error", label: "Utstedt ved feil" },
  { value: "other", label: "Annet" },
];

export function VoidAlertDialog({
  invoice,
  open,
  onClose,
}: {
  invoice: InvoiceSummary;
  open: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("duplicate");
  const [reasonDetail, setReasonDetail] = useState("");

  const expected = String(invoice.invoice_number ?? "");
  const canSubmit = useMemo(
    () => expected.length > 0 && typed === expected && reasonDetail.trim().length >= 10,
    [expected, typed, reasonDetail],
  );

  const onConfirm = () => {
    start(async () => {
      const result = await voidInvoice({
        invoice_id: invoice.invoice_id,
        reason,
        reason_detail: reasonDetail,
        typed_confirmation: typed,
        idempotency_key: crypto.randomUUID(),
      });

      if (result.ok) {
        toast.success(`Faktura #${invoice.invoice_number ?? ""} er annullert.`);
        setTyped("");
        setReasonDetail("");
        onClose();
      } else {
        toast.error(`Kunne ikke annullere: ${result.error}`);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Annuller faktura #{invoice.invoice_number ?? "—"}?</AlertDialogTitle>
          <AlertDialogDescription>
            Annullering er permanent. Fakturaen får status <em>void</em> og kan ikke gjenopprettes.
            Skriv inn fakturanummeret under for å bekrefte.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="void-reason">Årsak</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="void-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="void-detail">
              Detaljer (min. 10 tegn — kreves for regnskapssporet)
            </Label>
            <Input
              id="void-detail"
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              maxLength={1000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="void-confirm">Skriv fakturanummeret ({expected}) for å bekrefte</Label>
            <Input
              id="void-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={expected}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onClose}>
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!canSubmit || pending}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "Annullerer…" : "Annuller faktura"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
