// OrderHistorySection.tsx — last 12 orders for this workspace
//
// Renders a table of the 12 most recent invoices. Each row links to
// /orders?preview=<invoice_id> so Erik can inspect the detail Sheet
// without leaving the kartotek context.
//
// recentOrders is never null (always []) — orders are accessible with
// both orders_only and full_kartotek scope.
//
// Server Component. No "use client".

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge, type InvoiceStatus } from "@/components/ui/invoice-status-badge";
import type { KartotekOrderRow } from "@smartout/billing/server";

type Props = {
  recentOrders: KartotekOrderRow[];
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

export function OrderHistorySection({ recentOrders }: Props) {
  if (recentOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ordrehistorikk</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Ingen ordrer registrert</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Ordrehistorikk{" "}
          <span className="text-muted-foreground text-xs font-normal">
            (siste {recentOrders.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fakturanr.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fakturadato</TableHead>
              <TableHead>Forfallsdato</TableHead>
              <TableHead className="text-right">Beløp ink. mva</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentOrders.map((order) => (
              <TableRow key={order.invoice_id} className="hover:bg-muted/50">
                <TableCell>
                  <Link
                    href={`/orders?preview=${order.invoice_id}`}
                    className="text-primary font-mono text-sm underline-offset-4 hover:underline"
                  >
                    {order.invoice_number
                      ? `#${order.invoice_number}`
                      : order.invoice_id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={order.status as InvoiceStatus} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(order.issued_at)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(order.due_at)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatNok(order.amount_incl_vat)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
