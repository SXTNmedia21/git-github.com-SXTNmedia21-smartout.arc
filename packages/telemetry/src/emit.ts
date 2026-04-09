import type { SmartoutEvent } from "./registry";
import { EVENT_ROUTING } from "./registry";

// ─── Server Telemetry Event Router ──────────────────────────────
//
// This file only runs in react-server context (RSC, API routes,
// Server Actions). Client components get emit.client.ts via
// conditional exports in package.json (see ADR-0084).
//
// All providers are loaded via dynamic import for tree-shaking.

export async function emit(event: SmartoutEvent): Promise<void> {
  const routing = EVENT_ROUTING[event.event];

  if (!routing) {
    console.error(
      `[telemetry] Received unregistered event: "${event.event}". Ignoring emit(). Update registry.ts if this wasn't intended.`,
    );
    return;
  }

  const promises: Promise<void | unknown>[] = [];

  // 1. Analytics (server-side PostHog via posthog-node)
  if (routing.destinations.includes("posthog")) {
    const { sendToPostHogServer } = await import("./providers/posthog");
    promises.push(sendToPostHogServer(event));
  }

  // 2. Logging
  if (routing.destinations.includes("logger")) {
    const { logToStdout } = await import("./providers/logger");
    logToStdout(event, routing);
  }

  // 3. Activity Trail (audit DB table)
  if (routing.destinations.includes("activity_trail")) {
    const { writeActivityTrail } = await import("./providers/activity-trail");
    promises.push(writeActivityTrail(event, routing));
  }

  // 4. Engine Event (workflow triggers via engine-dispatch)
  if (routing.destinations.includes("engine_event")) {
    const { sendToEngine } = await import("./providers/engine-event");
    promises.push(sendToEngine(event));
  }

  // Let errors fly through silently. Analytics pipelines shouldn't crash standard operations.
  await Promise.allSettled(promises);
}
