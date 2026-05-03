"use client";

// OrderTable.tsx — order list table.
//
// Lifted from platform-admin/billing/invoices/_components/invoice-table.tsx.
// Terminology shift: "ordre" not "faktura". Adds Selskap column sourced from
// the joined company.name field. Row click sets ?preview=<id> (Sheet opens,
// no page navigation).
//
// Type: OrderListRow = InvoiceListRow & { company: { name: string } | null }
// (company join from the select in lib/orders/fetchers.ts:getOrders).

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/ui/invoice-status-badge";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { InvoiceStatus } from "@/components/ui/invoice-status-badge";
import type { OrderListRow } from "@/lib/orders/fetchers";

export function OrderTable({ orders }: { orders: OrderListRow[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const openPreview = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preview", id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (orders.length === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="font-heading mb-2 text-2xl">Ingen ordrer enda</h2>
        <p className="text-muted-foreground">
          Ordrer genereres automatisk dag 5 hver måned for tildelte selskaper.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nr.</TableHead>
          <TableHead>Selskap</TableHead>
          <TableHead>Periode</TableHead>
          <TableHead className="text-right">Beløp (inkl. mva)</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Forfall</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow
            key={order.invoice_id}
            onClick={() => openPreview(order.invoice_id)}
            className="cursor-pointer"
          >
            <TableCell className="font-mono tabular-nums">{order.invoice_number ?? "—"}</TableCell>
            <TableCell>{order.company?.name ?? "—"}</TableCell>
            <TableCell>
              {order.period_from} – {order.period_to}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {Number(order.amount_incl_vat).toLocaleString("nb-NO")} kr
            </TableCell>
            <TableCell>
              <InvoiceStatusBadge status={order.status as InvoiceStatus} size="sm" />
            </TableCell>
            <TableCell>{order.due_at ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
