"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  ToggleDispatchRuleInputSchema,
  toggleDispatchRule,
  type ToggleDispatchRuleResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveWorkspaceAdminContext } from "./_shared";
import { isWorkspaceAuthorised } from "./_helpers";

export async function toggleDispatchRuleAction(
  rawInput: unknown,
): Promise<ToggleDispatchRuleResult | { ok: false; error: string }> {
  const ctx = await resolveWorkspaceAdminContext();
  if (!ctx) return { ok: false, error: "unauthorized" };

  const parsed = ToggleDispatchRuleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("billing_dispatch_rule")
    .select("workspace_id")
    .eq("dispatch_rule_id", parsed.data.dispatch_rule_id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "dispatch_rule_not_found" };
  if (!isWorkspaceAuthorised(ctx, existing.workspace_id)) {
    return { ok: false, error: "forbidden_workspace_scope" };
  }

  const result = await toggleDispatchRule(
    supabase,
    parsed.data.dispatch_rule_id,
    parsed.data.is_enabled,
  );
  if (!result.ok) return result;

  await emit({
    event: "dispatch_rule updated",
    actor_id: nonEmpty(ctx.user_id, "actor_id"),
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

  revalidatePath("/dashboard/billing/settings");
  return result;
}
