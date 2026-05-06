// PaymentsHistory.tsx — read-only payment history for the accountant surface.
//
// Adapted from platform-admin InvoicePaymentsHistory + InvoicePaymentsHistoryClient.
// No framer-motion, no @smartout/i18n, no attempt drill-down — apps/admin
// intentionally excludes those deps. Simple flat list of payments.
//
// Props passed from the detail page (server component — no separate data fetch).

import type { Payment } from "@smartout/billing";

type Props = {
  payments: Payment[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Venter",
  processing: "Behandler",
  succeeded: "Gjennomført",
  failed: "Feilet",
  refunded: "Refundert",
  partially_refunded: "Delvis refundert",
};

const METHOD_LABELS: Record<string, string> = {
  stripe_card: "Stripe (kort)",
  stripe_bank: "Stripe (bank)",
  bank_transfer: "Bankoverføring",
  manual_adjustment: "Manuell justering",
  accountant_manual: "Regnskapsbilag",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("nb-NO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PaymentsHistory({ payments }: Props) {
  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h2 className="font-heading text-lg">Betalingshistorikk</h2>
      </header>

      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen betalinger registrert.</p>
      ) : (
        <div className="border-border/60 overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Beløp</th>
                <th className="px-4 py-2 font-medium">Metode</th>
                <th className="px-4 py-2 font-medium">Betalt</th>
                <th className="px-4 py-2 font-medium">Referanse</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.payment_id} className="border-t">
                  <td className="px-4 py-2">
                    <span className="text-xs">{STATUS_LABELS[p.status] ?? p.status}</span>
                  </td>
                  <td className="px-4 py-2 font-mono tabular-nums">
                    {Number(p.amount).toLocaleString("nb-NO")} {p.currency}
                    {p.refunded_amount != null && Number(p.refunded_amount) > 0 ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (−{Number(p.refunded_amount).toLocaleString("nb-NO")})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                  </td>
                  <td className="px-4 py-2 text-xs">{formatDateTime(p.paid_at ?? p.created_at)}</td>
                  <td className="text-muted-foreground max-w-40 truncate px-4 py-2 font-mono text-xs">
                    {p.external_id ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
