// ============================================
// useScrollTracking.ts
// Tracks scroll depth at 25%, 50%, 75%, and 100% thresholds.
// Each threshold fires once per session (guarded by sessionStorage).
// Uses requestAnimationFrame for scroll throttling to avoid
// performance impact on the visitor experience.
//
// One export:
//   useScrollTracking() — call once at the top of the page,
//                         listens for scroll events and reports depth
//
// Connected to: apps/landing/src/app/page.tsx (scroll depth tracking)
//               apps/landing/src/hooks/useTracking.ts (postEvent, session/variant)
//               apps/landing/src/lib/visitor-cookie.ts (visitor ID)
//               apps/landing/src/app/api/track/route.ts (receives events)
// ============================================

"use client";

import { useEffect } from "react";
import { postEvent, getOrCreateSessionId, getCurrentVariant } from "./useTracking";
import { getOrCreateVisitorId } from "../lib/visitor-cookie";

/** Scroll depth thresholds to track (percentage). */
const THRESHOLDS = [25, 50, 75, 100] as const;

/** Prefix for sessionStorage keys that guard one-time threshold fires. */
const SCROLL_KEY_PREFIX = "smartout_scroll_";

/**
 * Safely reads a value from sessionStorage.
 * Returns undefined when storage is unavailable.
 */
function getSessionStorageItem(key: string): string | undefined {
  try {
    return sessionStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Safely writes a value to sessionStorage.
 */
function setSessionStorageItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable — threshold will re-fire, acceptable degradation
  }
}

/**
 * Calculates the current scroll depth as a percentage (0–100).
 */
function getScrollPercent(): number {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  if (docHeight <= 0) return 100;
  return Math.min(100, Math.round((scrollTop / docHeight) * 100));
}

/**
 * Tracks scroll depth at 25%, 50%, 75%, and 100% thresholds.
 * Each threshold fires exactly once per browser session.
 * Uses requestAnimationFrame to throttle scroll event processing.
 *
 * Call this hook once in the top-level page component.
 */
export function useScrollTracking(): void {
  useEffect(() => {
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        ticking = false;
        const percent = getScrollPercent();

        for (const threshold of THRESHOLDS) {
          if (percent < threshold) continue;

          const key = `${SCROLL_KEY_PREFIX}${threshold}`;
          if (getSessionStorageItem(key)) continue;

          // Mark as fired before sending to prevent duplicates
          setSessionStorageItem(key, "1");

          const session_id = getOrCreateSessionId();
          const visitor_id = getOrCreateVisitorId();
          const variant = getCurrentVariant();

          void postEvent({
            event_type: "scroll_depth",
            session_id,
            visitor_id,
            variant,
            details: { percent: threshold },
          });
        }
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    // Check initial scroll position (page may already be scrolled on mount)
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  // Empty deps: registers listener once, cleans up on unmount
}
