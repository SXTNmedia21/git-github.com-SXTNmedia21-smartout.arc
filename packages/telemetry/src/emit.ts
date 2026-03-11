import type { SmartoutEvent } from "./registry";
import { EVENT_ROUTING } from "./registry";
import { sendToPostHogClient } from "./providers/posthog-client";

// ─── Shared Telemetry Event Router ──────────────────────────────
//
// Server-only providers (posthog-node, activity-trail, engine-event)
// are loaded via dynamic import so they are never bundled into the
// client chunk.  Turbopack / Next.js 16 Edge Runtime rejects any
// static import that transitively touches `node:fs` or service-role
// credentials.
export async function emit(event: SmartoutEvent): Promise<void> {
  const routing = EVENT_ROUTING[event.event];

  if (!routing) {
    console.error(
      `[telemetry] Received unregistered event: "${event.event}". Ignoring emit(). Update registry.ts if this wasn't intended.`,
    );
    return;
  }

  // Fire requests asynchronously as an array of promises
  const promises: Promise<void | unknown>[] = [];

  const isServer = typeof window === "undefined";

  // 0. Client-side event bus — lets any in-app listener (e.g. WalkAi) tap into telemetry
  if (!isServer) {
    window.dispatchEvent(new CustomEvent("smartout:telemetry", { detail: event }));
  }

  // 1. Analytics
  if (routing.destinations.includes("posthog")) {
    if (isServer) {
      const { sendToPostHogServer } = await import(/* webpackIgnore: true */ "./providers/posthog");
      promises.push(sendToPostHogServer(event));
    } else {
      sendToPostHogClient(event);
    }
  }

  // 2. Logging
  if (routing.destinations.includes("logger")) {
    if (isServer) {
      const { logToStdout } = await import(/* webpackIgnore: true */ "./providers/logger");
      logToStdout(event, routing);
    } else {
      // eslint-disable-next-line no-console
      console.info(`[local.logger] Client side invocation of Log event:`, event);
    }
  }

  // 3. Activity Trail (server-side only)
  if (routing.destinations.includes("activity_trail") && isServer) {
    const { writeActivityTrail } = await import(
      /* webpackIgnore: true */ "./providers/activity-trail"
    );
    promises.push(writeActivityTrail(event, routing));
  }

  // 4. Engine Event
  if (routing.destinations.includes("engine_event")) {
    const { sendToEngine } = await import(/* webpackIgnore: true */ "./providers/engine-event");
    promises.push(sendToEngine(event));
  }

  // Let errors fly through silently. Analytics pipelines shouldn't crash standard operations.
  await Promise.allSettled(promises);
}
