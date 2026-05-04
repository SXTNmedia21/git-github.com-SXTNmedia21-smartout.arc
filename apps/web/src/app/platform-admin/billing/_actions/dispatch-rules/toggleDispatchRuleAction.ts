"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  ToggleDispatchRuleInputSchema,
  toggleDispatchRule,
  type ToggleDispatchRuleResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Toggle is modelled as a 'dispatch_rule updated' event with a single-
// key changes-diff so the billing_activity_log audit uses one code path.

export async function toggleDispatchRuleAction(
  rawInput: unknown,
): Promise<ToggleDispatchRuleResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = ToggleDispatchRuleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();
  const result = await toggleDispatchRule(
    supabase,
    parsed.data.dispatch_rule_id,
    parsed.data.is_enabled,
  );
  if (!result.ok) return result;

  await emit({
    event: "dispatch_rule updated",
    actor_id: nonEmpty(adminId, "actor_id"),
    workspace_id: result.rule.workspace_id
      ? nonEmpty(result.rule.workspace_id, "workspace_id")
      : null,
    properties: {
      entity_type: "billing_dispatch_rule",
      entity_id: result.rule.dispatch_rule_id,
      changes: {
        is_enabled: {
          before: result.before.is_enabled,
          after: result.rule.is_enabled,
        },
      },
    },
  });

  revalidatePath("/platform-admin/billing/settings/dispatch");
  return result;
}
