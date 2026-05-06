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

/**
 * Build the engine-dispatch payload from a telemetry event.
 * Exported for contract testing (see __tests__/engine-event-contract.test.ts).
 * Shape MUST match what supabase/functions/engine-dispatch/index.ts reads:
 * engine-dispatch reads `payload.entity_id` and `payload.entity_type`
 * directly from the top of the payload to populate engine_state.
 *
 * ADR-0161 / double-spawn fix: promote event.entity (entity_type, entity_id)
 * to the top of the payload so dispatcher can bind engine_state.entity_type /
 * entity_id correctly without a second direct-insert from the call site.
 * Also promotes assignee_id (from properties.assignee_id or
 * properties.assignee_profile_id) so the dispatcher can set
 * engine_state.assignee_id in the same transaction.
 */
export function buildPayload(event: SmartoutEvent) {
  const eventType = toDotNotation(event.event);

  // Promote entity fields from event.entity (if present) to the top of
  // the payload so engine-dispatch can read them without destructuring
  // into nested properties. entity in the outer event is the semantic
  // subject; entity_type/entity_id at payload root drive the DB column.
  const entityFields: Record<string, string | undefined> = {};
  const ev = event as unknown as Record<string, unknown>;
  if (ev.entity && typeof ev.entity === "object") {
    const entity = ev.entity as { entity_type?: string; entity_id?: string };
    if (entity.entity_type) entityFields.entity_type = entity.entity_type;
    if (entity.entity_id) entityFields.entity_id = entity.entity_id;
  }

  // Promote assignee_id for process-spawn context. Properties may carry
  // either assignee_id or assignee_profile_id (two naming conventions
  // exist across the codebase). Emit the canonical `assignee_id` key.
  const props = ((ev.properties as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const assigneeId =
    (props.assignee_id as string | undefined) ?? (props.assignee_profile_id as string | undefined);
  const assigneeField = assigneeId ? { assignee_id: assigneeId } : {};

  return {
    event_type: eventType,
    workspace_id: event.workspace_id || null, // Convert "" to null, pass null through
    payload: {
      actor_id: event.actor_id,
      correlation_id: event.correlation_id,
      ...entityFields,
      ...assigneeField,
      ...props,
    },
    idempotency_key: `${eventType}-${event.workspace_id ?? "no-ws"}-${event.timestamp ?? new Date().toISOString()}`,
  };
}

/**
 * Check whether the browser has Supabase auth cookies.
 * If no auth token cookie exists, the user isn't authenticated and
 * engine-dispatch will 401 — skip the request entirely to avoid
 * wasted auth calls and console errors.
 */
function hasAuthCookie(): boolean {
  // Use globalThis key-lookup instead of `typeof document` so this file compiles
  // under ES2022 lib (no DOM required — avoids TS2584 "Cannot find name 'document'").
  const _g = globalThis as Record<string, unknown>;
  if (_g["document"] === undefined) return false;
  const doc = _g["document"] as { cookie: string };
  return doc.cookie.split(";").some((c) => c.trim().includes("-auth-token"));
}

/**
 * Dispatches a telemetry event to the engine-dispatch Edge Function.
 * Server-side: calls Edge Function directly via service role.
 * Client-side: relays through /api/engine-dispatch route.
 */
export async function sendToEngine(event: SmartoutEvent): Promise<void> {
  const body = buildPayload(event);

  const _g = globalThis as Record<string, unknown>;
  if (_g["window"] !== undefined) {
    // Client-side: relay through Next.js API route
    // Skip in development — engine-dispatch Edge Function may not be running
    if (process.env.NODE_ENV === "development") return;
    // Skip when unauthenticated — prevents 401 storms and wasted Supabase auth calls
    if (!hasAuthCookie()) return;
    try {
      const res = await fetch("/api/engine-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(`[telemetry.engine_event] Relay failed: ${res.status}`);
      }
    } catch {
      console.error("[telemetry.engine_event] Relay error");
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
