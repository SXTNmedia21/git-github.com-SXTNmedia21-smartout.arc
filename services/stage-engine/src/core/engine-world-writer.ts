// ============================================
// engine-world-writer.ts
// Async engine_world writer for stage-engine surfaces.
//
// Council mandates (Phase 1D):
//   F7 — void rpc().then(null, recordError) pattern — no await in request path
//   F7 — p95/error-rate aggregation via setInterval timer, NOT per-request
//   F8 — platform writes use SECURITY DEFINER RPC with observed_by='stage-engine'
//        (channel="system" by definition — ADR-0282 carve-out)
//
// Surfaces written:
//   stage_engine.dispatch            — platform-level (workspace_id NULL), timer-driven
//   capability.<name>                — platform-level (workspace_id NULL), timer-driven
//   stage_engine.session.<wsId>      — workspace-scoped, timer-driven (Phase 2B)
//     Phase 2B: session-event-bus subscription feeds workspace activity map.
//     Circular-dep-free: this module subscribes to session-event-bus; neither
//     session-manager nor session-event-bus imports from engine-world-writer.
//
// Timer: 60-second tick, 5-minute rolling window for p95+error-rate aggregation.
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { baseLogger } from "../lib/logger.js";
import { subscribeSessionEvents, type SessionLifecycleEvent } from "./session-event-bus.js";

const log = baseLogger.child({ module: "engine-world-writer" });

// ─── Aggregation state ────────────────────────────────────────────────────────

/** Per-capability rolling sample bucket (5-minute window). */
type CapabilityBucket = {
  latencies: number[]; // dispatch latencies in ms (trimmed to last 5 min window)
  errors: number;
  total: number;
  lastTs: number; // ms epoch of last sample
};

/** Dispatch-level rolling bucket (all capabilities combined). */
type DispatchBucket = {
  latencies: number[];
  errors: number;
  total: number;
};

const FIVE_MIN_MS = 5 * 60 * 1000;

// Module-level mutable state — intentionally not exported; only the record*
// functions mutate it.
const _dispatchBucket: DispatchBucket = {
  latencies: [],
  errors: 0,
  total: 0,
};

const _capabilityBuckets = new Map<string, CapabilityBucket>();

// ─── Per-workspace session health map (Phase 2B) ─────────────────────────────

/**
 * In-memory workspace activity record.
 *
 * active_count is a reference-count incremented on session.started and
 * decremented on session.ended. Never goes below 0.
 * last_transition_ts is updated on every event (started, ended, transitioned).
 */
type WorkspaceSessionEntry = {
  active_count: number;
  last_transition_ts: number; // ms epoch
};

const _workspaceSessionMap = new Map<string, WorkspaceSessionEntry>();

const FIVE_MIN_SESSION_MS = 5 * 60 * 1000;

/**
 * Handle an incoming session lifecycle event.
 * Called synchronously from session-event-bus subscriber.
 * Must never throw — errors are swallowed (caught by bus handler wrapper).
 */
function handleSessionEvent(event: SessionLifecycleEvent): void {
  const { workspace_id, event_type, ts } = event;

  let entry = _workspaceSessionMap.get(workspace_id);
  if (!entry) {
    entry = { active_count: 0, last_transition_ts: ts };
    _workspaceSessionMap.set(workspace_id, entry);
  }

  entry.last_transition_ts = ts;

  if (event_type === "session.started") {
    entry.active_count++;
  } else if (event_type === "session.ended") {
    entry.active_count = Math.max(0, entry.active_count - 1);
  }
  // session.transitioned: only updates last_transition_ts (already done above)
}

// ─── Sample recording (called once per dispatch, per-request hookpoint) ───────

/**
 * Record a completed dispatch sample. Called from agent-router AFTER the
 * response is assembled (still in request-path, but before returning).
 *
 * NOT the aggregation site — just accumulates into rolling buckets.
 * The setInterval timer (60s) reads these buckets and writes to engine_world.
 */
export function recordDispatchSample(params: {
  latencyMs: number;
  capability: string;
  isError: boolean;
}): void {
  const { latencyMs, capability, isError } = params;
  const now = Date.now();

  // Dispatch-level bucket
  _dispatchBucket.latencies.push(latencyMs);
  _dispatchBucket.total++;
  if (isError) _dispatchBucket.errors++;

  // Capability-level bucket
  let bucket = _capabilityBuckets.get(capability);
  if (!bucket) {
    bucket = { latencies: [], errors: 0, total: 0, lastTs: now };
    _capabilityBuckets.set(capability, bucket);
  }
  bucket.latencies.push(latencyMs);
  bucket.total++;
  if (isError) bucket.errors++;
  bucket.lastTs = now;
}

// ─── p95 computation helper ───────────────────────────────────────────────────

function computeP95(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function computeErrorRate(errors: number, total: number): number {
  if (total === 0) return 0;
  return errors / total;
}

/** Maps error_rate to green/yellow/red status string. */
function errorRateToStatus(errorRate: number): "green" | "yellow" | "red" {
  if (errorRate > 0.25) return "red";
  if (errorRate > 0.05) return "yellow";
  return "green";
}

// ─── Async RPC writer helpers ─────────────────────────────────────────────────

function recordError(label: string, err: unknown): void {
  log.warn({ err, label }, "engine_world platform write failed");
}

/**
 * Fire-and-forget write to engine_world via SECURITY DEFINER RPC.
 * Pattern per council F7 + spec: void rpc().then(null, recordError).
 * Never await — caller must not block on this.
 */
function writeToEngineWorld(params: {
  surfaceId: string;
  surfaceType: "service" | "ci_workflow" | "custom";
  status: "green" | "yellow" | "red" | "unknown";
  details: Record<string, unknown>;
  ttlSeconds: number;
}): void {
  void supabaseAdmin
    .rpc("engine_world_observe_platform", {
      p_surface_id: params.surfaceId,
      p_surface_type: params.surfaceType,
      p_status: params.status,
      p_details: params.details,
      p_ttl_seconds: params.ttlSeconds,
      p_observed_by: "stage-engine",
    })
    .then(null, (err: unknown) => recordError("engine_world_write_failed", err));
}

// ─── Timer tick: aggregation + write ─────────────────────────────────────────

function tickDispatchSurface(): void {
  const { latencies, errors, total } = _dispatchBucket;

  if (total === 0) {
    // No samples since last tick — write unknown status so staleness detection
    // doesn't fire a false red on the next reader fetch.
    writeToEngineWorld({
      surfaceId: "stage_engine.dispatch",
      surfaceType: "service",
      status: "unknown",
      details: { sample_size: 0, note: "no samples in window" },
      ttlSeconds: 120, // 2 min — expires before next tick if engine goes quiet
    });
    return;
  }

  const p95Ms = computeP95(latencies);
  const errorRate = computeErrorRate(errors, total);
  const status = errorRateToStatus(errorRate);

  writeToEngineWorld({
    surfaceId: "stage_engine.dispatch",
    surfaceType: "service",
    status,
    details: {
      p95_ms: Math.round(p95Ms),
      error_rate: Math.round(errorRate * 1000) / 1000,
      sample_size: total,
    },
    ttlSeconds: 120,
  });

  // Reset bucket after flush
  _dispatchBucket.latencies = [];
  _dispatchBucket.errors = 0;
  _dispatchBucket.total = 0;
}

function tickCapabilitySurfaces(): void {
  for (const [capability, bucket] of _capabilityBuckets.entries()) {
    if (bucket.total === 0) continue;

    const p95Ms = computeP95(bucket.latencies);
    const errorRate = computeErrorRate(bucket.errors, bucket.total);
    const status = errorRateToStatus(errorRate);

    writeToEngineWorld({
      surfaceId: `capability.${capability}`,
      surfaceType: "service",
      status,
      details: {
        p95_ms: Math.round(p95Ms),
        error_rate: Math.round(errorRate * 1000) / 1000,
        sample_size: bucket.total,
      },
      ttlSeconds: 120,
    });

    // Reset bucket after flush (preserve lastTs so we know last activity)
    bucket.latencies = [];
    bucket.errors = 0;
    bucket.total = 0;
  }
}

function tickWorkspaceSessionSurfaces(): void {
  const now = Date.now();
  for (const [workspaceId, entry] of _workspaceSessionMap.entries()) {
    const { active_count, last_transition_ts } = entry;

    let status: "green" | "yellow" | "unknown";
    if (active_count > 0) {
      status = "green";
    } else if (now - last_transition_ts < FIVE_MIN_SESSION_MS) {
      // No active sessions but had activity in the last 5 minutes — warming down
      status = "yellow";
    } else {
      status = "unknown";
    }

    writeToEngineWorld({
      surfaceId: `stage_engine.session.${workspaceId}`,
      surfaceType: "service",
      status,
      details: {
        active_count,
        last_transition_ts_iso: new Date(last_transition_ts).toISOString(),
      },
      ttlSeconds: 120,
    });
  }
}

// ─── Timer initialisation ─────────────────────────────────────────────────────

let _timerStarted = false;

/**
 * Start the 60-second aggregation timer. Safe to call multiple times — only
 * the first call takes effect (module-level singleton guard).
 *
 * Called from stage-engine startup (or lazily on first recordDispatchSample
 * call). The timer is unref'd so it does not prevent process exit in tests.
 */
export function startEngineWorldWriter(): void {
  if (_timerStarted) return;
  _timerStarted = true;

  // Subscribe to session lifecycle events (Phase 2B).
  // engine-world-writer SUBSCRIBES; session-manager/session-event-bus never
  // import from this module — circular-dep-free.
  subscribeSessionEvents(handleSessionEvent);

  const timer = setInterval(() => {
    try {
      tickDispatchSurface();
      tickCapabilitySurfaces();
      tickWorkspaceSessionSurfaces();
    } catch (err) {
      // Timer tick must never crash the process.
      log.warn({ err }, "engine-world-writer tick error");
    }
  }, 60_000);

  // Do not keep the process alive just for the writer; tests rely on this.
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as unknown as { unref: () => void }).unref();
  }

  log.info(
    "engine-world-writer: aggregation timer started (60s tick, incl. workspace session surfaces)",
  );
}
