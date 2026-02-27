import { useCallback } from "react";
import { SmartoutEvent, EVENT_ROUTING } from "../registry";
import { sendToPostHogClient } from "../providers/posthog";

// Placeholder standard context payload for the UI.
// Will integrate tightly with proper `@smartout/supabase` later on.
const MOCK_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";
const MOCK_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

export function useTrack() {
  const workspaceId = MOCK_WORKSPACE_ID;
  const profileId = MOCK_PROFILE_ID;

  const track = useCallback(
    // We infer typing to exclusively select properties valid for that particular event!
    <E extends SmartoutEvent>(
      event: E["event"],
      properties: E["properties"],
    ) => {
      const fullEvent = {
        event,
        properties,
        workspace_id: workspaceId, // automatically attach state values
        actor_id: profileId,
        timestamp: new Date().toISOString(),
      } as SmartoutEvent;

      const routing = EVENT_ROUTING[event];
      if (!routing) return;

      // Send directly over Web Socket or HTTP depending on Posthog Client
      if (routing.destinations.includes("posthog")) {
        sendToPostHogClient(fullEvent);
      }

      // Crucial: Activity Trails generated strictly from UI interaction
      // (Like an audit for some generic button or interaction not triggering Database triggers)
      // Send over `navigator.sendBeacon` for zero-overhead background tracking even when closing tab/routing abruptly.
      if (
        routing.destinations.includes("activity_trail") ||
        routing.destinations.includes("logger")
      ) {
        if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
          navigator.sendBeacon(
            "/api/telemetry", // NextJS receiving route to trigger backend telemetry process!
            JSON.stringify(fullEvent),
          );
        } else {
          fetch("/api/telemetry", {
            method: "POST",
            body: JSON.stringify(fullEvent),
            keepalive: true,
            headers: { "Content-Type": "application/json" },
          }).catch(console.error);
        }
      }
    },
    [workspaceId, profileId],
  );

  return { track };
}
