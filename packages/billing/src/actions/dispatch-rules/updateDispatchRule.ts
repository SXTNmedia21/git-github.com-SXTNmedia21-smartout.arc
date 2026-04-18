// updateDispatchRule — mutate an existing billing_dispatch_rule row.
// Pure function, mobile parity: web wraps in a Server Action, mobile
// calls directly.
//
// Scope discipline lives in the auth layer (Server Action for web,
// per-call auth for mobile). This function only applies the patch it
// receives. Zod validation for platform rules is enforced via the
// schema at the RPC boundary.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type {
  BillingDispatchChannel,
  BillingDispatchRule,
  BillingDispatchRuleUpdate,
  DispatchRuleAction,
} from "../../types";

type BillingClient = SupabaseClient<Database>;

export type UpdateDispatchRulePatch = {
  channel?: BillingDispatchChannel;
  trigger_event?: string;
  target?: Record<string, unknown>;
  template_id?: string | null;
  company_id?: string | null;
  action?: DispatchRuleAction;
  is_enabled?: boolean;
};

export type UpdateDispatchRuleResult =
  | { ok: true; rule: BillingDispatchRule; before: BillingDispatchRule }
  | { ok: false; error: string };

export async function updateDispatchRule(
  client: BillingClient,
  ruleId: string,
  patch: UpdateDispatchRulePatch,
): Promise<UpdateDispatchRuleResult> {
  // Load the "before" snapshot so the Server Action layer can compute
  // a changes-diff for the telemetry event.
  const { data: before, error: loadError } = await client
    .from("billing_dispatch_rule")
    .select("*")
    .eq("dispatch_rule_id", ruleId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!before) return { ok: false, error: "dispatch_rule_not_found" };

  const updateRow: BillingDispatchRuleUpdate = {};
  if (patch.channel !== undefined) updateRow.channel = patch.channel;
  if (patch.trigger_event !== undefined) updateRow.trigger_event = patch.trigger_event;
  if (patch.target !== undefined) {
    updateRow.target = patch.target as BillingDispatchRuleUpdate["target"];
  }
  if (patch.template_id !== undefined) updateRow.template_id = patch.template_id;
  if (patch.company_id !== undefined) updateRow.company_id = patch.company_id;
  if (patch.action !== undefined) updateRow.action = patch.action;
  if (patch.is_enabled !== undefined) updateRow.is_enabled = patch.is_enabled;

  const { data, error } = await client
    .from("billing_dispatch_rule")
    .update(updateRow)
    .eq("dispatch_rule_id", ruleId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "update_failed" };
  return {
    ok: true,
    rule: data as BillingDispatchRule,
    before: before as BillingDispatchRule,
  };
}
