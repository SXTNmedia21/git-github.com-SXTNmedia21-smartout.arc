// ============================================
// useTracking.ts
// Client-side tracking hooks for the landing page.
// Sends anonymous events to POST /api/track which
// writes them to the landing_event table in Supabase.
//
// Two exports:
//   usePageTracking() — call once at the top of the page,
//                       fires a page_view event once per browser session
//   useTrackCta()     — returns a trackCta(label) function,
//                       call it in onClick handlers on primary CTA buttons
//
// Why separate hooks: page tracking fires automatically (side effect),
// CTA tracking is intentional (user action). Keeps concerns clear.
//
// Connected to: apps/landing/src/app/page.tsx (usePageTracking)
//               apps/landing/src/components/landing/Variant*.tsx (useTrackCta)
//               apps/landing/src/app/api/track/route.ts (receives events)
// ============================================

"use client";

import { useEffect, useCallback } from "react";

/** Key in sessionStorage — set once per browser session to avoid duplicates. */
const SESSION_TRACKED_KEY = "smartout_page_tracked";

/** Key in sessionStorage — the anonymous session ID for this browser tab. */
const SESSION_ID_KEY = "smartout_session_id";

/** Key in localStorage — matches the variant store in landing-variant.ts. */
const VARIANT_STORAGE_KEY = "landing_variant";

/**
 * Generates a random session ID using the Web Crypto API.
 * Format: 16 hex bytes = 32 char string. No external dependency needed.
 */
function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Reads or creates the anonymous session ID from sessionStorage.
 * The same ID is reused across all events in a single browser tab session.
 */
function getOrCreateSessionId(): string {
  const existing = getSessionStorageItem(SESSION_ID_KEY);
  if (existing) return existing;
  const id = generateSessionId();
  setSessionStorageItem(SESSION_ID_KEY, id);
  return id;
}

/**
 * Safely reads a value from sessionStorage.
 * Returns undefined when storage is unavailable (private mode/blocked storage).
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
 * Returns false when storage is unavailable (private mode/blocked storage).
 */
function setSessionStorageItem(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Returns the currently active landing variant, or undefined if not set. */
function getCurrentVariant(): string | undefined {
  try {
    return localStorage.getItem(VARIANT_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Posts a tracking event to the server-side /api/track route.
 * Fire-and-forget — errors are silently swallowed so tracking
 * never blocks or breaks the visitor experience.
 */
async function postEvent(payload: {
  event_type: string;
  variant?: string;
  session_id?: string;
  referrer?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Tracking errors must never reach the user — silently ignore
  }
}

/**
 * Fires a single page_view event once per browser session.
 * Re-renders do NOT fire additional events (guarded by sessionStorage flag).
 *
 * Call this hook once in the top-level page component.
 */
export function usePageTracking(): void {
  useEffect(() => {
    // Guard: only track once per browser tab session
    if (getSessionStorageItem(SESSION_TRACKED_KEY)) return;
    setSessionStorageItem(SESSION_TRACKED_KEY, "1");

    const session_id = getOrCreateSessionId();
    const variant = getCurrentVariant();
    const referrer = document.referrer || undefined;

    void postEvent({ event_type: "page_view", variant, session_id, referrer });
  }, []);
  // Empty deps: runs once after first render, never again
}

/**
 * Returns a stable `trackCta(label)` function for CTA click tracking.
 * Add `onClick={() => trackCta("label")}` to primary CTA buttons.
 *
 * The label should be the visible button text (e.g., "Kom i gang", "Prøv gratis").
 * Navigation continues normally — this is fire-and-forget.
 */
export function useTrackCta(): (label: string) => void {
  return useCallback((label: string) => {
    // Read session context at click time (not at hook init time)
    const session_id = getOrCreateSessionId();
    const variant = getCurrentVariant();

    void postEvent({
      event_type: "cta_click",
      variant,
      session_id,
      details: { label },
    });
  }, []);
  // useCallback with empty deps: function reference is stable across re-renders
}
