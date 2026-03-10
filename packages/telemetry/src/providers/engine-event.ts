// ─── Engine Event Provider ────────────────────────────────
// Maps telemetry events to engine_event dispatch calls.
// Server-side only — engine-dispatch is an Edge Function
// that requires service role credentials.

import { createClient } from "@supabase/supabase-js";
import type { SmartoutEvent } from "../registry";

/**
 * Converts space-separated event names to dot notation.
 * "shift published"  → "shift.published"
 * "session hook_fired" → "session.hook_fired"
 * "reconciliation admin_action" → "reconciliation.admin_action"
 */
function toDotNotation(eventName: string): string {
  return eventName.replace(/ /g, ".");
}

/** Lazy singleton — avoids creating client until first use */
let _client: ReturnType<typeof createClient> | null = null;

function getServiceClient(): ReturnType<typeof createClient> {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("[telemetry.engine_event] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  _client = createClient(url, key);
  return _client;
}

/** Build the engine-dispatch payload from a telemetry event */
function buildPayload(event: SmartoutEvent) {
  const eventType = toDotNotation(event.event);
  return {
    event_type: eventType,
    workspace_id: event.workspace_id,
    payload: {
      actor_id: event.actor_id,
      correlation_id: event.correlation_id,
      ...event.properties,
    },
    idempotency_key: `${eventType}-${event.workspace_id}-${event.timestamp ?? new Date().toISOString()}`,
  };
}

/**
 * Dispatches a telemetry event to the engine-dispatch Edge Function.
 * Server-side: calls Edge Function directly via service role.
 * Client-side: relays through /api/engine-dispatch route.
 */
export async function sendToEngine(event: SmartoutEvent): Promise<void> {
  const body = buildPayload(event);

  if (typeof window !== "undefined") {
    // Client-side: relay through Next.js API route
    try {
      const res = await fetch("/api/engine-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(`[telemetry.engine_event] Relay failed: ${res.status}`);
      }
    } catch (err) {
      console.error("[telemetry.engine_event] Relay error:", err);
    }
    return;
  }

  // Server-side: call Edge Function directly
  const supabase = getServiceClient();
  const { error } = await supabase.functions.invoke("engine-dispatch", { body });

  if (error) {
    console.error(`[telemetry.engine_event] Dispatch failed for ${event.event}:`, error);
  }
}
