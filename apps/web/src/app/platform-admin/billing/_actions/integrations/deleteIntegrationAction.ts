"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  DeleteIntegrationInputSchema,
  deleteIntegration,
  type DeleteIntegrationResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

export async function deleteIntegrationAction(
  rawInput: unknown,
): Promise<DeleteIntegrationResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = DeleteIntegrationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();
  const result = await deleteIntegration(supabase, parsed.data.integration_id);
  if (!result.ok) return result;

  await emit({
    event: "integration deleted",
    actor_id: nonEmpty(adminId, "actor_id"),
    workspace_id: result.deleted.workspace_id
      ? nonEmpty(result.deleted.workspace_id, "workspace_id")
      : null,
    properties: {
      entity_type: "billing_integration",
      entity_id: result.deleted.integration_id,
      data: {
        integration_type: result.deleted.integration_type,
      },
    },
  });

  revalidatePath("/platform-admin/billing/integrations");
  return result;
}
