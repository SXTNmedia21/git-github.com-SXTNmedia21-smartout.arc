// ============================================
// useSessionLifecycle.ts
// Session heartbeat and session-end tracking.
// Two responsibilities:
//   1. Heartbeat: sends session_heartbeat every 30s with time on page + scroll %
//   2. Session end: on visibilitychange (hidden) and beforeunload, sends
//      session_end via navigator.sendBeacon with final session stats
//
// One export:
//   useSessionLifecycle() — call once at the top of the page
//
// Connected to: apps/landing/src/app/page.tsx (session lifecycle)
//               apps/landing/src/hooks/useTracking.ts (postEvent, beaconEvent, session/variant)
//               apps/landing/src/lib/visitor-cookie.ts (visitor ID)
//               apps/landing/src/app/api/track/route.ts (receives events)
// ============================================

"use client";

import { useEffect, useRef } from "react";
import {
  postEvent,
  beaconEvent,
  getOrCreateSessionId,
  getCurrentVariant,
} from "./useTracking";
import { getOrCreateVisitorId } from "../lib/visitor-cookie";

/** Heartbeat interval in milliseconds (30 seconds). */
const HEARTBEAT_INTERVAL_MS = 30_000;

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
 * Manages session heartbeat and end-of-session tracking.
 *
 * - Heartbeat every 30s: sends session_heartbeat with timeOnPage + scrollPercent
 * - Session end: on tab hide or page unload, sends session_end via sendBeacon
 *   with final stats (timeOnPage, maxScroll, clickCount, pageCount)
 *
 * Tracks maxScroll and clickCount internally via refs.
 *
 * Call this hook once in the top-level page component.
 */
export function useSessionLifecycle(): void {
  const startTime = useRef(Date.now());
  const maxScroll = useRef(0);
  const clickCount = useRef(0);
  const sessionEndSent = useRef(false);

  useEffect(() => {
    // --- Internal trackers ---

    /** Update max scroll on every scroll event. */
    function onScroll() {
      const current = getScrollPercent();
      if (current > maxScroll.current) {
        maxScroll.current = current;
      }
    }

    /** Count all clicks on the document. */
    function onClick() {
      clickCount.current += 1;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, { passive: true });

    // Initialize max scroll from current position
    onScroll();

    // --- Heartbeat ---

    const heartbeatTimer = setInterval(() => {
      const session_id = getOrCreateSessionId();
      const visitor_id = getOrCreateVisitorId();
      const variant = getCurrentVariant();
      const timeOnPage = Math.round((Date.now() - startTime.current) / 1000);
      const scrollPercent = getScrollPercent();

      void postEvent({
        event_type: "session_heartbeat",
        session_id,
        visitor_id,
        variant,
        details: { timeOnPage, scrollPercent },
      });
    }, HEARTBEAT_INTERVAL_MS);

    // --- Session end ---

    /** Builds and sends the session_end payload via sendBeacon. */
    function sendSessionEnd() {
      // Guard: only send once per page lifecycle
      if (sessionEndSent.current) return;
      sessionEndSent.current = true;

      const session_id = getOrCreateSessionId();
      const visitor_id = getOrCreateVisitorId();
      const variant = getCurrentVariant();
      const timeOnPage = Math.round((Date.now() - startTime.current) / 1000);

      beaconEvent({
        event_type: "session_end",
        session_id,
        visitor_id,
        variant,
        details: {
          timeOnPage,
          maxScroll: maxScroll.current,
          clickCount: clickCount.current,
          pageCount: 1, // Single-page landing, always 1
        },
      });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        sendSessionEnd();
      }
    }

    function onBeforeUnload() {
      sendSessionEnd();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    // --- Cleanup ---

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);
  // Empty deps: registers all listeners once, cleans up on unmount
}
