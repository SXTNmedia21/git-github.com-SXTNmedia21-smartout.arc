"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import { VoidInvoiceInputSchema } from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 7.2 — voidInvoice
//
// Typed-confirmation gate: the UI forces the admin to type the
// invoice_number as a string; we verify server-side that it matches
// the actual column value before allowing the void. Defence-in-depth
// against accidental voids of the wrong invoice.
//
// Only issued | sent | overdue → void transitions are permitted.
// Paid / void / uncollectible are immutable per ADR-0120.

export async function voidInvoice(
  rawInput: unknown,
): Promise<{ ok: true; invoice_id: string } | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = VoidInvoiceInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }
  const input = parsed.data;

  const supabase = createAdminClient();

  const { data: existing, error: loadErr } = await supabase
    .from("invoice")
    .select("invoice_number, status")
    .eq("invoice_id", input.invoice_id)
    .maybeSingle();

  if (loadErr) {
    console.error("[voidInvoice] load failed:", loadErr);
    return { ok: false, error: loadErr.message };
  }
  if (!existing) {
    return { ok: false, error: "invoice_not_found" };
  }
  // Explicit null-number reject — a draft invoice has
  // invoice_number = NULL, and String(null ?? "") === "". If we only
  // used the string comparison below, an empty typed_confirmation
  // would pass for draft invoices, relying on the status guard as
  // sole defence. Make both guards independent so the confirmation
  // story is "AND status" not "OR status".
  if (existing.invoice_number === null) {
    return { ok: false, error: "invoice_not_voidable_no_number" };
  }
  if (String(existing.invoice_number) !== input.typed_confirmation) {
    return { ok: false, error: "typed_confirmation_mismatch" };
  }

  const allowed: Array<typeof existing.status> = ["issued", "sent", "overdue"];
  if (!allowed.includes(existing.status)) {
    return {
      ok: false,
      error: `status_not_voidable:${existing.status}`,
    };
  }

  const { data, error } = await supabase
    .from("invoice")
    .update({
      status: "void",
      voided_at: new Date().toISOString(),
      voided_by: adminId,
      void_reason: `${input.reason}: ${input.reason_detail}`,
    })
    .eq("invoice_id", input.invoice_id)
    .select("invoice_id, company_id")
    .maybeSingle();

  if (error) {
    console.error("[voidInvoice] update failed:", error);
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "void_failed" };
  }

  await emit({
    event: "invoice voided",
    actor_id: nonEmpty(adminId, "actor_id"),
    workspace_id: null,
    properties: {
      entity_type: "invoice",
      entity_id: data.invoice_id,
      data: {
        company_id: data.company_id,
        reason: input.reason,
        reason_detail: input.reason_detail,
      },
    },
  });

  revalidatePath("/platform-admin/billing/invoices");
  revalidatePath(`/platform-admin/billing/invoices/${data.invoice_id}`);

  return { ok: true, invoice_id: data.invoice_id };
}
