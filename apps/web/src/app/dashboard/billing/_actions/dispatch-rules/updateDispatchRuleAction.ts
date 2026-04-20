"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  UpdateDispatchRuleInputSchema,
  updateDispatchRule,
  type UpdateDispatchRuleResult,
} from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { resolveWorkspaceAdminContext } from "./_shared";
import { isWorkspaceAuthorised } from "./_helpers";

type ChangeSet = Record<string, { before: unknown; after: unknown }>;

const TRACKED_KEYS = [
  "channel",
  "trigger_event",
  "target",
  "template_id",
  "company_id",
  "action",
  "is_enabled",
] as const;

function diffRule(
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

// Workspace-admin updateDispatchRuleAction.
//
// Pre-loads the existing rule to verify its workspace_id is in the
// caller's scope BEFORE the pure updateDispatchRule() function fires.
// Workspace-admin cannot touch platform rules (workspace_id NULL).

export async function updateDispatchRuleAction(
  rawInput: unknown,
): Promise<UpdateDispatchRuleResult | { ok: false; error: string }> {
  const ctx = await resolveWorkspaceAdminContext();
  if (!ctx) return { ok: false, error: "unauthorized" };

  const parsed = UpdateDispatchRuleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const { dispatch_rule_id, ...patch } = parsed.data;

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("billing_dispatch_rule")
    .select("workspace_id")
    .eq("dispatch_rule_id", dispatch_rule_id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "dispatch_rule_not_found" };
  if (!isWorkspaceAuthorised(ctx, existing.workspace_id)) {
    return { ok: false, error: "forbidden_workspace_scope" };
  }

  const result = await updateDispatchRule(supabase, dispatch_rule_id, patch);
  if (!result.ok) return result;

  const changes = diffRule(
    result.before as unknown as Record<string, unknown>,
    result.rule as unknown as Record<string, unknown>,
    TRACKED_KEYS,
  );

  await emit({
    event: "dispatch_rule updated",
    actor_id: ctx.user_id,
    workspace_id: result.rule.workspace_id,
    properties: {
      entity_type: "billing_dispatch_rule",
      entity_id: result.rule.dispatch_rule_id,
      changes,
    },
  });

  revalidatePath("/dashboard/billing/settings");
  return result;
}
