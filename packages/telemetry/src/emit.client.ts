import type { SmartoutEvent } from "./registry";
import { EVENT_ROUTING } from "./registry";
import { sendToPostHogClient } from "./providers/posthog-client";

// ─── Client-Safe Telemetry Event Router ─────────────────────────
//
// This file is the client bundle entry point. It only imports
// browser-safe providers — no posthog-node, no node:fs.
// Server-only destinations (activity_trail, engine_event) are proxied
// through /api/telemetry which calls server-side emit().

export async function emit(event: SmartoutEvent): Promise<void> {
  const routing = EVENT_ROUTING[event.event];

  if (!routing) {
    console.error(
      `[telemetry] Received unregistered event: "${event.event}". Ignoring emit(). Update registry.ts if this wasn't intended.`,
    );
    return;
  }

  // Client-side event bus — lets any in-app listener (e.g. Botsson) tap into telemetry.
  const _g = globalThis as Record<string, unknown>;
  const win = _g["window"] as { dispatchEvent: (e: Event) => void } | undefined;
  if (win) {
    win.dispatchEvent(new CustomEvent("smartout:telemetry", { detail: event }));
  }

  // 1. Analytics (client-side PostHog)
  if (routing.destinations.includes("posthog")) {
    sendToPostHogClient(event);
  }

  // 2. Logging (console only on client)
  if (routing.destinations.includes("logger")) {
    // eslint-disable-next-line no-console
    console.info(`[local.logger] Client side invocation of Log event:`, event);
  }

  // 3+4. Server-only destinations (activity_trail, engine_event) — proxy through API
  // The /api/telemetry route calls server-side emit() which handles both destinations.
  const needsServerProxy =
    routing.destinations.includes("activity_trail") ||
    routing.destinations.includes("engine_event");

  if (needsServerProxy) {
    fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {
      console.warn(`[telemetry] Failed to proxy "${event.event}" to server`);
    });
  }
}
