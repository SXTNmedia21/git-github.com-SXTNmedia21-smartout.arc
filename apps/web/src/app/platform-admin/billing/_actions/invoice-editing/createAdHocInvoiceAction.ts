"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  CreateAdHocInvoiceInputSchema,
  createAdHocInvoice,
  type CreateAdHocInvoiceResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Fase 2 Spor C — createAdHocInvoiceAction wrapper for the Sheet-drawer
// form. Uses the existing `one_off` invoice_type enum value — no new
// enum per spec §5.2.

export async function createAdHocInvoiceAction(
  rawInput: unknown,
): Promise<CreateAdHocInvoiceResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = CreateAdHocInvoiceInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }

  const supabase = createAdminClient();
  const result = await createAdHocInvoice(supabase, {
    ...parsed.data,
    created_by: adminId,
  });
  if (!result.ok) return result;

  await emit({
    event: "invoice adhoc_created",
    actor_id: nonEmpty(adminId, "actor_id"),
    workspace_id: null,
    properties: {
      entity_type: "invoice",
      entity_id: result.invoice.invoice_id,
      data: {
        company_id: result.invoice.company_id,
        amount_incl_vat: Number(result.invoice.amount_incl_vat),
      },
    },
  });

  revalidatePath("/platform-admin/billing/invoices");

  return result;
}
