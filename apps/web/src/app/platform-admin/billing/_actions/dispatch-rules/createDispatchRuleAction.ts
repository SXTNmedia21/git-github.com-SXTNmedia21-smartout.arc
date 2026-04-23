"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  CreateDispatchRuleInputSchema,
  createDispatchRule,
  type CreateDispatchRuleResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 2 B3 — platform-admin createDispatchRuleAction wrapper.
//
// Platform-admin can create rules with workspace_id NULL (baseline) or
// scope them to a specific workspace. Zod enforces the ADR-0127
// CHECK-constraint mirror (platform rules must be action=send and
// cannot be company-scoped) before the DB trip.

export async function createDispatchRuleAction(
  rawInput: unknown,
): Promise<CreateDispatchRuleResult | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = CreateDispatchRuleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();
  const result = await createDispatchRule(supabase, {
    ...parsed.data,
    created_by: adminId,
  });
  if (!result.ok) return result;

  await emit({
    event: "dispatch_rule created",
    actor_id: nonEmpty(adminId, "actor_id"),
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

  revalidatePath("/platform-admin/billing/settings/dispatch");
  return result;
}
