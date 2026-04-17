"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  UpdateDispatchRuleInputSchema,
  updateDispatchRule,
  type UpdateDispatchRuleResult,
} from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

type ChangeSet = Record<string, { before: unknown; after: unknown }>;

// Keys tracked for the updated-diff. target is compared via JSON-string
// so nested changes land correctly; action/trigger_event are primitive.
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

export async function updateDispatchRuleAction(
  rawInput: unknown,
): Promise<UpdateDispatchRuleResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = UpdateDispatchRuleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const { dispatch_rule_id, ...patch } = parsed.data;

  const supabase = createAdminClient();
  const result = await updateDispatchRule(supabase, dispatch_rule_id, patch);
  if (!result.ok) return result;

  const changes = diffRule(
    result.before as unknown as Record<string, unknown>,
    result.rule as unknown as Record<string, unknown>,
    TRACKED_KEYS,
  );

  await emit({
    event: "dispatch_rule updated",
    actor_id: adminId,
    workspace_id: result.rule.workspace_id,
    properties: {
      entity_type: "billing_dispatch_rule",
      entity_id: result.rule.dispatch_rule_id,
      changes,
    },
  });

  revalidatePath("/platform-admin/billing/settings/dispatch");
  return result;
}
