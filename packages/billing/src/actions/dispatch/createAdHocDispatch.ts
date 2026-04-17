// createAdHocDispatch — platform-admin "Send på nytt" without a rule.
//
// Inserts a single invoice_dispatch row with dispatch_rule_id = NULL
// and kicks off an engine_state to execute the send. Used when an
// admin wants to mail an invoice to an ad-hoc recipient without
// configuring a permanent dispatch rule.
//
// Mobile parity: pure function, no Next.js primitives.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { BillingDispatchChannel, InvoiceDispatchInsert } from "../../types";

type BillingClient = SupabaseClient<Database>;

export type CreateAdHocDispatchResult =
  | { ok: true; invoice_dispatch_id: string }
  | { ok: false; error: string };

export async function createAdHocDispatch(
  client: BillingClient,
  invoiceId: string,
  channel: BillingDispatchChannel,
  target: Record<string, unknown>,
): Promise<CreateAdHocDispatchResult> {
  // 1. Validate: invoice exists + not draft (can't dispatch drafts).
  const { data: invoice, error: invoiceErr } = await client
    .from("invoice")
    .select("invoice_id, company_id, status")
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  if (invoiceErr) return { ok: false, error: invoiceErr.message };
  if (!invoice) return { ok: false, error: "invoice_not_found" };
  if (invoice.status === "draft") {
    return { ok: false, error: "invoice_must_be_issued_or_later" };
  }

  // 2. Insert invoice_dispatch (dispatch_rule_id NULL = ad-hoc).
  const insertRow: InvoiceDispatchInsert = {
    invoice_id: invoiceId,
    dispatch_rule_id: null,
    channel,
    target: target as unknown as InvoiceDispatchInsert["target"],
    status: "pending",
  };
  const { data: dispatch, error: insertErr } = await client
    .from("invoice_dispatch")
    .insert(insertRow)
    .select("invoice_dispatch_id")
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };
  if (!dispatch) return { ok: false, error: "insert_failed" };

  // 3. Resolve workspace and spawn engine_state. Mirror of the
  //    enqueueDispatchesForInvoice flow; ad-hoc is just a single row.
  const { data: ws } = await client
    .from("workspace")
    .select("workspace_id")
    .eq("company_id", invoice.company_id)
    .limit(1)
    .maybeSingle();
  const workspaceId = ws?.workspace_id ?? null;

  if (workspaceId) {
    const { data: steps } = await client
      .from("engine_step")
      .select("*")
      .eq("process_id", "invoice_dispatch_delivery")
      .order("step_order");

    const firstStep = steps && steps.length > 0 ? steps[0] : undefined;
    if (firstStep) {
      const context = {
        invoice_dispatch_id: dispatch.invoice_dispatch_id,
        channel,
        originating_channel: "system",
      };

      const { data: state } = await client
        .from("engine_state")
        .insert({
          process_id: "invoice_dispatch_delivery",
          workspace_id: workspaceId,
          status: "active",
          current_step: 1,
          entity_type: "invoice_dispatch",
          entity_id: dispatch.invoice_dispatch_id,
          context,
          steps_snapshot: steps,
          result: {},
        })
        .select("id")
        .single();

      if (state) {
        await client.from("engine_state_step").insert({
          state_id: state.id,
          step_order: 1,
          status: "active",
          action_type: "dispatch_invoice",
          action_payload: firstStep.action_payload ?? {},
        });
      }
    }
  }

  return { ok: true, invoice_dispatch_id: dispatch.invoice_dispatch_id };
}
