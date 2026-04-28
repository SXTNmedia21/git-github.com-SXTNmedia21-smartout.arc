"use client";

// ============================================
// TourHighlight.tsx
// Absolute-positioned outline overlay + label badge for the help page tour.
// Why: provides a visible highlight ring around a targeted section anchor so
// the user can immediately see which element Emma/the tour is referring to.
// z-40 is deliberate — Sheet/Drawer uses z-50, so the overlay stays below
// any modal surface (Sheet, Combobox, Popover) that the user might have open.
// ============================================

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { resolveAnchorId } from "../_lib/tour-anchors";
import type { TourAnchor } from "../_lib/tour-anchors";

/* ━━━ Props ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface TourHighlightProps {
  targetId: TourAnchor;
  label: string;
  reducedMotion: boolean;
}

/* ━━━ Rect type ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface DOMRect2 {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 4; // px padding around the target element outline

/* ━━━ Geometry helper ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function computeRect(el: HTMLElement): DOMRect2 {
  const r = el.getBoundingClientRect();
  return {
    // Convert viewport-relative rect to document-relative (accounts for scroll).
    top: r.top + window.scrollY - PADDING,
    left: r.left + window.scrollX - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

/* ━━━ Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function TourHighlight({ targetId, label, reducedMotion }: TourHighlightProps) {
  const [rect, setRect] = useState<DOMRect2 | null>(null);
  const rafRef = useRef<number | null>(null);

  /* ── Compute + track rect ──────────────────────────────────────────── */
  const updateRect = () => {
    const elementId = resolveAnchorId(targetId);
    const el = document.getElementById(elementId);
    if (!el) return;
    setRect(computeRect(el));
  };

  // Fire synchronously before paint to avoid a one-frame flash of
  // the overlay at (0,0). SSR-safe: useLayoutEffect is skipped on server.
  useLayoutEffect(() => {
    updateRect();
  }, [targetId]);

  // Track viewport changes (scroll + resize) via rAF for performance.
  useEffect(() => {
    function onChangeEvent() {
      if (rafRef.current !== null) return; // debounce — already scheduled
      rafRef.current = requestAnimationFrame(() => {
        updateRect();
        rafRef.current = null;
      });
    }

    window.addEventListener("scroll", onChangeEvent, { passive: true });
    window.addEventListener("resize", onChangeEvent, { passive: true });

    return () => {
      window.removeEventListener("scroll", onChangeEvent);
      window.removeEventListener("resize", onChangeEvent);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [targetId]);

  if (!rect) return null;

  /* ── Animation classes ─────────────────────────────────────────────── */
  // Apply Tailwind animate-in only when the user has not requested reduced motion.
  // This is the same conditional pattern used across Nordic Split components.
  const animationClass = reducedMotion ? "" : "animate-in fade-in zoom-in-95 duration-200";

  return (
    // className `help-tour-overlay` is read by useHelpTour's document-click handler
    // to detect clicks inside the overlay (so they don't trigger cancellation).
    <div
      className={`help-tour-overlay border-primary pointer-events-none fixed z-40 rounded-md border-2 ${animationClass}`}
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
      aria-hidden="true"
    >
      {/* Label badge — top-right corner of the outline box */}
      <span
        className={
          "absolute -top-7 right-0 " +
          "bg-primary rounded-md px-2 py-0.5 " +
          "text-primary-foreground text-xs font-medium " +
          "whitespace-nowrap shadow-sm"
        }
      >
        {label}
      </span>
    </div>
  );
}
