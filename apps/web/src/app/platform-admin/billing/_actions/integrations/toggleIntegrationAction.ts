"use server";

import { revalidatePath } from "next/cache";
import {
  ToggleIntegrationInputSchema,
  toggleIntegration,
  type AdminActionResult,
  type BillingIntegration,
} from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { withPlatformAdmin } from "@/lib/billing/withAdmin";

// Fase 3A B0 (2026-04-17): migrated to withPlatformAdmin() wrapper. Conditional
// emit (only on state change) preserved from the original — the wrapper does
// not emit; that is the handler's job.

export async function toggleIntegrationAction(
  rawInput: unknown,
): Promise<AdminActionResult<BillingIntegration>> {
  return withPlatformAdmin(async (adminId, supabase) => {
    const parsed = ToggleIntegrationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
        code: "invalid_input",
      };
    }

    const result = await toggleIntegration(
      supabase,
      parsed.data.integration_id,
      parsed.data.enabled,
    );
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

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
    return { ok: true, data: result.integration };
  });
}
