import { useCallback, useEffect, useRef } from "react";
import type { SmartoutEvent } from "../registry";
import { EVENT_ROUTING } from "../registry";
import { sendToPostHogClient } from "../providers/posthog";

const MOCK_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";
const MOCK_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

type TrackFn = <E extends SmartoutEvent>(event: E["event"], properties: E["properties"]) => void;

/**
 * Track telemetry events.
 *
 * @param workspaceId - Real workspace ID from auth context. Falls back to mock if omitted (deprecated).
 * @param profileId - Real profile ID from auth context. Falls back to mock if omitted (deprecated).
 */
export function useTrack(workspaceId?: string, profileId?: string): { track: TrackFn } {
  const warnedRef = useRef(false);

  useEffect(() => {
    if (
      (!workspaceId || !profileId) &&
      !warnedRef.current &&
      process.env.NODE_ENV === "development"
    ) {
      console.warn(
        "[telemetry] useTrack() called without workspaceId/profileId — using mock IDs. " +
          "Pass real IDs from auth context to enable production telemetry.",
      );
      warnedRef.current = true;
    }
  }, [workspaceId, profileId]);

  const wsId = workspaceId ?? MOCK_WORKSPACE_ID;
  const actorId = profileId ?? MOCK_PROFILE_ID;

  const track: TrackFn = useCallback(
    (event, properties) => {
      const fullEvent = {
        event,
        properties,
        workspace_id: wsId,
        actor_id: actorId,
        timestamp: new Date().toISOString(),
      } as SmartoutEvent;

      const routing = EVENT_ROUTING[event];
      if (!routing) return;

      if (routing.destinations.includes("posthog")) {
        sendToPostHogClient(fullEvent);
      }

      if (
        routing.destinations.includes("activity_trail") ||
        routing.destinations.includes("logger")
      ) {
        const payload = JSON.stringify(fullEvent);
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon("/api/telemetry", payload);
        } else {
          void fetch("/api/telemetry", {
            method: "POST",
            body: payload,
            keepalive: true,
          });
        }
      }
    },
    [wsId, actorId],
  );

  return { track };
}
