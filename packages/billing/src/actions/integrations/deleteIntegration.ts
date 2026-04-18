// deleteIntegration — platform-admin action to remove a
// billing_integration row. Soft-delete is not required for Fase 2:
// ops can disable an integration via is_enabled=false without losing
// history. Hard-delete here is for mis-typed / duplicate rows that
// never shipped.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { BillingIntegration } from "../../types";

type BillingClient = SupabaseClient<Database>;

export type DeleteIntegrationResult =
  | { ok: true; deleted: BillingIntegration }
  | { ok: false; error: string };

export async function deleteIntegration(
  client: BillingClient,
  integrationId: string,
): Promise<DeleteIntegrationResult> {
  const { data: before, error: loadErr } = await client
    .from("billing_integration")
    .select("*")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!before) return { ok: false, error: "integration_not_found" };

  const { error: deleteErr } = await client
    .from("billing_integration")
    .delete()
    .eq("integration_id", integrationId);

  if (deleteErr) return { ok: false, error: deleteErr.message };
  return { ok: true, deleted: before as BillingIntegration };
}
