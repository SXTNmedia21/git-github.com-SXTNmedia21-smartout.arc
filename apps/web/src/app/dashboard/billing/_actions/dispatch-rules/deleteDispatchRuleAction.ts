"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  DeleteDispatchRuleInputSchema,
  deleteDispatchRule,
  type DeleteDispatchRuleResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveWorkspaceAdminContext } from "./_shared";
import { isWorkspaceAuthorised } from "./_helpers";

export async function deleteDispatchRuleAction(
  rawInput: unknown,
): Promise<DeleteDispatchRuleResult | { ok: false; error: string }> {
  const ctx = await resolveWorkspaceAdminContext();
  if (!ctx) return { ok: false, error: "unauthorized" };

  const parsed = DeleteDispatchRuleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();

  // Pre-check workspace scope. Platform rules (workspace_id NULL) are
  // never deletable from the workspace UI.
  const { data: existing } = await supabase
    .from("billing_dispatch_rule")
    .select("workspace_id")
    .eq("dispatch_rule_id", parsed.data.dispatch_rule_id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "dispatch_rule_not_found" };
  if (!isWorkspaceAuthorised(ctx, existing.workspace_id)) {
    return { ok: false, error: "forbidden_workspace_scope" };
  }

  const result = await deleteDispatchRule(supabase, parsed.data.dispatch_rule_id);
  if (!result.ok) return result;

  await emit({
    event: "dispatch_rule deleted",
    actor_id: nonEmpty(ctx.user_id, "actor_id"),
    workspace_id: result.deleted.workspace_id
      ? nonEmpty(result.deleted.workspace_id, "workspace_id")
      : null,
    properties: {
      entity_type: "billing_dispatch_rule",
      entity_id: result.deleted.dispatch_rule_id,
      data: {
        workspace_id: result.deleted.workspace_id,
      },
    },
  });

  revalidatePath("/dashboard/billing/settings");
  return result;
}
