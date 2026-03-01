// ============================================
// tracking.tsx
// Client-side tracking components for use in both
// Server Components and Client Components.
//
// PageTracker: renders nothing, fires a page_view event
// TrackedCta: a Link wrapper that fires cta_click on click
//
// Server Components can't call hooks directly, so these
// small client components bridge that gap.
//
// Connected to: hooks/useTracking.ts (tracking logic)
// ============================================

"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { usePageTracking, useTrackCta } from "../hooks/useTracking";

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
        // Preserve any existing onClick handler
        if (typeof props.onClick === "function") {
          props.onClick(e);
        }
      }}
    />
  );
}
