// ============================================
// useClickTracking.ts
// Document-level click listener for general click tracking.
// Captures clicks on interactive elements (a, button, [role=button],
// input, select) and sends event details to the tracking API.
// Debounced at 200ms to avoid flooding.
//
// One export:
//   useClickTracking() — call once at the top of the page,
//                         attaches a document-level click listener
//
// Connected to: apps/landing/src/app/page.tsx (click tracking)
//               apps/landing/src/hooks/useTracking.ts (postEvent, session/variant)
//               apps/landing/src/lib/visitor-cookie.ts (visitor ID)
//               apps/landing/src/app/api/track/route.ts (receives events)
// ============================================

"use client";

import { useEffect, useRef } from "react";
import { postEvent, getOrCreateSessionId, getCurrentVariant } from "./useTracking";
import { getOrCreateVisitorId } from "../lib/visitor-cookie";

/** Selector for interactive elements we want to track clicks on. */
const INTERACTIVE_SELECTOR = "a, button, [role=button], input, select";

/** Minimum time between click events in milliseconds. */
const DEBOUNCE_MS = 200;

/** Maximum length for captured inner text. */
const MAX_TEXT_LENGTH = 100;

/**
 * Builds a CSS selector path for an element, walking up to 3 ancestors.
 * Format: "body > div.hero > section > button.cta"
 */
function buildSelectorPath(element: Element, maxDepth: number = 3): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < maxDepth) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === "string") {
      const classes = current.className
        .trim()
        .split(/\s+/)
        .slice(0, 2) // Limit to 2 classes to keep it readable
        .join(".");
      if (classes) {
        selector += `.${classes}`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
    depth++;
  }

  return parts.join(" > ");
}

/**
 * Truncates text to a maximum length, adding ellipsis if needed.
 */
function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}\u2026`;
}

/**
 * Tracks clicks on interactive elements across the entire document.
 * Captures: tagName, innerText (truncated), href, CSS selector path,
 * and click position (clientX, clientY).
 *
 * Debounced at 200ms to prevent flooding the tracking API.
 *
 * Call this hook once in the top-level page component.
 */
export function useClickTracking(): void {
  const lastClickTime = useRef(0);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Debounce: skip if less than 200ms since last tracked click
      const now = Date.now();
      if (now - lastClickTime.current < DEBOUNCE_MS) return;

      // Find the closest interactive element from the click target
      const target = event.target as Element | null;
      if (!target) return;

      const interactive = target.closest(INTERACTIVE_SELECTOR);
      if (!interactive) return;

      lastClickTime.current = now;

      const session_id = getOrCreateSessionId();
      const visitor_id = getOrCreateVisitorId();
      const variant = getCurrentVariant();

      const tagName = interactive.tagName.toLowerCase();
      const text = truncateText(interactive.textContent ?? "", MAX_TEXT_LENGTH);
      const href = interactive instanceof HTMLAnchorElement ? interactive.href : undefined;
      const selector = buildSelectorPath(interactive);

      void postEvent({
        event_type: "click",
        session_id,
        visitor_id,
        variant,
        details: {
          selector,
          text,
          href,
          tagName,
          x: event.clientX,
          y: event.clientY,
        },
      });
    }

    document.addEventListener("click", onClick, { passive: true });

    return () => {
      document.removeEventListener("click", onClick);
    };
  }, []);
  // Empty deps: registers listener once, cleans up on unmount
}
