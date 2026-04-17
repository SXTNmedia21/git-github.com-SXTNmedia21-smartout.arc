// retryDispatch — platform-admin or workspace-admin "Send på nytt".
//
// Resets the invoice_dispatch row to pending, attempts=0, clears error
// fields, and inserts an 'invoice dispatch retry_requested' engine_event
// so the invoice_dispatch_delivery engine_process re-runs the adapter.
//
// Mobile parity: pure function, no Next.js primitives.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

type BillingClient = SupabaseClient<Database>;

export type RetryDispatchResult =
  | { ok: true; invoice_dispatch_id: string }
  | { ok: false; error: string };

export async function retryDispatch(
  client: BillingClient,
  invoiceDispatchId: string,
  /** Optional actor for the engine_event audit trail. */
  requestedBy?: string,
): Promise<RetryDispatchResult> {
  // 1. Load the dispatch row to confirm it exists + get invoice_id.
  const { data: dispatch, error: loadErr } = await client
    .from("invoice_dispatch")
    .select("invoice_dispatch_id, invoice_id, channel, status")
    .eq("invoice_dispatch_id", invoiceDispatchId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!dispatch) return { ok: false, error: "invoice_dispatch_not_found" };

  // 2. Reset the row. attempts=0 so retry backoff starts from the top.
  const { error: resetErr } = await client
    .from("invoice_dispatch")
    .update({
      status: "pending",
      attempts: 0,
      last_attempt_at: null,
      error_code: null,
      error_message: null,
    })
    .eq("invoice_dispatch_id", invoiceDispatchId);

  if (resetErr) return { ok: false, error: resetErr.message };

  // 3. Resolve workspace for the engine_event (engine_state.workspace_id
  //    NOT NULL; engine_event is nullable but we stamp it when we can).
  const { data: invoice } = await client
    .from("invoice")
    .select("company_id")
    .eq("invoice_id", dispatch.invoice_id)
    .maybeSingle();

  let workspaceId: string | null = null;
  if (invoice?.company_id) {
    const { data: ws } = await client
      .from("workspace")
      .select("workspace_id")
      .eq("company_id", invoice.company_id)
      .limit(1)
      .maybeSingle();
    workspaceId = ws?.workspace_id ?? null;
  }

  // 4. Insert an engine_event that the invoice_dispatch_delivery trigger
  //    listens to. engine-dispatch fan-in picks up the event → creates a
  //    fresh engine_state with invoice_dispatch_id in context.
  if (workspaceId) {
    await client.from("engine_event").insert({
      event_type: "invoice dispatch retry_requested",
      workspace_id: workspaceId,
      payload: {
        entity_type: "invoice_dispatch",
        entity_id: invoiceDispatchId,
        invoice_dispatch_id: invoiceDispatchId,
        invoice_id: dispatch.invoice_id,
        requested_by: requestedBy ?? null,
      },
    });
  }

  return { ok: true, invoice_dispatch_id: invoiceDispatchId };
}
