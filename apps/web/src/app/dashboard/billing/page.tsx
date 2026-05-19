import { redirect } from "next/navigation";
import { InvoiceStatusBadge } from "@smartout/ui";
import { createClient } from "@smartout/supabase/server";

import { getMyCompanyInvoices } from "./_actions/queries";
import { BillingToolsBridge } from "./_tools/billing-tools-bridge";

// Phase 10.1 — workspace-admin read-only billing view.
//
// Simple list: the company's invoices, most-recent first. No
// mutations here (those are platform-admin territory until Fase 2
// opens self-serve workflows). Workers get redirected home — this
// is an admin/owner surface.

export default async function DashboardBillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const invoices = await getMyCompanyInvoices();

  return (
    <div className="space-y-6">
      <BillingToolsBridge invoices={invoices} />
      <header className="space-y-1">
        <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
          Fakturering
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Her finner du fakturaer for arbeidsplassen din, inkludert status, beløp og forfallsdato.
          Klikk en faktura for å se detaljer eller åpne fakturainnstillinger for å konfigurere EHF
          og varslingsregler.
        </p>
      </header>

      {invoices.length === 0 ? (
        <div className="py-16 text-center">
          <h2 className="font-heading mb-2 text-2xl">Ingen fakturaer enda</h2>
          <p className="text-muted-foreground">Vi genererer fakturagrunnlag dag 5 hver måned.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Nr.</th>
                <th className="px-3 py-2 font-medium">Periode</th>
                <th className="px-3 py-2 text-right font-medium">Beløp (inkl. mva)</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Forfall</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.invoice_id} className="border-t">
                  <td className="px-3 py-2 font-mono tabular-nums">{inv.invoice_number ?? "—"}</td>
                  <td className="px-3 py-2">
                    {inv.period_from} – {inv.period_to}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {Number(inv.amount_incl_vat).toLocaleString("nb-NO")} kr
                  </td>
                  <td className="px-3 py-2">
                    <InvoiceStatusBadge status={inv.status} size="sm" />
                  </td>
                  <td className="px-3 py-2">{inv.due_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
