"use client";

import { useSearchParams } from "next/navigation";

const VALID_VARIANTS = ["E", "T", "K", "A", "F", "S"] as const;
type Variant = (typeof VALID_VARIANTS)[number] | null;

/**
 * Reads the landing page variant from the `?v=` query parameter.
 * Returns null (default variant) if no valid variant is specified.
 */
export function useVariant(): { variant: Variant } {
  const searchParams = useSearchParams();
  const v = searchParams.get("v")?.toUpperCase() ?? null;

  if (v && VALID_VARIANTS.includes(v as (typeof VALID_VARIANTS)[number])) {
    return { variant: v as Variant };
  }

  return { variant: null };
}
