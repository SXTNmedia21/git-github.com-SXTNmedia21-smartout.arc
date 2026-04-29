/**
 * obligation-due-soon-cron — Daily cron Edge Function (Wave 5, WS1D).
 *
 * Reads contract_obligation rows where:
 *   status = 'pending'
 *   AND due_at - NOW() <= 3 days (configurable via DUE_SOON_DAYS env)
 *   AND (notified_at IS NULL OR notified_at < NOW() - INTERVAL '24h')
 *
 * For each: emits contract.obligation_due_soon notification and updates
 * notified_at (idempotency guard — avoids re-notifying same day).
 *
 * Auth: CRON_SECRET bearer token (same pattern as obligation-overdue-cron).
 * Scheduled daily via supabase/config.toml.
 * Batch limit: 100 rows per run to avoid function timeout.
 *
 * Idempotency: tracks via notified_at column (migration 20260519140000).
 * Re-running within 24h of a notification is a no-op for that obligation.
 *
 * Telemetry: contract.obligation_due_soon (Wave 3 registered). Console.log
 * only (Edge Function Deno environment, same pattern as obligation-overdue-cron).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Days before due_at to trigger a "due soon" notification (default 3). */
const DUE_SOON_DAYS = Number(Deno.env.get("DUE_SOON_DAYS") ?? "3");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: CRON_SECRET bearer token.
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const nowIso = now.toISOString();

  // due_soon window: obligations due within DUE_SOON_DAYS days from now.
  const dueSoonThreshold = new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // notified_at cutoff: skip if notified within last 24h.
  const notifiedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // Fetch obligations that are due soon, not overdue, and not recently notified.
    const { data: dueSoon, error: queryErr } = await supabase
      .from("contract_obligation")
      .select(
        "id, contract_id, workspace_id, title, obligation_type, due_at, is_blocker, notified_at",
      )
      .eq("status", "pending")
      .gte("due_at", nowIso)
      .lte("due_at", dueSoonThreshold)
      .or(`notified_at.is.null,notified_at.lt.${notifiedCutoff}`)
      .order("due_at")
      .limit(100);

    if (queryErr) {
      console.log(
        JSON.stringify({
          level: "error",
          action: "obligation_due_soon_cron",
          category: "contracts",
          error: queryErr.message,
        }),
      );
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dueSoon || dueSoon.length === 0) {
      return new Response(JSON.stringify({ notified: 0, total: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = dueSoon.map((o) => o.id);

    // Update notified_at for all matched rows (idempotency marker).
    const { error: updateErr } = await supabase
      .from("contract_obligation")
      .update({ notified_at: nowIso })
      .in("id", ids);

    if (updateErr) {
      console.log(
        JSON.stringify({
          level: "error",
          action: "obligation_due_soon_cron",
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

    // Emit contract.obligation_due_soon for each obligation.
    // Console.log only — DB trigger handles activity_trail + engine_event routing.
    for (const obligation of dueSoon) {
      const daysUntilDue = Math.ceil(
        (new Date(obligation.due_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      console.log(
        JSON.stringify({
          level: "info",
          event: "contract.obligation_due_soon",
          action: "obligation_due_soon_cron",
          category: "contracts",
          workspace_id: obligation.workspace_id ?? null,
          obligation_id: obligation.id,
          contract_id: obligation.contract_id,
          obligation_type: obligation.obligation_type,
          title: obligation.title,
          due_at: obligation.due_at,
          days_until_due: daysUntilDue,
          is_blocker: obligation.is_blocker,
          notified_at: nowIso,
          automated: true,
        }),
      );
    }

    return new Response(
      JSON.stringify({
        notified: dueSoon.length,
        total: ids.length,
        due_soon_days_threshold: DUE_SOON_DAYS,
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
        action: "obligation_due_soon_cron",
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
