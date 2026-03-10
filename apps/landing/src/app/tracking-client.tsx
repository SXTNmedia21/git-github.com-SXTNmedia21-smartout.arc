// ============================================
// tracking-client.tsx
// Client-only tracking bridge for the server-rendered landing page.
// Why: server pages cannot call tracking hooks directly, but tracking still
// needs the resolved server variant slug as context.
// ============================================

"use client";

import { usePageTracking, useTrackingVariantContext } from "../hooks/useTracking";
import { useScrollTracking } from "../hooks/useScrollTracking";
import { useClickTracking } from "../hooks/useClickTracking";
import { useSessionLifecycle } from "../hooks/useSessionLifecycle";

type LandingTrackerProps = {
  variant: string;
};

/**
 * Enables the full landing tracking suite with resolved variant context.
 * Why: ensures all events use the server-resolved slug instead of stale
 * localStorage values.
 *
 * @returns Null (no UI output).
 */
export function LandingTracker({ variant }: LandingTrackerProps) {
  useTrackingVariantContext(variant);

  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();

  return null;
}
