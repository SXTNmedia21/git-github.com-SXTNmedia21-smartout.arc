// ══════════════════════════════════════════════════════════════════
// Billing Fase 2 Spor B — sync_integration action handler
// ══════════════════════════════════════════════════════════════════
//
// Runs outbound sync to a billing_integration row (customer, invoice,
// contract, product, plan). Spawned by the integration_sync engine
// process on lifecycle events: 'customer created', 'invoice generated',
// 'invoice issued', 'contract signed', 'contract terminated'.
//
// This file is intentionally NOT wired into index.ts's switch yet —
// ship it as a reviewable unit, then a follow-up commit appends
// `case "sync_integration": ...` to the switch. Keeping the wiring
// separate lets B2 dispatch_invoice land cleanly and avoids a merge
// collision in the same 2.6K-line file.
//
// Deno cannot import @smartout/billing — the adapter shape below is a
// minimal inline mirror of the Node-side adapter interface. Drift
// surfaces as a type error on the Server Action side (which reads the
// canonical types).
//
// ADR-0126: engine-orchestrated sync state lives on engine_state +
//           engine_state_step, not a parallel billing_integration_sync
//           table.
// ADR-0129: is_placeholder gates audit semantics. A real adapter
//           returning 'succeeded' on a placeholder row (or Placeholder
//           reporting anything other than 'mocked') emits the audit
//           violation event and FAILS the engine step.
// ═══════════════════════════════════════════════════════════════

import type { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Shared engine shapes (mirror index.ts internals) ───────────
// Kept inline so this file has no cross-import to the orchestrator.
// When the switch wiring lands, the types here satisfy the caller.
export interface SyncIntegrationStep {
  step_order: number;
  action_type: string;
  action_payload: Record<string, unknown>;
  condition: unknown;
  assignee_rule: string | null;
}

export interface SyncIntegrationState {
  id: string;
  workspace_id: string;
  process_id: string;
  current_step: number;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  context: Record<string, unknown>;
  steps_snapshot: SyncIntegrationStep[] | null;
  result: Record<string, unknown> | null;
}

type IntegrationEntity = "customer" | "invoice" | "contract" | "product" | "plan";
type IntegrationOperation = "create" | "update" | "delete";

// ─── Inline adapter shape (mirror of packages/billing) ──────────
// sync() is only ever called for the 'placeholder' type in Fase 2.
// Fase 3 adds real HTTP callers (Fiken / Tripletex / Stripe) behind
// the same discriminant.

type InlineSyncResult =
  | { status: "succeeded"; external_reference: string }
  | { status: "mocked"; external_reference: null }
  | {
      status: "failed";
      error_code: string;
      error_message: string;
      retryable: boolean;
    };

interface InlineIntegrationRow {
  integration_id: string;
  workspace_id: string | null;
  integration_type: string;
  display_name: string;
  config: Record<string, unknown>;
  is_enabled: boolean;
  is_placeholder: boolean;
}

// Fase 2 has one concrete adapter: PlaceholderAdapter, inlined. When
// Fase 3 ships real adapters they replace this switch entry.
async function runInlineAdapter(
  integration: InlineIntegrationRow,
  _entity_type: IntegrationEntity,
  _operation: IntegrationOperation,
  _payload: Record<string, unknown>,
): Promise<InlineSyncResult> {
  switch (integration.integration_type) {
    case "placeholder":
    case "fiken":
    case "tripletex":
    case "stripe":
      // ADR-0129: all Fase 2 adapters route through PlaceholderAdapter.
      // 'mocked' — never 'succeeded' — preserves audit truth.
      return { status: "mocked", external_reference: null };
    default:
      return {
        status: "failed",
        error_code: "unknown_integration_type",
        error_message: `No adapter registered for integration_type '${integration.integration_type}'.`,
        retryable: false,
      };
  }
}

// ─── Emit bridge (Deno → Node) ──────────────────────────────────
// Identical shape to dispatch_invoice handler's emitViaBridge.
// Kept local so this handler stays self-contained.

async function emitViaBridge(event: {
  event: string;
  actor_id: string | null;
  workspace_id: string | null;
  properties: Record<string, unknown>;
}): Promise<void> {
  const url = Deno.env.get("INTERNAL_EMIT_URL");
  const secret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!url || !secret) {
    console.error(
      `[sync_integration] emit bridge not configured — skipping '${event.event}'`,
    );
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[sync_integration] emit bridge returned ${res.status} for '${event.event}': ${body}`,
      );
    }
  } catch (error) {
    console.error(
      `[sync_integration] emit bridge failed for '${event.event}':`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ─── Main handler ──────────────────────────────────────────────
// Called from the switch case "sync_integration" in index.ts once
// wired. Pattern matches handleDispatchInvoice() for readability.

export async function handleSyncIntegration(
  supabase: ReturnType<typeof createClient>,
  state: SyncIntegrationState,
  step: SyncIntegrationStep,
): Promise<void> {
  const ctx = (state.context ?? {}) as Record<string, unknown>;
  const payload = (step.action_payload ?? {}) as Record<string, unknown>;

  // Context resolution priority: context > action_payload. Fan-out logic
  // (B2 carry-over in a follow-up commit) will put per-integration data
  // on the spawned child state's context.
  const integrationId =
    (ctx.integration_id as string | undefined) ??
    (payload.integration_id as string | undefined);
  const entityType =
    (ctx.entity_type as IntegrationEntity | undefined) ??
    (payload.entity_type as IntegrationEntity | undefined);
  const entityIdSynced =
    (ctx.entity_id_synced as string | undefined) ??
    (payload.entity_id_synced as string | undefined);
  const operation =
    ((ctx.operation as IntegrationOperation | undefined) ??
      (payload.operation as IntegrationOperation | undefined)) ??
    "create";

  if (!integrationId || !entityType || !entityIdSynced) {
    await supabase
      .from("engine_state")
      .update({
        status: "failed",
        last_error:
          "sync_integration: missing integration_id / entity_type / entity_id_synced in context. Fan-out must pre-populate before spawning the child state.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  // 1. Load the billing_integration row.
  const { data: integrationRow, error: integrationErr } = await supabase
    .from("billing_integration")
    .select(
      "integration_id, workspace_id, integration_type, display_name, config, is_enabled, is_placeholder",
    )
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (integrationErr || !integrationRow) {
    await supabase
      .from("engine_state")
      .update({
        status: "failed",
        last_error: `sync_integration: billing_integration ${integrationId} not found: ${
          integrationErr?.message ?? "missing"
        }`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  const integration = integrationRow as unknown as InlineIntegrationRow;

  // 2. Skip disabled rows gracefully (fan-out may have caught this
  //    already, but the child state is a second line of defence).
  if (!integration.is_enabled) {
    await supabase
      .from("engine_state")
      .update({
        status: "complete",
        result: {
          ...((state.result ?? {}) as Record<string, unknown>),
          skipped: "integration_disabled",
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  // 3. Load the entity payload. We keep the loader narrow: the Fase 2
  //    sync is metadata-only (no remote write happens for Placeholder).
  //    Fase 3 real adapters will pull richer shapes as needed.
  let entityPayload: Record<string, unknown> = {};
  switch (entityType) {
    case "invoice": {
      const { data } = await supabase
        .from("invoice")
        .select(
          "invoice_id, invoice_number, company_id, status, invoice_type, period_from, period_to, amount_incl_vat, currency",
        )
        .eq("invoice_id", entityIdSynced)
        .maybeSingle();
      if (data) entityPayload = data as Record<string, unknown>;
      break;
    }
    case "customer": {
      const { data } = await supabase
        .from("company")
        .select("company_id, name, org_number, default_currency")
        .eq("company_id", entityIdSynced)
        .maybeSingle();
      if (data) entityPayload = data as Record<string, unknown>;
      break;
    }
    case "contract":
    case "product":
    case "plan":
      // Fase 2 has no contract/product/plan sync payload shaping — the
      // PlaceholderAdapter does not read it. Fase 3 wires in the real
      // loaders alongside the real adapters.
      entityPayload = { entity_id: entityIdSynced };
      break;
  }

  // 4. Run the adapter.
  const result = await runInlineAdapter(integration, entityType, operation, entityPayload);

  // 5. ADR-0129 audit-safety assertions.
  //    Two failure modes, both corrupt the audit trail:
  //      a) Placeholder row but adapter reported 'succeeded' (should be 'mocked')
  //      b) Non-placeholder row but adapter reported 'mocked' (real adapter misconfigured)
  if (integration.is_placeholder && result.status === "succeeded") {
    await emitViaBridge({
      event: "integration audit violation",
      actor_id: null,
      workspace_id: state.workspace_id,
      properties: {
        entity_type: "billing_integration",
        entity_id: integration.integration_id,
        data: {
          integration_type: integration.integration_type,
          is_placeholder: true,
          reported_status: "succeeded",
          violation_kind: "placeholder_reported_succeeded",
          entity_type_synced: entityType,
          entity_id_synced: entityIdSynced,
        },
      },
    });
    await supabase
      .from("engine_state")
      .update({
        status: "failed",
        last_error:
          "sync_integration: ADR-0129 audit violation — placeholder row returned 'succeeded' from adapter. See 'integration audit violation' event.",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }
  if (!integration.is_placeholder && result.status === "mocked") {
    await emitViaBridge({
      event: "integration audit violation",
      actor_id: null,
      workspace_id: state.workspace_id,
      properties: {
        entity_type: "billing_integration",
        entity_id: integration.integration_id,
        data: {
          integration_type: integration.integration_type,
          is_placeholder: false,
          reported_status: "mocked",
          violation_kind: "real_adapter_on_placeholder_row",
          entity_type_synced: entityType,
          entity_id_synced: entityIdSynced,
        },
      },
    });
    await supabase
      .from("engine_state")
      .update({
        status: "failed",
        last_error:
          "sync_integration: ADR-0129 audit violation — real adapter row returned 'mocked'. See 'integration audit violation' event.",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  // 6. Persist sync outcome on billing_integration.
  //    last_sync_status maps:
  //      succeeded | mocked → 'ok'
  //      failed             → 'error'
  const now = new Date().toISOString();
  const lastSyncStatus: "ok" | "error" =
    result.status === "failed" ? "error" : "ok";
  await supabase
    .from("billing_integration")
    .update({
      last_sync_at: now,
      last_sync_status: lastSyncStatus,
    })
    .eq("integration_id", integration.integration_id);

  // 7. Emit the matching telemetry event + complete/fail the state.
  const commonEntity = {
    entity_type: "billing_integration" as const,
    entity_id: integration.integration_id,
  };
  const syncedShape = {
    integration_type: integration.integration_type,
    entity_type_synced: entityType,
    entity_id_synced: entityIdSynced,
    operation,
  };

  if (result.status === "succeeded") {
    await emitViaBridge({
      event: "integration sync succeeded",
      actor_id: null,
      workspace_id: state.workspace_id,
      properties: {
        ...commonEntity,
        data: {
          ...syncedShape,
          external_reference: result.external_reference,
        },
      },
    });

    await supabase
      .from("engine_state")
      .update({
        status: "complete",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", state.id);
    return;
  }

  if (result.status === "mocked") {
    // Placeholder path. Emit 'mocked' (logger-only per registry) and
    // prefix the activity log via the emit bridge — the registry routes
    // 'integration sync mocked' destinations so downstream dedup is
    // straightforward. The `[PLACEHOLDER]` prefix is explicit for human
    // readers of billing_activity_log when the Node emit picks this up.
    await emitViaBridge({
      event: "integration sync mocked",
      actor_id: null,
      workspace_id: state.workspace_id,
      properties: {
        ...commonEntity,
        data: {
          ...syncedShape,
          integration_type: "placeholder",
          audit_note: "[PLACEHOLDER] No external call was made (ADR-0129).",
        },
      },
    });

    await supabase
      .from("engine_state")
      .update({
        status: "complete",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", state.id);
    return;
  }

  // Failure path. Retry policy mirrors dispatch_invoice: exponential
  // backoff via engine_delayed_trigger. Fase 2 uses the 'integration
  // sync retry_requested' trigger (seed follow-up) — until that is
  // defined, fail the engine state terminally and let the admin UI
  // surface the last_error.
  const retryConfig = ((step.action_payload as Record<string, unknown>).retry ??
    {}) as {
    max_attempts?: number;
    backoff_seconds?: number[];
  };
  const maxAttempts = retryConfig.max_attempts ?? 5;
  // attempts tracked on engine_state.retry_count is managed by the main
  // orchestrator; we just decide final vs retryable here.
  const attempt = 1;
  const isFinal = !result.retryable || attempt >= maxAttempts;

  await emitViaBridge({
    event: "integration sync failed",
    actor_id: null,
    workspace_id: state.workspace_id,
    properties: {
      ...commonEntity,
      data: {
        ...syncedShape,
        error_code: result.error_code,
        error_message: result.error_message,
      },
    },
  });

  await supabase
    .from("engine_state")
    .update({
      status: isFinal ? "failed" : "active",
      last_error: `${result.error_code}: ${result.error_message}`,
      updated_at: now,
      ...(isFinal ? { completed_at: now } : {}),
    })
    .eq("id", state.id);
}
