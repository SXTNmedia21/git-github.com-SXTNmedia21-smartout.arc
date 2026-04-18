import { createAdminClient } from "@smartout/supabase/admin";
import { getDispatchesByInvoice } from "@smartout/billing";

import { WorkspaceInvoiceDispatchesClient } from "./WorkspaceInvoiceDispatchesClient";

// Fase 2 B3 — workspace-admin read-only dispatches section on the
// invoice detail page. Mirrors the platform-admin version structurally
// but strips action buttons (retry / ad-hoc are platform-admin only per
// spec §8 mobile parity + §7 RLS).
//
// RLS: invoice_dispatch_workspace_admin_read allows SELECT for invoices
// in the caller's company — the parent page has already validated the
// invoice belongs to the workspace-admin's company via getMyInvoiceDetail.

export async function WorkspaceInvoiceDispatches({ invoiceId }: { invoiceId: string }) {
  const supabase = createAdminClient();
  const dispatches = await getDispatchesByInvoice(supabase, invoiceId);

  const rows = dispatches.map((d) => ({
    invoice_dispatch_id: d.invoice_dispatch_id,
    channel: d.channel,
    target: d.target,
    status: d.status,
    attempts: d.attempts,
    external_reference: d.external_reference,
    delivered_at: d.delivered_at,
    error_message: d.error_message,
  }));

  return <WorkspaceInvoiceDispatchesClient rows={rows} />;
}

export type WorkspaceInvoiceDispatchRow = {
  invoice_dispatch_id: string;
  channel: string;
  target: unknown;
  status: string;
  attempts: number;
  external_reference: string | null;
  delivered_at: string | null;
  error_message: string | null;
};
