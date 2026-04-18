"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  DeleteManualLineItemInputSchema,
  deleteManualLineItem,
  type DeleteManualLineItemResult,
} from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Fase 2 Spor C — deleteManualLineItemAction.

export async function deleteManualLineItemAction(
  rawInput: unknown,
): Promise<DeleteManualLineItemResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = DeleteManualLineItemInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }

  const supabase = createAdminClient();
  const result = await deleteManualLineItem(supabase, parsed.data);
  if (!result.ok) return result;

  await emit({
    event: "invoice line_item removed",
    actor_id: adminId,
    workspace_id: null,
    properties: {
      entity_type: "invoice_line_item",
      entity_id: result.removed.line_item_id,
      data: { invoice_id: result.removed.invoice_id },
    },
  });

  revalidatePath(`/platform-admin/billing/invoices/${result.removed.invoice_id}`);
  revalidatePath("/platform-admin/billing/invoices");

  return result;
}
