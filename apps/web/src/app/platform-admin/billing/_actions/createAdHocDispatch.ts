"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import { CreateAdHocDispatchInputSchema, createAdHocDispatch } from "@smartout/billing";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 2 B2 — createAdHocDispatchAction wrapper.
//
// Platform-admin "Send ad-hoc" from the invoice detail sheet. The pure
// createAdHocDispatch() function in packages/billing inserts the
// invoice_dispatch row + engine_state; this wrapper adds the auth gate,
// input validation, and Next.js revalidation.

export async function createAdHocDispatchAction(
  rawInput: unknown,
): Promise<{ ok: true; invoice_dispatch_id: string } | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = CreateAdHocDispatchInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();
  const result = await createAdHocDispatch(
    supabase,
    parsed.data.invoice_id,
    parsed.data.channel,
    parsed.data.target,
  );

  if (!result.ok) return result;

  revalidatePath("/platform-admin/billing/invoices");
  revalidatePath(`/platform-admin/billing/invoices/${parsed.data.invoice_id}`);

  return result;
}
