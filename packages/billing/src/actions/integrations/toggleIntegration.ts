// toggleIntegration — platform-admin action that flips is_enabled.
// Returns the new row so the web wrapper can revalidatePath immediately
// without a secondary fetch.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { BillingIntegration } from "../../types";

type BillingClient = SupabaseClient<Database>;

export type ToggleIntegrationResult =
  | { ok: true; integration: BillingIntegration; changed: boolean }
  | { ok: false; error: string };

export async function toggleIntegration(
  client: BillingClient,
  integrationId: string,
  enabled: boolean,
): Promise<ToggleIntegrationResult> {
  const { data: before, error: loadErr } = await client
    .from("billing_integration")
    .select("*")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!before) return { ok: false, error: "integration_not_found" };

  // No-op short-circuit — keeps the 'integration updated' emit honest.
  if (before.is_enabled === enabled) {
    return {
      ok: true,
      integration: before as BillingIntegration,
      changed: false,
    };
  }

  const { data: after, error: updateErr } = await client
    .from("billing_integration")
    .update({ is_enabled: enabled })
    .eq("integration_id", integrationId)
    .select("*")
    .single();

  if (updateErr) return { ok: false, error: updateErr.message };
  if (!after) return { ok: false, error: "update_failed" };

  return {
    ok: true,
    integration: after as BillingIntegration,
    changed: true,
  };
}
