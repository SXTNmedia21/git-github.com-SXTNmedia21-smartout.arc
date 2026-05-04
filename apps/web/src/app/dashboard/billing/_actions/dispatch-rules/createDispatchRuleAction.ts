"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  CreateDispatchRuleInputSchema,
  createDispatchRule,
  type CreateDispatchRuleResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveWorkspaceAdminContext } from "./_shared";
import { isWorkspaceAuthorised } from "./_helpers";

// Workspace-admin createDispatchRuleAction.
//
// Scope rules (spec §7 RLS + §3.6 UI):
//  - workspace_id MUST be set and MUST be in the caller's admin scope.
//    Workspace admins can never create a platform-baseline rule
//    (workspace_id NULL is platform-only).
//  - action='suppress' is allowed — this is how workspace admins turn
//    off a platform default by matching its (channel, trigger_event,
//    target) dedup-key (ADR-0127).
//  - company_id may be set to carve out a specific customer within the
//    workspace's own billing scope.

export async function createDispatchRuleAction(
  rawInput: unknown,
): Promise<CreateDispatchRuleResult | { ok: false; error: string }> {
  const ctx = await resolveWorkspaceAdminContext();
  if (!ctx) return { ok: false, error: "unauthorized" };

  const parsed = CreateDispatchRuleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  // Workspace UI cannot create platform rules — reject workspace_id
  // NULL early so Zod's platform-rule refinement never matters here.
  if (!isWorkspaceAuthorised(ctx, parsed.data.workspace_id ?? null)) {
    return { ok: false, error: "forbidden_workspace_scope" };
  }

  const supabase = createAdminClient();
  const result = await createDispatchRule(supabase, {
    ...parsed.data,
    created_by: ctx.user_id,
  });
  if (!result.ok) return result;

  await emit({
    event: "dispatch_rule created",
    actor_id: nonEmpty(ctx.user_id, "actor_id"),
    workspace_id: result.rule.workspace_id
      ? nonEmpty(result.rule.workspace_id, "workspace_id")
      : null,
    properties: {
      entity_type: "billing_dispatch_rule",
      entity_id: result.rule.dispatch_rule_id,
      data: {
        workspace_id: result.rule.workspace_id,
        channel: result.rule.channel,
        trigger_event: result.rule.trigger_event,
        action: result.rule.action,
      },
    },
  });

  revalidatePath("/dashboard/billing/settings");
  return result;
}
