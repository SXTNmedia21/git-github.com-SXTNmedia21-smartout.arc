// toggleDispatchRule — flip the is_enabled flag. Thin convenience wrapper
// over updateDispatchRule for the rules table inline toggle.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { BillingDispatchRule } from "../../types";

type BillingClient = SupabaseClient<Database>;

export type ToggleDispatchRuleResult =
  | { ok: true; rule: BillingDispatchRule; before: BillingDispatchRule }
  | { ok: false; error: string };

export async function toggleDispatchRule(
  client: BillingClient,
  ruleId: string,
  isEnabled: boolean,
): Promise<ToggleDispatchRuleResult> {
  const { data: before, error: loadError } = await client
    .from("billing_dispatch_rule")
    .select("*")
    .eq("dispatch_rule_id", ruleId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!before) return { ok: false, error: "dispatch_rule_not_found" };

  const { data, error } = await client
    .from("billing_dispatch_rule")
    .update({ is_enabled: isEnabled })
    .eq("dispatch_rule_id", ruleId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "toggle_failed" };
  return {
    ok: true,
    rule: data as BillingDispatchRule,
    before: before as BillingDispatchRule,
  };
}
