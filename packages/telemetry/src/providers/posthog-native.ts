// ─── PostHog React Native Adapter ──────────────────────
//
// Separated from posthog-client.ts (browser) and posthog.ts (node)
// so that React Native bundles use the native PostHog SDK.
// Uses require() because posthog-react-native may not be installed
// in every consumer — graceful degradation is required.

import type { SmartoutEvent } from "../registry";

export function capturePostHogNative(event: SmartoutEvent): void {
  try {
    // posthog-react-native exposes a singleton client via getClient()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PostHogModule = require("posthog-react-native");
    const client = PostHogModule.default?.getClient?.() ?? PostHogModule.getClient?.();
    if (!client) return;

    client.capture(event.event, {
      workspace_id: event.workspace_id,
      actor_id: event.actor_id,
      ...event.properties,
    });
  } catch {
    // Silent fail — analytics should never crash the app
  }
}
