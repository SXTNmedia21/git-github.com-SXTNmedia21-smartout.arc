/**
 * journey-stuck-detector — Cron-triggered Journey Harness rescue trigger.
 *
 * Runs hourly. Finds engine_state rows for journey_03_check_shifts that have
 * been stuck on step 1 (waiting for shift.detail_viewed) for more than 24
 * hours, and writes a guardian_signal with domain='journey_health' for each.
 * The guardian_signal_journey_health_push trigger then fires a push
 * notification to deliver the rescue prompt.
 *
 * Idempotent: skips any profile that already has an active journey_health
 * signal created within the last 24 hours, so re-runs within the cron
 * window do not spam users.
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern, matching
 * daily-session-replenish).
 *
 * See: docs/superpowers/specs/2026-04-06-journey-harness-poc-instruction.md (C5)
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STALE_THRESHOLD_HOURS = 24;
const PROCESS_ID = "journey_03_check_shifts";

type StuckState = {
  id: string;
  entity_id: string | null;
  entity_type: string | null;
  workspace_id: string;
  current_step: number;
  updated_at: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Cron secret bearer token — only enforced when WATCHDOG_CRON_SECRET is
  // set (allows manual invocation in local dev when the secret is empty).
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Find all engine_state rows stuck on step 1 of journey_03_check_shifts
  const cutoff = new Date(
    Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: stuckStates, error: queryError } = await supabase
    .from("engine_state")
    .select("id, entity_id, entity_type, workspace_id, current_step, updated_at")
    .eq("process_id", PROCESS_ID)
    .eq("current_step", 1)
    .eq("status", "waiting")
    .lt("updated_at", cutoff);

  if (queryError) {
    return new Response(
      JSON.stringify({ error: queryError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const states = (stuckStates ?? []) as StuckState[];

  if (states.length === 0) {
    return new Response(
      JSON.stringify({ checked: 0, signals_created: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. For each stuck state, idempotency-check then insert the signal.
  // Idempotency window matches the stale threshold so a single user is
  // notified at most once per 24h regardless of cron frequency.
  const idempotencyCutoff = new Date(
    Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000,
  ).toISOString();

  let created = 0;
  for (const state of states) {
    if (!state.entity_id || !state.workspace_id) continue;

    const { data: existing } = await supabase
      .from("guardian_signal")
      .select("id")
      .eq("entity_id", state.entity_id)
      .eq("domain", "journey_health")
      .gt("created_at", idempotencyCutoff)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { error: insertError } = await supabase.from("guardian_signal").insert({
      workspace_id: state.workspace_id,
      domain: "journey_health",
      entity_type: "profile",
      entity_id: state.entity_id,
      signal_type: "journey_stalled",
      severity: "info",
      title: "Journey 03 stalled",
      description: `Employee opened the shifts list but never tapped a specific shift within ${STALE_THRESHOLD_HOURS}h. Send a rescue prompt to guide them to the next step.`,
      status: "active",
    });

    if (!insertError) created++;
  }

  return new Response(
    JSON.stringify({ checked: states.length, signals_created: created }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
