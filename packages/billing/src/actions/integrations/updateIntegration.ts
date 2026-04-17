// updateIntegration — platform-admin action for editing an existing
// billing_integration row. Returns before/after snapshot so the web
// Server Action wrapper can emit a diff-shaped 'integration updated'
// event without a second load.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { BillingIntegration, BillingIntegrationUpdate } from "../../types";

type BillingClient = SupabaseClient<Database>;

export type UpdateIntegrationPatch = {
  display_name?: string;
  config?: Record<string, unknown>;
  is_enabled?: boolean;
  is_placeholder?: boolean;
};

export type UpdateIntegrationResult =
  | {
      ok: true;
      before: BillingIntegration;
      after: BillingIntegration;
    }
  | { ok: false; error: string };

export async function updateIntegration(
  client: BillingClient,
  integrationId: string,
  patch: UpdateIntegrationPatch,
): Promise<UpdateIntegrationResult> {
  const { data: before, error: loadErr } = await client
    .from("billing_integration")
    .select("*")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!before) return { ok: false, error: "integration_not_found" };

  const patchRow: BillingIntegrationUpdate = {};
  if (patch.display_name !== undefined) patchRow.display_name = patch.display_name;
  if (patch.config !== undefined) {
    patchRow.config = patch.config as BillingIntegrationUpdate["config"];
  }
  if (patch.is_enabled !== undefined) patchRow.is_enabled = patch.is_enabled;
  if (patch.is_placeholder !== undefined) patchRow.is_placeholder = patch.is_placeholder;

  const { data: after, error: updateErr } = await client
    .from("billing_integration")
    .update(patchRow)
    .eq("integration_id", integrationId)
    .select("*")
    .single();

  if (updateErr) return { ok: false, error: updateErr.message };
  if (!after) return { ok: false, error: "update_failed" };

  return {
    ok: true,
    before: before as BillingIntegration,
    after: after as BillingIntegration,
  };
}
