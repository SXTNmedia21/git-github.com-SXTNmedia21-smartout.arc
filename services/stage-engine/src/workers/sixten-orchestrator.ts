// ============================================
// sixten-orchestrator.ts
// Phase 0d.1 — Sixten Orchestrator Handler
//
// What: Polling worker that picks up `sixten.pulse_received` engine_event
//       rows and runs 5 prioritized health checks per Sixten design doc.
//
// Architecture choice (why polling, not Edge Function):
//   The existing pattern in this service (mission-pool-slot, guardian-evaluator,
//   calendar-guardian) is setInterval-based polling against Supabase with the
//   service-role client. The heartbeat design's 5-minute cadence aligns well
//   with this model. An Edge Function alternative would require a separate
//   Supabase trigger + cold-start latency + no shared state with the running
//   pg client pool. The polling worker reuses supabaseAdmin already in scope,
//   keeps failure contained to this process, and can be disabled via env flag.
//
// Idempotency (two layers):
//   1. Per-pulse: before processing a pulse, insert a "sixten.pulse_processed"
//      engine_event with idempotency_key = `pulse_processed_${pulseId}`.
//      If that key already exists, Supabase's unique constraint rejects the
//      insert and we skip processing. We use ON CONFLICT DO NOTHING via
//      the Supabase client upsert.
//   2. Per-check: each check writes its own engine_event with
//      idempotency_key = `${pulseId}_${check_name}` so re-runs (e.g. from
//      a restart mid-batch) don't duplicate check events.
//
// Policy matrix (per Sixten design):
//   LOG     (always)  → emit sixten.check_result engine_event
//   NUDGE   (warn)    → emit sixten.nudge engine_event for downstream
//   AUTO-FIX (breach + D6_orphan_deviations only) → bump deviation priority
//   ESKALER (breach + non-D6) → emit sixten.escalation engine_event
//
// Gap note:
//   engine_event has no processed_at column (Gap B5 note). Idempotency
//   is enforced via idempotency_key uniqueness on the pulse_processed row.
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { baseLogger } from "../lib/logger.js";
import { emit, nonEmpty } from "@smartout/telemetry";
import { runAllChecks } from "./sixten-checks.js";
import type { CheckResult } from "./sixten-checks.js";

// ─── Constants ───────────────────────────────────────────────────

/** Platform system actor — no real profile behind it. */
const SYSTEM_ACTOR_ID = nonEmpty("00000000-0000-0000-0000-000000000001", "system_actor_id");

/** Poll every 60s looking for unprocessed pulses. Much faster than pulse
 *  cadence (5 min) so we catch missed pulses promptly. */
const POLL_INTERVAL_MS = 60_000;

/** Look back 15 min for unprocessed pulses to avoid re-processing old ones. */
const PULSE_LOOKBACK_MS = 15 * 60 * 1000;

// ─── Module state ────────────────────────────────────────────────
let pollInterval: NodeJS.Timeout | null = null;
let isRunning = false;

// ─── Idempotency guard ───────────────────────────────────────────

/**
 * Attempt to claim a pulse for processing by inserting a sentinel row.
 * Returns true if this process should handle the pulse (claimed it),
 * false if already processed by another instance or this run.
 *
 * Uses Supabase upsert with ignoreDuplicates to map to ON CONFLICT DO NOTHING.
 */
async function claimPulse(pulseId: string): Promise<boolean> {
  const idempotencyKey = `pulse_processed_${pulseId}`;

  const { error } = await supabaseAdmin.from("engine_event").insert({
    event_type: "sixten.pulse_processing_claimed",
    workspace_id: null,
    idempotency_key: idempotencyKey,
    payload: {
      pulse_id: pulseId,
      claimed_at: new Date().toISOString(),
    },
  });

  if (error) {
    // Unique constraint violation = already claimed (idempotent skip)
    if (error.code === "23505") {
      baseLogger.debug(
        { pulse_id: pulseId },
        "[sixten-orchestrator] pulse already claimed — skipping",
      );
      return false;
    }
    // Other errors: log but proceed (fail-open so we don't drop pulses on transient DB errors)
    baseLogger.warn(
      { pulse_id: pulseId, err: error },
      "[sixten-orchestrator] claim insert error — proceeding anyway",
    );
    return true;
  }

  return true;
}

// ─── Check idempotency key ────────────────────────────────────────

/**
 * Returns the idempotency key for a per-check event row.
 * Prevents duplicate check events on re-run within same pulse.
 */
function checkIdempotencyKey(pulseId: string, checkName: string): string {
  return `${pulseId}_${checkName}`;
}

// ─── Policy executor ─────────────────────────────────────────────

type PolicyAction = "LOG" | "NUDGE" | "AUTO_FIX" | "ESKALER";

function policyActionsFor(result: CheckResult): PolicyAction[] {
  const actions: PolicyAction[] = ["LOG"]; // always

  if (result.status === "ok") return actions;

  if (result.status === "warn") {
    actions.push("NUDGE");
    return actions;
  }

  // breach
  if (result.check_name === "D6_orphan_deviations") {
    actions.push("AUTO_FIX");
    actions.push("ESKALER");
  } else {
    actions.push("NUDGE");
    actions.push("ESKALER");
  }

  return actions;
}

/**
 * Write a per-check engine_event for LOG policy.
 * Idempotency key prevents duplicate rows on re-run.
 * Also emits sixten.check_breach telemetry when status === 'breach'.
 */
async function executeLog(pulseId: string, result: CheckResult): Promise<void> {
  await supabaseAdmin.from("engine_event").insert({
    event_type: "sixten.check_result",
    workspace_id: null,
    idempotency_key: checkIdempotencyKey(pulseId, result.check_name),
    payload: {
      pulse_id: pulseId,
      check_name: result.check_name,
      status: result.status,
      metric: result.metric,
      threshold: result.threshold,
      check_payload: result.payload,
    },
  });

  if (result.status === "breach") {
    await emitCheckBreach(pulseId, result);
  }
}

/**
 * Write a nudge engine_event for downstream handlers (NUDGE policy).
 */
async function executeNudge(pulseId: string, result: CheckResult): Promise<void> {
  await supabaseAdmin.from("engine_event").insert({
    event_type: "sixten.nudge",
    workspace_id: null,
    idempotency_key: checkIdempotencyKey(pulseId, `${result.check_name}_nudge`),
    payload: {
      pulse_id: pulseId,
      check_name: result.check_name,
      metric: result.metric,
      threshold: result.threshold,
      nudge_reason: `${result.check_name} at ${result.status}: ${result.metric} vs threshold ${result.threshold}`,
    },
  });
}

/**
 * AUTO-FIX: for D6_orphan_deviations breach, bump priority on orphaned rows.
 * Deviation table has no priority column — we add a subcategory tag instead
 * to flag urgency without schema migration (Phase 0d.1 constraint: no new tables/columns).
 *
 * Practical effect: updates description to flag as "sixten_escalated" so
 * managers see it surfaced. Future: use a priority column once schema lands.
 */
async function executeAutoFix(pulseId: string, result: CheckResult): Promise<void> {
  if (result.check_name !== "D6_orphan_deviations") return;

  const orphanIds = result.payload.orphan_ids as string[] | undefined;
  if (!orphanIds || orphanIds.length === 0) return;

  // Batch update: mark subcategory = 'sixten_orphan_escalated' on orphaned rows
  // Use individual updates to avoid triggering RLS issues with service role on batch
  for (const deviationId of orphanIds) {
    const { error } = await supabaseAdmin
      .from("deviation")
      .update({
        subcategory: "sixten_orphan_escalated",
        // Note: updated_at not in schema — deviation table uses timestamps
      })
      .eq("deviation_id", deviationId)
      .eq("status", "open"); // guard: only update still-open rows

    if (error) {
      baseLogger.warn(
        { deviation_id: deviationId, err: error },
        "[sixten-orchestrator] auto-fix update failed",
      );
    }
  }

  baseLogger.info(
    { pulse_id: pulseId, orphan_count: orphanIds.length },
    "[sixten-orchestrator] AUTO-FIX: flagged orphan deviations",
  );
}

/**
 * Emit sixten.check_breach telemetry for breach-status checks.
 * Called from executeLog when status === 'breach' so breaches
 * get both the LOG row (engine_event direct insert) AND a typed telemetry event.
 */
async function emitCheckBreach(pulseId: string, result: CheckResult): Promise<void> {
  await emit({
    event: "sixten check_breach",
    workspace_id: null,
    actor_id: SYSTEM_ACTOR_ID,
    correlation_id: pulseId,
    properties: {
      pulse_id: pulseId,
      check_name: result.check_name,
      metric: result.metric,
      threshold: result.threshold,
    },
  });
}

/**
 * ESKALER: emit sixten.escalation telemetry event.
 */
async function executeEskalering(pulseId: string, result: CheckResult): Promise<void> {
  await emit({
    event: "sixten escalation",
    workspace_id: null,
    actor_id: SYSTEM_ACTOR_ID,
    correlation_id: pulseId,
    properties: {
      pulse_id: pulseId,
      check_name: result.check_name,
      escalation_reason: `${result.check_name} breach: metric=${result.metric} threshold=${result.threshold}`,
    },
  });
}

/**
 * Execute all policy actions for a single check result.
 * Errors in any action are caught and logged — they MUST NOT block other actions.
 */
async function executePolicies(pulseId: string, result: CheckResult): Promise<void> {
  const actions = policyActionsFor(result);

  for (const action of actions) {
    try {
      switch (action) {
        case "LOG":
          await executeLog(pulseId, result);
          break;
        case "NUDGE":
          await executeNudge(pulseId, result);
          break;
        case "AUTO_FIX":
          await executeAutoFix(pulseId, result);
          break;
        case "ESKALER":
          await executeEskalering(pulseId, result);
          break;
      }
    } catch (err) {
      baseLogger.warn(
        { pulse_id: pulseId, check_name: result.check_name, action, err },
        "[sixten-orchestrator] policy action failed (non-blocking)",
      );
    }
  }
}

// ─── Single pulse processor ──────────────────────────────────────

async function processPulse(pulseId: string): Promise<void> {
  const startMs = Date.now();

  // Idempotency: claim this pulse or skip
  const claimed = await claimPulse(pulseId);
  if (!claimed) return;

  baseLogger.info({ pulse_id: pulseId }, "[sixten-orchestrator] processing pulse");

  // Run all 5 checks
  const results = await runAllChecks(supabaseAdmin, pulseId);

  // Execute policies for each result (errors isolated per result)
  for (const result of results) {
    await executePolicies(pulseId, result);
  }

  const durationMs = Date.now() - startMs;
  const breaches = results.filter((r) => r.status === "breach").length;

  // Emit pulse_processed summary telemetry
  try {
    await emit({
      event: "sixten pulse_processed",
      workspace_id: null,
      actor_id: SYSTEM_ACTOR_ID,
      correlation_id: pulseId,
      properties: {
        pulse_id: pulseId,
        checks_run: results.length,
        breaches,
        duration_ms: durationMs,
      },
    });
  } catch (err) {
    baseLogger.warn(
      { pulse_id: pulseId, err },
      "[sixten-orchestrator] pulse_processed emit failed (non-blocking)",
    );
  }

  baseLogger.info(
    { pulse_id: pulseId, checks_run: results.length, breaches, duration_ms: durationMs },
    "[sixten-orchestrator] pulse processed",
  );
}

// ─── Polling loop ────────────────────────────────────────────────

async function pollForPulses(): Promise<void> {
  if (isRunning) {
    baseLogger.debug("[sixten-orchestrator] poll skipped — previous run still active");
    return;
  }
  isRunning = true;

  try {
    const lookbackCutoff = new Date(Date.now() - PULSE_LOOKBACK_MS).toISOString();

    // Fetch recent pulse_received events — unprocessed ones will not have
    // a corresponding pulse_processing_claimed row.
    const { data: pulseEvents, error } = await supabaseAdmin
      .from("engine_event")
      .select("id, payload, fired_at, idempotency_key")
      .eq("event_type", "sixten.pulse_received")
      .gte("fired_at", lookbackCutoff)
      .order("fired_at", { ascending: true });

    if (error) {
      baseLogger.warn({ err: error }, "[sixten-orchestrator] poll query failed");
      return;
    }

    if (!pulseEvents || pulseEvents.length === 0) return;

    // Check which pulses are already claimed by querying for their sentinel rows
    const pulseIds = pulseEvents
      .map((e) => {
        const p = e.payload as Record<string, unknown>;
        return typeof p.pulse_id === "string" ? p.pulse_id : null;
      })
      .filter((id): id is string => id !== null);

    if (pulseIds.length === 0) return;

    const claimedKeys = pulseIds.map((id) => `pulse_processed_${id}`);

    const { data: claimedRows } = await supabaseAdmin
      .from("engine_event")
      .select("idempotency_key")
      .eq("event_type", "sixten.pulse_processing_claimed")
      .in("idempotency_key", claimedKeys);

    const claimedSet = new Set(claimedRows?.map((r) => r.idempotency_key as string) ?? []);

    for (const pulseId of pulseIds) {
      const key = `pulse_processed_${pulseId}`;
      if (!claimedSet.has(key)) {
        // Process this unclaimed pulse — errors isolated per pulse
        try {
          await processPulse(pulseId);
        } catch (err) {
          baseLogger.error(
            { pulse_id: pulseId, err },
            "[sixten-orchestrator] pulse processing error",
          );
        }
      }
    }
  } finally {
    isRunning = false;
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────

export function startSixtenOrchestrator(): void {
  if (pollInterval) {
    baseLogger.warn("[sixten-orchestrator] already started");
    return;
  }

  baseLogger.info(
    { poll_interval_ms: POLL_INTERVAL_MS },
    "[sixten-orchestrator] starting — polling for sixten.pulse_received events",
  );

  // Immediate first run
  void pollForPulses();

  pollInterval = setInterval(() => {
    void pollForPulses();
  }, POLL_INTERVAL_MS);
}

export function stopSixtenOrchestrator(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    baseLogger.info("[sixten-orchestrator] stopped");
  }
}
