// retriggerIntegrationSync — manual re-run of a sync for one entity
// against one integration. Creates an engine_state row on the
// integration_sync process with the minimum context the handler needs:
//   integration_id, entity_type, entity_id_synced, operation.
//
// Mobile parity: pure function, no Next.js primitives.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

type BillingClient = SupabaseClient<Database>;

export type IntegrationSyncEntity = "customer" | "invoice" | "contract" | "product" | "plan";
export type IntegrationSyncOperation = "create" | "update" | "delete";

export type RetriggerIntegrationSyncResult =
  | { ok: true; engine_state_id: string }
  | { ok: false; error: string };

export async function retriggerIntegrationSync(
  client: BillingClient,
  integrationId: string,
  entityType: IntegrationSyncEntity,
  entityId: string,
  operation: IntegrationSyncOperation,
): Promise<RetriggerIntegrationSyncResult> {
  // 1. Load the integration to confirm it exists + grab workspace_id.
  const { data: integration, error: loadErr } = await client
    .from("billing_integration")
    .select("integration_id, workspace_id, is_enabled")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!integration) return { ok: false, error: "integration_not_found" };
  if (!integration.is_enabled) {
    return { ok: false, error: "integration_disabled" };
  }

  // 2. Platform-level integrations (workspace_id NULL) still need a
  //    workspace_id on engine_state (column is NOT NULL). Callers must
  //    scope manually — refuse otherwise.
  if (!integration.workspace_id) {
    return { ok: false, error: "platform_level_retrigger_not_supported" };
  }

  // 3. Resolve the integration_sync process steps.
  const { data: steps, error: stepErr } = await client
    .from("engine_step")
    .select("*")
    .eq("process_id", "integration_sync")
    .order("step_order");

  if (stepErr) return { ok: false, error: stepErr.message };
  const firstStep = steps && steps.length > 0 ? steps[0] : undefined;
  if (!firstStep) return { ok: false, error: "integration_sync_process_not_seeded" };

  // 4. Spawn the engine_state. Context carries everything the handler
  //    needs so no second look-up is required in the Deno boundary.
  const context = {
    integration_id: integrationId,
    entity_type: entityType,
    entity_id_synced: entityId,
    operation,
    originating_channel: "manual_retrigger",
  };

  const { data: state, error: stateErr } = await client
    .from("engine_state")
    .insert({
      process_id: "integration_sync",
      workspace_id: integration.workspace_id,
      status: "active",
      current_step: 1,
      entity_type: "billing_integration",
      entity_id: integrationId,
      context,
      steps_snapshot: steps,
      result: {},
    })
    .select("id")
    .single();

  if (stateErr) return { ok: false, error: stateErr.message };
  if (!state) return { ok: false, error: "engine_state_insert_failed" };

  // 5. Materialise step 1 on engine_state_step so the dispatcher can
  //    pick it up (dispatcher reads engine_state_step first, falls back
  //    to steps_snapshot).
  await client.from("engine_state_step").insert({
    state_id: state.id,
    step_order: 1,
    status: "active",
    action_type: "sync_integration",
    action_payload: firstStep.action_payload ?? {},
  });

  return { ok: true, engine_state_id: state.id };
}
