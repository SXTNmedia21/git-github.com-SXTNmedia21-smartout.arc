"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@smartout/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Invoice } from "@smartout/billing";

// Projection shape for the list view — matches the SELECT in
// apps/web/src/app/platform-admin/billing/invoices/page.tsx. Keep
// in sync with that query if columns change.
export type InvoiceListRow = Pick<
  Invoice,
  | "invoice_id"
  | "invoice_number"
  | "company_id"
  | "invoice_type"
  | "status"
  | "dunning_status"
  | "period_from"
  | "period_to"
  | "due_at"
  | "amount_incl_vat"
  | "delivery_channel"
> & { company: { name: string } | null };

export function InvoiceTable({ invoices }: { invoices: InvoiceListRow[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const openPreview = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preview", id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (invoices.length === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="font-heading mb-2 text-2xl">Ingen fakturaer enda</h2>
        <p className="text-muted-foreground">Fakturaer genereres automatisk dag 5 hver måned.</p>
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
          <TableHead>Kanal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((inv) => (
          <TableRow
            key={inv.invoice_id}
            onClick={() => openPreview(inv.invoice_id)}
            className="cursor-pointer"
          >
            <TableCell className="font-mono tabular-nums">{inv.invoice_number ?? "—"}</TableCell>
            <TableCell>{inv.company?.name ?? "—"}</TableCell>
            <TableCell>
              {inv.period_from} – {inv.period_to}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {Number(inv.amount_incl_vat).toLocaleString("nb-NO")} kr
            </TableCell>
            <TableCell>
              <InvoiceStatusBadge status={inv.status} />
            </TableCell>
            <TableCell>{inv.due_at ?? "—"}</TableCell>
            <TableCell>{inv.delivery_channel}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
