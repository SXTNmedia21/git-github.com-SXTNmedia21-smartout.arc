"use client";

import { useState } from "react";
import type { InvoiceStatus } from "@smartout/ui";
import { Button } from "@/components/ui/button";

import { MarkPaidDialog } from "./mark-paid-dialog";
import { VoidAlertDialog } from "./void-alert-dialog";
import { DunningNoteDialog } from "./dunning-note-dialog";

// InvoiceActions — platform-admin mutation surface for a single
// invoice. Wires the four primary dialogs to a local state machine.
// Phase 7.9 of Billing Engine Fase 1.
//
// Visible actions depend on invoice status:
//   issued | sent | overdue -> Merk som betalt, Annuller, Legg til notat
//   paid | void | uncollectible -> Legg til notat (read-only otherwise)
//   draft -> no actions (draft is cron-managed; regenerate lives in B5)

type InvoiceSummary = {
  invoice_id: string;
  invoice_number: number | null;
  amount_incl_vat: number;
  status: InvoiceStatus;
};

type Dialog = "markPaid" | "void" | "dunningNote" | null;

export function InvoiceActions({ invoice }: { invoice: InvoiceSummary }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  const isActive =
    invoice.status === "issued" || invoice.status === "sent" || invoice.status === "overdue";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {isActive ? <Button onClick={() => setDialog("markPaid")}>Merk som betalt</Button> : null}
        {isActive ? (
          <Button variant="destructive" onClick={() => setDialog("void")}>
            Annuller faktura
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => setDialog("dunningNote")}>
          Legg til notat
        </Button>
      </div>

      <MarkPaidDialog invoice={invoice} open={dialog === "markPaid"} onClose={close} />
      <VoidAlertDialog invoice={invoice} open={dialog === "void"} onClose={close} />
      <DunningNoteDialog invoice={invoice} open={dialog === "dunningNote"} onClose={close} />
    </div>
  );
}
