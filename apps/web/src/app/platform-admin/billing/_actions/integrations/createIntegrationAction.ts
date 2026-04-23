"use server";

import { revalidatePath } from "next/cache";
import {
  CreateIntegrationInputSchema,
  createIntegration,
  type AdminActionResult,
  type BillingIntegration,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { withPlatformAdmin } from "@/lib/billing/withAdmin";

// Phase 2 B4 — createIntegrationAction wrapper.
//
// Fase 3A B0 (2026-04-17): migrated from inline getSuperAdminId() to the
// withPlatformAdmin() wrapper. The pure createIntegration() in
// @smartout/billing still owns the DB insert + ADR-0129 sanity net. This
// wrapper is now only Zod validation + emit + revalidatePath.
//
// Return shape aligned to AdminActionResult<BillingIntegration>.

export async function createIntegrationAction(
  rawInput: unknown,
): Promise<AdminActionResult<BillingIntegration>> {
  return withPlatformAdmin(async (adminId, supabase) => {
    const parsed = CreateIntegrationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "invalid_input",
        code: "invalid_input",
      };
    }

    const result = await createIntegration(supabase, parsed.data);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    await emit({
      event: "integration created",
      actor_id: nonEmpty(adminId, "actor_id"),
      workspace_id: result.integration.workspace_id
        ? nonEmpty(result.integration.workspace_id, "workspace_id")
        : null,
      properties: {
        entity_type: "billing_integration",
        entity_id: result.integration.integration_id,
        data: {
          integration_type: result.integration.integration_type,
          is_placeholder: result.integration.is_placeholder,
          workspace_id: result.integration.workspace_id,
        },
      },
    });

    revalidatePath("/platform-admin/billing/integrations");
    return { ok: true, data: result.integration };
  });
}
