"use client";

import { useState } from "react";
import { useTranslation } from "@smartout/i18n";

import { Button } from "@/components/ui/button";
import { MarkPaidDialog } from "./MarkPaidDialog";

// Fase 2 Spor C — workspace-admin mark-paid button.
//
// Only visible when invoice.status === 'issued' (spec §5.2). Lives in
// the Payment section on /dashboard/billing/[invoice_id]. Secondary
// button style — this is a normal settlement action, not destructive.
//
// After success (MarkPaidDialog closes the dialog + toasts), the
// surrounding server component re-renders via revalidatePath, which
// hides the button because status flips to 'paid'.

export type MarkPaidButtonInvoice = {
  invoice_id: string;
  invoice_number: number | null;
  status: string;
};

export function MarkPaidButton({ invoice }: { invoice: MarkPaidButtonInvoice }) {
  const { t } = useTranslation("billing");
  const [open, setOpen] = useState(false);

  if (invoice.status !== "issued") return null;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("mark_paid.button")}
      </Button>
      <MarkPaidDialog invoice={invoice} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
