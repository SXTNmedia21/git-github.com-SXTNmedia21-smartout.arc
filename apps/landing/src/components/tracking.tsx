// ============================================
// tracking.tsx
// Client-side tracking components for use in both
// Server Components and Client Components.
//
// FullTracker: renders nothing, activates ALL tracking
//              (page views, scroll depth, clicks, session lifecycle)
// PageTracker: renders nothing, fires a page_view event only
//              (kept for backward compat on simple redirect pages)
// TrackedCta: a Link wrapper that fires cta_click on click
//
// Server Components can't call hooks directly, so these
// small client components bridge that gap.
//
// Connected to: hooks/useTracking.ts (page view + CTA tracking)
//               hooks/useScrollTracking.ts (scroll depth)
//               hooks/useClickTracking.ts (click tracking)
//               hooks/useSessionLifecycle.ts (heartbeat + session end)
// ============================================

"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { usePageTracking, useTrackCta, getCurrentVariant } from "../hooks/useTracking";
import { useScrollTracking } from "../hooks/useScrollTracking";
import { useClickTracking } from "../hooks/useClickTracking";
import { useSessionLifecycle } from "../hooks/useSessionLifecycle";
import { useConsent } from "./cookie-consent";

/**
 * Invisible component that fires a page_view event once per session.
 * Drop this into any page (server or client) to enable page tracking.
 * Renders nothing — zero layout impact.
 */
export function PageTracker() {
  usePageTracking();
  return null;
}

/**
 * Full tracking component that activates all tracking hooks:
 * page views, scroll depth, click tracking, and session lifecycle.
 * Drop this into any main landing page to enable comprehensive tracking.
 * Renders nothing — zero layout impact.
 */
export function FullTracker() {
  const { categories, hasConsented } = useConsent();
  const analyticsAllowed = hasConsented && categories.analytics;

  // Hooks must be called unconditionally (React rules),
  // but the underlying tracking hooks should check consent internally.
  // For now, we conditionally render to prevent hook side-effects.
  if (!analyticsAllowed) return null;

  return <FullTrackerInner />;
}

function FullTrackerInner() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  return null;
}

/**
 * A Link component that also fires a cta_click tracking event.
 * Use this for CTA buttons in Server Components where you can't
 * call useTrackCta() directly.
 *
 * @param label - The visible button text sent as the event label
 * @param props - All standard Next.js Link props
 */
export function TrackedCta({ label, ...props }: ComponentProps<typeof Link> & { label: string }) {
  const trackCta = useTrackCta();

  return (
    <Link
      {...props}
      onClick={(e) => {
        trackCta(label);
        if (typeof props.onClick === "function") {
          props.onClick(e);
        }
      }}
    />
  );
}

/**
 * A wrapper around Next.js Link that used to append ?v= variant flags.
 * Deprecated since Variant M is now the default app-wide.
 * We just return a standard Link to avoid Hydration Mismatch issues.
 */
export function VariantLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} />;
}
