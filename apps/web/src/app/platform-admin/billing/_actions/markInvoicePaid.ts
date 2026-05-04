"use server";

import { revalidatePath } from "next/cache";
import { MarkInvoicePaidInputSchema, type AdminActionResult } from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { withPlatformAdmin } from "@/lib/billing/withAdmin";

// Phase 7.1 — markInvoicePaid
//
// Fase 3A B0 (2026-04-17): migrated from inline getSuperAdminId() to the
// withPlatformAdmin() wrapper. Behaviour is identical — the wrapper collapses
// the auth-gate + admin-client boilerplate. Zod validation, status-guarded
// UPDATE, emit(), and revalidatePath remain in the handler body because they
// are action-specific.
//
// Caller contract: { ok: true; data: { invoice_id } } | { ok: false; error }.
// (Shape changed from legacy { ok: true; invoice_id } per AdminActionResult
// discriminant; current callers only branch on .ok + read .error.)

export async function markInvoicePaid(
  rawInput: unknown,
): Promise<AdminActionResult<{ invoice_id: string }>> {
  return withPlatformAdmin(async (adminId, supabase) => {
    const parsed = MarkInvoicePaidInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
        code: "invalid_input",
      };
    }
    const input = parsed.data;

    // Status guard in the WHERE clause — if the row is not in a payable
    // state the UPDATE affects zero rows and .maybeSingle() returns null.
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
      return { ok: false, error: error.message, code: "internal_error" };
    }
    if (!invoice) {
      return {
        ok: false,
        error: "invoice_not_found_or_not_in_payable_state",
        code: "not_found",
      };
    }

    await emit({
      event: "invoice marked_paid",
      actor_id: nonEmpty(adminId, "actor_id"),
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

    // B7-fase3b (ADR-0148): ekstra event for accountant-rapportert mark-paid
    // så billing_activity_log kan skille regnskapsfører-rapportert fra
    // platform-admin korreksjon. Mark-paid-flyten forblir lik.
    if (input.payment_channel === "accountant_manual") {
      await emit({
        event: "billing accountant_marked_paid",
        actor_id: nonEmpty(adminId, "actor_id"),
        workspace_id: null,
        properties: {
          entity_type: "invoice",
          entity_id: invoice.invoice_id,
          data: {
            workspace_id: invoice.company_id, // company_id; telemetry-event aksepterer string
            payment_reference: input.payment_reference,
            amount: Number(invoice.amount_incl_vat),
            currency: "NOK",
          },
        },
      });
    }

    revalidatePath("/platform-admin/billing/invoices");
    revalidatePath(`/platform-admin/billing/invoices/${invoice.invoice_id}`);

    return { ok: true, data: { invoice_id: invoice.invoice_id } };
  });
}
