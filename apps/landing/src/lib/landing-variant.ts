// ============================================
// landing-variant.ts
// Reactive store for switching landing page variants.
// Persists choice to localStorage, syncs all
// components via useSyncExternalStore.
// Connected to: page.tsx (renders variant), footer.tsx (switcher)
// ============================================

"use client";

import { useSyncExternalStore } from "react";

export type LandingVariant = "B" | "E" | "T" | "K" | "A" | "F" | "S";

const DEFAULT_VARIANT: LandingVariant = "B";
const STORAGE_KEY = "landing_variant";
const VALID_VARIANTS: LandingVariant[] = ["B", "E", "T", "K", "A", "F", "S"];

/** Display metadata for each variant, shown in the switcher. */
export const VARIANT_META: Record<LandingVariant, { label: string; description: string }> = {
  B: { label: "Standard", description: "Fullverdig oversikt" },
  E: { label: "Action", description: "Rett på sak" },
  T: { label: "Enterprise", description: "Data og kontroll" },
  K: { label: "Konsulent", description: "Resultater og bevis" },
  A: { label: "Inkluderende", description: "Visuelt og varmt" },
  F: { label: "Tilgjengelig", description: "Maksimal enkelhet" },
  S: { label: "Eleganse", description: "Raffinert håndverk" },
};

function isValidVariant(v: string | null | undefined): v is LandingVariant {
  return typeof v === "string" && VALID_VARIANTS.includes(v as LandingVariant);
}

/* ---------- Module-level reactive store ---------- */

let current: LandingVariant = DEFAULT_VARIANT;
const listeners = new Set<() => void>();

/**
 * Initialize from env var, then check localStorage override.
 * Env var sets the default; localStorage lets users override.
 */
if (typeof window !== "undefined") {
  const envVal = process.env.NEXT_PUBLIC_LANDING_VARIANT;
  if (isValidVariant(envVal)) {
    current = envVal;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (isValidVariant(stored)) {
    current = stored;
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): LandingVariant {
  return current;
}

function getServerSnapshot(): LandingVariant {
  const envVal = process.env.NEXT_PUBLIC_LANDING_VARIANT;
  return isValidVariant(envVal) ? envVal : DEFAULT_VARIANT;
}

/**
 * Sets the active landing variant.
 * Persists to localStorage and notifies all subscribers
 * so the page re-renders with the new variant.
 */
export function setVariant(variant: LandingVariant) {
  current = variant;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, variant);
  }
  listeners.forEach((fn) => fn());
}

/**
 * React hook to read and set the current landing variant.
 * All components using this hook stay in sync automatically.
 */
export function useVariant() {
  const variant = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { variant, setVariant } as const;
}
