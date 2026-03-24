"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

const VALID_VARIANTS = ["E", "T", "K", "A", "F", "S", "M"] as const;
type Variant = (typeof VALID_VARIANTS)[number];
const VARIANT_STORAGE_KEY = "landing_variant";

function isValidVariant(v: string | null): v is Variant {
  return v !== null && VALID_VARIANTS.includes(v as Variant);
}

/**
 * Reads the landing page variant from the `?v=` query parameter,
 * falling back to localStorage for persistence across navigation.
 * Returns 'M' (default variant) if no valid variant is specified.
 */
export function useVariant(): { variant: Variant } {
  const searchParams = useSearchParams();
  const urlVariant = searchParams.get("v")?.toUpperCase() ?? null;

  // Persist URL variant to localStorage (side effect only, no state update)
  useEffect(() => {
    if (isValidVariant(urlVariant)) {
      localStorage.setItem(VARIANT_STORAGE_KEY, urlVariant);
    }
  }, [urlVariant]);

  const variant = useMemo<Variant>(() => {
    if (isValidVariant(urlVariant)) return urlVariant;

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(VARIANT_STORAGE_KEY);
      if (isValidVariant(stored)) return stored;
    }

    return "M";
  }, [urlVariant]);

  return { variant };
}
