// ============================================
// sixten-checks.ts
// Phase 0d.1 — Sixten Orchestrator: five health checks.
//
// What: Pure SQL query functions, each returning a typed CheckResult.
//       No side-effects — all policy/emit happens in sixten-orchestrator.ts.
//
// Checks (in priority order per Sixten design):
//   1. emit_pulse_received   — confirms pulse landed (always "ok")
//   2. engine_event_lag      — oldest unprocessed engine_event (by fired_at)
//   3. notification_outbox_stale — pending outbox rows older than threshold
//   4. ticket_SLA            — engine_state desk_query_ticket past SLA
//   5. D6_orphan_deviations  — deviation rows open > 24h
//
// Note on "unprocessed" engine_event (Gap B5):
//   engine_event has no processed_at column. We proxy "lag" by finding the
//   oldest fired_at that is NOT the pulse family itself — a row sitting
//   > 600s without a subsequent processing echo signals stale queue.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Result Shape ────────────────────────────────────────────────
export type CheckStatus = "ok" | "warn" | "breach";

export interface CheckResult {
  check_name: string;
  status: CheckStatus;
  /** Observed metric value (seconds, count, etc.) */
  metric: number;
  /** Threshold that was evaluated against */
  threshold: number;
  payload: Record<string, unknown>;
}

// ─── Thresholds ──────────────────────────────────────────────────
const ENGINE_EVENT_LAG_WARN_S = 300; // 5 min
const ENGINE_EVENT_LAG_BREACH_S = 600; // 10 min
const OUTBOX_STALE_WARN_S = 300;
const OUTBOX_STALE_BREACH_S = 600;
const TICKET_SLA_BREACH_COUNT = 1; // any overdue ticket = breach
const DEVIATION_ORPHAN_WARN_H = 12; // 12h
const DEVIATION_ORPHAN_BREACH_H = 24; // 24h

// ─── Check 1: emit_pulse_received ───────────────────────────────
/**
 * Confirms the pulse row exists in engine_event.
 * This check is always "ok" when called (the orchestrator only runs on a
 * received pulse). Its job is to produce a LOG record for observability.
 */
export async function checkEmitPulseReceived(
  supabase: SupabaseClient,
  pulseId: string,
): Promise<CheckResult> {
  const { count } = await supabase
    .from("engine_event")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "sixten.pulse_received")
    .contains("payload", { pulse_id: pulseId });

  return {
    check_name: "emit_pulse_received",
    status: "ok",
    metric: count ?? 0,
    threshold: 1,
    payload: { pulse_id: pulseId, rows_found: count ?? 0 },
  };
}

// ─── Check 2: engine_event_lag ───────────────────────────────────
/**
 * Finds the oldest engine_event row (excluding sixten.pulse_* family and
 * workspace_id=null) older than ENGINE_EVENT_LAG_BREACH_S seconds.
 *
 * Rationale for excluding null workspace_id: sixten/system events are
 * expected to be long-lived and unprocessed — they are producers, not
 * consumers of the queue.
 */
export async function checkEngineEventLag(supabase: SupabaseClient): Promise<CheckResult> {
  const nowMs = Date.now();
  const breachCutoff = new Date(nowMs - ENGINE_EVENT_LAG_BREACH_S * 1000).toISOString();
  const warnCutoff = new Date(nowMs - ENGINE_EVENT_LAG_WARN_S * 1000).toISOString();

  const { data, error } = await supabase
    .from("engine_event")
    .select("id, fired_at, event_type")
    .not("event_type", "like", "sixten.%")
    .not("workspace_id", "is", null)
    .lt("fired_at", breachCutoff)
    .order("fired_at", { ascending: true })
    .limit(1);

  if (error) {
    return {
      check_name: "engine_event_lag",
      status: "warn",
      metric: 0,
      threshold: ENGINE_EVENT_LAG_BREACH_S,
      payload: { error: error.message },
    };
  }

  if (!data || data.length === 0) {
    // Check warn band
    const { data: warnData } = await supabase
      .from("engine_event")
      .select("id, fired_at")
      .not("event_type", "like", "sixten.%")
      .not("workspace_id", "is", null)
      .lt("fired_at", warnCutoff)
      .order("fired_at", { ascending: true })
      .limit(1);

    if (warnData && warnData.length > 0) {
      const ageS = Math.round((nowMs - new Date(warnData[0].fired_at as string).getTime()) / 1000);
      return {
        check_name: "engine_event_lag",
        status: "warn",
        metric: ageS,
        threshold: ENGINE_EVENT_LAG_BREACH_S,
        payload: {
          oldest_event_id: warnData[0].id,
          oldest_fired_at: warnData[0].fired_at,
          age_seconds: ageS,
        },
      };
    }

    return {
      check_name: "engine_event_lag",
      status: "ok",
      metric: 0,
      threshold: ENGINE_EVENT_LAG_BREACH_S,
      payload: { note: "no lagging events" },
    };
  }

  const oldest = data[0];
  const ageS = Math.round((nowMs - new Date(oldest.fired_at as string).getTime()) / 1000);

  return {
    check_name: "engine_event_lag",
    status: "breach",
    metric: ageS,
    threshold: ENGINE_EVENT_LAG_BREACH_S,
    payload: { oldest_event_id: oldest.id, oldest_fired_at: oldest.fired_at, age_seconds: ageS },
  };
}

// ─── Check 3: notification_outbox_stale ──────────────────────────
/**
 * Counts notification_outbox rows in 'pending' state older than thresholds.
 */
export async function checkNotificationOutboxStale(supabase: SupabaseClient): Promise<CheckResult> {
  const nowMs = Date.now();
  const breachCutoff = new Date(nowMs - OUTBOX_STALE_BREACH_S * 1000).toISOString();
  const warnCutoff = new Date(nowMs - OUTBOX_STALE_WARN_S * 1000).toISOString();

  const { count: breachCount, error: breachErr } = await supabase
    .from("notification_outbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", breachCutoff);

  if (breachErr) {
    return {
      check_name: "notification_outbox_stale",
      status: "warn",
      metric: 0,
      threshold: OUTBOX_STALE_BREACH_S,
      payload: { error: breachErr.message },
    };
  }

  if ((breachCount ?? 0) > 0) {
    return {
      check_name: "notification_outbox_stale",
      status: "breach",
      metric: breachCount ?? 0,
      threshold: OUTBOX_STALE_BREACH_S,
      payload: { stale_count: breachCount, threshold_seconds: OUTBOX_STALE_BREACH_S },
    };
  }

  const { count: warnCount } = await supabase
    .from("notification_outbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", warnCutoff);

  if ((warnCount ?? 0) > 0) {
    return {
      check_name: "notification_outbox_stale",
      status: "warn",
      metric: warnCount ?? 0,
      threshold: OUTBOX_STALE_BREACH_S,
      payload: { stale_count: warnCount, threshold_seconds: OUTBOX_STALE_WARN_S },
    };
  }

  return {
    check_name: "notification_outbox_stale",
    status: "ok",
    metric: 0,
    threshold: OUTBOX_STALE_BREACH_S,
    payload: { note: "no stale outbox rows" },
  };
}

// ─── Check 4: ticket_SLA ─────────────────────────────────────────
/**
 * Counts engine_state rows with process_id='desk_query_ticket' past their
 * SLA deadline stored in context->>'sla_due_at'.
 *
 * Phase 0d.1 note: desk_query_ticket process may not yet exist (Phase B4
 * helpdesk pending). The query returns 0 safely if no matching rows exist.
 */
export async function checkTicketSLA(supabase: SupabaseClient): Promise<CheckResult> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("engine_state")
    .select("id, context")
    .eq("process_id", "desk_query_ticket")
    .not("status", "in", '("complete","failed","cancelled")')
    .lt("context->>'sla_due_at'", now);

  if (error) {
    return {
      check_name: "ticket_SLA",
      status: "warn",
      metric: 0,
      threshold: TICKET_SLA_BREACH_COUNT,
      payload: {
        error: error.message,
        note: "desk_query_ticket process may not exist yet (Phase B4)",
      },
    };
  }

  const count = data?.length ?? 0;

  if (count >= TICKET_SLA_BREACH_COUNT) {
    return {
      check_name: "ticket_SLA",
      status: "breach",
      metric: count,
      threshold: TICKET_SLA_BREACH_COUNT,
      payload: { overdue_ticket_ids: data?.map((r) => r.id) ?? [], overdue_count: count },
    };
  }

  return {
    check_name: "ticket_SLA",
    status: "ok",
    metric: count,
    threshold: TICKET_SLA_BREACH_COUNT,
    payload: { overdue_count: count },
  };
}

// ─── Check 5: D6_orphan_deviations ───────────────────────────────
/**
 * Counts deviation rows in 'open' status older than DEVIATION_ORPHAN_BREACH_H.
 * AUTO-FIX policy: policy executor bumps priority to signal urgency.
 */
export async function checkD6OrphanDeviations(supabase: SupabaseClient): Promise<CheckResult> {
  const nowMs = Date.now();
  const breachCutoff = new Date(nowMs - DEVIATION_ORPHAN_BREACH_H * 60 * 60 * 1000).toISOString();
  const warnCutoff = new Date(nowMs - DEVIATION_ORPHAN_WARN_H * 60 * 60 * 1000).toISOString();

  const { data: breachData, error: breachErr } = await supabase
    .from("deviation")
    .select("deviation_id, workspace_id, domain, severity, created_at")
    .eq("status", "open")
    .lt("created_at", breachCutoff);

  if (breachErr) {
    return {
      check_name: "D6_orphan_deviations",
      status: "warn",
      metric: 0,
      threshold: DEVIATION_ORPHAN_BREACH_H,
      payload: { error: breachErr.message },
    };
  }

  if ((breachData?.length ?? 0) > 0) {
    return {
      check_name: "D6_orphan_deviations",
      status: "breach",
      metric: breachData?.length ?? 0,
      threshold: DEVIATION_ORPHAN_BREACH_H,
      payload: {
        orphan_ids: breachData?.map((r) => r.deviation_id) ?? [],
        orphan_count: breachData?.length ?? 0,
        oldest_created_at: breachData?.[0]?.created_at,
        workspace_ids: [...new Set(breachData?.map((r) => r.workspace_id) ?? [])],
      },
    };
  }

  const { data: warnData } = await supabase
    .from("deviation")
    .select("deviation_id")
    .eq("status", "open")
    .lt("created_at", warnCutoff);

  if ((warnData?.length ?? 0) > 0) {
    return {
      check_name: "D6_orphan_deviations",
      status: "warn",
      metric: warnData?.length ?? 0,
      threshold: DEVIATION_ORPHAN_BREACH_H,
      payload: { orphan_count: warnData?.length, threshold_hours: DEVIATION_ORPHAN_WARN_H },
    };
  }

  return {
    check_name: "D6_orphan_deviations",
    status: "ok",
    metric: 0,
    threshold: DEVIATION_ORPHAN_BREACH_H,
    payload: { note: "no orphan deviations" },
  };
}

// ─── Run all 5 checks ────────────────────────────────────────────
/**
 * Runs all five checks in independent try/catch blocks.
 * A failure in one check MUST NOT block the others.
 */
export async function runAllChecks(
  supabase: SupabaseClient,
  pulseId: string,
): Promise<CheckResult[]> {
  const checks = [
    () => checkEmitPulseReceived(supabase, pulseId),
    () => checkEngineEventLag(supabase),
    () => checkNotificationOutboxStale(supabase),
    () => checkTicketSLA(supabase),
    () => checkD6OrphanDeviations(supabase),
  ];

  const results: CheckResult[] = [];

  for (const check of checks) {
    try {
      const result = await check();
      results.push(result);
    } catch (err) {
      results.push({
        check_name: "unknown",
        status: "warn",
        metric: 0,
        threshold: 0,
        payload: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  return results;
}
