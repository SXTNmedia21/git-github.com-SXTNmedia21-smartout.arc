"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import { MarkInvoicePaidInputSchema } from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 7.1 — markInvoicePaid
//
// Pattern (every billing Server Action in this file + siblings):
//   1. getSuperAdminId() gate.
//   2. Zod validation via @smartout/billing schema.
//   3. Status-guarded DB update (issued/sent/overdue -> paid).
//   4. emit(...) — routes through billing_activity_log (ADR-0125)
//      with actor_id = user_identity.user_id.
//   5. revalidatePath on list + detail.

export async function markInvoicePaid(
  rawInput: unknown,
): Promise<{ ok: true; invoice_id: string } | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = MarkInvoicePaidInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }
  const input = parsed.data;

  const supabase = createAdminClient();

  // Status guard in the WHERE clause — if the row is not in a payable
  // state the UPDATE affects zero rows and .single() returns null.
  const { data: invoice, error } = await supabase
    .from("invoice")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_date: input.payment_date,
      payment_reference: input.payment_reference,
      payment_channel: input.payment_channel,
    })
    .eq("invoice_id", input.invoice_id)
    .in("status", ["issued", "sent", "overdue"])
    .select("invoice_id, company_id, amount_incl_vat")
    .maybeSingle();

  if (error) {
    console.error("[markInvoicePaid] update failed:", error);
    return { ok: false, error: error.message };
  }
  if (!invoice) {
    return {
      ok: false,
      error: "invoice_not_found_or_not_in_payable_state",
    };
  }

  await emit({
    event: "invoice marked_paid",
    actor_id: adminId,
    workspace_id: null,
    properties: {
      entity_type: "invoice",
      entity_id: invoice.invoice_id,
      data: {
        company_id: invoice.company_id,
        amount_incl_vat: Number(invoice.amount_incl_vat),
        payment_channel: input.payment_channel,
        payment_date: input.payment_date,
        payment_reference: input.payment_reference,
      },
    },
  });

  revalidatePath("/platform-admin/billing/invoices");
  revalidatePath(`/platform-admin/billing/invoices/${invoice.invoice_id}`);

  return { ok: true, invoice_id: invoice.invoice_id };
}
