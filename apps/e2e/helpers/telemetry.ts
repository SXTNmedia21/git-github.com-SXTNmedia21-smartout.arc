import { expect } from "@playwright/test";
import { supabase } from "./seed";

/**
 * Verifies a telemetry event was emitted to the activity_trail table.
 *
 * Usage:
 *   await expectTelemetryEvent("website created", workspaceId);
 *   await expectTelemetryEvent("department created", workspaceId, { since: timestamp });
 */
export async function expectTelemetryEvent(
  eventName: string,
  workspaceId: string,
  options: {
    /** Only check events after this ISO timestamp */
    since?: string;
    /** Entity type to match (e.g. "website", "department") */
    entityType?: string;
    /** Maximum time to wait for the event (default: 5000ms) */
    timeout?: number;
  } = {},
) {
  const { since, entityType, timeout = 5000 } = options;
  const start = Date.now();

  // Poll until event appears or timeout
  while (Date.now() - start < timeout) {
    let query = supabase
      .from("activity_trail")
      .select("id, event, entity_type, created_at")
      .eq("workspace_id", workspaceId)
      .eq("event", eventName);

    if (since) {
      query = query.gte("created_at", since);
    }
    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    const { data, error } = await query.limit(1);
    if (!error && data && data.length > 0) {
      return data[0]; // Event found
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  // Final check — fail with details
  const { data: recent } = await supabase
    .from("activity_trail")
    .select("event, entity_type, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentEvents = recent?.map((e) => e.event).join(", ") ?? "none";
  expect(
    null,
    `Telemetry event "${eventName}" not found within ${timeout}ms. Recent events: [${recentEvents}]`,
  ).not.toBeNull();
}

/**
 * Verifies a telemetry event was NOT emitted (negative assertion).
 */
export async function expectNoTelemetryEvent(
  eventName: string,
  workspaceId: string,
  options: { since?: string } = {},
) {
  const { since } = options;

  let query = supabase
    .from("activity_trail")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("event", eventName);

  if (since) {
    query = query.gte("created_at", since);
  }

  const { count } = await query;
  expect(count, `Expected no "${eventName}" event but found ${count}`).toBe(0);
}

/**
 * Returns the current timestamp for use as a "since" marker.
 * Call before the action, then pass to expectTelemetryEvent.
 */
export function telemetryTimestamp(): string {
  return new Date().toISOString();
}
