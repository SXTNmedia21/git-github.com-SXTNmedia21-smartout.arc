"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 8.2 — resolveDriftEvent
//
// Platform-admin records how a basis_drift_event was resolved:
// 'ignored' (non-material drift), 'credit_note_issued' (we already
// compensated the customer), or 'reinvoiced' (we regenerated the
// invoice for the corrected basis). The CHECK constraint on the DB
// limits the resolution values to these three; we mirror the list
// here for compile-time safety.
//
// No emit() call — drift resolution is recorded inline on the row.
// Phase 8+ can revisit if we need a separate audit event.

const ResolutionSchema = z.enum(["ignored", "credit_note_issued", "reinvoiced"]);

const ResolveDriftInput = z.object({
  drift_event_id: z.string().uuid(),
  resolution: ResolutionSchema,
});

export async function resolveDriftEvent(
  rawInput: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = ResolveDriftInput.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }
  const input = parsed.data;

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("basis_drift_event")
    .update({
      resolution: input.resolution,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq("drift_event_id", input.drift_event_id)
    .is("resolution", null);

  if (error) {
    console.error("[resolveDriftEvent] update failed:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/platform-admin/billing/drift");

  return { ok: true };
}
