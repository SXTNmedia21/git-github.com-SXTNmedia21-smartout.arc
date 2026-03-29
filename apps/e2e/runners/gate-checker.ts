/**
 * Gate Checker — polls DB records, UI elements, or URL patterns until
 * they match expected state or timeout.
 *
 * Used by the protocol runner between journey steps: each step has a
 * gate that must pass before the runner advances to the next step.
 */

import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Gate } from "../protocols/schema";
import type { GateResult } from "../protocols/types";

// ---------------------------------------------------------------------------
// Internal helpers — one per gate type
// ---------------------------------------------------------------------------

/** Query a Supabase table and verify the row matches expectations. */
async function checkDbRecord(
  gate: Extract<Gate, { type: "db_record" }>,
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
  gate: Extract<Gate, { type: "ui_state" }>,
  page: Page,
): Promise<GateResult> {
  const isVisible = await page
    .getByTestId(gate.testid)
    .isVisible({ timeout: 200 })
    .catch(() => false);

  if (isVisible === gate.visible) {
    return { passed: true, data: { testid: gate.testid, visible: isVisible } };
  }

  return {
    passed: false,
    error: `Expected testid "${gate.testid}" visible=${gate.visible}, got visible=${isVisible}`,
  };
}

/** Test whether the current browser URL matches a regex pattern. */
async function checkUrlMatch(
  gate: Extract<Gate, { type: "url_match" }>,
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
  gate: Gate,
  page: Page,
  supabase: SupabaseClient,
): Promise<GateResult> {
  const deadline = Date.now() + gate.timeout_ms;
  const interval = gate.type === "db_record" ? gate.retry_interval_ms : 500;

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
