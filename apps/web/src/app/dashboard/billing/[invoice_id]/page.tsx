import { redirect } from "next/navigation";
import { InvoiceStatusBadge } from "@smartout/ui";

import { getMyInvoiceDetail } from "../_actions/queries";
import { MarkPaidButton } from "../_components/MarkPaidButton";
import { PayNowButton } from "../_components/PayNowButton";
import { PostPaymentCancelled } from "../_components/PostPaymentCancelled";
import { PostPaymentConfirmation } from "../_components/PostPaymentConfirmation";
import { WorkspaceInvoiceDispatches } from "../_components/WorkspaceInvoiceDispatches";

// Fase 2 Spor C — workspace-admin invoice detail.
//
// Read-only invoice view for the company's own invoices. "Mark as
// paid" button shows only when invoice.status = 'issued' (guarded by
// MarkPaidButton itself).
//
// Auth: getMyInvoiceDetail() resolves the caller's company and
// returns null if the invoice belongs to a different company. We
// redirect to the list rather than 404 so the UX stays forgiving for
// admins browsing several companies.

type LineItem = {
  line_item_id?: string;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  amount_incl_vat: number | string;
};

export default async function WorkspaceInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ invoice_id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const [{ invoice_id }, search] = await Promise.all([params, searchParams]);
  const detail = await getMyInvoiceDetail(invoice_id);
  if (!detail) redirect("/dashboard/billing");

  const { invoice, line_items } = detail;
  const lines = line_items as LineItem[];
  const paymentReturn = search.payment;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl">
            Faktura <span className="font-mono tabular-nums">#{invoice.invoice_number ?? "—"}</span>
          </h1>
          <InvoiceStatusBadge status={invoice.status} size="sm" />
        </div>
        <p className="text-muted-foreground text-sm">
          Periode {invoice.period_from} – {invoice.period_to}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-heading text-lg">Linjer</h2>
        <div className="border-border rounded-md border">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Beskrivelse</th>
                <th className="px-3 py-2 text-right font-medium">Antall</th>
                <th className="px-3 py-2 text-right font-medium">À-pris</th>
                <th className="px-3 py-2 text-right font-medium">Beløp (inkl. mva)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.line_item_id ?? idx} className="border-t">
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {Number(line.quantity)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {Number(line.unit_price).toLocaleString("nb-NO")}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {Number(line.amount_incl_vat).toLocaleString("nb-NO")}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t">
              <tr className="font-medium">
                <td colSpan={3} className="px-3 py-2 text-right">
                  Totalt (inkl. mva)
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {Number(invoice.amount_incl_vat).toLocaleString("nb-NO")} {invoice.currency}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg">Betaling</h2>
        {invoice.status === "paid" ? (
          <div className="border-border bg-muted/20 space-y-1 rounded-md border p-4 text-sm">
            <p>
              Betalt {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString("nb-NO") : ""}
            </p>
            {invoice.payment_reference ? (
              <p className="text-muted-foreground">Referanse: {invoice.payment_reference}</p>
            ) : null}
            {invoice.payment_channel ? (
              <p className="text-muted-foreground">Kanal: {invoice.payment_channel}</p>
            ) : null}
          </div>
        ) : null}
        {/* B3-fase3a: workspace betal-nå — DO NOT REMOVE */}
        <PayNowButton
          invoice={{
            invoice_id: invoice.invoice_id,
            status: invoice.status,
            amount_incl_vat: invoice.amount_incl_vat,
            currency: invoice.currency,
          }}
        />
        {/* /B3-fase3a: workspace betal-nå */}
        {paymentReturn === "success" ? (
          <PostPaymentConfirmation invoiceId={invoice.invoice_id} />
        ) : null}
        {paymentReturn === "cancelled" ? (
          <PostPaymentCancelled invoiceId={invoice.invoice_id} />
        ) : null}
        {/* B5: workspace mark-paid — DO NOT REMOVE */}
        <MarkPaidButton
          invoice={{
            invoice_id: invoice.invoice_id,
            invoice_number: invoice.invoice_number,
            status: invoice.status,
          }}
        />
        {/* /B5: workspace mark-paid */}
      </section>

      {/* B3: workspace dispatches read-only — DO NOT REMOVE */}
      <WorkspaceInvoiceDispatches invoiceId={invoice.invoice_id} />
      {/* /B3: workspace dispatches read-only */}
    </div>
  );
}
