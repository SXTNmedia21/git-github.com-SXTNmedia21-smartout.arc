"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  DeleteDispatchRuleInputSchema,
  deleteDispatchRule,
  type DeleteDispatchRuleResult,
} from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

export async function deleteDispatchRuleAction(
  rawInput: unknown,
): Promise<DeleteDispatchRuleResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = DeleteDispatchRuleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();
  const result = await deleteDispatchRule(supabase, parsed.data.dispatch_rule_id);
  if (!result.ok) return result;

  await emit({
    event: "dispatch_rule deleted",
    actor_id: adminId,
    workspace_id: result.deleted.workspace_id,
    properties: {
      entity_type: "billing_dispatch_rule",
      entity_id: result.deleted.dispatch_rule_id,
      data: {
        workspace_id: result.deleted.workspace_id,
      },
    },
  });

  revalidatePath("/platform-admin/billing/settings/dispatch");
  return result;
}
