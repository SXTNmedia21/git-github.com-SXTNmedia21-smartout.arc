import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceStatusBadge, type InvoiceStatus } from "@smartout/ui";
import { createAdminClient } from "@smartout/supabase/admin";

import { InvoiceTimeline } from "./invoice-timeline";
import { InvoiceActions } from "./invoice-actions";

// Shared invoice detail body. Used by both the full-page route
// (/platform-admin/billing/invoices/[id]) and the Sheet preview
// (?preview=<id>).
//
// Data source: get_invoice_basis(uuid) RPC written in Task 1.8. It
// returns a single row bundling invoice header + line items +
// usage snapshots + pricing_terms-at-issue (P1.5 FK snapshot).

type InvoiceBasis = {
  invoice_id: string;
  invoice_number: number | null;
  company_id: string;
  company_name: string;
  period_from: string;
  period_to: string;
  issued_at: string | null;
  status: InvoiceStatus;
  amount_excl_vat: number;
  vat_rate: number;
  vat_amount: number;
  amount_incl_vat: number;
  currency: string;
  line_items: Array<{
    line_type: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount_incl_vat: number;
    addon_key?: string | null;
  }> | null;
  usage_snapshots: Array<{
    workspace_id: string;
    active_users: number;
    billable_users: number;
    free_users_applied: number;
    period_from: string;
    period_to: string;
  }> | null;
  pricing_terms_at_issue: {
    monthly_cost: number;
    price_per_employee: number;
    free_users: number;
    overage_price_per_user: number | null;
    billing_interval: string;
  } | null;
};

export async function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const supabase = createAdminClient();

  // get_invoice_basis() returns exactly one row per invoice_id; we
  // treat missing as a rendering concern, not a throw.
  const { data, error } = await supabase
    .rpc("get_invoice_basis", { p_invoice_id: invoiceId })
    .maybeSingle();

  if (error) {
    console.error("[InvoiceDetail] get_invoice_basis failed:", error);
    return <p className="text-muted-foreground">Kunne ikke hente faktura. Prøv igjen.</p>;
  }

  if (!data) {
    return <p className="text-muted-foreground">Fant ikke faktura.</p>;
  }

  const invoice = data as InvoiceBasis;
  const lineItems = invoice.line_items ?? [];
  const usageSnapshots = invoice.usage_snapshots ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-2xl">
            Faktura <span className="font-mono tabular-nums">#{invoice.invoice_number ?? "—"}</span>
          </h2>
          <InvoiceStatusBadge status={invoice.status} size="sm" />
        </div>
        <p className="text-muted-foreground">{invoice.company_name}</p>
        <p className="text-muted-foreground text-sm">
          Periode {invoice.period_from} – {invoice.period_to}
        </p>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Oversikt</TabsTrigger>
          <TabsTrigger value="history">Historikk</TabsTrigger>
          <TabsTrigger value="actions">Handlinger</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {line.quantity}
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
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right">
                      Beløp eks. mva
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {Number(invoice.amount_excl_vat).toLocaleString("nb-NO")}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right">
                      MVA ({invoice.vat_rate}%)
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {Number(invoice.vat_amount).toLocaleString("nb-NO")}
                    </td>
                  </tr>
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

          {usageSnapshots.length > 0 ? (
            <section className="space-y-2">
              <h3 className="font-heading text-lg">Grunnlag (ADR-0119)</h3>
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

          {invoice.pricing_terms_at_issue ? (
            <section className="space-y-2">
              <h3 className="font-heading text-lg">Prisvilkår ved utstedelse (ADR-0121)</h3>
              <dl className="bg-muted/20 grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
                <dt className="text-muted-foreground">Månedspris</dt>
                <dd className="font-mono tabular-nums">
                  {Number(invoice.pricing_terms_at_issue.monthly_cost).toLocaleString("nb-NO")}
                </dd>
                <dt className="text-muted-foreground">Gratis brukere</dt>
                <dd className="font-mono tabular-nums">
                  {invoice.pricing_terms_at_issue.free_users}
                </dd>
                <dt className="text-muted-foreground">Overforbruk per bruker</dt>
                <dd className="font-mono tabular-nums">
                  {invoice.pricing_terms_at_issue.overage_price_per_user ?? "—"}
                </dd>
                <dt className="text-muted-foreground">Faktureringsintervall</dt>
                <dd>{invoice.pricing_terms_at_issue.billing_interval}</dd>
              </dl>
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="history">
          <InvoiceTimeline invoiceId={invoice.invoice_id} />
        </TabsContent>

        <TabsContent value="actions">
          <InvoiceActions
            invoice={{
              invoice_id: invoice.invoice_id,
              invoice_number: invoice.invoice_number,
              amount_incl_vat: invoice.amount_incl_vat,
              status: invoice.status,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
