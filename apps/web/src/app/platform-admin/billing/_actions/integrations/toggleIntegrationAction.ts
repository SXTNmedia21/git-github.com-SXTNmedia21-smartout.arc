"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  ToggleIntegrationInputSchema,
  toggleIntegration,
  type ToggleIntegrationResult,
} from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

export async function toggleIntegrationAction(
  rawInput: unknown,
): Promise<ToggleIntegrationResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = ToggleIntegrationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();
  const result = await toggleIntegration(supabase, parsed.data.integration_id, parsed.data.enabled);
  if (!result.ok) return result;

  if (result.changed) {
    await emit({
      event: "integration updated",
      actor_id: adminId,
      workspace_id: result.integration.workspace_id,
      properties: {
        entity_type: "billing_integration",
        entity_id: result.integration.integration_id,
        changes: {
          is_enabled: {
            before: !parsed.data.enabled,
            after: parsed.data.enabled,
          },
        },
      },
    });
  }

  revalidatePath("/platform-admin/billing/integrations");
  return result;
}
