// createDispatchRule — platform-admin + workspace-admin pure action to
// register a new billing_dispatch_rule row. Mobile parity: web wraps
// this in a Server Action, React Native calls it directly with its
// own Supabase client.
//
// ADR-0127: platform rules (workspace_id NULL) must be action='send'
// and cannot be company-scoped. Zod enforces this at the RPC boundary
// (see CreateDispatchRuleInputSchema in ../../schemas.ts); the DB
// CHECK constraint is the last line of defence. This pure function
// simply trusts the caller — auth + Zod live one layer up.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type {
  BillingDispatchChannel,
  BillingDispatchRule,
  BillingDispatchRuleInsert,
  DispatchRuleAction,
} from "../../types";

type BillingClient = SupabaseClient<Database>;

export type CreateDispatchRuleInput = {
  workspace_id?: string | null;
  company_id?: string | null;
  channel: BillingDispatchChannel;
  trigger_event: string;
  target: Record<string, unknown>;
  template_id?: string | null;
  action?: DispatchRuleAction;
  is_enabled?: boolean;
  /** Optional stamp for audit trail (created_by FK). */
  created_by?: string | null;
};

export type CreateDispatchRuleResult =
  | { ok: true; rule: BillingDispatchRule }
  | { ok: false; error: string };

export async function createDispatchRule(
  client: BillingClient,
  input: CreateDispatchRuleInput,
): Promise<CreateDispatchRuleResult> {
  const insertRow: BillingDispatchRuleInsert = {
    workspace_id: input.workspace_id ?? null,
    company_id: input.company_id ?? null,
    channel: input.channel,
    trigger_event: input.trigger_event,
    target: input.target as BillingDispatchRuleInsert["target"],
    template_id: input.template_id ?? null,
    action: input.action ?? "send",
    is_enabled: input.is_enabled ?? true,
    created_by: input.created_by ?? null,
  };

  const { data, error } = await client
    .from("billing_dispatch_rule")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "insert_failed" };
  return { ok: true, rule: data as BillingDispatchRule };
}
