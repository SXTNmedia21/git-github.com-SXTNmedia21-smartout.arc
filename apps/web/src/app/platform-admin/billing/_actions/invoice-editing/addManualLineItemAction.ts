"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  AddManualLineItemInputSchema,
  addManualLineItem,
  type AddManualLineItemResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Fase 2 Spor C — addManualLineItemAction wrapper.
//
// Pattern mirrors the B4 integration actions:
//   1. getSuperAdminId() gate (platform-admin only).
//   2. Zod validation via @smartout/billing schema.
//   3. Delegate to the pure addManualLineItem() function.
//   4. emit 'invoice line_item added' — routed through
//      billing_activity_log per telemetry registry.
//   5. revalidatePath on the invoice detail route.

export async function addManualLineItemAction(
  rawInput: unknown,
): Promise<AddManualLineItemResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = AddManualLineItemInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }

  const supabase = createAdminClient();
  const result = await addManualLineItem(supabase, parsed.data);
  if (!result.ok) return result;

  await emit({
    event: "invoice line_item added",
    actor_id: nonEmpty(adminId, "actor_id"),
    workspace_id: null,
    properties: {
      entity_type: "invoice_line_item",
      entity_id: result.line_item.line_item_id,
      data: {
        invoice_id: result.line_item.invoice_id,
        line_type: result.line_item.line_type,
        amount_incl_vat: Number(result.line_item.amount_incl_vat),
      },
    },
  });

  revalidatePath(`/platform-admin/billing/invoices/${parsed.data.invoice_id}`);
  revalidatePath("/platform-admin/billing/invoices");

  return result;
}
