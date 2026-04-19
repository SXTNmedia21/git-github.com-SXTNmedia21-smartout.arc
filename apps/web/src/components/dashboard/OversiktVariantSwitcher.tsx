"use client";

// OversiktVariantSwitcher — tab-menu that lets Pontus flip between the live
// React `OversiktView` and the static HTML mockups served from /design-mockups/.
// Selection persists in localStorage so the choice survives reloads.
//
// TODO after variant decision is made: remove this switcher and wire the
// winning variant directly into dashboard/page.tsx.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const OversiktView = dynamic(() => import("./OversiktView"), { ssr: false });

type Variant = {
  id: string;
  label: string;
  description: string;
  kind: "react" | "iframe";
  src?: string;
};

const DEFAULT_VARIANT: Variant = {
  id: "current",
  label: "Live (React)",
  description: "OversiktView — action-drevet, Nordic Split",
  kind: "react",
};

const VARIANTS: readonly [Variant, ...Variant[]] = [
  DEFAULT_VARIANT,
  {
    id: "mockup-v1",
    label: "Mockup v1",
    description: "Første statisk designforslag",
    kind: "iframe",
    src: "/design-mockups/dashboard-overview-mockup.html",
  },
  {
    id: "mockup-v2",
    label: "Mockup v2",
    description: "Interaktiv v3 prototype",
    kind: "iframe",
    src: "/design-mockups/dashboard-overview-mockup-v2.html",
  },
  {
    id: "pipeline",
    label: "Pipeline A/B/C",
    description: "Tre alternative pipeline-layout",
    kind: "iframe",
    src: "/design-mockups/dashboard-pipeline-variants.html",
  },
];

const STORAGE_KEY = "smartout:dashboard-oversikt-variant";
const DEFAULT_ID = DEFAULT_VARIANT.id;

export default function OversiktVariantSwitcher() {
  const [activeId, setActiveId] = useState<string>(DEFAULT_ID);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored && VARIANTS.some((v) => v.id === stored)) {
      setActiveId(stored);
    }
  }, []);

  function selectVariant(id: string) {
    setActiveId(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }

  const active: Variant = VARIANTS.find((v) => v.id === activeId) ?? DEFAULT_VARIANT;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Variant tab bar */}
      <div className="border-border/60 bg-background/60 supports-[backdrop-filter]:bg-background/40 flex flex-shrink-0 items-center gap-1 border-b px-4 py-2 backdrop-blur-xl">
        <span className="text-muted-foreground mr-3 text-[10px] font-bold tracking-widest uppercase">
          Variant
        </span>
        <div className="flex flex-wrap gap-1">
          {VARIANTS.map((v) => {
            const isActive = v.id === active.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => selectVariant(v.id)}
                aria-pressed={isActive}
                title={v.description}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto hidden text-xs md:block">
          <span className="text-muted-foreground">{active.description}</span>
        </div>
      </div>

      {/* Variant content */}
      <div className="relative min-h-0 flex-1">
        {!mounted ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Laster…
          </div>
        ) : active.kind === "react" ? (
          <OversiktView />
        ) : (
          <iframe
            key={active.id}
            src={active.src}
            title={active.label}
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
}
