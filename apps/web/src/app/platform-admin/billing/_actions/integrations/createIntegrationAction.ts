"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  CreateIntegrationInputSchema,
  createIntegration,
  type CreateIntegrationResult,
} from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 2 B4 — createIntegrationAction wrapper.
//
// Mirrors the dispatch action pattern (see ./../retryDispatch.ts):
//   1. getSuperAdminId() gate.
//   2. Zod validation via @smartout/billing schema.
//   3. Delegate to the pure createIntegration() function.
//   4. emit(...) 'integration created' — routed to PostHog + logger +
//      billing_activity_log per the telemetry registry (ADR-0125).
//   5. revalidatePath on the integrations list.

export async function createIntegrationAction(
  rawInput: unknown,
): Promise<CreateIntegrationResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = CreateIntegrationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();
  const result = await createIntegration(supabase, parsed.data);
  if (!result.ok) return result;

  await emit({
    event: "integration created",
    actor_id: adminId,
    workspace_id: result.integration.workspace_id,
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
  return result;
}
