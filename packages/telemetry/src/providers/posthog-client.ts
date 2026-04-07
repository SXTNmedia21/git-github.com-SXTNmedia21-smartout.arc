// ─── PostHog Client-Side Adapter ──────────────────────
//
// Separated from posthog-server.ts so that importing this
// file never pulls posthog-node (which uses node:fs) into
// the browser bundle.

import type { SmartoutEvent } from "../registry";

export function sendToPostHogClient(event: SmartoutEvent): void {
  // Use globalThis key-lookup so this file compiles under ES2022 lib (no DOM required).
  if ((globalThis as Record<string, unknown>)["window"] === undefined) return;

  void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.capture(event.event, {
        ...event.properties,
        workspace_id: event.workspace_id,
        $set: { last_active_workspace: event.workspace_id },
      });
    })
    .catch(() => {
      /* PostHog not available (ad blocker, network error) */
    });
}
