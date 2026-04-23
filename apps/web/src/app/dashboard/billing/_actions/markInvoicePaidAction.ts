"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  MarkInvoicePaidByWorkspaceAdminInputSchema,
  markInvoicePaidByWorkspaceAdmin,
  type MarkInvoicePaidByWorkspaceAdminResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
// Fase 2 Spor C — workspace-admin "Marker som betalt".
//
// Auth gate: company_member.role in ('admin', 'owner') — same pattern
// as the read-side getMyCompanyInvoices (see ./queries.ts). We use
// the cookie-bound server client to resolve the caller, then the
// admin client to verify the invoice belongs to that caller's
// company. Zero trust on the client-supplied invoice_id.
//
// Emits two events per spec §5.2 + telemetry registry:
//   - `invoice marked_paid` — parity with platform-admin flow; also
//     routes to engine_event so dispatch state machines observe the
//     settlement.
//   - `workspace marked_paid` — distinct event so admin UI can
//     display "betalt av [workspace-admin] [dato]".
//
// billing_activity_log row with source='web' is written automatically
// by the telemetry provider — no direct insert needed.

export async function markInvoicePaidAction(
  rawInput: unknown,
): Promise<MarkInvoicePaidByWorkspaceAdminResult | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsed = MarkInvoicePaidByWorkspaceAdminInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }

  const admin = createAdminClient();

  // Resolve caller's company + role. Same pattern as queries.ts —
  // workspace-admin billing is a company-scoped surface.
  const { data: member } = await admin
    .from("company_member")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["admin", "owner"])
    .limit(1)
    .maybeSingle();

  if (!member) return { ok: false, error: "forbidden" };

  // Verify the invoice belongs to the caller's company. Prevents a
  // malicious admin from marking another tenant's invoice paid.
  const { data: invoiceRow } = await admin
    .from("invoice")
    .select("invoice_id, company_id, amount_incl_vat")
    .eq("invoice_id", parsed.data.invoice_id)
    .maybeSingle();

  if (!invoiceRow || invoiceRow.company_id !== member.company_id) {
    return { ok: false, error: "invoice_not_found" };
  }

  const result = await markInvoicePaidByWorkspaceAdmin(admin, parsed.data);
  if (!result.ok) return result;

  // Two events so dispatch processes (engine_event routing) observe
  // the settlement AND the admin UI can audit "who marked paid".
  await Promise.all([
    emit({
      event: "invoice marked_paid",
      actor_id: nonEmpty(user.id, "actor_id"),
      workspace_id: null,
      properties: {
        entity_type: "invoice",
        entity_id: result.invoice.invoice_id,
        data: {
          company_id: result.invoice.company_id,
          amount_incl_vat: Number(result.invoice.amount_incl_vat),
          payment_channel: "bank_transfer",
          payment_date: parsed.data.payment_date,
          payment_reference: parsed.data.payment_reference,
        },
      },
    }),
    emit({
      event: "workspace marked_paid",
      actor_id: nonEmpty(user.id, "actor_id"),
      workspace_id: null,
      properties: {
        entity_type: "invoice",
        entity_id: result.invoice.invoice_id,
        data: {
          invoice_id: result.invoice.invoice_id,
          payment_date: parsed.data.payment_date,
          payment_reference: parsed.data.payment_reference,
        },
      },
    }),
  ]);

  revalidatePath("/dashboard/billing");
  revalidatePath(`/dashboard/billing/${result.invoice.invoice_id}`);

  return result;
}
