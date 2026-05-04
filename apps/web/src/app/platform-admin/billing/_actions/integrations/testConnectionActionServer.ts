"use server";

import { createAdminClient } from "@smartout/supabase/admin";
import {
  TestConnectionInputSchema,
  testConnectionAction,
  type TestConnectionActionFailure,
  type TestConnectionActionResult,
} from "@smartout/billing";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// testConnectionActionServer — platform-admin button handler for
// "Test connection". Loads the integration, runs the adapter's
// testConnection(), emits telemetry based on the 4-outcome taxonomy.
//
// Does NOT revalidatePath: the outcome is a UI-only event consumed
// by the TestConnectionButton micro-interaction. No persisted state
// changes (is_placeholder stays on the row, not on the probe result).

export async function testConnectionActionServer(
  rawInput: unknown,
): Promise<TestConnectionActionResult | TestConnectionActionFailure> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = TestConnectionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }

  const supabase = createAdminClient();
  const result = await testConnectionAction(supabase, parsed.data.integration_id);
  if (!result.ok) return result;

  const { integration, result: probe } = result;
  if (probe.status === "ok") {
    await emit({
      event: "integration test_connection succeeded",
      actor_id: nonEmpty(adminId, "actor_id"),
      workspace_id: integration.workspace_id
        ? nonEmpty(integration.workspace_id, "workspace_id")
        : null,
      properties: {
        entity_type: "billing_integration",
        entity_id: integration.integration_id,
        data: {
          integration_type: integration.integration_type,
          is_placeholder: probe.is_placeholder === true,
        },
      },
    });
  } else {
    // Collapse error / ambiguous / timeout into the single failed emit.
    // The 4-outcome shape is preserved in the UI via `result.result`;
    // telemetry only needs a coarse-grained success/fail split.
    const errorCode =
      probe.status === "timeout" ? "timeout" : probe.status === "ambiguous" ? "ambiguous" : "error";
    const errorMessage =
      probe.status === "timeout" ? "Timeout — adapter did not respond." : probe.message;
    await emit({
      event: "integration test_connection failed",
      actor_id: nonEmpty(adminId, "actor_id"),
      workspace_id: integration.workspace_id
        ? nonEmpty(integration.workspace_id, "workspace_id")
        : null,
      properties: {
        entity_type: "billing_integration",
        entity_id: integration.integration_id,
        data: {
          integration_type: integration.integration_type,
          error_code: errorCode,
          error_message: errorMessage,
        },
      },
    });
  }

  return result;
}
