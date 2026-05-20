// Core generation logic for the monthly billing cron.
//
// Extracted from index.ts so the entry point stays thin and this file
// can be unit-tested in isolation when a test harness lands.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export type GenerationResult = {
  period_from: string;
  period_to: string;
  companies_processed: number;
  invoices_created: number;
  invoices_skipped: number;
  overdue_flipped: number;
  errors: Array<{ company_id: string; stage: string; error: string }>;
};

type CompanyRow = {
  company_id: string;
  workspace: Array<{ workspace_id: string; contract_status: string | null }> | null;
};

export async function generateMonthlyInvoicesForAllCompanies(
  supabase: SupabaseLike,
  periodStart: Date,
  periodEnd: Date,
): Promise<GenerationResult> {
  const periodFrom = toIsoDate(periodStart);
  const periodTo = toIsoDate(periodEnd);

  const result: GenerationResult = {
    period_from: periodFrom,
    period_to: periodTo,
    companies_processed: 0,
    invoices_created: 0,
    invoices_skipped: 0,
    overdue_flipped: 0,
    errors: [],
  };

  const { data: companies, error } = await supabase
    .from("company")
    .select("company_id, workspace(workspace_id, contract_status)")
    .eq("is_active", true);

  if (error) {
    console.error(
      "[generator] failed to list active companies:",
      error.message,
    );
    result.errors.push({
      company_id: "<list>",
      stage: "list_companies",
      error: error.message,
    });
    return result;
  }

  for (const company of (companies ?? []) as CompanyRow[]) {
    try {
      const created = await generateForCompany(
        supabase,
        company,
        periodFrom,
        periodTo,
      );
      if (created) {
        result.invoices_created++;
      } else {
        result.invoices_skipped++;
      }
      result.companies_processed++;
    } catch (err) {
      result.errors.push({
        company_id: company.company_id,
        stage: "generate_for_company",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    result.overdue_flipped = await markOverdueInvoices(supabase);
  } catch (err) {
    result.errors.push({
      company_id: "<overdue_scan>",
      stage: "mark_overdue",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

async function generateForCompany(
  supabase: SupabaseLike,
  company: CompanyRow,
  periodFrom: string,
  periodTo: string,
): Promise<boolean> {
  // Idempotency fast-path. UNIQUE INDEX idx_invoice_one_recurring_per_period
  // enforces this at the DB level too; early-exit avoids wasted work + the
  // emit side-effects a double-insert would attempt.
  const { data: existing } = await supabase
    .from("invoice")
    .select("invoice_id")
    .eq("company_id", company.company_id)
    .eq("period_from", periodFrom)
    .eq("period_to", periodTo)
    .eq("invoice_type", "recurring")
    .neq("status", "void")
    .maybeSingle();

  if (existing) {
    console.log(
      `[generator] skip company ${company.company_id}: invoice already exists for ${periodFrom}..${periodTo}`,
    );
    return false;
  }

  // Currently-effective pricing_terms for this period. ADR-0121 extended
  // the table with free_users, overage_price_per_user, delivery_channel.
  const { data: pt } = await supabase
    .from("pricing_terms")
    .select("*")
    .eq("company_id", company.company_id)
    .lte("effective_from", periodTo)
    .or(`effective_until.is.null,effective_until.gte.${periodFrom}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pt) {
    console.log(
      `[generator] skip company ${company.company_id}: no effective pricing_terms for ${periodFrom}..${periodTo}`,
    );
    return false;
  }

  const workspaces = (company.workspace ?? []).map((w) => w.workspace_id);
  if (workspaces.length === 0) {
    console.log(
      `[generator] skip company ${company.company_id}: no workspaces`,
    );
    return false;
  }

  // Billing-gate: only invoice companies with a SIGNED contract. Signing a
  // SaaS contract sets workspace.contract_status='active' (docuseal webhook).
  // company.is_active defaults true, so it gates nothing on its own — the
  // contract_status gate is the real one. Start date is enforced separately
  // by the pricing_terms.effective_from <= periodTo filter above.
  const hasSignedContract = (company.workspace ?? []).some(
    (w) => w.contract_status === "active",
  );
  if (!hasSignedContract) {
    console.log(
      `[generator] skip company ${company.company_id}: no signed contract (no workspace with contract_status='active')`,
    );
    return false;
  }

  // Phase 1.5 ADR-0119 predicate per workspace.
  const snapshots: Array<{
    workspace_id: string;
    billable_users: number;
    usage_snapshot_id: string;
  }> = [];

  for (const workspaceId of workspaces) {
    const { data: shifts, error: shiftErr } = await supabase
      .from("schedule_shift")
      .select("employee_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "completed")
      .not("employee_id", "is", null)
      .gte("shift_date", periodFrom)
      .lte("shift_date", periodTo);

    if (shiftErr) throw new Error(`shift lookup: ${shiftErr.message}`);

    const profileIds = Array.from(
      new Set((shifts ?? []).map((s: { employee_id: string }) => s.employee_id)),
    );
    const active_users = profileIds.length;
    const free_users_applied: number = Number(pt.free_users ?? 0);
    const billable_users = Math.max(0, active_users - free_users_applied);

    const source_query_hash = await sha256(
      JSON.stringify({
        workspace_id: workspaceId,
        period_from: periodFrom,
        period_to: periodTo,
        status: "completed",
        predicate: "ADR-0119",
      }),
    );

    const { data: snap, error: upsertErr } = await supabase
      .from("usage_snapshot")
      .upsert(
        {
          company_id: company.company_id,
          workspace_id: workspaceId,
          period_from: periodFrom,
          period_to: periodTo,
          active_users,
          free_users_applied,
          billable_users,
          counted_profile_ids: profileIds,
          source_query_hash,
          computed_by: "cron",
        },
        { onConflict: "company_id,workspace_id,period_from,period_to" },
      )
      .select("usage_snapshot_id")
      .single();

    if (upsertErr || !snap) {
      throw new Error(
        `usage_snapshot upsert: ${upsertErr?.message ?? "no row returned"}`,
      );
    }

    snapshots.push({
      workspace_id: workspaceId,
      billable_users,
      usage_snapshot_id: snap.usage_snapshot_id,
    });
  }

  // Invoice amounts. Base plan = monthly_cost (flat), overage = sum of
  // per-workspace billable_users × overage_price_per_user. VAT 25% (NO).
  //
  // Rounding contract: accumulate the exact products, round ONCE at the
  // end. Rounding on every reduce iteration bleeds ±0.01 per workspace
  // into the header and diverges from the per-line-item totals (which
  // round each line independently). Header must agree with Σ(lines).
  const base_plan_amount = toMoney(pt.monthly_cost ?? 0);
  const overage_unit_price = toMoney(pt.overage_price_per_user ?? 0);
  const overage_amount = toMoney(
    snapshots.reduce(
      (sum, s) => sum + s.billable_users * overage_unit_price,
      0,
    ),
  );
  const amount_excl_vat = toMoney(base_plan_amount + overage_amount);
  const vat_rate = 25.0;
  const vat_amount = toMoney(amount_excl_vat * 0.25);
  const amount_incl_vat = toMoney(amount_excl_vat + vat_amount);

  const due_at = toIsoDate(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  ); // net 14

  // Build line items array to pass to the atomic RPC. The invoice_id is
  // assigned inside the function, so we omit it here — the RPC joins it
  // to every row in its loop.
  const lineItems = [
    {
      line_type: "base_plan",
      description: `Månedlig abonnement ${periodFrom} – ${periodTo}`,
      quantity: 1,
      unit_price: base_plan_amount,
      amount_excl_vat: base_plan_amount,
      vat_rate,
      vat_amount: toMoney(base_plan_amount * 0.25),
      amount_incl_vat: toMoney(base_plan_amount * 1.25),
      usage_snapshot_id: null,
    },
    ...snapshots
      .filter((s) => s.billable_users > 0)
      .map((s) => {
        const line_excl = toMoney(s.billable_users * overage_unit_price);
        return {
          line_type: "user_overage",
          description: `Ekstra brukere over ${pt.free_users ?? 0}: ${s.billable_users}`,
          quantity: s.billable_users,
          unit_price: overage_unit_price,
          amount_excl_vat: line_excl,
          vat_rate,
          vat_amount: toMoney(line_excl * 0.25),
          amount_incl_vat: toMoney(line_excl * 1.25),
          usage_snapshot_id: s.usage_snapshot_id,
        };
      }),
  ];

  // C1 — atomic RPC: INSERT draft + INSERT line_items + UPDATE→issued in
  // one server-side transaction. Eliminates the partial-write window that
  // previously left header-only draft invoices (feat/billing-cron-correctness).
  // ADR-0121 Phase 1.5: pricing_terms_id snapshot passed through to RPC so
  // get_invoice_basis() audits are protected against retroactive edits.
  const { data: rpcResult, error: rpcErr } = await supabase
    .rpc("fn_generate_company_invoice", {
      p_company_id: company.company_id,
      p_period_from: periodFrom,
      p_period_to: periodTo,
      p_pricing_terms_id: pt.pricing_terms_id,
      p_amount_excl_vat: amount_excl_vat,
      p_vat_rate: vat_rate,
      p_vat_amount: vat_amount,
      p_amount_incl_vat: amount_incl_vat,
      p_currency: "NOK",
      p_due_at: due_at,
      p_line_items: lineItems,
    });

  if (rpcErr || !rpcResult || rpcResult.length === 0) {
    throw new Error(
      `fn_generate_company_invoice rpc: ${rpcErr?.message ?? "no row returned"}`,
    );
  }

  const invoiceId: string = rpcResult[0].invoice_id;
  const invoiceNumber: number = rpcResult[0].invoice_number ?? 0;

  // Emit usage snapshots + invoice_generated BEFORE invoice_issued, so
  // the timeline reads chronologically. All emits run after the RPC
  // returns — telemetry failure never aborts generation (emitViaEndpoint
  // catches and logs internally).
  for (const s of snapshots) {
    await emitViaEndpoint({
      event: "usage_snapshot created",
      actor_id: null,
      workspace_id: s.workspace_id,
      properties: {
        entity_type: "usage_snapshot",
        entity_id: s.usage_snapshot_id,
        data: {
          workspace_id: s.workspace_id,
          company_id: company.company_id,
          billable_users: s.billable_users,
          source: "cron",
        },
      },
    });
  }

  await emitViaEndpoint({
    event: "invoice generated",
    actor_id: null,
    workspace_id: null,
    properties: {
      entity_type: "invoice",
      entity_id: invoiceId,
      data: {
        company_id: company.company_id,
        amount_incl_vat,
        period_from: periodFrom,
        period_to: periodTo,
        source: "cron",
      },
    },
  });

  await emitViaEndpoint({
    event: "invoice issued",
    actor_id: null,
    workspace_id: null,
    properties: {
      entity_type: "invoice",
      entity_id: invoiceId,
      data: {
        company_id: company.company_id,
        invoice_number: invoiceNumber,
        amount_incl_vat,
        source: "cron",
      },
    },
  });

  // Collection boundary (ADR-0385): generation stops at status='issued'. The
  // cron deliberately does NOT call enqueueDispatchesForInvoice / charge via
  // Stripe — collection is manual in V1 ("Betal nå" Checkout or manual
  // dispatch_invoice). Auto-charge from this cron is a future ADR.
  return true;
}

async function markOverdueInvoices(supabase: SupabaseLike): Promise<number> {
  const today = toIsoDate(new Date());

  const { data, error } = await supabase
    .from("invoice")
    .update({ status: "overdue" })
    .in("status", ["issued", "sent"])
    .lt("due_at", today)
    .select("invoice_id, company_id, due_at");

  if (error) {
    console.error("[generator] overdue scan failed:", error.message);
    throw error;
  }

  for (const inv of (data ?? []) as Array<{
    invoice_id: string;
    company_id: string;
    due_at: string;
  }>) {
    const days_overdue = Math.floor(
      (Date.now() - new Date(inv.due_at).getTime()) / (24 * 60 * 60 * 1000),
    );
    await emitViaEndpoint({
      event: "invoice overdue_detected",
      actor_id: null,
      workspace_id: null,
      properties: {
        entity_type: "invoice",
        entity_id: inv.invoice_id,
        data: {
          days_overdue,
          company_id: inv.company_id,
          source: "cron",
        },
      },
    });
  }

  return data?.length ?? 0;
}

// ─── emit bridge (Edge Function → /api/internal/emit) ──────────────
// ADR-0084 boundary: Deno can't import @smartout/telemetry. Post raw
// SmartoutEvent payloads to the Next.js side via a shared secret.
// Telemetry failure never aborts invoice generation — fail-loud via
// console.error, continue the transaction.

type EmitPayload = {
  event: string;
  actor_id: string | null;
  workspace_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>;
};

async function emitViaEndpoint(event: EmitPayload): Promise<void> {
  const url = Deno.env.get("INTERNAL_EMIT_URL");
  const secret = Deno.env.get("WATCHDOG_CRON_SECRET");

  if (!url || !secret) {
    console.error(
      "[generator.emit] missing INTERNAL_EMIT_URL or WATCHDOG_CRON_SECRET — skipping emit for",
      event.event,
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
        `[generator.emit] non-OK response for "${event.event}": ${res.status} ${body}`,
      );
    }
  } catch (err) {
    console.error(
      `[generator.emit] network error for "${event.event}":`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ─── tiny helpers ──────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Rounds to 2 decimal places. Currency math via string-to-number
// risks float drift; we round-on-read instead of string-money because
// DB stores decimal(12,2) and receives numeric literals cleanly.
function toMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
