"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  RetriggerIntegrationSyncInputSchema,
  retriggerIntegrationSync,
  type RetriggerIntegrationSyncResult,
} from "@smartout/billing";
import { getSuperAdminId } from "@/lib/platform-admin";

// retriggerIntegrationSyncAction — wrapper for the manual "Retry" row
// action in the sync-history panel. Spawns an engine_state on the
// integration_sync process. The handler (handleSyncIntegration) emits
// the follow-up 'integration sync succeeded|failed|mocked' event when
// the engine step executes — this action does NOT emit directly.

export async function retriggerIntegrationSyncAction(
  rawInput: unknown,
): Promise<RetriggerIntegrationSyncResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = RetriggerIntegrationSyncInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();
  const result = await retriggerIntegrationSync(
    supabase,
    parsed.data.integration_id,
    parsed.data.entity_type,
    parsed.data.entity_id,
    parsed.data.operation,
  );

  if (result.ok) {
    revalidatePath("/platform-admin/billing/integrations");
  }
  return result;
}
