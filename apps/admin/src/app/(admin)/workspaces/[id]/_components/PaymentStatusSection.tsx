// PaymentStatusSection.tsx — outstanding payments + last paid amounts
//
// Shows the recent payment rows (last-5 from kartotek query) and
// outstanding amount scalars from the summary view.
//
// Never null (outstandingPayments is always []). Always accessible —
// both orders_only and full_kartotek scope.
//
// Server Component. No "use client".

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { KartotekPaymentRow, KartotekSummary } from "@smartout/billing/server";

type Props = {
  outstandingPayments: KartotekPaymentRow[];
  summary: KartotekSummary | null;
};

function formatNok(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("nb-NO", { dateStyle: "short" }).format(new Date(iso));
}

function paymentStatusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case "paid":
    case "succeeded":
      return { label: "Betalt", className: "bg-primary/15 text-primary border-primary/30" };
    case "pending":
    case "processing":
      return {
        label: "Venter",
        className: "bg-muted text-muted-foreground border-border",
      };
    case "failed":
      return {
        label: "Feilet",
        className: "bg-destructive/15 text-destructive border-destructive/30",
      };
    case "refunded":
      return {
        label: "Refundert",
        className: "bg-muted text-muted-foreground border-border",
      };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

export function PaymentStatusSection({ outstandingPayments, summary }: Props) {
  const hasOutstanding =
    summary?.amount_outstanding_incl_vat != null && summary.amount_outstanding_incl_vat > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Betalingsstatus</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aggregate scalars from summary */}
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Utestående</p>
            <p
              className={`font-heading mt-1 text-xl font-semibold ${hasOutstanding ? "text-destructive" : "text-muted-foreground"}`}
            >
              {formatNok(summary?.amount_outstanding_incl_vat ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Sist betalt</p>
            <p className="mt-1 font-mono text-sm">{formatDate(summary?.last_paid_at ?? null)}</p>
          </div>
          {summary?.invoice_count_outstanding != null && summary.invoice_count_outstanding > 0 && (
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Ubetalte fakturaer
              </p>
              <p className="text-destructive mt-1 font-mono text-sm">
                {summary.invoice_count_outstanding}
              </p>
            </div>
          )}
        </div>

        {/* Payment rows */}
        {outstandingPayments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Siste betalinger
              </p>
              {outstandingPayments.map((payment) => {
                const { label, className } = paymentStatusLabel(payment.status);
                return (
                  <div
                    key={payment.payment_id}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={className}>
                        {label}
                      </Badge>
                      <span className="text-muted-foreground font-mono text-xs">
                        {payment.payment_id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground text-xs">
                        {formatDate(payment.paid_at)}
                      </span>
                      <span className="font-mono font-medium">{formatNok(payment.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {outstandingPayments.length === 0 && !hasOutstanding && (
          <p className="text-muted-foreground text-sm">Ingen utestående betalinger</p>
        )}
      </CardContent>
    </Card>
  );
}
