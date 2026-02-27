import { SmartoutEvent, EVENT_ROUTING } from "./registry";
import { sendToPostHogClient, sendToPostHogServer } from "./providers/posthog";
import { logToStdout } from "./providers/logger";
import { writeActivityTrail } from "./providers/activity-trail";

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
      console.info(
        `[local.logger] Client side invocation of Log event:`,
        event,
      );
    }
  }

  // 3. Activity Trail
  if (routing.destinations.includes("activity_trail") && isServer) {
    promises.push(writeActivityTrail(event, routing));
  }

  // Let errors fly through silently. Analytics pipelines shouldn't crash standard operations.
  await Promise.allSettled(promises);
}
