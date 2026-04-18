// deleteDispatchRule — hard-delete a billing_dispatch_rule row.
// Pure function, mobile parity. Returns the deleted row so the Server
// Action layer can construct a lossless telemetry event (workspace_id
// stamp + integration_type for the audit trail).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { BillingDispatchRule } from "../../types";

type BillingClient = SupabaseClient<Database>;

export type DeleteDispatchRuleResult =
  | { ok: true; deleted: BillingDispatchRule }
  | { ok: false; error: string };

export async function deleteDispatchRule(
  client: BillingClient,
  ruleId: string,
): Promise<DeleteDispatchRuleResult> {
  // Load the row first so we have the full shape for the emit() payload.
  // Two round-trips is cheaper than a DELETE ... RETURNING that fights
  // RLS timing in some Postgres versions.
  const { data: existing, error: loadError } = await client
    .from("billing_dispatch_rule")
    .select("*")
    .eq("dispatch_rule_id", ruleId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!existing) return { ok: false, error: "dispatch_rule_not_found" };

  const { error: deleteError } = await client
    .from("billing_dispatch_rule")
    .delete()
    .eq("dispatch_rule_id", ruleId);

  if (deleteError) return { ok: false, error: deleteError.message };
  return { ok: true, deleted: existing as BillingDispatchRule };
}
