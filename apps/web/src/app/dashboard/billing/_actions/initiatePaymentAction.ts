"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  InitiatePaymentInputSchema,
  initiatePayment,
  type AdminActionResult,
  type InitiatePaymentOutput,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
// Fase 3A B2.4 — workspace "Betal nå" Server Action.
//
// Auth gate pattern mirrors ./markInvoicePaidAction.ts:
//   - Cookie-bound client resolves caller (JWT)
//   - Resolve caller's company + verify company_member.role IN ('admin','owner')
//   - Verify invoice.company_id matches caller's company (zero trust on
//     client-supplied invoice_id)
//
// We can't use withWorkspaceAdmin() directly here because workspace_id is
// not the authorisation anchor for a BILLING action — company_id is. A
// user may be admin in multiple workspaces for the same company; the
// billing surface is company-scoped. This is why markInvoicePaidAction
// uses company_member instead of is_admin_in_workspace.

export async function initiatePaymentAction(
  rawInput: unknown,
): Promise<AdminActionResult<InitiatePaymentOutput>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "unauthorized", code: "not_workspace_admin" };
  }

  const parsed = InitiatePaymentInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
      code: "invalid_input",
    };
  }

  const admin = createAdminClient();

  // Resolve caller's company — company_member is the billing-surface
  // gate. A user with admin role in any active company_member row
  // qualifies; billing is company-scoped, not workspace-scoped.
  const { data: member } = await admin
    .from("company_member")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["admin", "owner"])
    .limit(1)
    .maybeSingle();

  if (!member) {
    return { ok: false, error: "forbidden", code: "not_workspace_admin" };
  }

  // Verify the invoice belongs to the caller's company. Prevents a
  // malicious admin from generating a Stripe session for another
  // tenant's invoice.
  const { data: invoiceRow } = await admin
    .from("invoice")
    .select("invoice_id, company_id, amount_incl_vat, currency")
    .eq("invoice_id", parsed.data.invoice_id)
    .maybeSingle();

  if (!invoiceRow || invoiceRow.company_id !== member.company_id) {
    return { ok: false, error: "invoice_not_found", code: "not_found" };
  }

  const result = await initiatePayment(admin, parsed.data);
  if (!result.ok) return result;

  await emit({
    event: "payment initiated",
    actor_id: nonEmpty(user.id, "actor_id"),
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

  revalidatePath("/dashboard/billing");
  revalidatePath(`/dashboard/billing/${parsed.data.invoice_id}`);

  return result;
}
