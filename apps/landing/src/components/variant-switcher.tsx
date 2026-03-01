// ============================================
// variant-switcher.tsx
// Subtle dropdown in the footer to switch between
// landing page variants. Minimal footprint — just
// a small text trigger with a floating menu.
// Connected to: landing-variant.ts (state), footer.tsx (host)
// ============================================

"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { useVariant, VARIANT_META, type LandingVariant } from "../lib/landing-variant";

/**
 * Renders a small text link that opens a floating panel
 * with variant options. Selected variant updates immediately.
 */
export default function VariantSwitcher() {
  const { variant, setVariant } = useVariant();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /** Close on outside click. */
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const currentMeta = VARIANT_META[variant];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-zinc-600 transition-colors hover:text-zinc-400"
        aria-label="Bytt variant"
      >
        <span className="text-sm">{currentMeta.label}</span>
        <ChevronUp className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 min-w-[160px] overflow-hidden rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl backdrop-blur-xl">
          {(
            Object.entries(VARIANT_META) as [
              LandingVariant,
              { label: string; description: string },
            ][]
          ).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => {
                setVariant(key);
                setOpen(false);
              }}
              className={`flex w-full flex-col px-3 py-2 text-left transition-colors ${
                variant === key
                  ? "bg-white/5 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-sm font-medium">{meta.label}</span>
              <span className="text-xs text-zinc-500">{meta.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
