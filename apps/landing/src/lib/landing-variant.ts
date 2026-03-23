"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const VALID_VARIANTS = ["E", "T", "K", "A", "F", "S", "M"] as const;
type Variant = (typeof VALID_VARIANTS)[number];
const VARIANT_STORAGE_KEY = "landing_variant";

/**
 * Reads the landing page variant from the `?v=` query parameter,
 * falling back to localStorage for persistence across navigation.
 * Returns 'M' (default variant) if no valid variant is specified.
 */
export function useVariant(): { variant: Variant } {
  const searchParams = useSearchParams();
  const urlVariant = searchParams.get("v")?.toUpperCase() ?? null;
  const [variant, setVariant] = useState<Variant>("M");

  useEffect(() => {
    if (urlVariant && VALID_VARIANTS.includes(urlVariant as Variant)) {
      localStorage.setItem(VARIANT_STORAGE_KEY, urlVariant);
      setVariant(urlVariant as Variant);
      return;
    }

    const storedVariant = localStorage.getItem(VARIANT_STORAGE_KEY);
    if (storedVariant && VALID_VARIANTS.includes(storedVariant as Variant)) {
      setVariant(storedVariant as Variant);
    }
  }, [urlVariant]);

  if (urlVariant && VALID_VARIANTS.includes(urlVariant as Variant)) {
    return { variant: urlVariant as Variant };
  }

  return { variant };
}
