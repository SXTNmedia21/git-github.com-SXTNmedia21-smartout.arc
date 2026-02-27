// ─── PostHog Client/Server Adapters ──────────────────────

import { SmartoutEvent } from "../registry";

// 1. CLIENT-SIDE
export function sendToPostHogClient(event: SmartoutEvent): void {
  if (typeof window === "undefined") return;

  // Assumes initialized posthog-js available globally
  // via the root `<PHProvider>`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posthog = (window as any).posthog;
  if (!posthog) return;

  posthog.capture(event.event, {
    ...event.properties,
    workspace_id: event.workspace_id,
    $set: { last_active_workspace: event.workspace_id },
  });
}

// 2. SERVER-SIDE
export async function sendToPostHogServer(event: SmartoutEvent): Promise<void> {
  const { PostHog } = await import("posthog-node");
  // Enforce runtime variables (loaded through NextJS + Env)
  const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1, // Extremely important for stateless Edge Functions
    flushInterval: 0,
  });

  client.capture({
    distinctId: event.actor_id,
    event: event.event,
    properties: {
      ...event.properties,
      workspace_id: event.workspace_id,
      correlation_id: event.correlation_id,
    },
    groups: { workspace: event.workspace_id },
  });

  await client.shutdown();
}
