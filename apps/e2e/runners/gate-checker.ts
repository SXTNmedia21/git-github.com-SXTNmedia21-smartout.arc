/**
 * Gate Checker — polls DB records, UI elements, or URL patterns until
 * they match expected state or timeout.
 *
 * Used by the protocol runner between journey steps: each step has a
 * gate that must pass before the runner advances to the next step.
 *
 * M3.5 (ADR-0178): types migrated from `../protocols/schema::Gate` to
 * `@smartout/journey-ir::JourneyGate` so the runner drives verification
 * from the IR directly — no `ProtocolDefinition` dependency.
 */

import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyGate, SpeedMultiplier } from "@smartout/journey-ir";
import type { GateResult } from "../protocols/types";

// Default timeouts (ms) when the IR omits optional timeout fields. These
// mirror the Zod defaults that the legacy v1 protocol schema applied.
const DEFAULT_DB_RECORD_TIMEOUT_MS = 10_000;
const DEFAULT_UI_STATE_TIMEOUT_MS = 5_000;
const DEFAULT_URL_MATCH_TIMEOUT_MS = 10_000;
const DEFAULT_TELEMETRY_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_INTERVAL_MS = 500;
const DEFAULT_TELEMETRY_RETRY_INTERVAL_MS = 1_000;

// ---------------------------------------------------------------------------
// Internal helpers — one per gate type
// ---------------------------------------------------------------------------

/** Query a Supabase table and verify the row matches expectations. */
async function checkDbRecord(
  gate: Extract<JourneyGate, { type: "db_record" }>,
  supabase: SupabaseClient,
): Promise<GateResult> {
  let query = supabase.from(gate.table).select("*");

  for (const [key, value] of Object.entries(gate.where)) {
    query = query.eq(key, value as string);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { passed: false, error: `DB query failed: ${error.message}` };
  }

  // Handle existence checks
  if ("exists" in gate.expect) {
    const expectExists = gate.expect.exists as boolean;
    if (expectExists && data === null) {
      return { passed: false, data: null, error: "Expected record to exist but found none" };
    }
    if (!expectExists && data !== null) {
      return {
        passed: false,
        data: data as Record<string, unknown>,
        error: "Expected record NOT to exist but found one",
      };
    }
    return { passed: true, data: data as Record<string, unknown> | null };
  }

  // No row returned but we expected field matches
  if (data === null) {
    return { passed: false, data: null, error: "No record found" };
  }

  // Verify each expected field matches the row
  const row = data as Record<string, unknown>;
  for (const [key, expected] of Object.entries(gate.expect)) {
    if (row[key] !== expected) {
      return {
        passed: false,
        data: row,
        error: `Field "${key}": expected ${JSON.stringify(expected)}, got ${JSON.stringify(row[key])}`,
      };
    }
  }

  return { passed: true, data: row };
}

/** Check whether a UI element (by data-testid) is visible or hidden. */
async function checkUiState(
  gate: Extract<JourneyGate, { type: "ui_state" }>,
  page: Page,
): Promise<GateResult> {
  const isVisible = await page
    .getByTestId(gate.testid)
    .isVisible({ timeout: 200 })
    .catch(() => false);

  // `visible` defaults to true when the IR omits it (matches v1 Zod default).
  const expectedVisible = gate.visible ?? true;

  if (isVisible === expectedVisible) {
    return { passed: true, data: { testid: gate.testid, visible: isVisible } };
  }

  return {
    passed: false,
    error: `Expected testid "${gate.testid}" visible=${expectedVisible}, got visible=${isVisible}`,
  };
}

/** Check whether a telemetry event has been emitted to activity_trail. */
async function checkTelemetryEvent(
  gate: Extract<JourneyGate, { type: "telemetry_event" }>,
  supabase: SupabaseClient,
): Promise<GateResult> {
  let query = supabase
    .from("activity_trail")
    .select("activity_trail_id, event, actor_id, created_at")
    .eq("event", gate.event_name)
    .order("created_at", { ascending: false })
    .limit(1);

  if (gate.actor_id) {
    query = query.eq("actor_id", gate.actor_id);
  }

  if (gate.since) {
    query = query.gte("created_at", gate.since);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { passed: false, error: `Telemetry query failed: ${error.message}` };
  }

  if (data) {
    return { passed: true, data: data as Record<string, unknown> };
  }

  return {
    passed: false,
    error: `Telemetry event "${gate.event_name}" not found in activity_trail`,
  };
}

/** Test whether the current browser URL matches a regex pattern. */
async function checkUrlMatch(
  gate: Extract<JourneyGate, { type: "url_match" }>,
  page: Page,
): Promise<GateResult> {
  const url = page.url();
  const matches = new RegExp(gate.pattern).test(url);

  if (matches) {
    return { passed: true, data: { url, pattern: gate.pattern } };
  }

  return {
    passed: false,
    error: `URL "${url}" does not match pattern "${gate.pattern}"`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Poll a gate condition until it passes or the timeout expires.
 *
 * The gate is a discriminated union — the checker dispatches to the
 * correct internal helper based on `gate.type`. Between attempts it
 * sleeps for the configured retry interval (db_record uses its own
 * `retry_interval_ms`; other gate types default to 500 ms).
 *
 * @returns `{ passed: true, data }` when the condition is met,
 *          `{ passed: false, error }` when the timeout is reached.
 */
export async function checkGate(
  gate: JourneyGate,
  page: Page,
  supabase: SupabaseClient,
  speedMultiplier: SpeedMultiplier = { settle: 1, retry: 1, timeout: 1 },
): Promise<GateResult> {
  // Optional timeouts on `JourneyGate` — fall back to per-type defaults that
  // mirror the legacy v1 protocol Zod defaults. Scale by speedMultiplier.timeout.
  const timeoutMs =
    (gate.timeout_ms ??
      (gate.type === "db_record"
        ? DEFAULT_DB_RECORD_TIMEOUT_MS
        : gate.type === "ui_state"
          ? DEFAULT_UI_STATE_TIMEOUT_MS
          : gate.type === "url_match"
            ? DEFAULT_URL_MATCH_TIMEOUT_MS
            : DEFAULT_TELEMETRY_TIMEOUT_MS)) * speedMultiplier.timeout;
  const deadline = Date.now() + timeoutMs;
  const interval =
    (gate.type === "db_record"
      ? (gate.retry_interval_ms ?? DEFAULT_RETRY_INTERVAL_MS)
      : gate.type === "telemetry_event"
        ? (gate.retry_interval_ms ?? DEFAULT_TELEMETRY_RETRY_INTERVAL_MS)
        : DEFAULT_RETRY_INTERVAL_MS) * speedMultiplier.retry;

  while (Date.now() < deadline) {
    let result: GateResult;

    switch (gate.type) {
      case "db_record":
        result = await checkDbRecord(gate, supabase);
        break;
      case "ui_state":
        result = await checkUiState(gate, page);
        break;
      case "url_match":
        result = await checkUrlMatch(gate, page);
        break;
      case "telemetry_event":
        result = await checkTelemetryEvent(gate, supabase);
        break;
    }

    if (result.passed) {
      return result;
    }

    // Don't sleep if we've already exceeded the deadline
    if (Date.now() >= deadline) {
      return { passed: false, error: result.error ?? "Gate timed out" };
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  // Deadline exceeded before the first check could run (timeout_ms = 0)
  return { passed: false, error: "Gate timed out before first check" };
}
