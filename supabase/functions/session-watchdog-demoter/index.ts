/**
 * session-watchdog-demoter — Cron-triggered demotion of stale
 * `pending_signoff` sessions to `missed`.
 *
 * Problem: `department_session` rows can get stuck in
 * `status='pending_signoff'` indefinitely if no admin signs off. This
 * watchdog runs periodically and demotes rows whose `updated_at` has
 * not moved for `SESSION_PENDING_SIGNOFF_STALE_HOURS` (default 24 h).
 *
 * Architecture (per ADR-0187 — single-emit-source invariant):
 *   1. The Edge Function performs only the UPDATE on
 *      `department_session.status`.
 *   2. A DB trigger (`trg_session_demoted_to_missed`, added in the
 *      companion migration) is the SOLE emitter of the
 *      `department_session.missed` engine_event.
 *   3. The trigger is gated via `gate_action` on the new capability
 *      `session.auto_missed_transition` (min_role=system) — the
 *      pattern introduced by ADR-0189 for ADR-0187 state transitions.
 *   4. Because the emit-registry subscriber infrastructure is not yet
 *      in place, this function ALSO writes `activity_trail` and
 *      `logger` directly — identical to `journey-stuck-detector`
 *      (ADR-0175 handling of the same boundary). The event key
 *      `"session demoted_to_missed"` matches the entry in
 *      `packages/telemetry/src/registry.ts`.
 *
 * Auth: internal cron only. `verify_jwt = false` in config.toml; the
 * handler requires `Bearer ${WATCHDOG_CRON_SECRET}` like every other
 * watchdog function in this repo (journey-stuck-detector,
 * watchdog-integrity, fire-delayed-triggers, session-lifecycle).
 *
 * Tunable threshold:
 *   SESSION_PENDING_SIGNOFF_STALE_HOURS (env, default 24).
 *
 * Idempotence: the function is safe to run repeatedly — the UPDATE
 * filters `status='pending_signoff'`, so a second pass will find no
 * rows. Idempotency on the engine_event side is preserved by the
 * trigger's `idempotency_key = 'session_missed_' || session_id`.
 *
 * See:
 *   - ADR-0187 (single-emit source for session state transitions)
 *   - ADR-0189 (authority gate on DB-level writers)
 *   - L-0108 (triple-writer pattern, 3rd occurrence)
 *   - Migration 20260517130000_session_watchdog_demoter.sql
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

// profile_id seeded in migration 20260422215500_system_actor_profile_seed.sql.
// activity_trail.actor_id is NOT NULL — system-initiated writes must
// target the system profile to satisfy the FK.
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

const DEFAULT_STALE_HOURS = 24;

// Query batch cap — matches fire-delayed-triggers to keep a single
// cron invocation bounded.
const QUERY_LIMIT = 200;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StaleSessionRow {
  department_session_id: string;
  workspace_id: string;
  department_id: string;
  session_date: string;
  updated_at: string;
}

interface DemotionResult {
  department_session_id: string;
  workspace_id: string;
  ok: boolean;
  error?: string;
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: WATCHDOG_CRON_SECRET bearer (internal cron).
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Threshold — env-configurable, default 24 h.
  const staleHoursRaw = Deno.env.get("SESSION_PENDING_SIGNOFF_STALE_HOURS");
  const staleHoursParsed = staleHoursRaw != null ? Number(staleHoursRaw) : NaN;
  const staleHours =
    Number.isFinite(staleHoursParsed) && staleHoursParsed > 0
      ? staleHoursParsed
      : DEFAULT_STALE_HOURS;

  const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString();
  const now = new Date();

  try {
    // 1. Query stale pending_signoff rows.
    const { data: stale, error: queryErr } = await supabase
      .from("department_session")
      .select("department_session_id, workspace_id, department_id, session_date, updated_at")
      .eq("status", "pending_signoff")
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(QUERY_LIMIT);

    if (queryErr) {
      console.log(
        JSON.stringify({
          level: "error",
          action: "session_watchdog_demoter",
          category: "operations",
          error: queryErr.message,
        }),
      );
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = (stale ?? []) as StaleSessionRow[];

    if (rows.length === 0) {
      console.log(
        JSON.stringify({
          level: "info",
          action: "session_watchdog_demoter",
          category: "operations",
          message: "no_stale_sessions",
          stale_hours: staleHours,
        }),
      );
      return new Response(
        JSON.stringify({ ok: true, demoted_count: 0, ids: [], stale_hours: staleHours }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Demote each row. Per ADR-0187: UPDATE only — the trigger
    //    emits engine_event. We use a per-row UPDATE (not .in()) so
    //    a gate-denial on one row does not abort the whole batch.
    const results: DemotionResult[] = [];

    for (const row of rows) {
      const { error: updateErr } = await supabase
        .from("department_session")
        // Casting through string: `status` is enum-typed in generated
        // types; .update() accepts the runtime string.
        .update({ status: "missed" as "missed" })
        .eq("department_session_id", row.department_session_id)
        // Re-check status to guard against races (another writer may
        // have moved the row to closed/active between SELECT and UPDATE).
        .eq("status", "pending_signoff");

      if (updateErr) {
        results.push({
          department_session_id: row.department_session_id,
          workspace_id: row.workspace_id,
          ok: false,
          error: updateErr.message,
        });
        console.log(
          JSON.stringify({
            level: "error",
            action: "session_watchdog_demoter",
            category: "operations",
            department_session_id: row.department_session_id,
            workspace_id: row.workspace_id,
            error: updateErr.message,
          }),
        );
        continue;
      }

      results.push({
        department_session_id: row.department_session_id,
        workspace_id: row.workspace_id,
        ok: true,
      });

      // 3. activity_trail fan-out (registry destination #3).
      //    Event key "session demoted_to_missed" matches
      //    packages/telemetry/src/registry.ts EVENT_ROUTING.
      //    engine_event fan-out (destination #4) is handled by the
      //    trigger — do NOT insert engine_event here (ADR-0187).
      //    PostHog and logger in the registry destination set are
      //    handled by the registry subscriber / console.log below,
      //    same pattern as journey-stuck-detector.
      const entityLabel = `Session ${row.session_date} demoted to missed after ${staleHours}h stale`;
      const { error: activityErr } = await supabase.from("activity_trail").insert({
        event: "session demoted_to_missed",
        action_verb: "expired",
        category: "operations",
        entity_type: "department_session",
        entity_id: row.department_session_id,
        entity_label: entityLabel,
        actor_id: SYSTEM_ACTOR_ID,
        workspace_id: row.workspace_id,
        data: {
          session_id: row.department_session_id,
          department_id: row.department_id,
          workspace_id: row.workspace_id,
          previous_status: "pending_signoff",
          stale_hours: staleHours,
          automated: true,
          manual: false,
          system: true,
          session_date: row.session_date,
          previous_updated_at: row.updated_at,
          demoted_at: now.toISOString(),
        },
        source: "edge-function",
      });

      if (activityErr) {
        console.log(
          JSON.stringify({
            level: "warn",
            action: "session_watchdog_demoter",
            category: "operations",
            department_session_id: row.department_session_id,
            workspace_id: row.workspace_id,
            activity_trail_error: activityErr.message,
          }),
        );
      }

      // 4. Structured logger destination (registry destination #2).
      console.log(
        JSON.stringify({
          level: "info",
          action: "session_watchdog_demoter",
          category: "operations",
          event: "session demoted_to_missed",
          department_session_id: row.department_session_id,
          workspace_id: row.workspace_id,
          department_id: row.department_id,
          session_date: row.session_date,
          stale_hours: staleHours,
          previous_updated_at: row.updated_at,
          activity_trail_ok: activityErr == null,
        }),
      );
    }

    const successIds = results.filter((r) => r.ok).map((r) => r.department_session_id);
    const failureCount = results.length - successIds.length;

    console.log(
      JSON.stringify({
        level: failureCount > 0 ? "warn" : "info",
        action: "session_watchdog_demoter",
        category: "operations",
        message: "batch_complete",
        demoted_count: successIds.length,
        failure_count: failureCount,
        stale_hours: staleHours,
      }),
    );

    return new Response(
      JSON.stringify({
        ok: true,
        demoted_count: successIds.length,
        failure_count: failureCount,
        ids: successIds,
        stale_hours: staleHours,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "error",
        action: "session_watchdog_demoter",
        category: "operations",
        error: String(err),
      }),
    );
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
