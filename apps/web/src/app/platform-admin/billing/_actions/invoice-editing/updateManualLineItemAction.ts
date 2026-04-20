"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  UpdateManualLineItemInputSchema,
  updateManualLineItem,
  type UpdateManualLineItemResult,
} from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Fase 2 Spor C — updateManualLineItemAction.
//
// Builds a before/after diff so the emitted event carries a
// structured `changes` payload. billing_activity_log reads `changes`
// from the event properties and persists it verbatim.

export async function updateManualLineItemAction(
  rawInput: unknown,
): Promise<UpdateManualLineItemResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = UpdateManualLineItemInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }

  const supabase = createAdminClient();
  const result = await updateManualLineItem(supabase, parsed.data);
  if (!result.ok) return result;

  // Compute a narrow diff — only fields that actually changed.
  // Values are stored as strings/numbers by Postgres; we coerce to
  // Number() for symmetric comparison.
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  const keys = ["description", "quantity", "unit_price", "vat_rate"] as const;
  for (const key of keys) {
    const before = result.before[key];
    const after = result.after[key];
    if (String(before) !== String(after)) {
      changes[key] = { before, after };
    }
  }

  await emit({
    event: "invoice line_item edited",
    actor_id: adminId,
    workspace_id: null,
    properties: {
      entity_type: "invoice_line_item",
      entity_id: result.after.line_item_id,
      changes,
      data: { invoice_id: result.after.invoice_id },
    },
  });

  revalidatePath(`/platform-admin/billing/invoices/${result.after.invoice_id}`);
  revalidatePath("/platform-admin/billing/invoices");

  return result;
}
