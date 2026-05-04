// page.tsx — /orders
//
// Accountant order list. Lifted from platform-admin/billing/invoices/page.tsx
// pattern — server component, auth gate, search-param-driven filter + Sheet preview.
//
// Terminology: "invoice" in DB → "ordre" in UI (blueprint §1 naming note).
// Filter values map 1:1 to invoice.status DB enum values.

import { requireAccountant } from "@/lib/accountant";
import { createClient } from "@/lib/supabase/server";
import { getOrders } from "@/lib/orders/fetchers";
import { emit, nonEmpty } from "@smartout/telemetry";

import { OrderFilterBar } from "./_components/OrderFilterBar";
import { OrderTable } from "./_components/OrderTable";
import { OrderDetailSheet } from "./_components/OrderDetailSheet";

type SearchParams = {
  status?: string;
  company?: string;
  preview?: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [{ userId, companyIds }, params] = await Promise.all([requireAccountant(), searchParams]);

  const supabase = await createClient();

  const orders = await getOrders(supabase, companyIds, {
    status: params.status,
    company: params.company,
    limit: 100,
  });

  // Emit telemetry once on render.
  await emit({
    event: "order list_viewed",
    actor_id: nonEmpty(userId, "actor_id"),
    workspace_id: null,
    properties: {
      entity: { entity_type: "invoice", entity_id: "00000000-0000-0000-0000-000000000000" },
      data: {
        filters: { status: params.status, company: params.company },
        count: orders.length,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-heading text-2xl">Ordrer</h1>
      </div>
      <OrderFilterBar />
      <OrderTable orders={orders} />
      {/* Always mounted — open/close derived from ?preview search param.
          Conditional mount causes Radix to tear the component mid-close
          animation → null.dispatchEvent at History.pushState. */}
      <OrderDetailSheet />
    </div>
  );
}
