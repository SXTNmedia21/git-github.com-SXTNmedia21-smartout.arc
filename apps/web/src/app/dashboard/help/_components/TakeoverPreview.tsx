"use client";

// ============================================
// TakeoverPreview.tsx
// Modal overlay rendered when Botsson proposes a page-takeover action.
// Per M3.2 spec + ADR-0228:
//   - Mandatory preview: NO action fires without showing this first
//   - Confirm button DISABLED until minPreviewMs elapses (default 3000)
//     to prevent reflexive confirm-clicks
//   - ESC + off-target click cancel
//   - z-50 (above Sheet/Drawer) — this is the most important UI on screen
//   - Outline draws around resolved DOM target so user sees what's about to happen
// ============================================

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TakeoverPreviewProps {
  selector: string;
  label: string;
  minPreviewMs?: number;
  onConfirm: () => void;
  onCancel: (trigger: "esc" | "off_target_click") => void;
  reducedMotion?: boolean;
}

interface DOMRect2 {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 4;

function computeRect(el: HTMLElement): DOMRect2 {
  const r = el.getBoundingClientRect();
  return {
    top: r.top + window.scrollY - PADDING,
    left: r.left + window.scrollX - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

export function TakeoverPreview({
  selector,
  label,
  minPreviewMs = 3000,
  onConfirm,
  onCancel,
  reducedMotion = false,
}: TakeoverPreviewProps) {
  const [rect, setRect] = useState<DOMRect2 | null>(null);
  const [confirmEnabledAt, setConfirmEnabledAt] = useState<number>(Date.now() + minPreviewMs);
  const [now, setNow] = useState<number>(Date.now());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  // Resolve target on mount + whenever selector changes
  useLayoutEffect(() => {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      targetRef.current = el;
      setRect(computeRect(el));
    }
    setConfirmEnabledAt(Date.now() + minPreviewMs);
  }, [selector, minPreviewMs]);

  // Recompute rect on scroll/resize
  useEffect(() => {
    const update = () => {
      if (targetRef.current) setRect(computeRect(targetRef.current));
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Tick once per 100ms to enable confirm button after minPreviewMs
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  // ESC keydown cancels
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel("esc");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  // Off-target click cancels (anything outside overlay + target)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (overlayRef.current?.contains(t)) return;
      if (targetRef.current?.contains(t)) return;
      onCancel("off_target_click");
    };
    // Use capture so we beat any other handlers
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [onCancel]);

  if (!rect) return null;

  const remaining = Math.max(0, confirmEnabledAt - now);
  const canConfirm = remaining === 0;
  const animationClass = reducedMotion
    ? ""
    : "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200";

  return (
    <div ref={overlayRef} className={`page-takeover-overlay ${animationClass}`}>
      {/* Body-blocking scrim (semi-transparent) at z-49 — preview chip + outline at z-50 */}
      <div aria-hidden className="bg-background/60 fixed inset-0 z-[49] backdrop-blur-[2px]" />

      {/* Outline around resolved target */}
      <div
        aria-hidden
        className="border-warning ring-warning/30 pointer-events-none absolute z-[50] rounded-md border-2 ring-4"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />

      {/* Confirm chip — fixed at bottom center, above scrim */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bekreft page-takeover handling"
        className="border-warning bg-card fixed bottom-6 left-1/2 z-[50] flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-3 shadow-lg"
      >
        <AlertTriangle className="text-warning h-5 w-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">ESC for å avbryte</p>
        </div>
        <Button size="sm" variant="default" onClick={onConfirm} disabled={!canConfirm}>
          {canConfirm ? "Klikk for å bekrefte" : `Vent ${Math.ceil(remaining / 1000)}s`}
        </Button>
      </div>
    </div>
  );
}
