import type { SmartoutEvent } from "./registry";
import { EVENT_ROUTING } from "./registry";
import { sendToPostHogClient, sendToPostHogServer } from "./providers/posthog";
import { logToStdout } from "./providers/logger";
import { writeActivityTrail } from "./providers/activity-trail";
import { sendToEngine } from "./providers/engine-event";

// ─── Shared Telemetry Event Router ──────────────────────────────
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

  // 1. Analytics
  if (routing.destinations.includes("posthog")) {
    if (isServer) {
      promises.push(sendToPostHogServer(event));
    } else {
      // Technically, Posthog-js is a synchronous firing function internally.
      // But we push it purely to align the array typing.
      sendToPostHogClient(event);
    }
  }

  // 2. Logging
  if (routing.destinations.includes("logger")) {
    if (isServer) {
      logToStdout(event, routing);
    } else {
      // Option to relay frontend logger constraints via Bacon later.
      // eslint-disable-next-line no-console
      console.info(`[local.logger] Client side invocation of Log event:`, event);
    }
  }

  // 3. Activity Trail
  if (routing.destinations.includes("activity_trail") && isServer) {
    promises.push(writeActivityTrail(event, routing));
  }

  // 4. Engine Event (server-side only — dispatches to engine-dispatch Edge Function)
  if (routing.destinations.includes("engine_event") && isServer) {
    promises.push(sendToEngine(event));
  }

  // Let errors fly through silently. Analytics pipelines shouldn't crash standard operations.
  await Promise.allSettled(promises);
}
