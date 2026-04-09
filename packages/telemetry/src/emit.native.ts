// React Native global — true in dev builds, false in production
declare const __DEV__: boolean;

import type { SmartoutEvent } from "./registry";
import { EVENT_ROUTING } from "./registry";
import { capturePostHogNative } from "./providers/posthog-native";

// ─── React Native Telemetry Event Router ──────────────────────
//
// This file is the React Native entry point, selected via the
// "react-native" condition in package.json exports.
//
// Key differences from emit.client.ts (browser):
//   - Uses posthog-react-native instead of posthog-js
//   - No CustomEvent / window.dispatchEvent (no DOM in RN)
//   - No fetch("/api/telemetry") — proxies through Supabase Edge Function
//   - Logs via console.log only in __DEV__ mode

export async function emit(event: SmartoutEvent): Promise<void> {
  const routing = EVENT_ROUTING[event.event];

  if (!routing) {
    if (__DEV__) {
      console.error(`[telemetry] Unregistered event: "${event.event}". Update registry.ts.`);
    }
    return;
  }

  const promises: Promise<void | unknown>[] = [];

  // 1. Analytics (PostHog React Native SDK)
  if (routing.destinations.includes("posthog")) {
    capturePostHogNative(event);
  }

  // 2. Logging (dev-only console output)
  if (routing.destinations.includes("logger") && __DEV__) {
    console.log(`[telemetry] ${event.event}`, event.properties);
  }

  // 3+4. Server-only destinations — proxy through Supabase Edge Function
  // since React Native can't call /api/telemetry (that's a Next.js route)
  const needsProxy =
    routing.destinations.includes("activity_trail") ||
    routing.destinations.includes("engine_event");

  if (needsProxy) {
    promises.push(
      proxyToEdgeFunction(event, routing.destinations).catch(() => {
        if (__DEV__) {
          console.warn(`[telemetry] Failed to proxy "${event.event}" to edge function`);
        }
      }),
    );
  }

  // 5. Notifications — proxy through the same edge function
  if (routing.destinations.includes("notifications")) {
    promises.push(
      proxyToEdgeFunction(event, ["notifications"]).catch(() => {
        // Silent fail — notification delivery is best-effort
      }),
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Proxies telemetry events to the Supabase Edge Function telemetry-proxy.
 * This avoids depending on a Next.js API route (/api/telemetry) that
 * doesn't exist in the React Native runtime.
 */
async function proxyToEdgeFunction(event: SmartoutEvent, destinations: string[]): Promise<void> {
  // Dynamic import to avoid pulling supabase into the telemetry package bundle
  // at the top level — consumers provide the client at runtime.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require("@/lib/supabase") as {
      supabase: {
        functions: {
          invoke: (name: string, options: { body: unknown }) => Promise<{ error: unknown }>;
        };
      };
    };

    await supabase.functions.invoke("telemetry-proxy", {
      body: { event, destinations },
    });
  } catch {
    // If supabase client is unavailable, silently fail
  }
}
