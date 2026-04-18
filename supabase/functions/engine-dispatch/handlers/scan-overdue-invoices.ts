// ══════════════════════════════════════════════════════════════════
// Billing Fase 3A Spor C — scan_overdue_invoices action handler
// ══════════════════════════════════════════════════════════════════
//
// Daily scan of overdue invoices driven by the dunning_escalation_scan
// engine_process blueprint (B1 Migration G). Reads the stages config
// from action_payload and advances each invoice that has crossed the
// next boundary, creating idempotency rows in dunning_escalation_log
// and enqueuing dispatch rows for the customer email.
//
// Trigger flow (end-to-end):
//   pg_cron 'smartout-dunning-daily' (Migration I) inserts
//     engine_event 'dunning_daily_tick'
//   → engine_trigger 'dunning_daily_tick' → 'dunning_escalation_scan'
//   → engine_state spawned at step_order=1
//   → this handler
//
// Idempotency contract (ADR-0134):
//   - dunning_escalation_log UNIQUE(invoice_id, to_stage) — a second
//     run for the same (invoice, stage) raises 23505 and is swallowed.
//   - same-day re-runs of the cron collapse via
//     engine_event.idempotency_key 'dunning_daily_tick_YYYY-MM-DD'.
//
// Workspace opt-out (ADR-0127 + spec §4.4):
//   Workspace-admin creates a billing_dispatch_rule with
//   trigger_event='invoice dunning_escalated' + action='suppress'. We
//   evaluate suppression via effective_dispatch_rules(); when the rule
//   set is empty we still advance dunning_status + log the escalation
//   (internal audit) but skip the customer email dispatch.
//
// Separate file (not inlined in index.ts) because:
//   - index.ts is already 2.6K lines; a 200-line handler bloats the
//     switch and obscures the shared-invoice code path.
//   - Matches the sync-integration.ts precedent (Fase 2 B4).
//
// Ref: Fase 3A spec §4.2, ADR-0134, ADR-0078 (allowed_channels).
// ═══════════════════════════════════════════════════════════════

import type { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Shared engine shapes (mirror index.ts internals) ───────────
// Kept inline so this file has no cross-import to the orchestrator.

export interface ScanOverdueStep {
  step_order: number;
  action_type: string;
  action_payload: Record<string, unknown>;
  condition: unknown;
  assignee_rule: string | null;
}

export interface ScanOverdueState {
  id: string;
  workspace_id: string;
  process_id: string;
  current_step: number;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  context: Record<string, unknown>;
  steps_snapshot: ScanOverdueStep[] | null;
  result: Record<string, unknown> | null;
}

export type DunningStage = {
  // Days past invoice.due_at that trigger this stage.
  days: number;
  // NULL = matches invoices still at the initial dunning state.
  from: string | null;
  // Target dunning_status value. Matches dunning_status enum
  // (extended by Migration 20260512000009).
  to: string;
};

// ─── Emit bridge (Deno → Node) ──────────────────────────────────
// Identical shape to dispatch_invoice + sync_integration handlers.

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
      `[scan_overdue_invoices] emit bridge not configured — skipping '${event.event}'`,
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
        `[scan_overdue_invoices] emit bridge returned ${res.status} for '${event.event}': ${body}`,
      );
    }
  } catch (error) {
    console.error(
      `[scan_overdue_invoices] emit bridge failed for '${event.event}':`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

// ─── Public pure validator (exported for tests) ─────────────────
// Stage config validation — keeps the ordering contract explicit
// and bubbles bad payloads up with a clear error. The handler calls
// this before touching the DB.

export function validateStages(raw: unknown): {
  ok: true;
  stages: DunningStage[];
} | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "stages must be an array" };
  }
  if (raw.length === 0) {
    return { ok: false, error: "stages cannot be empty" };
  }
  const stages: DunningStage[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i] as Record<string, unknown>;
    if (!s || typeof s !== "object") {
      return { ok: false, error: `stages[${i}] is not an object` };
    }
    if (typeof s.days !== "number" || !Number.isFinite(s.days) || s.days < 0) {
      return { ok: false, error: `stages[${i}].days must be a non-negative number` };
    }
    if (typeof s.to !== "string" || s.to.length === 0) {
      return { ok: false, error: `stages[${i}].to must be a non-empty string` };
    }
    if (s.from !== null && typeof s.from !== "string") {
      return { ok: false, error: `stages[${i}].from must be null or a string` };
    }
    stages.push({
      days: s.days,
      from: (s.from as string | null) ?? null,
      to: s.to as string,
    });
  }
  return { ok: true, stages };
}

// ─── Handler state types ─────────────────────────────────────────

type OverdueInvoice = {
  invoice_id: string;
  company_id: string;
  invoice_number: number | null;
  due_at: string | null;
  dunning_status: string | null;
  amount_incl_vat: number | string;
  currency: string;
};

type EffectiveRule = {
  dispatch_rule_id: string;
  workspace_id: string | null;
  company_id: string | null;
  channel: string;
  trigger_event: string;
  target: Record<string, unknown>;
  template_id: string | null;
  action: "send" | "suppress";
  is_enabled: boolean;
  rule_source: "platform" | "workspace";
};

// ─── Escalate one invoice to one stage ──────────────────────────
// Returns:
//   'escalated'       — log row created + dunning_status advanced
//   'already_logged'  — idempotency hit (no-op, UNIQUE constraint)
//   'suppressed'      — internal advance but email dispatch suppressed
//                       by workspace opt-out rule
//   'error'           — unrecoverable per-invoice error; caller
//                       records the message but continues the scan.

type EscalateOutcome =
  | { kind: "escalated" }
  | { kind: "already_logged" }
  | { kind: "suppressed" }
  | { kind: "error"; message: string };

async function escalateInvoice(
  supabase: ReturnType<typeof createClient>,
  invoice: OverdueInvoice,
  stage: DunningStage,
  workspaceId: string,
): Promise<EscalateOutcome> {
  // 1. Idempotency: INSERT dunning_escalation_log first. UNIQUE
  //    constraint on (invoice_id, to_stage) makes a second attempt
  //    in the same day a no-op. We rely on the error code (23505)
  //    to distinguish "already escalated" from real errors.
  const { error: logErr } = await supabase
    .from("dunning_escalation_log")
    .insert({
      invoice_id: invoice.invoice_id,
      from_stage: stage.from,
      to_stage: stage.to,
    });

  if (logErr) {
    // Postgres unique_violation — this (invoice, stage) pair is already
    // logged. Safe no-op per ADR-0134 idempotency contract.
    if (logErr.code === "23505") {
      return { kind: "already_logged" };
    }
    return { kind: "error", message: `log insert failed: ${logErr.message}` };
  }

  // 2. Advance dunning_status. The enum was extended by
  //    Migration 20260512000009 to carry reminder_1 / reminder_2 /
  //    collection_notice. Check constraint invoice_status_dunning_legal
  //    accepts any dunning_status value for status IN (issued, sent,
  //    overdue) — the stage query below already narrows to those.
  const { error: updateErr } = await supabase
    .from("invoice")
    .update({ dunning_status: stage.to })
    .eq("invoice_id", invoice.invoice_id);

  if (updateErr) {
    return {
      kind: "error",
      message: `dunning_status update failed: ${updateErr.message}`,
    };
  }

  // 3. Enqueue customer email dispatch via the Fase 2 pipeline. Ignore
  //    the outcome of suppression — that's a workspace choice, not an
  //    error. The UPDATE to dunning_status still persists for audit
  //    truth per ADR-0134.
  const dispatched = await enqueueDunningDispatch(
    supabase,
    invoice,
    stage,
    workspaceId,
  );

  if (!dispatched) {
    return { kind: "suppressed" };
  }

  return { kind: "escalated" };
}

// ─── Enqueue the customer email dispatch ────────────────────────
// Returns true if an invoice_dispatch row was created + engine_state
// spawned; false if the workspace has a suppress rule or if no
// customer email is resolvable. False is NOT an error — the caller
// records it as 'suppressed' per spec §4.4.

async function enqueueDunningDispatch(
  supabase: ReturnType<typeof createClient>,
  invoice: OverdueInvoice,
  stage: DunningStage,
  workspaceId: string,
): Promise<boolean> {
  const triggerEvent = "invoice dunning_escalated";

  // 1. Check workspace opt-out via effective_dispatch_rules. When the
  //    workspace has a suppress rule for this trigger_event + the
  //    email_customer channel, effective_dispatch_rules returns 0
  //    rows (suppress wins per ADR-0127). When there is no workspace
  //    configuration at all, the RPC also returns 0 rows for this
  //    event because no platform rule is seeded for dunning — the
  //    template lookup below is the authoritative dispatch path.
  const { data: rules } = await supabase.rpc("effective_dispatch_rules", {
    p_invoice_id: invoice.invoice_id,
    p_trigger_event: triggerEvent,
  });

  const hasSuppress = ((rules ?? []) as EffectiveRule[]).some(
    (r) => r.action === "suppress" && r.channel === "email_customer",
  );
  if (hasSuppress) {
    return false;
  }

  // 2. Resolve the customer email. company.billing_email wins over
  //    company.email; both are nullable. Without an email there is
  //    nowhere to deliver, so we log + skip (idempotency preserved).
  const { data: company } = await supabase
    .from("company")
    .select("billing_email, email")
    .eq("company_id", invoice.company_id)
    .maybeSingle();

  const customerEmail =
    (company?.billing_email as string | null | undefined) ??
    (company?.email as string | null | undefined) ??
    null;

  if (!customerEmail) {
    console.warn(
      `[scan_overdue_invoices] invoice ${invoice.invoice_id}: no customer email on company ${invoice.company_id} — skipping dispatch (log row still created)`,
    );
    return false;
  }

  // 3. Resolve the template by name. Dunning templates are
  //    platform-seeded (workspace_id IS NULL) per Migration H. The
  //    naming contract is 'dunning_<to_stage>'.
  const templateName = `dunning_${stage.to}`;
  const { data: template } = await supabase
    .from("billing_dispatch_template")
    .select("template_id")
    .is("workspace_id", null)
    .eq("name", templateName)
    .maybeSingle();

  // Template is optional from the runtime standpoint — the
  // dispatch_invoice handler has hard-coded defaults. Still, log a
  // warning so ops can catch a missing seed.
  if (!template) {
    console.warn(
      `[scan_overdue_invoices] template '${templateName}' not found — dispatching with handler defaults`,
    );
  }

  // 4. Create the invoice_dispatch row. dispatch_rule_id is NULL
  //    because this is a platform-driven dunning dispatch, not a
  //    workspace rule. The dispatch_invoice handler in index.ts
  //    tolerates NULL dispatch_rule_id and falls back to the default
  //    template via the separate template lookup below — we attach
  //    the template_id directly in the target JSON so the handler
  //    can render it (forward-compat — currently the handler reads
  //    the template via dispatch_rule; template_id here is
  //    informational until the handler extracts it).
  const { data: dispatch, error: insertErr } = await supabase
    .from("invoice_dispatch")
    .insert({
      invoice_id: invoice.invoice_id,
      dispatch_rule_id: null,
      channel: "email_customer",
      target: {
        email: customerEmail,
        template_name: templateName,
        template_id: template?.template_id ?? null,
      },
      status: "pending",
    })
    .select("invoice_dispatch_id")
    .single();

  if (insertErr || !dispatch) {
    console.error(
      `[scan_overdue_invoices] invoice_dispatch insert failed for invoice ${invoice.invoice_id}:`,
      insertErr?.message ?? "unknown",
    );
    return false;
  }

  // 5. Spawn the engine_state so engine-dispatch's dispatch_invoice
  //    case will pick it up. Mirrors the shape of
  //    spawnChildStates() in packages/billing/src/actions/dispatch/
  //    enqueueDispatchesForInvoice.ts.
  const { data: processSteps } = await supabase
    .from("engine_step")
    .select("step_order, action_type, action_payload, condition, assignee_rule")
    .eq("process_id", "invoice_dispatch_delivery")
    .order("step_order");

  if (!processSteps || processSteps.length === 0) {
    // The Fase 2 invoice_dispatch_delivery blueprint should always be
    // seeded. If it isn't, the invoice_dispatch row still exists and
    // admin UI can retry manually.
    console.error(
      "[scan_overdue_invoices] invoice_dispatch_delivery engine_process has no steps — dispatch row created but not executed",
    );
    return true;
  }

  const firstStep = processSteps[0] as {
    step_order: number;
    action_type: string;
    action_payload: Record<string, unknown>;
    condition: unknown;
    assignee_rule: string | null;
  } | undefined;
  if (!firstStep) return true;

  const context = {
    invoice_dispatch_id: dispatch.invoice_dispatch_id,
    channel: "email_customer",
    originating_channel: "system",
    dunning_stage: stage.to,
  };

  const { data: spawned } = await supabase
    .from("engine_state")
    .insert({
      process_id: "invoice_dispatch_delivery",
      workspace_id: workspaceId,
      status: "active",
      current_step: 1,
      entity_type: "invoice_dispatch",
      entity_id: dispatch.invoice_dispatch_id,
      context,
      steps_snapshot: processSteps,
      result: {},
    })
    .select("id")
    .single();

  if (spawned) {
    await supabase.from("engine_state_step").insert({
      state_id: spawned.id,
      step_order: 1,
      status: "active",
      action_type: "dispatch_invoice",
      action_payload: firstStep.action_payload ?? {},
    });
  }

  return true;
}

// ─── Main handler ───────────────────────────────────────────────

export async function handleScanOverdueInvoices(
  supabase: ReturnType<typeof createClient>,
  state: ScanOverdueState,
  step: ScanOverdueStep,
): Promise<void> {
  const payload = (step.action_payload ?? {}) as Record<string, unknown>;
  const validated = validateStages(payload.stages);
  if (!validated.ok) {
    await supabase
      .from("engine_state")
      .update({
        status: "failed",
        last_error: `scan_overdue_invoices: ${validated.error}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  const { stages } = validated;
  const nowMs = Date.now();

  let totalEscalated = 0;
  let totalAlreadyLogged = 0;
  let totalSuppressed = 0;
  const errors: string[] = [];

  // Walk stages in the order given by the blueprint. Ordering is
  // causally important: reminder_1 must run before reminder_2 so the
  // same-day scan can cascade an invoice across multiple stages if
  // its dunning_status NULL, +3d → reminder_1 advances to reminder_1,
  // then stage 2 (+7d, from=reminder_1) still matches.
  for (const stage of stages) {
    const cutoffIso = new Date(nowMs - stage.days * 24 * 60 * 60 * 1000).toISOString();

    // Status filter narrows to active invoices only. draft / paid /
    // void / uncollectible are never candidates for dunning. Use lt()
    // on due_at (strictly less than cutoff = definitely overdue).
    let query = supabase
      .from("invoice")
      .select(
        "invoice_id, company_id, invoice_number, due_at, dunning_status, amount_incl_vat, currency",
      )
      .in("status", ["issued", "sent", "overdue"])
      .lt("due_at", cutoffIso);

    // stage.from === null → invoice has not been escalated yet.
    // Postgres IS NULL comparison requires .is() in PostgREST syntax.
    if (stage.from === null) {
      query = query.is("dunning_status", null);
    } else {
      query = query.eq("dunning_status", stage.from);
    }

    const { data: candidates, error: queryErr } = await query;

    if (queryErr) {
      errors.push(`stage ${stage.to}: query failed: ${queryErr.message}`);
      continue;
    }

    for (const invoice of (candidates ?? []) as OverdueInvoice[]) {
      const outcome = await escalateInvoice(supabase, invoice, stage, state.workspace_id);

      switch (outcome.kind) {
        case "escalated": {
          totalEscalated++;
          const daysOverdue = Math.floor(
            (nowMs - new Date(invoice.due_at ?? cutoffIso).getTime()) /
              (24 * 60 * 60 * 1000),
          );
          await emitViaBridge({
            event: "invoice dunning_escalated",
            actor_id: null,
            workspace_id: state.workspace_id,
            properties: {
              entity_type: "invoice",
              entity_id: invoice.invoice_id,
              data: {
                from_stage: stage.from,
                to_stage: stage.to,
                days_overdue: daysOverdue,
                company_id: invoice.company_id,
              },
            },
          });
          break;
        }
        case "suppressed": {
          totalSuppressed++;
          const daysOverdue = Math.floor(
            (nowMs - new Date(invoice.due_at ?? cutoffIso).getTime()) /
              (24 * 60 * 60 * 1000),
          );
          // Still emit — the internal audit trail records the
          // escalation even when the customer email was suppressed.
          await emitViaBridge({
            event: "invoice dunning_escalated",
            actor_id: null,
            workspace_id: state.workspace_id,
            properties: {
              entity_type: "invoice",
              entity_id: invoice.invoice_id,
              data: {
                from_stage: stage.from,
                to_stage: stage.to,
                days_overdue: daysOverdue,
                company_id: invoice.company_id,
                // Informational — the downstream billing_activity_log
                // can surface that the customer email was suppressed.
                suppressed: true,
              },
            },
          });
          break;
        }
        case "already_logged":
          totalAlreadyLogged++;
          break;
        case "error":
          errors.push(`invoice ${invoice.invoice_id}: ${outcome.message}`);
          break;
      }
    }
  }

  // Partial-failure policy: a handful of per-invoice errors should not
  // fail the whole scan — we record them in the result payload and
  // succeed. This matches the daily-job pattern where tomorrow's tick
  // is the real guard. Only a query-level failure (whole-stage error)
  // is considered final; per-invoice errors bubble up but do not block.
  //
  // Threshold: if errors outnumber successes (escalated + suppressed +
  // already_logged), something systemic is wrong — fail the state so
  // ops is alerted. Otherwise succeed.
  const successes = totalEscalated + totalAlreadyLogged + totalSuppressed;
  const shouldFail = errors.length > 0 && errors.length >= successes + 1;

  const now = new Date().toISOString();
  const result = {
    total_escalated: totalEscalated,
    total_already_logged: totalAlreadyLogged,
    total_suppressed: totalSuppressed,
    error_count: errors.length,
    // Cap the errors list so a pathological loop doesn't blow up the
    // engine_state.result row.
    errors: errors.slice(0, 10),
  };

  await supabase
    .from("engine_state")
    .update({
      status: shouldFail ? "failed" : "complete",
      last_error: shouldFail
        ? `scan_overdue_invoices: ${errors.length} errors vs ${successes} successes`
        : null,
      result,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", state.id);
}
