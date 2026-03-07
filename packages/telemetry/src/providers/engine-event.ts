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
    throw new Error(
      "[telemetry.engine_event] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  _client = createClient(url, key);
  return _client;
}

/**
 * Dispatches a telemetry event to the engine-dispatch Edge Function.
 * Only runs server-side — silently returns on client.
 */
export async function sendToEngine(event: SmartoutEvent): Promise<void> {
  // Guard: never run in the browser
  if (typeof window !== "undefined") return;

  const eventType = toDotNotation(event.event);
  const idempotencyKey = `${eventType}-${event.workspace_id}-${event.timestamp ?? new Date().toISOString()}`;

  const supabase = getServiceClient();

  const { error } = await supabase.functions.invoke("engine-dispatch", {
    body: {
      event_type: eventType,
      workspace_id: event.workspace_id,
      payload: {
        actor_id: event.actor_id,
        correlation_id: event.correlation_id,
        ...event.properties,
      },
      idempotency_key: idempotencyKey,
    },
  });

  if (error) {
    console.error(
      `[telemetry.engine_event] Dispatch failed for ${event.event}:`,
      error,
    );
  }
}
