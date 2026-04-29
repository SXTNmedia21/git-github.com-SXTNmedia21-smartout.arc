/**
 * obligation-overdue-cron — Daily cron Edge Function (ADR-0243, Part C).
 *
 * Reads contract_obligation rows where:
 *   status = 'pending' AND due_at <= NOW()
 *
 * Sets status → 'overdue' and emits contract.obligation_overdue per obligation.
 *
 * Scheduled daily via supabase/config.toml [functions.obligation-overdue-cron.cron].
 *
 * Auth: CRON_SECRET bearer token (same pattern as fire-delayed-triggers and
 * session-watchdog-demoter). Set CRON_SECRET in Supabase Vault / env.
 *
 * Telemetry: emits contract.obligation_overdue for each overdue obligation.
 * Uses service_role for the DB query (obligation reads across all workspaces).
 * Emits are fire-and-forget (void) — cron outcome logged via console.log.
 *
 * Batch limit: 100 rows per run to avoid function timeout on large datasets.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: CRON_SECRET bearer token (same pattern as session-watchdog-demoter).
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();

  try {
    // 1. Fetch obligations that are overdue but still pending.
    const { data: dueObligations, error: queryErr } = await supabase
      .from("contract_obligation")
      .select(
        "id, contract_id, workspace_id, title, obligation_type, due_at, is_blocker",
      )
      .eq("status", "pending")
      .lte("due_at", now)
      .order("due_at")
      .limit(100);

    if (queryErr) {
      console.log(
        JSON.stringify({
          level: "error",
          action: "obligation_overdue_cron",
          category: "contracts",
          error: queryErr.message,
        }),
      );
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dueObligations || dueObligations.length === 0) {
      return new Response(JSON.stringify({ demoted: 0, total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = dueObligations.map((o) => o.id);

    // 2. Set status → 'overdue' for all found rows.
    const { error: updateErr } = await supabase
      .from("contract_obligation")
      .update({ status: "overdue", updated_at: now })
      .in("id", ids);

    if (updateErr) {
      console.log(
        JSON.stringify({
          level: "error",
          action: "obligation_overdue_cron",
          category: "contracts",
          error: updateErr.message,
          obligation_ids: ids,
        }),
      );
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Emit contract.obligation_overdue for each row.
    // Fire-and-forget — cron continues even if individual emits fail.
    // Telemetry is best-effort for cron paths (L-0023: system events).
    //
    // We use a lightweight inline emit (no @smartout/telemetry package import —
    // Edge Functions use Deno and can't import Node packages directly).
    // The activity_trail + engine_event destinations are handled by the
    // DB trigger on contract_obligation status change (ADR-0243).
    // This cron only emits the logger destination for observability.
    for (const obligation of dueObligations) {
      console.log(
        JSON.stringify({
          level: "info",
          event: "contract.obligation_overdue",
          action: "obligation_overdue_cron",
          category: "contracts",
          workspace_id: obligation.workspace_id ?? null,
          obligation_id: obligation.id,
          contract_id: obligation.contract_id,
          obligation_type: obligation.obligation_type,
          title: obligation.title,
          due_at: obligation.due_at,
          is_blocker: obligation.is_blocker,
          demoted_at: now,
          automated: true,
        }),
      );
    }

    return new Response(
      JSON.stringify({
        demoted: dueObligations.length,
        total: ids.length,
        obligation_ids: ids,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      JSON.stringify({
        level: "error",
        action: "obligation_overdue_cron",
        category: "contracts",
        error: message,
      }),
    );
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
