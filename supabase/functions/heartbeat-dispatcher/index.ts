/**
 * heartbeat-dispatcher — Phase 0 (Crown) — Arena Harness Migration
 *
 * Runs on pg_cron schedule (every 1 minute — `* /1 * * * *` for crown). Selects up to 50
 * `engine_state` rows where `status='scheduled' AND scheduled_for <= now()`
 * under `FOR UPDATE SKIP LOCKED`. Sets `dispatch_lock_id`, flips status
 * to `'pending'`, and fires `pg_notify('mission_dispatch', json)` per row.
 * All four operations are atomic inside the heartbeat_pickup() RPC to
 * eliminate the SELECT/UPDATE race window.
 *
 * Auth: bearer token must equal `WATCHDOG_CRON_SECRET`.
 * Config: `verify_jwt = false` in supabase/functions/config.toml.
 *
 * See:
 * - docs/plans/PLAN-arena-harness-migration.md §Phase 0 Step 0.2
 * - docs/superpowers/plans/2026-04-29-arena-harness-phase-0-crown.md Task 3
 * - ADR-0151 (workspace_id server-derived)
 * - ADR-0175 (telemetry events frozen)
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Auth ────────────────────────────────────────────────────
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${Deno.env.get("WATCHDOG_CRON_SECRET") ?? ""}`;
  if (!Deno.env.get("WATCHDOG_CRON_SECRET") || auth !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ── Atomic pickup: SELECT FOR UPDATE SKIP LOCKED + UPDATE + pg_notify ──
  const { data: dispatched, error } = await supabase.rpc("heartbeat_pickup", {
    p_limit: 50,
  });

  if (error) {
    // Log full detail server-side, return opaque body to caller (F-EF-07).
    console.error("[heartbeat-dispatcher] rpc heartbeat_pickup error:", error);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      mode: "cron",
      dispatched: (dispatched ?? []).length,
      rows: dispatched,
    }),
    { headers: { ...corsHeaders, "content-type": "application/json" } },
  );
});
