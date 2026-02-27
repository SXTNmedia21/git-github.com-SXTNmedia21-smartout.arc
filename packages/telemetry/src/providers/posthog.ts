// ─── PostHog Client/Server Adapters ──────────────────────

import type { PostHog as PostHogNode } from "posthog-node";
import type { SmartoutEvent } from "../registry";

// 1. CLIENT-SIDE
// Dynamic import avoids bundling posthog-js on the server
export function sendToPostHogClient(event: SmartoutEvent): void {
  if (typeof window === "undefined") return;

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

// 2. SERVER-SIDE (singleton — single cached promise eliminates race conditions)
let _clientPromise: Promise<PostHogNode | null> | null = null;

async function initServerClient(): Promise<PostHogNode | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  const { PostHog } = await import("posthog-node");
  const client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 20,
    flushInterval: 10000,
  });

  // Flush buffered events when event loop drains.
  // Only beforeExit — SIGTERM is owned by Next.js/Vercel and registering it
  // here would suppress default termination, causing the process to hang.
  process.on("beforeExit", () => {
    void client.shutdown();
  });

  return client;
}

function getServerClient(): Promise<PostHogNode | null> {
  if (!_clientPromise) {
    _clientPromise = initServerClient().catch((err) => {
      _clientPromise = null; // Allow retry on next call
      console.error("[telemetry] PostHog server init failed:", err);
      return null;
    });
  }
  return _clientPromise;
}

export async function sendToPostHogServer(event: SmartoutEvent): Promise<void> {
  const client = await getServerClient();
  if (!client) return;

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
}
