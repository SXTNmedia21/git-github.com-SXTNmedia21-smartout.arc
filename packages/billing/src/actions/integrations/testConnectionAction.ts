// testConnectionAction — runs adapter.testConnection() against a
// billing_integration row. Returns the adapter's 4-outcome taxonomy
// for the platform-admin UI to render via TestConnectionButton.
//
// ADR-0129: PlaceholderAdapter returns { status: 'ok', is_placeholder:
// true } — the UI renders a distinct badge so success is never
// confused with a real remote probe.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { BillingIntegration } from "../../types";
import { getIntegrationAdapter } from "../../integrations/registry";
import type { IntegrationTestConnectionResult } from "../../integrations/types";

type BillingClient = SupabaseClient<Database>;

export type TestConnectionActionResult = {
  ok: true;
  integration: BillingIntegration;
  result: IntegrationTestConnectionResult;
};

export type TestConnectionActionFailure = { ok: false; error: string };

export async function testConnectionAction(
  client: BillingClient,
  integrationId: string,
): Promise<TestConnectionActionResult | TestConnectionActionFailure> {
  const { data, error } = await client
    .from("billing_integration")
    .select("*")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "integration_not_found" };

  const integration = data as BillingIntegration;
  const adapter = getIntegrationAdapter(integration.integration_type);
  const result = await adapter.testConnection(integration);

  return { ok: true, integration, result };
}
