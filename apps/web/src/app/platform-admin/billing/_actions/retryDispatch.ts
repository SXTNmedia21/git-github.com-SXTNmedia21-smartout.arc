"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import { RetryDispatchInputSchema, retryDispatch } from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 2 B2 — retryDispatchAction wrapper.
//
// Mirrors Fase 1 Server Actions (see ./markInvoicePaid.ts):
//   1. getSuperAdminId() gate.
//   2. Zod validation via @smartout/billing schema.
//   3. Delegate to the pure retryDispatch() function in packages/billing.
//   4. emit(...) — 'invoice dispatch retry_requested' routes through
//      logger + billing_activity_log per spec §11 / ADR-0125.
//   5. revalidatePath on list + detail so the Dispatches section
//      re-renders the new pending state.

export async function retryDispatchAction(
  rawInput: unknown,
): Promise<{ ok: true; invoice_dispatch_id: string } | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = RetryDispatchInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();

  // Load invoice_id up front for the emit payload + revalidatePath.
  const { data: dispatch } = await supabase
    .from("invoice_dispatch")
    .select("invoice_id")
    .eq("invoice_dispatch_id", parsed.data.invoice_dispatch_id)
    .maybeSingle();

  const result = await retryDispatch(supabase, parsed.data.invoice_dispatch_id, adminId);
  if (!result.ok) return result;

  await emit({
    event: "invoice dispatch retry_requested",
    actor_id: nonEmpty(adminId, "actor_id"),
    workspace_id: null,
    properties: {
      entity_type: "invoice_dispatch",
      entity_id: parsed.data.invoice_dispatch_id,
      data: {
        invoice_id: dispatch?.invoice_id ?? "",
        requested_by: adminId,
      },
    },
  });

  revalidatePath("/platform-admin/billing/invoices");
  if (dispatch?.invoice_id) {
    revalidatePath(`/platform-admin/billing/invoices/${dispatch.invoice_id}`);
  }

  return result;
}
