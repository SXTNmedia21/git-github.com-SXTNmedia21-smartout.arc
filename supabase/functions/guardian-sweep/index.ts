/**
 * guardian-sweep — Cron-triggered signal generator.
 *
 * Runs every 15 minutes. Scans workspace state and generates guardian_signal rows.
 * Uses service role (no user auth). Deduplicates by source_check_id.
 *
 * Checks:
 * 1. Expired protocol assignments (status = 'expired', not yet signalled)
 * 2. Stale engine sessions (active but not updated in 10+ minutes)
 * 3. Missing season budget (workspace has season but no season_budget)
 * 4. Incomplete onboarding (started > 24h ago, not completed)
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import type { SignalInsert } from "../_shared/guardian-types.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: cron secret bearer token
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const signals: SignalInsert[] = [];
  const errors: string[] = [];

  // ── Check 1: Expired protocol assignments ──────────────────────────
  try {
    // protocol_assignment lacks workspace_id, join through profile
    const { data: expired, error } = await supabase
      .from("protocol_assignment")
      .select(
        "assignment_id, profile_id, protocol_id, status, profile!inner(workspace_id, full_name)",
      )
      .eq("status", "expired");

    if (error) {
      errors.push(`expired_protocols: ${error.message}`);
    } else if (expired) {
      for (const row of expired) {
        const profile = row.profile as unknown as {
          workspace_id: string;
          full_name: string | null;
        };
        signals.push({
          workspace_id: profile.workspace_id,
          signal_type: "expired_protocol_assignment",
          domain: "readiness",
          severity: "warning",
          entity_type: "protocol_assignment",
          entity_id: row.assignment_id,
          entity_label: profile.full_name ?? row.profile_id,
          title: "Expired protocol assignment",
          description: `Protocol assignment for ${profile.full_name ?? "unknown"} has expired without completion.`,
          source_check_id: `expired_protocol:${row.assignment_id}`,
          data: { protocol_id: row.protocol_id, profile_id: row.profile_id },
        });
      }
    }
  } catch (e) {
    errors.push(`expired_protocols: ${String(e)}`);
  }

  // ── Check 2: Stale engine sessions ─────────────────────────────────
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stale, error } = await supabase
      .from("engine_sessions")
      .select("id, workspace_id, profile_id, mission_id, updated_at")
      .eq("status", "active")
      .lt("updated_at", tenMinAgo);

    if (error) {
      errors.push(`stale_sessions: ${error.message}`);
    } else if (stale) {
      for (const session of stale) {
        signals.push({
          workspace_id: session.workspace_id,
          signal_type: "stale_session",
          domain: "agent_behavior",
          severity: "info",
          entity_type: "engine_session",
          entity_id: session.id,
          entity_label: `Session ${session.id.slice(0, 8)}`,
          title: "Stale agent session",
          description: `Session ${session.id.slice(0, 8)} has been active but not updated since ${session.updated_at}.`,
          source_check_id: `stale_session:${session.id}`,
          data: { mission_id: session.mission_id, profile_id: session.profile_id },
        });
      }
    }
  } catch (e) {
    errors.push(`stale_sessions: ${String(e)}`);
  }

  // ── Check 3: Missing season budget ─────────────────────────────────
  try {
    // Find seasons that have no corresponding season_budget
    const { data: seasons, error: seasonErr } = await supabase
      .from("season")
      .select("season_id, workspace_id, name");

    if (seasonErr) {
      errors.push(`missing_budget: ${seasonErr.message}`);
    } else if (seasons && seasons.length > 0) {
      const seasonIds = seasons.map((s: { season_id: string }) => s.season_id);
      const { data: budgets, error: budgetErr } = await supabase
        .from("season_budget")
        .select("season_id")
        .in("season_id", seasonIds);

      if (budgetErr) {
        errors.push(`missing_budget: ${budgetErr.message}`);
      } else {
        const budgetSeasonIds = new Set(
          (budgets ?? []).map((b: { season_id: string }) => b.season_id),
        );
        for (const season of seasons) {
          if (!budgetSeasonIds.has(season.season_id)) {
            signals.push({
              workspace_id: season.workspace_id,
              signal_type: "missing_season_budget",
              domain: "workspace_maturity",
              severity: "warning",
              entity_type: "season",
              entity_id: season.season_id,
              entity_label: season.name ?? `Season ${season.season_id.slice(0, 8)}`,
              title: "Season missing budget",
              description: `Season "${season.name ?? season.season_id.slice(0, 8)}" has no budget configured.`,
              source_check_id: `missing_budget:${season.season_id}`,
              data: { season_id: season.season_id },
            });
          }
        }
      }
    }
  } catch (e) {
    errors.push(`missing_budget: ${String(e)}`);
  }

  // ── Check 4: Incomplete onboarding (> 24h) ────────────────────────
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: incomplete, error } = await supabase
      .from("onboarding_session")
      .select("id, user_id, workspace_id, created_at, current_step")
      .is("completed_at", null)
      .lt("created_at", twentyFourHoursAgo);

    if (error) {
      errors.push(`incomplete_onboarding: ${error.message}`);
    } else if (incomplete) {
      for (const session of incomplete) {
        // onboarding_session may not have workspace_id yet if very early
        if (!session.workspace_id) continue;
        signals.push({
          workspace_id: session.workspace_id,
          signal_type: "incomplete_onboarding",
          domain: "onboarding",
          severity: "warning",
          entity_type: "onboarding_session",
          entity_id: session.id,
          entity_label: `Onboarding ${session.id.slice(0, 8)}`,
          title: "Incomplete onboarding",
          description: `Onboarding started more than 24 hours ago and is still at step ${session.current_step ?? 0}.`,
          source_check_id: `incomplete_onboarding:${session.id}`,
          data: { user_id: session.user_id, current_step: session.current_step },
        });
      }
    }
  } catch (e) {
    errors.push(`incomplete_onboarding: ${String(e)}`);
  }

  // ── Deduplicate & insert ───────────────────────────────────────────
  let inserted = 0;
  let skipped = 0;

  if (signals.length > 0) {
    // Fetch all active source_check_ids to deduplicate
    const checkIds = signals.map((s) => s.source_check_id);
    const { data: existing } = await supabase
      .from("guardian_signal")
      .select("source_check_id")
      .in("source_check_id", checkIds)
      .in("status", ["active", "acknowledged"]);

    const existingIds = new Set(
      (existing ?? []).map((e: { source_check_id: string }) => e.source_check_id),
    );

    const newSignals = signals.filter((s) => !existingIds.has(s.source_check_id));
    skipped = signals.length - newSignals.length;

    if (newSignals.length > 0) {
      const { error: insertErr } = await supabase.from("guardian_signal").insert(newSignals);

      if (insertErr) {
        errors.push(`insert: ${insertErr.message}`);
      } else {
        inserted = newSignals.length;
      }
    }
  }

  return new Response(
    JSON.stringify({
      status: errors.length > 0 ? "partial" : "ok",
      timestamp: now,
      checks: {
        expired_protocols: true,
        stale_sessions: true,
        missing_budget: true,
        incomplete_onboarding: true,
      },
      signals_found: signals.length,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
