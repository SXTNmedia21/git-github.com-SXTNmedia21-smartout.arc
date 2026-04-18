"use server";

import { revalidatePath } from "next/cache";
import {
  InitiatePaymentInputSchema,
  initiatePayment,
  type AdminActionResult,
  type InitiatePaymentOutput,
} from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { withPlatformAdmin } from "@/lib/billing/withAdmin";

// Fase 3A B2.4 — platform-admin "Generate payment link manually".
//
// Use case: platform-admin wants to share a Stripe Checkout URL with a
// workspace out-of-band (email, phone call). Workspace-admin has their
// own action with workspace-gate (see dashboard/billing/_actions).
//
// Returns checkout_url for the admin UI to copy / open.

export async function initiatePaymentAction(
  rawInput: unknown,
): Promise<AdminActionResult<InitiatePaymentOutput>> {
  return withPlatformAdmin(async (adminId, supabase) => {
    const parsed = InitiatePaymentInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
        code: "invalid_input",
      };
    }

    const result = await initiatePayment(supabase, parsed.data);
    if (!result.ok) return result;

    // Load invoice for emit context — the pure function returns the
    // payment_id but not the invoice's company_id.
    const { data: invoiceRow } = await supabase
      .from("invoice")
      .select("invoice_id, company_id, amount_incl_vat, currency")
      .eq("invoice_id", parsed.data.invoice_id)
      .maybeSingle();

    if (invoiceRow) {
      await emit({
        event: "payment initiated",
        actor_id: adminId,
        workspace_id: null,
        properties: {
          entity_type: "payment",
          entity_id: result.data.payment_id,
          data: {
            invoice_id: invoiceRow.invoice_id,
            company_id: invoiceRow.company_id,
            amount: Number(invoiceRow.amount_incl_vat),
            currency: invoiceRow.currency,
            payment_method: "stripe_card",
          },
        },
      });
    }

    revalidatePath("/platform-admin/billing/payments");
    revalidatePath(`/platform-admin/billing/invoices/${parsed.data.invoice_id}`);

    return result;
  });
}
