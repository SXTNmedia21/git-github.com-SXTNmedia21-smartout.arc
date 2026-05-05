// page.tsx — /orders/[id]
//
// Accountant order detail page. Auth gate + access check + parallel data load.
//
// Renders:
//   InvoiceDetailReadOnly — header + line items + totals (no mutation buttons)
//   PaymentsHistory       — betalingshistorikk (read-only)
//   DispatchesList        — leveransehistorikk (read-only)
//   MarkReceivedDialog    — trigger button for "Marker som mottatt" action

import { notFound } from "next/navigation";
import { requireAccountant } from "@/lib/accountant";
import { createClient } from "@/lib/supabase/server";
import { hasAccountantAccess } from "@smartout/billing/accountant";
import { getOrderDetail, getOrderDispatches, getOrderPayments } from "@/lib/orders/fetchers";
import { emit, nonEmpty } from "@smartout/telemetry";

import { InvoiceDetailReadOnly } from "../_components/InvoiceDetailReadOnly";
import { DispatchesList } from "../_components/DispatchesList";
import { PaymentsHistory } from "../_components/PaymentsHistory";
import { MarkReceivedDialog } from "../_components/MarkReceivedDialog";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: Props) {
  const [{ userId }, { id }] = await Promise.all([requireAccountant(), params]);

  const supabase = await createClient();

  // Parallel data load.
  const [detail, dispatches, payments] = await Promise.all([
    getOrderDetail(supabase, id),
    getOrderDispatches(supabase, id),
    getOrderPayments(supabase, id),
  ]);

  if (!detail) notFound();

  // Validate accountant has active grant for this company — defense-in-depth.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canAccess = await hasAccountantAccess(supabase as any, userId, detail.company_id);
  if (!canAccess) notFound();

  await emit({
    event: "order detail_viewed",
    actor_id: nonEmpty(userId, "actor_id"),
    workspace_id: null,
    properties: {
      entity: { entity_type: "invoice", entity_id: id },
      data: {
        invoice_id: id,
        source: "deeplink" as const,
      },
    },
  });

  const isMarkable = ["issued", "sent", "overdue"].includes(detail.status);

  return (
    <div className="space-y-6">
      {isMarkable ? (
        <div className="flex justify-end">
          <MarkReceivedDialog
            invoice={{
              invoice_id: detail.invoice_id,
              invoice_number: detail.invoice_number,
              amount_incl_vat: detail.amount_incl_vat,
              currency: detail.currency,
            }}
          />
        </div>
      ) : null}

      <InvoiceDetailReadOnly detail={detail} />
      <PaymentsHistory payments={payments} />
      <DispatchesList dispatches={dispatches} />
    </div>
  );
}
