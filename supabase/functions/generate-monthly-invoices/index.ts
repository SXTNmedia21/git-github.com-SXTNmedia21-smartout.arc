/**
 * generate-monthly-invoices — Cron-triggered billing generator.
 *
 * Runs day 5 of each month at 00:01 UTC (pg_cron trigger, see
 * docs/runbooks/billing-monthly-cron.md). For every active company:
 *
 *  1. Freezes one `usage_snapshot` per workspace for the previous month
 *     using the ADR-0119 predicate (completed shifts with employee_id).
 *  2. Generates a single recurring `invoice` (draft) per company with
 *     base_plan + user_overage line items per workspace.
 *  3. Transitions the invoice to `issued` status — `assign_invoice_number`
 *     trigger fires, invoice_number_seq allocates the next number.
 *  4. Emits `usage_snapshot created`, `invoice generated`, `invoice issued`
 *     via the /api/internal/emit HTTP bridge (Deno cannot import
 *     @smartout/telemetry).
 *  5. Scans existing issued/sent invoices past their due_at, flips them
 *     to `overdue` status, emits `invoice overdue_detected`.
 *
 * Idempotency: the unique index `idx_invoice_one_recurring_per_period`
 * prevents double-generation at the DB level; the generator also
 * early-exits if a non-void invoice already exists for (company, period).
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (same pattern as
 * daily-session-replenish, ops-monitor, watchdog-uptime).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { generateMonthlyInvoicesForAllCompanies } from "./generator.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Previous calendar month. Example: cron fires 2026-04-05 → period
  // = 2026-03-01..2026-03-31. UTC-based to avoid timezone ambiguity
  // in period boundaries (invoice period_from/_to are DATE columns).
  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
  );

  try {
    const result = await generateMonthlyInvoicesForAllCompanies(
      supabase,
      periodStart,
      periodEnd,
    );
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-monthly-invoices] unhandled error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
