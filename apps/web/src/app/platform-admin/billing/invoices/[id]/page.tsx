import { redirect } from "next/navigation";
import { createAdminClient } from "@smartout/supabase/admin";
import type { InvoiceStatus } from "@smartout/ui";
import { getSuperAdminId } from "@/lib/platform-admin";
import { InvoiceDetail } from "../_components/invoice-detail";
import { InvoiceLineItemEditor } from "./_components/InvoiceLineItemEditor";
import { InvoiceDispatchesList } from "./_components/InvoiceDispatchesList";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [adminId, { id }] = await Promise.all([getSuperAdminId(), params]);
  if (!adminId) redirect("/");

  // Load invoice status separately so we can decide whether to render
  // the B5 editor without round-tripping through get_invoice_basis()
  // twice. InvoiceDetail does its own load.
  const supabase = createAdminClient();
  const { data: invoiceRow } = await supabase
    .from("invoice")
    .select("status")
    .eq("invoice_id", id)
    .maybeSingle();

  const status = (invoiceRow?.status ?? null) as InvoiceStatus | null;

  return (
    <div className="space-y-6">
      <InvoiceDetail invoiceId={id} />
      {/* B5: invoice editing — DO NOT REMOVE */}
      {status === "draft" ? <InvoiceLineItemEditor invoiceId={id} invoiceStatus={status} /> : null}
      {/* /B5: invoice editing */}
      {/* B3: dispatches — DO NOT REMOVE */}
      <InvoiceDispatchesList invoiceId={id} />
      {/* /B3: dispatches */}
    </div>
  );
}
