// createIntegration — platform-admin action to register a new
// billing_integration row. Pure async function, mobile parity: Server
// Action wraps it, React Native callers invoke directly.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type {
  BillingIntegration,
  BillingIntegrationInsert,
  BillingIntegrationType,
} from "../../types";

type BillingClient = SupabaseClient<Database>;

export type CreateIntegrationInput = {
  integration_type: BillingIntegrationType;
  display_name: string;
  config?: Record<string, unknown>;
  is_enabled?: boolean;
  is_placeholder?: boolean;
  workspace_id?: string | null;
};

export type CreateIntegrationResult =
  | { ok: true; integration: BillingIntegration }
  | { ok: false; error: string };

export async function createIntegration(
  client: BillingClient,
  input: CreateIntegrationInput,
): Promise<CreateIntegrationResult> {
  // ADR-0129 sanity net: if caller ticks is_placeholder with a
  // non-placeholder type, accept it. The integration_type alone does
  // NOT auto-imply is_placeholder — ops may flag a real integration as
  // a rehearsal row. The audit gate runs at sync-time, not at create.
  const insertRow: BillingIntegrationInsert = {
    integration_type: input.integration_type,
    display_name: input.display_name,
    config: (input.config ?? {}) as BillingIntegrationInsert["config"],
    is_enabled: input.is_enabled ?? true,
    is_placeholder: input.is_placeholder ?? false,
    workspace_id: input.workspace_id ?? null,
  };

  const { data, error } = await client
    .from("billing_integration")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "insert_failed" };
  return { ok: true, integration: data as BillingIntegration };
}
