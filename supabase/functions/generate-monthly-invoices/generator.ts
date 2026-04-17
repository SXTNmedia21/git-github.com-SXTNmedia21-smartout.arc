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
  workspace: Array<{ workspace_id: string }> | null;
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
    .select("company_id, workspace(workspace_id)")
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
  const base_plan_amount = toMoney(pt.monthly_cost ?? 0);
  const overage_unit_price = toMoney(pt.overage_price_per_user ?? 0);
  const overage_amount = snapshots.reduce(
    (sum, s) => toMoney(sum + s.billable_users * overage_unit_price),
    0,
  );
  const amount_excl_vat = toMoney(base_plan_amount + overage_amount);
  const vat_rate = 25.0;
  const vat_amount = toMoney(amount_excl_vat * 0.25);
  const amount_incl_vat = toMoney(amount_excl_vat + vat_amount);

  const due_at = toIsoDate(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  ); // net 14

  const { data: invoice, error: invErr } = await supabase
    .from("invoice")
    .insert({
      company_id: company.company_id,
      invoice_type: "recurring",
      status: "draft",
      period_from: periodFrom,
      period_to: periodTo,
      amount_excl_vat,
      vat_rate,
      vat_amount,
      amount_incl_vat,
      currency: "NOK",
      delivery_channel: pt.delivery_channel ?? "manual",
      due_at,
      // ADR-0121 Phase 1.5: snapshot the exact pricing_terms row that
      // governed this invoice. get_invoice_basis() prefers this FK over
      // date-range fallback (protects audit against retroactive edits).
      pricing_terms_id: pt.pricing_terms_id,
    })
    .select("invoice_id")
    .single();

  if (invErr || !invoice) {
    throw new Error(
      `invoice insert: ${invErr?.message ?? "no row returned"}`,
    );
  }

  const lineItems: Array<Record<string, unknown>> = [
    {
      invoice_id: invoice.invoice_id,
      line_type: "base_plan",
      description: `Månedlig abonnement ${periodFrom} – ${periodTo}`,
      quantity: 1,
      unit_price: base_plan_amount,
      amount_excl_vat: base_plan_amount,
      vat_rate,
      vat_amount: toMoney(base_plan_amount * 0.25),
      amount_incl_vat: toMoney(base_plan_amount * 1.25),
    },
    ...snapshots
      .filter((s) => s.billable_users > 0)
      .map((s) => {
        const line_excl = toMoney(s.billable_users * overage_unit_price);
        return {
          invoice_id: invoice.invoice_id,
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

  const { error: liErr } = await supabase
    .from("invoice_line_item")
    .insert(lineItems);
  if (liErr) throw new Error(`line_item insert: ${liErr.message}`);

  // Emit usage snapshots + invoice_generated BEFORE the issued
  // transition, so the timeline reads chronologically.
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
      entity_id: invoice.invoice_id,
      data: {
        company_id: company.company_id,
        amount_incl_vat,
        period_from: periodFrom,
        period_to: periodTo,
        source: "cron",
      },
    },
  });

  // Transition to issued → fires assign_invoice_number trigger.
  const { error: issueErr } = await supabase
    .from("invoice")
    .update({ status: "issued" })
    .eq("invoice_id", invoice.invoice_id);

  if (issueErr) throw new Error(`issue transition: ${issueErr.message}`);

  // Fetch the now-assigned invoice_number for the emit payload.
  const { data: issued } = await supabase
    .from("invoice")
    .select("invoice_number")
    .eq("invoice_id", invoice.invoice_id)
    .single();

  await emitViaEndpoint({
    event: "invoice issued",
    actor_id: null,
    workspace_id: null,
    properties: {
      entity_type: "invoice",
      entity_id: invoice.invoice_id,
      data: {
        company_id: company.company_id,
        invoice_number: issued?.invoice_number ?? 0,
        amount_incl_vat,
        source: "cron",
      },
    },
  });

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
