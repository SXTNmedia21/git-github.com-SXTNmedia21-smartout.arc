"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  UpdateIntegrationInputSchema,
  updateIntegration,
  type UpdateIntegrationResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

type ChangeSet = Record<string, { before: unknown; after: unknown }>;

// Build a minimal before/after diff for the 'integration updated' emit.
// Only keys the caller actually touched land in the event properties.
function diffIntegration(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly string[],
): ChangeSet {
  const changes: ChangeSet = {};
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes[key] = { before: b, after: a };
    }
  }
  return changes;
}

const TRACKED_KEYS = ["display_name", "config", "is_enabled", "is_placeholder"] as const;

export async function updateIntegrationAction(
  rawInput: unknown,
): Promise<UpdateIntegrationResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = UpdateIntegrationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const { integration_id, ...patch } = parsed.data;

  const supabase = createAdminClient();
  const result = await updateIntegration(supabase, integration_id, patch);
  if (!result.ok) return result;

  const changes = diffIntegration(
    result.before as unknown as Record<string, unknown>,
    result.after as unknown as Record<string, unknown>,
    TRACKED_KEYS,
  );

  await emit({
    event: "integration updated",
    actor_id: nonEmpty(adminId, "actor_id"),
    workspace_id: result.after.workspace_id
      ? nonEmpty(result.after.workspace_id, "workspace_id")
      : null,
    properties: {
      entity_type: "billing_integration",
      entity_id: result.after.integration_id,
      changes,
    },
  });

  revalidatePath("/platform-admin/billing/integrations");
  return result;
}
