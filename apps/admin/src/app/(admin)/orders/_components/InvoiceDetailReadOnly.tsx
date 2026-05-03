// InvoiceDetailReadOnly.tsx — read-only invoice detail.
//
// Adapted from platform-admin/billing/invoices/_components/invoice-detail.tsx.
// Mutation buttons removed (mark-paid, void, dunning, credit-note) — accountant
// only has mark-received (handled separately by MarkReceivedDialog).
// Tabs removed — accountant surface has only the overview (no History/Actions tabs).
//
// Terminology: "Ordre" for invoice header (admin surface per blueprint §1).
// Data: InvoiceBasis from @smartout/billing/server (loadInvoiceDetailServer).

import { InvoiceStatusBadge } from "@/components/ui/invoice-status-badge";
import type { InvoiceStatus } from "@/components/ui/invoice-status-badge";
import type { InvoiceBasis } from "@/lib/orders/fetchers";

type Props = {
  detail: InvoiceBasis;
};

export function InvoiceDetailReadOnly({ detail }: Props) {
  const lineItems = detail.line_items ?? [];
  const usageSnapshots = detail.usage_snapshots ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-2xl">
            Ordre <span className="font-mono tabular-nums">#{detail.invoice_number ?? "—"}</span>
          </h2>
          <InvoiceStatusBadge status={detail.status as InvoiceStatus} size="sm" />
        </div>
        <p className="text-muted-foreground">{detail.company_name}</p>
        <p className="text-muted-foreground text-sm">
          Periode {detail.period_from} – {detail.period_to}
        </p>
      </header>

      {/* Line items */}
      <section className="space-y-2">
        <h3 className="font-heading text-lg">Linjer</h3>
        <div className="rounded-md border">
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
              {lineItems.map((line, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{line.quantity}</td>
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
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right">
                  Beløp eks. mva
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {Number(detail.amount_excl_vat).toLocaleString("nb-NO")}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right">
                  MVA ({detail.vat_rate}%)
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {Number(detail.vat_amount).toLocaleString("nb-NO")}
                </td>
              </tr>
              <tr className="font-medium">
                <td colSpan={3} className="px-3 py-2 text-right">
                  Totalt (inkl. mva)
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {Number(detail.amount_incl_vat).toLocaleString("nb-NO")} {detail.currency}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {usageSnapshots.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-heading text-lg">Grunnlag</h3>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Workspace</th>
                  <th className="px-3 py-2 text-right font-medium">Aktive</th>
                  <th className="px-3 py-2 text-right font-medium">Gratis</th>
                  <th className="px-3 py-2 text-right font-medium">Fakturert</th>
                </tr>
              </thead>
              <tbody>
                {usageSnapshots.map((s) => (
                  <tr key={s.workspace_id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{s.workspace_id}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {s.active_users}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {s.free_users_applied}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {s.billable_users}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {detail.pricing_terms_at_issue ? (
        <section className="space-y-2">
          <h3 className="font-heading text-lg">Prisvilkår ved utstedelse</h3>
          <dl className="bg-muted/20 grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
            <dt className="text-muted-foreground">Månedspris</dt>
            <dd className="font-mono tabular-nums">
              {Number(detail.pricing_terms_at_issue.monthly_cost).toLocaleString("nb-NO")}
            </dd>
            <dt className="text-muted-foreground">Gratis brukere</dt>
            <dd className="font-mono tabular-nums">{detail.pricing_terms_at_issue.free_users}</dd>
            <dt className="text-muted-foreground">Overforbruk per bruker</dt>
            <dd className="font-mono tabular-nums">
              {detail.pricing_terms_at_issue.overage_price_per_user ?? "—"}
            </dd>
            <dt className="text-muted-foreground">Faktureringsintervall</dt>
            <dd>{detail.pricing_terms_at_issue.billing_interval}</dd>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
