// Fan-out: given an invoice_id, read effective_dispatch_rules, create
// one invoice_dispatch row per active rule, and start an engine_state
// per row that the engine-dispatch handler will execute.
//
// Why Node-side instead of inside the Edge Function:
//   - workspace_id resolution (invoice.company_id → workspace.company_id)
//     is easier to test in the Node runtime
//   - engine_state.workspace_id is NOT NULL — invoices emit with
//     workspace_id: null from the Fase 1 cron, so the engine_trigger
//     path would fail insert. Resolving workspace here avoids that gap.
//   - Server Actions need the same path for "Send på nytt" anyway
//
// Idempotency: the function skips rules whose (invoice_id, channel,
// target) combination already has a non-failed invoice_dispatch row.
// Calling enqueue twice for the same invoice does not create duplicate
// dispatches. Retries happen via retryDispatch, not enqueue.
//
// V1 collection boundary (ADR-0385): this is built-but-intentionally-unwired
// from the monthly generation cron. The cron stops at status='issued' and
// does NOT auto-call this. Current callers are manual/operator paths only.
// Do NOT delete as "unused" — auto-charge wiring is a future ADR.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { BillingDispatchChannel, InvoiceDispatchInsert } from "../../types";

type BillingClient = SupabaseClient<Database>;

export type EnqueueDispatchesResult =
  | {
      ok: true;
      invoice_id: string;
      workspace_id: string | null;
      dispatches_created: number;
      dispatches_skipped: number;
    }
  | { ok: false; error: string };

type EffectiveRule = {
  dispatch_rule_id: string;
  workspace_id: string | null;
  company_id: string | null;
  channel: BillingDispatchChannel;
  trigger_event: string;
  target: Record<string, unknown>;
  template_id: string | null;
  action: "send" | "suppress";
  is_enabled: boolean;
  rule_source: "platform" | "workspace";
};

export async function enqueueDispatchesForInvoice(
  client: BillingClient,
  invoiceId: string,
  triggerEvent: string = "invoice issued",
): Promise<EnqueueDispatchesResult> {
  // 1. Load the invoice to resolve company + workspace.
  const { data: invoice, error: invoiceErr } = await client
    .from("invoice")
    .select("invoice_id, company_id, status")
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  if (invoiceErr) return { ok: false, error: invoiceErr.message };
  if (!invoice) return { ok: false, error: "invoice_not_found" };

  // 2. Resolve workspace. effective_dispatch_rules does this too but we
  //    also need workspace_id for engine_state.workspace_id (NOT NULL).
  const { data: ws } = await client
    .from("workspace")
    .select("workspace_id")
    .eq("company_id", invoice.company_id)
    .limit(1)
    .maybeSingle();

  const workspaceId = ws?.workspace_id ?? null;

  // 3. Read the effective rule set for this invoice + event.
  const { data: rules, error: rulesErr } = await client.rpc("effective_dispatch_rules", {
    p_invoice_id: invoiceId,
    p_trigger_event: triggerEvent,
  });

  if (rulesErr) return { ok: false, error: rulesErr.message };
  const activeRules = ((rules ?? []) as EffectiveRule[]).filter(
    (r) => r.action === "send" && r.is_enabled,
  );

  if (activeRules.length === 0) {
    return {
      ok: true,
      invoice_id: invoiceId,
      workspace_id: workspaceId,
      dispatches_created: 0,
      dispatches_skipped: 0,
    };
  }

  // 4. Load existing invoice_dispatch rows to avoid duplicate enqueue.
  const { data: existing } = await client
    .from("invoice_dispatch")
    .select("channel, target, status")
    .eq("invoice_id", invoiceId);

  const existingKeys = new Set<string>();
  for (const row of existing ?? []) {
    if (row.status === "failed") continue;
    existingKeys.add(`${row.channel}::${stableStringify(row.target)}`);
  }

  // 5. Insert invoice_dispatch rows for new rules.
  const toInsert: InvoiceDispatchInsert[] = [];
  let skipped = 0;

  for (const rule of activeRules) {
    const key = `${rule.channel}::${stableStringify(rule.target)}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    toInsert.push({
      invoice_id: invoiceId,
      dispatch_rule_id: rule.dispatch_rule_id,
      channel: rule.channel,
      target: rule.target as unknown as InvoiceDispatchInsert["target"],
      status: "pending",
    });
  }

  if (toInsert.length === 0) {
    return {
      ok: true,
      invoice_id: invoiceId,
      workspace_id: workspaceId,
      dispatches_created: 0,
      dispatches_skipped: skipped,
    };
  }

  const { data: inserted, error: insertErr } = await client
    .from("invoice_dispatch")
    .insert(toInsert)
    .select("invoice_dispatch_id, channel");

  if (insertErr) return { ok: false, error: insertErr.message };

  // 6. For each new dispatch, start an engine_state that the
  //    engine-dispatch handler will execute. If workspace_id is missing
  //    we still create the invoice_dispatch rows (visible in admin UI)
  //    but skip the engine hand-off — retryDispatch can re-fire later.
  if (workspaceId && inserted) {
    await spawnChildStates(client, workspaceId, inserted);
  }

  return {
    ok: true,
    invoice_id: invoiceId,
    workspace_id: workspaceId,
    dispatches_created: inserted?.length ?? 0,
    dispatches_skipped: skipped,
  };
}

/**
 * Create one engine_state per dispatch row with invoice_dispatch_id in
 * context. The engine-dispatch dispatch_invoice action-handler picks
 * these up via the engine-dispatch HTTP endpoint (not invoked here —
 * fire-delayed-triggers polls periodically, or the caller can invoke
 * explicitly via a separate Server Action).
 */
async function spawnChildStates(
  client: BillingClient,
  workspaceId: string,
  dispatches: Array<{ invoice_dispatch_id: string; channel: string }>,
): Promise<void> {
  // Load the engine_process + step so we can snapshot the step config.
  const { data: steps } = await client
    .from("engine_step")
    .select("*")
    .eq("process_id", "invoice_dispatch_delivery")
    .order("step_order");

  if (!steps || steps.length === 0) return;
  const firstStep = steps[0];
  if (!firstStep) return;

  for (const dispatch of dispatches) {
    const context = {
      invoice_dispatch_id: dispatch.invoice_dispatch_id,
      channel: dispatch.channel,
      originating_channel: "system",
    };

    const { data: state } = await client
      .from("engine_state")
      .insert({
        process_id: "invoice_dispatch_delivery",
        workspace_id: workspaceId,
        status: "active",
        current_step: 1,
        entity_type: "invoice_dispatch",
        entity_id: dispatch.invoice_dispatch_id,
        context,
        steps_snapshot: steps,
        result: {},
      })
      .select("id")
      .single();

    if (state) {
      await client.from("engine_state_step").insert({
        state_id: state.id,
        step_order: 1,
        status: "active",
        action_type: "dispatch_invoice",
        action_payload: firstStep.action_payload ?? {},
      });
    }
  }
}

/**
 * Deterministic JSON stringify for target dedup. Keeps key order
 * stable so "{a:1,b:2}" and "{b:2,a:1}" collapse to the same hash.
 * Lightweight alternative to canonical_json (which runs in the DB).
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}
