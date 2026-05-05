/**
 * _helpers.ts — Shared utilities for Sixten heartbeat E2E specs.
 *
 * What: Admin Supabase client + typed engine_event query helpers used by all
 *       five heartbeat journey specs (J1–J5).
 *
 * Why separate file: avoids repeating the createClient boilerplate in every
 * spec, and gives a single place to change polling constants.
 *
 * Pattern: Playwright `request` fixture for HTTP calls; supabase admin client
 * for DB assertions. No browser context — heartbeat is API-only.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Constants ────────────────────────────────────────────────────

export const WEBHOOK_URL =
  process.env.HEARTBEAT_WEBHOOK_URL ?? "http://127.0.0.1:3060/api/heartbeat/sixten";

/** Max milliseconds to poll for orchestrator to process a pulse. */
export const POLL_TIMEOUT_MS = 30_000;

/** Polling interval between DB checks. */
export const POLL_INTERVAL_MS = 1_000;

// ─── Admin client ─────────────────────────────────────────────────

/**
 * Creates a service-role Supabase client for test DB assertions.
 * Reads env from .env.local (loaded by playwright.config.ts via dotenv).
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Ensure .env.local is populated (run: op run --env-file=.env.template -- pnpm turbo dev).",
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Pulse sender ─────────────────────────────────────────────────

export type PulseBody = {
  cron_run_id?: string;
  scope?: string;
  trigger_source?: string;
  directives?: string[];
  metadata?: Record<string, unknown>;
};

export type PulseResponse = {
  pulse_id: string;
  pulse_at: string;
  scope: string;
  directives: string[];
  received: boolean;
};

/**
 * Sends one pulse POST to the webhook. Returns the parsed response body.
 * Uses `fetch` directly (no Playwright request fixture needed for plain HTTP).
 */
export async function sendPulse(body: PulseBody = {}): Promise<{
  status: number;
  body: PulseResponse;
}> {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const parsed = (await res.json()) as PulseResponse;
  return { status: res.status, body: parsed };
}

// ─── Polling helpers ─────────────────────────────────────────────

type EngineEventRow = {
  id: string;
  event_type: string;
  idempotency_key: string | null;
  payload: Record<string, unknown>;
  fired_at: string;
};

/**
 * Polls engine_event until a row matching `predicate` appears, or until
 * POLL_TIMEOUT_MS is exceeded. Throws on timeout with a descriptive message.
 */
export async function pollEngineEvent(
  db: SupabaseClient,
  predicate: {
    event_type: string;
    idempotency_key?: string;
    payload_match?: Record<string, unknown>;
  },
  label: string,
  timeoutMs = POLL_TIMEOUT_MS,
): Promise<EngineEventRow> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let query = db
      .from("engine_event")
      .select("id, event_type, idempotency_key, payload, fired_at")
      .eq("event_type", predicate.event_type);

    if (predicate.idempotency_key !== undefined) {
      query = query.eq("idempotency_key", predicate.idempotency_key);
    }

    const { data, error } = await query.limit(50);

    if (!error && data && data.length > 0) {
      if (predicate.payload_match) {
        const match = (data as EngineEventRow[]).find((row) =>
          Object.entries(predicate.payload_match!).every(([k, v]) => row.payload[k] === v),
        );
        if (match) return match;
      } else {
        return (data as EngineEventRow[])[0]!;
      }
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(
    `[heartbeat-spec] Timeout waiting for engine_event "${predicate.event_type}" (${label}) ` +
      `after ${timeoutMs}ms. ` +
      `Ensure stage-engine is running with ENABLE_SIXTEN_ORCHESTRATOR=true.`,
  );
}

/**
 * Queries engine_event for all check_result rows belonging to a given pulseId.
 * Does NOT poll — call after the sentinel has already been confirmed.
 */
export async function queryCheckResults(
  db: SupabaseClient,
  pulseId: string,
): Promise<EngineEventRow[]> {
  const { data, error } = await db
    .from("engine_event")
    .select("id, event_type, idempotency_key, payload, fired_at")
    .eq("event_type", "sixten.check_result")
    .contains("payload", { pulse_id: pulseId });

  if (error) {
    throw new Error(`queryCheckResults failed: ${error.message}`);
  }

  return (data ?? []) as EngineEventRow[];
}

/**
 * Counts engine_event rows matching event_type where payload contains
 * the given pulse_id. Used for negative assertions (expecting 0).
 */
export async function countEventsByPulseId(
  db: SupabaseClient,
  eventType: string,
  pulseId: string,
): Promise<number> {
  const { data, error } = await db
    .from("engine_event")
    .select("id")
    .eq("event_type", eventType)
    .contains("payload", { pulse_id: pulseId });

  if (error) return 0;
  return (data ?? []).length;
}

/**
 * Generates a unique cron_run_id for use in idempotency tests.
 * Includes timestamp + random suffix to survive reruns without DB cleanup issues.
 */
export function uniqueCronRunId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
